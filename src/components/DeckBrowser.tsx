import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { SupplementaryFile } from '../types';
import {
  X, Search, FileText, Presentation, Folder, ChevronRight,
  ArrowUpDown, Check, CornerDownLeft, FileType2
} from 'lucide-react';

/**
 * Full-window browser for the slide library.
 *
 * The switcher was a 384px dropdown holding a flat scroll of every deck. That
 * is fine for a dozen and useless at 156, where a single folder contributed 73
 * — you cannot find anything by scrolling a list that long through a keyhole.
 * This is the problem-list pattern: a folder rail on the left that doubles as a
 * map of how the material is actually structured, and a filtered, sorted,
 * searchable table on the right that always says how much it is showing.
 */

interface Props {
  decks: SupplementaryFile[];
  currentDeckId?: string | null;
  onSelect: (deck: SupplementaryFile) => void;
  onClose: () => void;
}

type SortKey = 'name' | 'size' | 'type';

const PPTX = new Set(['pptx', 'ppt', 'pptm']);
const WORD = new Set(['docx', 'doc']);
const isSlides = (d: SupplementaryFile) => PPTX.has(String(d.type).toLowerCase());
const isWord = (d: SupplementaryFile) => WORD.has(String(d.type).toLowerCase());

const sizeOf = (d: any): number => d.fileSizeBytes ?? d.sizeBytes ?? 0;

const prettySize = (bytes: number) => {
  if (!bytes) return '—';
  return bytes >= 1024 * 1024
    ? `${(bytes / 1024 / 1024).toFixed(1)} MB`
    : `${Math.max(1, Math.round(bytes / 1024))} KB`;
};

/**
 * The folder path a deck actually came from. A deck carries its group either
 * pre-joined as "Parent › Child" or split across courseName and moduleName
 * depending on how it was indexed, so both are folded into one segment list —
 * otherwise the rail shows only top-level folders and the nesting is lost.
 */
const deckPath = (d: SupplementaryFile): string[] => {
  const segs = String(d.courseName || 'Other material')
    .split('›').map(x => x.trim()).filter(Boolean);
  const mod = String((d as any).moduleName || '').trim();
  if (mod && mod !== segs[segs.length - 1]) segs.push(mod);
  return segs.length ? segs : ['Other material'];
};

const SEP = ' › ';
const splitGroup = (d: SupplementaryFile) => {
  const segs = deckPath(d);
  return { top: segs[0], sub: segs.slice(1).join(SEP) };
};

export const DeckBrowser: React.FC<Props> = ({ decks, currentDeckId, onSelect, onClose }) => {
  const [query, setQuery] = useState('');
  const [scope, setScope] = useState<string>('__all__');
  const [kind, setKind] = useState<'all' | 'pdf' | 'slides' | 'word'>('all');
  const [sort, setSort] = useState<SortKey>('name');
  const [cursor, setCursor] = useState(0);

  const searchRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => { searchRef.current?.focus(); }, []);

  // The rail is built from the real folder names, so it shows the shape of the
  // library rather than a flat alphabetical dump.
  const tree = useMemo(() => {
    const top = new Map<string, { count: number; subs: Map<string, number> }>();
    for (const d of decks) {
      const { top: t, sub } = splitGroup(d);
      if (!top.has(t)) top.set(t, { count: 0, subs: new Map() });
      const node = top.get(t)!;
      node.count++;
      if (sub) node.subs.set(sub, (node.subs.get(sub) || 0) + 1);
    }
    return [...top.entries()].sort((a, b) => b[1].count - a[1].count);
  }, [decks]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    let out = decks.filter(d => {
      if (kind === 'pdf' && (isSlides(d) || isWord(d))) return false;
      if (kind === 'slides' && !isSlides(d)) return false;
      if (kind === 'word' && !isWord(d)) return false;
      if (scope !== '__all__') {
        // A parent scope keeps everything nested under it.
        const full = deckPath(d).join(SEP);
        if (full !== scope && !full.startsWith(scope + SEP)) return false;
      }
      if (!q) return true;
      return (
        d.title.toLowerCase().includes(q) ||
        (d.courseName || '').toLowerCase().includes(q) ||
        ((d as any).moduleName || '').toLowerCase().includes(q) ||
        (d.filename || '').toLowerCase().includes(q)
      );
    });

    out = [...out].sort((a, b) => {
      if (sort === 'size') return sizeOf(b) - sizeOf(a);
      if (sort === 'type') {
        const t = String(a.type).localeCompare(String(b.type));
        if (t !== 0) return t;
      }
      return a.title.localeCompare(b.title, undefined, { numeric: true, sensitivity: 'base' });
    });
    return out;
  }, [decks, query, scope, kind, sort]);

  useEffect(() => { setCursor(0); }, [query, scope, kind, sort]);

  // Keyboard: the list is long, so it has to be drivable without the mouse.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { onClose(); return; }
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        setCursor(c => {
          const next = e.key === 'ArrowDown'
            ? Math.min(c + 1, visible.length - 1)
            : Math.max(c - 1, 0);
          listRef.current?.querySelectorAll('[data-row]')[next]
            ?.scrollIntoView({ block: 'nearest' });
          return next;
        });
      }
      if (e.key === 'Enter' && visible[cursor]) {
        e.preventDefault();
        onSelect(visible[cursor]);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [visible, cursor, onSelect, onClose]);

  const railButton = (label: string, value: string, count: number, nested = false) => {
    const active = scope === value;
    return (
      <button
        key={value}
        onClick={() => setScope(value)}
        className={`w-full flex items-center gap-2 rounded-lg text-left transition-colors ${
          nested ? 'pl-7 pr-2.5 py-1.5' : 'px-2.5 py-2'
        } ${
          active
            ? 'bg-zinc-900 dark:bg-white text-white dark:text-zinc-950'
            : 'text-zinc-700 dark:text-zinc-300 hover:bg-black/[0.04] dark:hover:bg-white/[0.06]'
        }`}
      >
        {!nested && (
          <Folder className={`w-3.5 h-3.5 flex-shrink-0 ${active ? '' : 'text-zinc-500 dark:text-zinc-400'}`} strokeWidth={1.5} />
        )}
        <span className={`truncate min-w-0 flex-1 ${nested ? 'text-[11.5px]' : 'text-[12px] font-semibold'}`} title={label}>
          {label}
        </span>
        <span className={`text-[10px] font-mono tabular-nums flex-shrink-0 ${
          active ? 'opacity-80' : 'text-zinc-600 dark:text-zinc-400'
        }`}>
          {count}
        </span>
      </button>
    );
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Browse slides and PDFs"
    >
      <div className="fixed inset-0 bg-black/70 backdrop-blur-md" onClick={onClose} />

      <div className="relative w-full max-w-5xl h-[86vh] p-1.5 rounded-[2rem] bg-black/[0.05] dark:bg-white/[0.05] border border-black/[0.08] dark:border-white/10 shadow-[0_25px_60px_rgba(0,0,0,0.35)] z-10">
        <div className="h-full rounded-[calc(2rem-0.375rem)] bg-white dark:bg-[#111218] border border-black/[0.05] dark:border-white/[0.08] overflow-hidden flex flex-col">

          <div className="flex items-center gap-3 p-4 border-b border-black/[0.06] dark:border-white/[0.08] flex-shrink-0">
            <div className="relative flex-1 min-w-0">
              <Search className="w-4 h-4 text-zinc-500 dark:text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" strokeWidth={1.5} />
              <input
                ref={searchRef}
                id="deck-browser-search"
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder={`Search ${decks.length} documents by name or folder...`}
                className="w-full bg-black/[0.03] dark:bg-white/[0.05] border border-black/[0.06] dark:border-white/10 rounded-full pl-9 pr-3 py-2.5 text-[13px] text-zinc-900 dark:text-white placeholder-zinc-500 dark:placeholder-zinc-400 focus:outline-none focus:border-indigo-500 focus-visible:ring-2 focus-visible:ring-indigo-500/40"
              />
            </div>
            <button
              onClick={onClose}
              aria-label="Close"
              className="w-8 h-8 rounded-full flex items-center justify-center text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-black/[0.05] dark:hover:bg-white/10 transition-colors flex-shrink-0"
            >
              <X className="w-4 h-4" strokeWidth={1.5} />
            </button>
          </div>

          <div className="flex-1 flex min-h-0">
            {/* Folder rail — also the map of how the library is organised */}
            <aside className="w-56 sm:w-64 border-r border-black/[0.06] dark:border-white/[0.08] overflow-y-auto p-2.5 space-y-1 flex-shrink-0 hidden sm:block">
              <p className="px-2.5 pb-1.5 pt-1 text-[10px] font-mono uppercase tracking-[0.15em] text-zinc-600 dark:text-zinc-400">
                Folders
              </p>
              {railButton(`All material`, '__all__', decks.length)}
              {tree.map(([top, node]) => (
                <React.Fragment key={top}>
                  {railButton(top, top, node.count)}
                  {[...node.subs.entries()].sort((a, b) => b[1] - a[1]).map(([sub, n]) =>
                    railButton(sub, `${top} › ${sub}`, n, true)
                  )}
                </React.Fragment>
              ))}
            </aside>

            <div className="flex-1 flex flex-col min-w-0">
              <div className="flex items-center gap-2 px-4 py-2.5 border-b border-black/[0.06] dark:border-white/[0.08] flex-shrink-0 flex-wrap">
                {([['all', 'All'], ['pdf', 'PDF'], ['slides', 'Slides'], ['word', 'Word']] as const).map(([v, label]) => (
                  <button
                    key={v}
                    id={`deck-filter-${v}`}
                    onClick={() => setKind(v)}
                    className={`px-3 py-1 rounded-full text-[11px] font-semibold transition-colors ${
                      kind === v
                        ? 'bg-zinc-900 dark:bg-white text-white dark:text-zinc-950'
                        : 'bg-black/[0.03] dark:bg-white/[0.05] text-zinc-700 dark:text-zinc-300 hover:bg-black/[0.06] dark:hover:bg-white/[0.09]'
                    }`}
                  >
                    {label}
                  </button>
                ))}

                <button
                  id="deck-sort-btn"
                  onClick={() => setSort(s => (s === 'name' ? 'size' : s === 'size' ? 'type' : 'name'))}
                  className="flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-medium bg-black/[0.03] dark:bg-white/[0.05] text-zinc-700 dark:text-zinc-300 hover:bg-black/[0.06] dark:hover:bg-white/[0.09] transition-colors"
                >
                  <ArrowUpDown className="w-3 h-3" strokeWidth={1.75} />
                  {sort === 'name' ? 'Name' : sort === 'size' ? 'Largest' : 'Type'}
                </button>

                <span className="ml-auto text-[11px] font-mono tabular-nums text-zinc-600 dark:text-zinc-400">
                  {visible.length} of {decks.length}
                </span>
              </div>

              <div ref={listRef} className="flex-1 overflow-y-auto p-2">
                {visible.length === 0 ? (
                  <p className="px-3 py-10 text-center text-[12.5px] text-zinc-600 dark:text-zinc-400">
                    Nothing here matches {query ? `“${query}”` : 'those filters'}.
                  </p>
                ) : visible.map((deck, i) => {
                  const selected = currentDeckId === deck.id;
                  const onCursor = i === cursor;
                  const slides = isSlides(deck);
                  const word = isWord(deck);
                  const [top, ...rest] = deckPath(deck);
                  const sub = rest.join(SEP);
                  return (
                    <button
                      key={deck.id}
                      data-row
                      onMouseEnter={() => setCursor(i)}
                      onClick={() => onSelect(deck)}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-colors ${
                        selected
                          ? 'bg-zinc-900 dark:bg-white text-white dark:text-zinc-950'
                          : onCursor
                            ? 'bg-black/[0.05] dark:bg-white/[0.07] text-zinc-900 dark:text-white'
                            : 'text-zinc-800 dark:text-zinc-200 hover:bg-black/[0.04] dark:hover:bg-white/[0.06]'
                      }`}
                    >
                      {slides ? (
                        <Presentation className={`w-4 h-4 flex-shrink-0 ${selected ? '' : 'text-amber-600 dark:text-amber-500'}`} strokeWidth={1.5} />
                      ) : word ? (
                        <FileType2 className={`w-4 h-4 flex-shrink-0 ${selected ? '' : 'text-sky-600 dark:text-sky-400'}`} strokeWidth={1.5} />
                      ) : (
                        <FileText className={`w-4 h-4 flex-shrink-0 ${selected ? '' : 'text-indigo-600 dark:text-indigo-400'}`} strokeWidth={1.5} />
                      )}

                      <span className="flex-1 min-w-0">
                        <span className="block truncate text-[13px] font-semibold" title={deck.title}>
                          {deck.title}
                        </span>
                        <span className={`flex items-center gap-1 text-[10.5px] font-mono truncate ${
                          selected ? 'opacity-75' : 'text-zinc-600 dark:text-zinc-400'
                        }`}>
                          <span className="truncate">{top}</span>
                          {sub && (<><ChevronRight className="w-2.5 h-2.5 flex-shrink-0" /><span className="truncate">{sub}</span></>)}
                        </span>
                      </span>

                      <span className={`text-[10px] font-mono uppercase px-2 py-0.5 rounded-full flex-shrink-0 ${
                        selected ? 'bg-white/20 dark:bg-black/15' : 'bg-black/[0.04] dark:bg-white/[0.07] text-zinc-700 dark:text-zinc-300'
                      }`}>
                        {String(deck.type).toUpperCase()}
                      </span>
                      <span className={`hidden sm:block w-16 text-right text-[10.5px] font-mono tabular-nums flex-shrink-0 ${
                        selected ? 'opacity-75' : 'text-zinc-600 dark:text-zinc-400'
                      }`}>
                        {prettySize(sizeOf(deck))}
                      </span>
                      {selected && <Check className="w-4 h-4 flex-shrink-0" strokeWidth={2} />}
                    </button>
                  );
                })}
              </div>

              <div className="px-4 py-2 border-t border-black/[0.06] dark:border-white/[0.08] flex items-center gap-4 text-[10.5px] font-mono text-zinc-600 dark:text-zinc-400 flex-shrink-0">
                <span className="flex items-center gap-1.5"><CornerDownLeft className="w-3 h-3" strokeWidth={1.5} /> open</span>
                <span>↑↓ move</span>
                <span>esc close</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

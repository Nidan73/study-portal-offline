import React, { useEffect, useRef, useState } from 'react';
import { useStore } from '../store/useStore';
import { X, Plus, Trash2, Download, Search, NotebookPen, Check } from 'lucide-react';

/**
 * General notepad.
 *
 * The lecture notes panel needs an active lesson — it renders "Select a lecture"
 * otherwise — so there was nowhere to jot anything down while browsing the
 * library, searching YouTube, or with nothing playing at all. This is that
 * place: notes with no lesson, course, or timestamp attached, opened with
 * Ctrl+Shift+N from anywhere.
 */
export const Scratchpad: React.FC = () => {
  const isOpen = useStore(s => s.isScratchpadOpen);
  const setOpen = useStore(s => s.setScratchpadOpen);
  const notes = useStore(s => s.scratchNotes);
  const saveNote = useStore(s => s.saveScratchNote);
  const removeNote = useStore(s => s.removeScratchNote);

  const [draft, setDraft] = useState('');
  const [query, setQuery] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [savedFlash, setSavedFlash] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Ctrl/Cmd+Shift+N from anywhere, Escape to close.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'n') {
        e.preventDefault();
        setOpen(!isOpen);
        return;
      }
      if (e.key === 'Escape' && isOpen) setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, setOpen]);

  useEffect(() => {
    if (isOpen) setTimeout(() => textareaRef.current?.focus(), 60);
  }, [isOpen]);

  if (!isOpen) return null;

  const submit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const text = draft.trim();
    if (!text) return;
    await saveNote(text, editingId ?? undefined);
    setDraft('');
    setEditingId(null);
    setSavedFlash(true);
    setTimeout(() => setSavedFlash(false), 1600);
    textareaRef.current?.focus();
  };

  const download = () => {
    if (!notes.length) return;
    const md = `# Notepad\n\n` + notes
      .map(n => `- ${n.content}\n  _${new Date(n.createdAt).toLocaleString()}_`)
      .join('\n\n');
    const url = URL.createObjectURL(new Blob([md], { type: 'text/markdown;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = 'studyhub-notepad.md';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const q = query.trim().toLowerCase();
  const visible = q ? notes.filter(n => n.content.toLowerCase().includes(q)) : notes;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 select-none" role="dialog" aria-modal="true" aria-label="Notepad">
      <div className="fixed inset-0 bg-black/70 backdrop-blur-md motion-safe:animate-in motion-safe:fade-in motion-safe:duration-200" onClick={() => setOpen(false)} />

      <div className="relative w-full max-w-2xl p-1.5 rounded-[2rem] bg-black/[0.05] dark:bg-white/[0.05] border border-black/[0.08] dark:border-white/10 shadow-[0_25px_60px_rgba(0,0,0,0.3)] dark:shadow-[0_25px_60px_rgba(0,0,0,0.8)] z-10 motion-safe:animate-in motion-safe:fade-in motion-safe:zoom-in-95 motion-safe:duration-200">
        <div className="rounded-[calc(2rem-0.375rem)] bg-white/95 dark:bg-[#111218]/95 backdrop-blur-2xl border border-black/[0.05] dark:border-white/[0.08] overflow-hidden flex flex-col max-h-[85vh]">

          <div className="flex items-center justify-between p-5 border-b border-black/[0.06] dark:border-white/[0.08] bg-black/[0.01] dark:bg-white/[0.02] flex-shrink-0">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-8 h-8 rounded-full bg-zinc-900 dark:bg-white text-white dark:text-zinc-950 flex items-center justify-center flex-shrink-0">
                <NotebookPen className="w-4 h-4" strokeWidth={1.5} />
              </div>
              <div className="min-w-0">
                <h3 className="text-[14px] font-bold tracking-tight text-zinc-900 dark:text-white">Notepad</h3>
                <p className="text-[11px] font-mono text-zinc-500 dark:text-zinc-400 truncate">
                  Not tied to any lecture — always available
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1.5 flex-shrink-0">
              {notes.length > 0 && (
                <button
                  onClick={download}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-black/[0.03] hover:bg-black/[0.06] dark:bg-white/[0.05] dark:hover:bg-white/10 border border-black/[0.05] dark:border-white/[0.08] text-zinc-700 dark:text-zinc-200 text-[11px] font-medium transition-colors"
                  title="Save the notepad as a .md file"
                >
                  <Download className="w-3.5 h-3.5" strokeWidth={1.5} />
                  <span className="font-mono hidden sm:inline">Save</span>
                </button>
              )}
              <button
                onClick={() => setOpen(false)}
                aria-label="Close notepad"
                className="w-7 h-7 rounded-full flex items-center justify-center text-zinc-500 hover:text-zinc-700 dark:hover:text-white hover:bg-black/[0.04] dark:hover:bg-white/10 transition-colors"
              >
                <X className="w-4 h-4" strokeWidth={1.5} />
              </button>
            </div>
          </div>

          <form onSubmit={submit} className="p-4 border-b border-black/[0.06] dark:border-white/[0.08] space-y-2.5 flex-shrink-0">
            <textarea
              ref={textareaRef}
              value={draft}
              onChange={e => setDraft(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); submit(); } }}
              rows={3}
              placeholder="Anything you want to remember… (Ctrl+Enter to save)"
              className="w-full bg-black/[0.02] dark:bg-white/[0.03] border border-black/[0.05] dark:border-white/10 rounded-2xl p-3 text-[13px] text-zinc-900 dark:text-white placeholder-zinc-500 dark:placeholder-zinc-400 focus:outline-none focus:border-indigo-500 focus-visible:ring-2 focus-visible:ring-indigo-500/40 resize-none transition-colors"
            />
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono text-zinc-500 dark:text-zinc-400">
                {editingId ? 'Editing an existing note' : savedFlash ? 'Saved' : `${notes.length} note${notes.length === 1 ? '' : 's'}`}
              </span>
              <div className="flex items-center gap-2">
                {editingId && (
                  <button
                    type="button"
                    onClick={() => { setEditingId(null); setDraft(''); }}
                    className="px-3 py-1.5 rounded-full bg-black/[0.03] hover:bg-black/[0.06] dark:bg-white/[0.05] dark:hover:bg-white/10 text-zinc-700 dark:text-zinc-300 text-[11px] font-medium transition-colors"
                  >
                    Cancel
                  </button>
                )}
                <button
                  type="submit"
                  disabled={!draft.trim()}
                  className="flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-zinc-900 dark:bg-white disabled:opacity-30 text-white dark:text-zinc-950 text-[11px] font-semibold transition-all duration-200 ease-fluid shadow-sm"
                >
                  <span>{editingId ? 'Update' : 'Add note'}</span>
                  <span className="w-4 h-4 rounded-full bg-white/20 dark:bg-black/10 flex items-center justify-center">
                    {savedFlash ? <Check className="w-2.5 h-2.5" strokeWidth={2.5} /> : <Plus className="w-3 h-3" strokeWidth={2} />}
                  </span>
                </button>
              </div>
            </div>
          </form>

          {notes.length > 2 && (
            <div className="px-4 pt-3 flex-shrink-0">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-zinc-500 dark:text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" strokeWidth={1.5} />
                <input
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  placeholder={`Search ${notes.length} notes...`}
                  className="w-full bg-black/[0.02] dark:bg-white/[0.03] border border-black/[0.05] dark:border-white/10 rounded-full pl-9 pr-3 py-2 text-[12px] text-zinc-900 dark:text-white placeholder-zinc-500 dark:placeholder-zinc-400 focus:outline-none focus:border-indigo-500 focus-visible:ring-2 focus-visible:ring-indigo-500/40 transition-colors"
                />
              </div>
            </div>
          )}

          <div className="flex-1 overflow-y-auto p-4 space-y-2 min-h-[120px]" role="region" aria-live="polite" aria-label="Saved notepad entries">
            {notes.length === 0 ? (
              <div className="text-center py-10 text-zinc-500 dark:text-zinc-400 text-[13px]">
                <p>Nothing here yet.</p>
                <p className="text-[11px] font-mono mt-1">Open this from anywhere with Ctrl+Shift+N.</p>
              </div>
            ) : visible.length === 0 ? (
              <div className="text-center py-10 text-zinc-500 dark:text-zinc-400 text-[13px]">
                <p>No notes match &ldquo;{query}&rdquo;.</p>
              </div>
            ) : (
              visible.map(n => (
                <div
                  key={n.id}
                  className="p-3 rounded-2xl bg-black/[0.02] dark:bg-white/[0.02] border border-black/[0.04] dark:border-white/[0.06] group"
                >
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-[12.5px] leading-relaxed text-zinc-800 dark:text-zinc-200 whitespace-pre-wrap select-text flex-1 min-w-0">
                      {n.content}
                    </p>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button
                        onClick={() => { setEditingId(n.id); setDraft(n.content); textareaRef.current?.focus(); }}
                        className="px-2 py-1 rounded-lg text-[10px] font-mono text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-black/[0.05] dark:hover:bg-white/10 transition-colors"
                        title="Edit this note"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => removeNote(n.id)}
                        aria-label="Delete this note"
                        className="p-1.5 rounded-lg text-zinc-500 dark:text-zinc-400 hover:text-rose-500 hover:bg-rose-500/10 transition-colors"
                        title="Delete this note"
                      >
                        <Trash2 className="w-3 h-3" strokeWidth={1.5} />
                      </button>
                    </div>
                  </div>
                  <span className="block text-[10px] font-mono text-zinc-500 dark:text-zinc-400 mt-1.5">
                    {new Date(n.updatedAt).toLocaleString()}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

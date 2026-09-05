import React, { useState, useEffect } from 'react';
import { useStore } from '../store/useStore';
import {
  FolderPlus,
  X,
  AlertCircle,
  ArrowRight,
  Radar,
  HardDrive,
  Home,
  Loader2,
  Check,
  FileText,
  Film
} from 'lucide-react';

interface ScanRoot {
  path: string;
  label: string;
  kind: 'drive' | 'home';
}

interface Candidate {
  path: string;
  name: string;
  videoCount: number;
  docCount: number;
  totalBytes: number;
  likelyCourse: boolean;
  reason: string;
  alreadyAdded: boolean;
}

const formatSize = (bytes: number) => {
  if (bytes >= 1e9) return `${(bytes / 1e9).toFixed(1)} GB`;
  if (bytes >= 1e6) return `${Math.round(bytes / 1e6)} MB`;
  return `${Math.round(bytes / 1e3)} KB`;
};

export const AddCourseModal: React.FC = () => {
  const { isAddCourseModalOpen, setAddCourseModal, addCustomCourse } = useStore();

  const [mode, setMode] = useState<'scan' | 'manual'>('scan');

  // Manual entry
  const [folderPath, setFolderPath] = useState('');
  const [courseName, setCourseName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Scan
  const [roots, setRoots] = useState<ScanRoot[]>([]);
  const [scanPath, setScanPath] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  const [candidates, setCandidates] = useState<Candidate[] | null>(null);
  const [scanMeta, setScanMeta] = useState<{ elapsedMs: number; truncated: boolean } | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [addingCount, setAddingCount] = useState(0);

  // Escape closes this the way it closes CommandPalette and ShortcutModal.
  useEffect(() => {
    if (!isAddCourseModalOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setAddCourseModal(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isAddCourseModalOpen, setAddCourseModal]);

  useEffect(() => {
    if (!isAddCourseModalOpen) return;
    fetch('/api/scan/roots')
      .then(r => r.json())
      .then(d => {
        setRoots(d.roots || []);
        if (!scanPath && d.roots?.length) setScanPath(d.roots[0].path);
      })
      .catch(() => {});
  }, [isAddCourseModalOpen]);

  if (!isAddCourseModalOpen) return null;

  const runScan = async (target?: string) => {
    const root = (target ?? scanPath).trim();
    if (!root) return;
    setIsScanning(true);
    setError(null);
    setCandidates(null);
    setSelected(new Set());
    try {
      const res = await fetch('/api/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rootPath: root, timeoutMs: 45000 })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Scan failed');
      setCandidates(data.candidates || []);
      setScanMeta({ elapsedMs: data.elapsedMs, truncated: data.truncated });
    } catch (err: any) {
      setError(err.message || 'Could not scan that location');
    } finally {
      setIsScanning(false);
    }
  };

  const toggle = (p: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(p)) next.delete(p); else next.add(p);
      return next;
    });
  };

  const addSelected = async () => {
    if (!candidates) return;
    const picks = candidates.filter(c => selected.has(c.path));
    if (!picks.length) return;
    setAddingCount(picks.length);
    let added = 0;
    for (const c of picks) {
      const ok = await addCustomCourse(c.path, c.name);
      if (ok) added++;
    }
    setAddingCount(0);
    if (added === picks.length) {
      setAddCourseModal(false);
    } else {
      setError(`Added ${added} of ${picks.length}. The rest could not be indexed.`);
      runScan();
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!folderPath.trim()) return;
    setIsSubmitting(true);
    setError(null);
    const success = await addCustomCourse(folderPath.trim(), courseName.trim() || undefined);
    setIsSubmitting(false);
    if (success) {
      setAddCourseModal(false);
      setFolderPath('');
      setCourseName('');
    } else {
      setError('Folder path could not be located. Please ensure the full absolute path is correct.');
    }
  };

  const selectable = (candidates || []).filter(c => !c.alreadyAdded);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 select-none" role="dialog" aria-modal="true" aria-label="Add courses">
      <div
        className="fixed inset-0 bg-black/70 backdrop-blur-md animate-in fade-in duration-200"
        onClick={() => setAddCourseModal(false)}
      />

      <div className="relative w-full max-w-2xl p-1.5 rounded-[2rem] bg-black/[0.05] dark:bg-white/[0.05] border border-black/[0.08] dark:border-white/10 shadow-[0_25px_60px_rgba(0,0,0,0.3)] dark:shadow-[0_25px_60px_rgba(0,0,0,0.8)] z-10 animate-in fade-in zoom-in-95 duration-200">
        <div className="rounded-[calc(2rem-0.375rem)] bg-white/95 dark:bg-[#111218]/95 backdrop-blur-2xl border border-black/[0.05] dark:border-white/[0.08] shadow-[inset_0_1px_1px_rgba(255,255,255,0.15)] dark:shadow-[inset_0_1px_1px_rgba(255,255,255,0.06)] overflow-hidden flex flex-col max-h-[85vh]">

          {/* Header */}
          <div className="flex items-center justify-between p-5 border-b border-black/[0.06] dark:border-white/[0.08] bg-black/[0.01] dark:bg-white/[0.02] flex-shrink-0">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-8 h-8 rounded-full bg-zinc-900 dark:bg-white text-white dark:text-zinc-950 flex items-center justify-center shadow-sm flex-shrink-0">
                <FolderPlus className="w-4 h-4" strokeWidth={1.5} />
              </div>
              <div className="min-w-0">
                <h3 className="text-[14px] font-bold tracking-tight text-zinc-900 dark:text-white">Add Courses</h3>
                <p className="text-[11px] font-mono text-zinc-500 dark:text-zinc-400 truncate">Scan a drive, or point at one folder</p>
              </div>
            </div>
            <button
              onClick={() => setAddCourseModal(false)}
              className="w-7 h-7 rounded-full flex items-center justify-center text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-white hover:bg-black/[0.04] dark:hover:bg-white/10 transition-colors flex-shrink-0"
              aria-label="Close"
            >
              <X className="w-4 h-4" strokeWidth={1.5} />
            </button>
          </div>

          {/* Mode switch */}
          <div className="px-5 pt-4 flex-shrink-0">
            <div className="inline-flex items-center gap-1 p-1 rounded-full bg-black/[0.04] dark:bg-white/[0.05] border border-black/[0.05] dark:border-white/[0.08]">
              {([['scan', 'Scan for courses', Radar], ['manual', 'Enter a path', FolderPlus]] as const).map(([id, label, Icon]) => (
                <button
                  key={id}
                  id={`add-course-mode-${id}`}
                  onClick={() => { setMode(id); setError(null); }}
                  className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-[12px] font-medium transition-all duration-200 ease-fluid ${
                    mode === id
                      ? 'bg-zinc-900 dark:bg-white text-white dark:text-zinc-950 shadow-sm'
                      : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" strokeWidth={1.5} />
                  <span>{label}</span>
                </button>
              ))}
            </div>
          </div>

          {error && (
            <div className="mx-5 mt-4 p-3.5 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-red-700 dark:text-red-300 text-[12px] flex items-center gap-2.5 flex-shrink-0">
              <AlertCircle className="w-4 h-4 flex-shrink-0" strokeWidth={1.5} />
              <span>{error}</span>
            </div>
          )}

          {/* ---------------- SCAN ---------------- */}
          {mode === 'scan' && (
            <>
              <div className="px-5 pt-4 space-y-3 flex-shrink-0">
                <div className="flex flex-wrap gap-2">
                  {roots.map(r => (
                    <button
                      key={r.path}
                      onClick={() => { setScanPath(r.path); runScan(r.path); }}
                      disabled={isScanning}
                      className={`flex items-center gap-2 px-3.5 py-2 rounded-full border text-[12px] font-medium transition-all duration-200 ease-fluid disabled:opacity-40 ${
                        scanPath === r.path
                          ? 'bg-indigo-500/10 border-indigo-500/30 text-indigo-700 dark:text-indigo-400'
                          : 'bg-black/[0.03] dark:bg-white/[0.05] border-black/[0.05] dark:border-white/[0.08] text-zinc-700 dark:text-zinc-300 hover:border-zinc-400'
                      }`}
                      title={`Scan ${r.path}`}
                    >
                      {r.kind === 'drive'
                        ? <HardDrive className="w-3.5 h-3.5" strokeWidth={1.5} />
                        : <Home className="w-3.5 h-3.5" strokeWidth={1.5} />}
                      <span>{r.label}</span>
                    </button>
                  ))}
                </div>

                <div className="flex gap-2">
                  <input
                    id="scan-path-input"
                    type="text"
                    value={scanPath}
                    onChange={(e) => setScanPath(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); runScan(); } }}
                    placeholder="/absolute/path/to/scan"
                    className="flex-1 min-w-0 bg-black/[0.02] dark:bg-white/[0.03] border border-black/[0.06] dark:border-white/10 rounded-full px-4 py-2.5 text-[12px] text-zinc-900 dark:text-white placeholder-zinc-500 focus:outline-none focus:border-indigo-500 focus-visible:ring-2 focus-visible:ring-indigo-500/40 font-mono transition-colors"
                  />
                  <button
                    id="run-scan-btn"
                    onClick={() => runScan()}
                    disabled={isScanning || !scanPath.trim()}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-zinc-900 dark:bg-white disabled:opacity-30 text-white dark:text-zinc-950 text-[12px] font-semibold transition-all duration-200 ease-fluid shadow-sm flex-shrink-0"
                  >
                    {isScanning
                      ? <Loader2 className="w-3.5 h-3.5 animate-spin" strokeWidth={2} />
                      : <Radar className="w-3.5 h-3.5" strokeWidth={1.5} />}
                    <span>{isScanning ? 'Scanning' : 'Scan'}</span>
                  </button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto px-5 py-4 min-h-[180px]" role="region" aria-live="polite" aria-busy={isScanning} aria-label="Scan results">
                {isScanning && (
                  <div className="h-full flex flex-col items-center justify-center text-center py-10 text-zinc-500 dark:text-zinc-400">
                    <Loader2 className="w-5 h-5 animate-spin mb-3" strokeWidth={1.5} />
                    <p className="text-[13px]">Looking for folders of lessons…</p>
                    <p className="text-[11px] font-mono mt-1 truncate max-w-full">{scanPath}</p>
                  </div>
                )}

                {!isScanning && candidates === null && (
                  <div className="h-full flex flex-col items-center justify-center text-center py-10 text-zinc-500 dark:text-zinc-400">
                    <Radar className="w-5 h-5 mb-3" strokeWidth={1.5} />
                    <p className="text-[13px]">Pick a drive above, or type a folder, then hit Scan.</p>
                    <p className="text-[11px] font-mono mt-1">Nothing is added until you choose it.</p>
                  </div>
                )}

                {!isScanning && candidates?.length === 0 && (
                  <div className="h-full flex flex-col items-center justify-center text-center py-10 text-zinc-500 dark:text-zinc-400">
                    <p className="text-[13px]">No folders with 3 or more videos found here.</p>
                    <p className="text-[11px] font-mono mt-1">Try a different drive, or add the path manually.</p>
                  </div>
                )}

                {!isScanning && candidates && candidates.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[10px] font-mono uppercase tracking-[0.15em] text-zinc-500">
                        {candidates.length} found{scanMeta ? ` in ${scanMeta.elapsedMs}ms` : ''}
                      </span>
                      {selectable.length > 0 && (
                        <button
                          onClick={() => setSelected(
                            selected.size === selectable.length ? new Set() : new Set(selectable.map(c => c.path))
                          )}
                          className="text-[11px] font-medium text-indigo-700 dark:text-indigo-400 hover:underline"
                        >
                          {selected.size === selectable.length ? 'Clear all' : 'Select all'}
                        </button>
                      )}
                    </div>

                    {candidates.map(c => {
                      const isSel = selected.has(c.path);
                      return (
                        <button
                          key={c.path}
                          onClick={() => !c.alreadyAdded && toggle(c.path)}
                          disabled={c.alreadyAdded}
                          className={`w-full text-left p-3 rounded-2xl border transition-all duration-200 flex items-start gap-3 ${
                            c.alreadyAdded
                              ? 'bg-black/[0.02] dark:bg-white/[0.02] border-black/[0.04] dark:border-white/[0.06] opacity-55 cursor-default'
                              : isSel
                                ? 'bg-indigo-500/10 border-indigo-500/40'
                                : 'bg-black/[0.02] dark:bg-white/[0.02] border-black/[0.05] dark:border-white/[0.07] hover:border-zinc-400 dark:hover:border-white/25'
                          }`}
                        >
                          <span className={`mt-0.5 w-4 h-4 rounded-md border flex items-center justify-center flex-shrink-0 ${
                            c.alreadyAdded
                              ? 'bg-emerald-500/20 border-emerald-500/40'
                              : isSel
                                ? 'bg-indigo-600 border-indigo-600'
                                : 'border-zinc-400 dark:border-white/30'
                          }`}>
                            {(isSel || c.alreadyAdded) && <Check className="w-3 h-3 text-white" strokeWidth={3} />}
                          </span>

                          <span className="min-w-0 flex-1">
                            <span className="flex items-center gap-2 flex-wrap">
                              <span className="text-[13px] font-semibold text-zinc-900 dark:text-white truncate">{c.name}</span>
                              {c.likelyCourse ? (
                                <span className="text-[9px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 border border-indigo-500/20 flex-shrink-0">
                                  Course
                                </span>
                              ) : (
                                <span className="text-[9px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-black/[0.04] dark:bg-white/[0.06] text-zinc-500 dark:text-zinc-400 flex-shrink-0">
                                  Media?
                                </span>
                              )}
                              {c.alreadyAdded && (
                                <span className="text-[9px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20 flex-shrink-0">
                                  In library
                                </span>
                              )}
                            </span>
                            <span className="block text-[10px] font-mono text-zinc-500 dark:text-zinc-400 truncate mt-0.5">{c.path}</span>
                            <span className="flex items-center gap-3 text-[10px] font-mono text-zinc-500 dark:text-zinc-400 mt-1">
                              <span className="flex items-center gap-1"><Film className="w-3 h-3" strokeWidth={1.5} />{c.videoCount}</span>
                              {c.docCount > 0 && <span className="flex items-center gap-1"><FileText className="w-3 h-3" strokeWidth={1.5} />{c.docCount}</span>}
                              <span>{formatSize(c.totalBytes)}</span>
                              <span className="text-zinc-500 dark:text-zinc-400 truncate">{c.reason}</span>
                            </span>
                          </span>
                        </button>
                      );
                    })}

                    {scanMeta?.truncated && (
                      <p className="text-[11px] font-mono text-amber-700 dark:text-amber-400 pt-1">
                        Scan hit its limit — some folders were not reached. Scan a narrower path to see the rest.
                      </p>
                    )}
                  </div>
                )}
              </div>

              <div className="p-5 border-t border-black/[0.06] dark:border-white/[0.08] flex items-center justify-between gap-3 flex-shrink-0 bg-black/[0.01] dark:bg-white/[0.02]">
                <span className="text-[11px] font-mono text-zinc-500">
                  {selected.size > 0 ? `${selected.size} selected` : 'Nothing selected'}
                </span>
                <div className="flex items-center gap-2.5">
                  <button
                    onClick={() => setAddCourseModal(false)}
                    className="px-4 py-2 rounded-full bg-black/[0.03] hover:bg-black/[0.06] dark:bg-white/[0.05] dark:hover:bg-white/10 text-zinc-700 dark:text-zinc-300 text-[11px] font-medium transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    id="add-selected-btn"
                    onClick={addSelected}
                    disabled={selected.size === 0 || addingCount > 0}
                    className="flex items-center gap-2 px-5 py-2 rounded-full bg-zinc-900 dark:bg-white disabled:opacity-30 text-white dark:text-zinc-950 text-[11px] font-semibold transition-all duration-200 ease-fluid shadow-sm group"
                  >
                    <span>{addingCount > 0 ? `Adding ${addingCount}…` : `Add ${selected.size || ''}`.trim()}</span>
                    <span className="w-4 h-4 rounded-full bg-white/20 dark:bg-black/10 flex items-center justify-center transition-transform group-hover:translate-x-0.5">
                      {addingCount > 0
                        ? <Loader2 className="w-2.5 h-2.5 animate-spin" strokeWidth={2} />
                        : <ArrowRight className="w-2.5 h-2.5" strokeWidth={1.5} />}
                    </span>
                  </button>
                </div>
              </div>
            </>
          )}

          {/* ---------------- MANUAL ---------------- */}
          {mode === 'manual' && (
            <form onSubmit={handleSubmit} className="p-5 space-y-4 overflow-y-auto">
              <div>
                <label className="block text-[11px] font-mono uppercase tracking-wider text-zinc-600 dark:text-zinc-400 mb-1.5">
                  Absolute Directory Path
                </label>
                <input
                  type="text"
                  value={folderPath}
                  onChange={(e) => setFolderPath(e.target.value)}
                  placeholder="/absolute/path/to/Course_Directory"
                  required
                  className="w-full bg-black/[0.02] dark:bg-white/[0.03] border border-black/[0.06] dark:border-white/10 rounded-xl px-3.5 py-2.5 text-[12px] text-zinc-900 dark:text-white placeholder-zinc-500 focus:outline-none focus:border-indigo-500 focus-visible:ring-2 focus-visible:ring-indigo-500/40 font-mono transition-colors"
                />
                <span className="text-[10px] font-mono text-zinc-500 dark:text-zinc-400 mt-1 block">
                  Provide the full path on your local drive.
                </span>
              </div>

              <div>
                <label className="block text-[11px] font-mono uppercase tracking-wider text-zinc-600 dark:text-zinc-400 mb-1.5">
                  Course Title (Optional)
                </label>
                <input
                  type="text"
                  value={courseName}
                  onChange={(e) => setCourseName(e.target.value)}
                  placeholder="e.g. System Design Masterclass"
                  className="w-full bg-black/[0.02] dark:bg-white/[0.03] border border-black/[0.06] dark:border-white/10 rounded-xl px-3.5 py-2.5 text-[12px] text-zinc-900 dark:text-white placeholder-zinc-500 focus:outline-none focus:border-indigo-500 focus-visible:ring-2 focus-visible:ring-indigo-500/40 transition-colors font-sans"
                />
              </div>

              <div className="pt-3 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setAddCourseModal(false)}
                  className="px-4 py-2 rounded-full bg-black/[0.03] hover:bg-black/[0.06] dark:bg-white/[0.05] dark:hover:bg-white/10 text-zinc-700 dark:text-zinc-300 text-[11px] font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || !folderPath.trim()}
                  className="flex items-center gap-2 px-5 py-2 rounded-full bg-zinc-900 dark:bg-white disabled:opacity-30 text-white dark:text-zinc-950 text-[11px] font-semibold transition-all duration-200 ease-fluid shadow-sm group"
                >
                  <span>{isSubmitting ? 'Indexing...' : 'Index Course'}</span>
                  <span className="w-4 h-4 rounded-full bg-white/20 dark:bg-black/10 flex items-center justify-center transition-transform group-hover:translate-x-0.5">
                    <ArrowRight className="w-2.5 h-2.5" strokeWidth={1.5} />
                  </span>
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

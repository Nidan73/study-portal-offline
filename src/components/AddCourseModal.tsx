import React, { useState, useEffect } from 'react';
import { useStore } from '../store/useStore';
import { 
  FolderPlus, 
  X, 
  AlertCircle, 
  ArrowRight
} from 'lucide-react';

export const AddCourseModal: React.FC = () => {
  const { isAddCourseModalOpen, setAddCourseModal, addCustomCourse } = useStore();

  const [folderPath, setFolderPath] = useState('');
  const [courseName, setCourseName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Escape closes this the way it closes CommandPalette and ShortcutModal.
  useEffect(() => {
    if (!isAddCourseModalOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setAddCourseModal(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isAddCourseModalOpen, setAddCourseModal]);

  if (!isAddCourseModalOpen) return null;

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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 select-none">
      <div 
        className="fixed inset-0 bg-black/70 backdrop-blur-md animate-in fade-in duration-200"
        onClick={() => setAddCourseModal(false)}
      />

      <div className="relative w-full max-w-lg p-1.5 rounded-[2rem] bg-black/[0.05] dark:bg-white/[0.05] border border-black/[0.08] dark:border-white/10 shadow-[0_25px_60px_rgba(0,0,0,0.3)] dark:shadow-[0_25px_60px_rgba(0,0,0,0.8)] z-10 animate-in fade-in zoom-in-95 duration-200">
        <div className="rounded-[calc(2rem-0.375rem)] bg-white/95 dark:bg-[#111218]/95 backdrop-blur-2xl border border-black/[0.05] dark:border-white/[0.08] shadow-[inset_0_1px_1px_rgba(255,255,255,0.15)] dark:shadow-[inset_0_1px_1px_rgba(255,255,255,0.06)] overflow-hidden">
          <div className="flex items-center justify-between p-5 border-b border-black/[0.06] dark:border-white/[0.08] bg-black/[0.01] dark:bg-white/[0.02]">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-zinc-900 dark:bg-white text-white dark:text-zinc-950 flex items-center justify-center shadow-sm">
                <FolderPlus className="w-4 h-4" strokeWidth={1.5} />
              </div>
              <div>
                <h3 className="text-[14px] font-bold tracking-tight text-zinc-900 dark:text-white">Scan Course Folder</h3>
                <p className="text-[11px] font-mono text-zinc-400 dark:text-zinc-500">Index local directory containing video files</p>
              </div>
            </div>
            <button
              onClick={() => setAddCourseModal(false)}
              className="w-7 h-7 rounded-full flex items-center justify-center text-zinc-400 hover:text-zinc-700 dark:hover:text-white hover:bg-black/[0.04] dark:hover:bg-white/10 transition-colors"
            >
              <X className="w-4 h-4" strokeWidth={1.5} />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            {error && (
              <div className="p-3.5 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-red-700 dark:text-red-300 text-[12px] flex items-center gap-2.5">
                <AlertCircle className="w-4 h-4 flex-shrink-0" strokeWidth={1.5} />
                <span>{error}</span>
              </div>
            )}

            <div>
              <label className="block text-[11px] font-mono uppercase tracking-wider text-zinc-600 dark:text-zinc-400 mb-1.5">
                Absolute Directory Path
              </label>
              <input
                type="text"
                value={folderPath}
                onChange={(e) => setFolderPath(e.target.value)}
                placeholder="/run/media/nidan73/.../Course_Directory"
                required
                className="w-full bg-black/[0.02] dark:bg-white/[0.03] border border-black/[0.06] dark:border-white/10 rounded-xl px-3.5 py-2.5 text-[12px] text-zinc-900 dark:text-white placeholder-zinc-400 focus:outline-none focus:border-indigo-500 font-mono transition-colors"
              />
              <span className="text-[10px] font-mono text-zinc-400 dark:text-zinc-500 mt-1 block">
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
                className="w-full bg-black/[0.02] dark:bg-white/[0.03] border border-black/[0.06] dark:border-white/10 rounded-xl px-3.5 py-2.5 text-[12px] text-zinc-900 dark:text-white placeholder-zinc-400 focus:outline-none focus:border-indigo-500 transition-colors font-sans"
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
        </div>
      </div>
    </div>
  );
};

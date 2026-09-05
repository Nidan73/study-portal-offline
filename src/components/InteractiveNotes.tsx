import React, { useState } from 'react';
import { useStore } from '../store/useStore';
import { 
  Clock, 
  Plus, 
  Copy, 
  Check, 
  FileText, 
  Bookmark as BookmarkIcon, 
  Trash2,
  Zap,
  ZapOff,
  Download,
  Search,
  X
} from 'lucide-react';

export const InteractiveNotes: React.FC = () => {
  const { 
    activeCourseId, 
    activeLesson, 
    currentTime, 
    setCurrentTime, 
    isPlaying,
    setIsPlaying,
    autoPauseOnNote,
    toggleAutoPauseOnNote,
    activeSlideNumber,
    userData, 
    addNote,
    removeNote,
    clearAllNotes,
    addBookmark,
    removeBookmark,
    clearAllBookmarks
  } = useStore();

  const [activeTab, setActiveTab] = useState<'notes' | 'bookmarks'>('notes');
  const [noteContent, setNoteContent] = useState('');
  const [bookmarkLabel, setBookmarkLabel] = useState('');
  const [copied, setCopied] = useState(false);
  const [confirmClearBookmarks, setConfirmClearBookmarks] = useState(false);
  const [confirmClearNotes, setConfirmClearNotes] = useState(false);
  const [noteQuery, setNoteQuery] = useState('');
  const [lockedTimestamp, setLockedTimestamp] = useState<number | null>(null);

  const notes = activeLesson 
    ? userData?.courses?.[activeCourseId]?.notes?.[activeLesson.id] || [] 
    : [];

  const bookmarks = activeLesson 
    ? userData?.courses?.[activeCourseId]?.bookmarks?.[activeLesson.id] || [] 
    : [];

  const sortedBookmarks = [...bookmarks].sort((a, b) => a.timestampSeconds - b.timestampSeconds);

  const noteFilter = noteQuery.trim().toLowerCase();
  const visibleNotes = noteFilter
    ? notes.filter(n => n.content.toLowerCase().includes(noteFilter))
    : notes;

  const formatTimestamp = (secs: number) => {
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = Math.floor(secs % 60);
    if (h > 0) {
      return `${h}:${m < 10 ? '0' : ''}${m}:${s < 10 ? '0' : ''}${s}`;
    }
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const handleFocusNote = () => {
    if (autoPauseOnNote) {
      setLockedTimestamp(currentTime);
      setIsPlaying(false);
    }
  };

  const handleAddNote = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!noteContent.trim() || !activeLesson) return;

    const noteTime = lockedTimestamp !== null ? lockedTimestamp : currentTime;
    addNote(activeLesson.id, noteTime, noteContent.trim(), activeSlideNumber ?? undefined);
    setNoteContent('');
    setLockedTimestamp(null);

    // If auto-pause is enabled, resume playback
    if (autoPauseOnNote) {
      setIsPlaying(true);
    }
  };

  const handleAddBookmark = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!activeLesson) return;

    addBookmark(activeLesson.id, currentTime, bookmarkLabel.trim() || undefined);
    setBookmarkLabel('');
  };

  const handleKeyDownNote = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      handleAddNote();
    }
  };

  const buildMarkdown = () => {
    if (!activeLesson) return '';
    const isYT = Boolean(activeLesson.source === 'youtube' || activeLesson.youtubeVideoId);
    const ytId = activeLesson.youtubeVideoId || (isYT ? activeLesson.relativePath : '');

    return `# Notes: ${activeLesson.title}\n\n` +
      notes.map(n => {
        const timeStr = formatTimestamp(n.timestampSeconds);
        const timeLink = isYT && ytId
          ? `[[${timeStr}]](https://youtu.be/${ytId}?t=${Math.floor(n.timestampSeconds)}s)`
          : `[${timeStr}]`;
        const slideInfo = n.slideNumber ? ` (Slide ${n.slideNumber})` : '';
        return `- ${timeLink}${slideInfo} ${n.content}`;
      }).join('\n\n');
  };

  // Save the notes as a .md file on this machine.
  const downloadNotes = () => {
    if (!activeLesson || notes.length === 0) return;
    const safeName = activeLesson.title.replace(/[^\w\d\-. ]+/g, '_').slice(0, 80).trim() || 'notes';
    const blob = new Blob([buildMarkdown()], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${safeName}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleClearAllNotes = () => {
    if (!activeLesson) return;
    if (!confirmClearNotes) {
      setConfirmClearNotes(true);
      setTimeout(() => setConfirmClearNotes(false), 3000);
      return;
    }
    clearAllNotes(activeLesson.id);
    setConfirmClearNotes(false);
  };

  const copyNotesToClipboard = async () => {
    if (!activeLesson || notes.length === 0) return;
    const markdown = buildMarkdown();

    let success = false;
    if (navigator.clipboard && window.isSecureContext) {
      try {
        await navigator.clipboard.writeText(markdown);
        success = true;
      } catch (e) {}
    }
    if (!success) {
      try {
        const ta = document.createElement('textarea');
        ta.value = markdown;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.focus();
        ta.select();
        success = document.execCommand('copy');
        document.body.removeChild(ta);
      } catch (err) {}
    }

    if (success) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleClearAllBookmarks = () => {
    if (!activeLesson) return;
    if (!confirmClearBookmarks) {
      setConfirmClearBookmarks(true);
      setTimeout(() => setConfirmClearBookmarks(false), 3000);
      return;
    }
    clearAllBookmarks(activeLesson.id);
    setConfirmClearBookmarks(false);
  };

  if (!activeLesson) {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[350px] p-6 text-center text-slate-400 dark:text-slate-500">
        <p className="text-[13px]">Select a lecture to view notes and bookmarks.</p>
      </div>
    );
  }

  return (
    <div className="p-1.5 rounded-[2rem] bg-black/[0.03] dark:bg-white/[0.03] border border-black/[0.06] dark:border-white/[0.08] h-full">
      <div className="flex flex-col h-full bg-white dark:bg-[#111218] border border-black/[0.05] dark:border-white/[0.06] rounded-[calc(2rem-0.375rem)] shadow-[inset_0_1px_1px_rgba(255,255,255,0.15)] dark:shadow-[inset_0_1px_1px_rgba(255,255,255,0.06)] overflow-hidden select-none transition-colors">
        {/* Header with Segmented Tabs */}
        <div className="px-4 py-3 border-b border-black/[0.06] dark:border-white/[0.08] flex items-center justify-between bg-black/[0.01] dark:bg-white/[0.02]">
          <div className="flex items-center gap-1 p-0.5 rounded-xl bg-black/[0.04] dark:bg-white/[0.05] border border-black/[0.04] dark:border-white/[0.08]">
            <button
              onClick={() => setActiveTab('notes')}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-[12px] font-medium transition-all ${
                activeTab === 'notes'
                  ? 'bg-white dark:bg-white/15 text-zinc-900 dark:text-white shadow-sm font-semibold'
                  : 'text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200'
              }`}
            >
              <FileText className="w-3.5 h-3.5" strokeWidth={1.5} />
              <span>Notes</span>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-full bg-black/[0.04] dark:bg-white/10 font-medium">
                {notes.length}
              </span>
            </button>
            <button
              onClick={() => setActiveTab('bookmarks')}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-[12px] font-medium transition-all ${
                activeTab === 'bookmarks'
                  ? 'bg-white dark:bg-white/15 text-amber-600 dark:text-amber-400 shadow-sm font-semibold'
                  : 'text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200'
              }`}
            >
              <BookmarkIcon className="w-3.5 h-3.5" strokeWidth={1.5} />
              <span>Bookmarks</span>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-full bg-black/[0.04] dark:bg-white/10 font-medium">
                {bookmarks.length}
              </span>
            </button>
          </div>

          {activeTab === 'notes' && notes.length > 0 && (
            <div className="flex items-center gap-1.5">
              <button
                onClick={copyNotesToClipboard}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-black/[0.03] hover:bg-black/[0.06] dark:bg-white/[0.05] dark:hover:bg-white/10 border border-black/[0.05] dark:border-white/[0.08] text-zinc-700 dark:text-zinc-200 text-[11px] font-medium transition-colors"
                title="Copy all notes to clipboard as Markdown"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" strokeWidth={1.5} /> : <Copy className="w-3.5 h-3.5 text-zinc-400" strokeWidth={1.5} />}
                <span className="font-mono hidden sm:inline">{copied ? 'Copied' : 'Copy'}</span>
              </button>

              <button
                id="download-notes-btn"
                onClick={downloadNotes}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-black/[0.03] hover:bg-black/[0.06] dark:bg-white/[0.05] dark:hover:bg-white/10 border border-black/[0.05] dark:border-white/[0.08] text-zinc-700 dark:text-zinc-200 text-[11px] font-medium transition-colors"
                title="Save notes as a .md file on this machine"
              >
                <Download className="w-3.5 h-3.5 text-zinc-400" strokeWidth={1.5} />
                <span className="font-mono hidden sm:inline">Save</span>
              </button>

              <button
                id="clear-notes-btn"
                onClick={handleClearAllNotes}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-full border text-[11px] font-medium transition-all ${
                  confirmClearNotes
                    ? 'bg-rose-500/20 text-rose-400 border-rose-500/40'
                    : 'bg-black/[0.03] hover:bg-rose-500/10 dark:bg-white/[0.05] dark:hover:bg-rose-500/15 border-black/[0.05] dark:border-white/[0.08] hover:border-rose-500/30 text-zinc-500 hover:text-rose-400'
                }`}
                title="Delete every note on this lecture"
              >
                <Trash2 className="w-3.5 h-3.5" strokeWidth={1.5} />
                <span className="font-mono text-[10px] hidden sm:inline">{confirmClearNotes ? 'Confirm?' : 'Clear'}</span>
              </button>
            </div>
          )}

          {activeTab === 'bookmarks' && bookmarks.length > 0 && (
            <button
              onClick={handleClearAllBookmarks}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-[11px] font-medium transition-all ${
                confirmClearBookmarks
                  ? 'bg-rose-500/20 text-rose-400 border-rose-500/40 animate-pulse'
                  : 'bg-black/[0.03] hover:bg-rose-500/10 dark:bg-white/[0.05] dark:hover:bg-rose-500/15 border-black/[0.05] dark:border-white/[0.08] hover:border-rose-500/30 text-zinc-500 hover:text-rose-400'
              }`}
              title="Clear all bookmarks for this lesson"
            >
              <Trash2 className="w-3.5 h-3.5" strokeWidth={1.5} />
              <span className="font-mono text-[10px]">{confirmClearBookmarks ? 'Confirm Clear?' : 'Clear All'}</span>
            </button>
          )}
        </div>

        {/* Tab Body: Notes */}
        {activeTab === 'notes' && (
          <>
            {notes.length > 0 && (
              <div className="px-3.5 pt-3 pb-1">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" strokeWidth={1.5} />
                  <input
                    id="notes-search-input"
                    type="text"
                    value={noteQuery}
                    onChange={(e) => setNoteQuery(e.target.value)}
                    placeholder={`Search ${notes.length} note${notes.length === 1 ? '' : 's'} on this lecture...`}
                    className="w-full bg-black/[0.02] dark:bg-white/[0.03] border border-black/[0.05] dark:border-white/10 rounded-full pl-9 pr-8 py-2 text-[12px] text-zinc-900 dark:text-white placeholder-zinc-400 dark:placeholder-zinc-500 focus:outline-none focus:border-indigo-500 transition-colors"
                  />
                  {noteQuery && (
                    <button
                      onClick={() => setNoteQuery('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 rounded-full text-zinc-400 hover:text-zinc-700 dark:hover:text-white transition-colors"
                      title="Clear search"
                      aria-label="Clear search"
                    >
                      <X className="w-3.5 h-3.5" strokeWidth={1.5} />
                    </button>
                  )}
                </div>
              </div>
            )}

            <div className="flex-1 overflow-y-auto p-3.5 space-y-2.5">
              {notes.length === 0 ? (
                <div className="text-center py-12 text-zinc-400 dark:text-zinc-500 text-[13px]">
                  <p>No notes for this lecture yet.</p>
                  <p className="text-[11px] text-zinc-400 dark:text-zinc-600 mt-1 font-mono">
                    Press Ctrl+Enter to save a note with current timestamp.
                  </p>
                </div>
              ) : visibleNotes.length === 0 ? (
                <div className="text-center py-12 text-zinc-400 dark:text-zinc-500 text-[13px]">
                  <p>No notes match &ldquo;{noteQuery}&rdquo;.</p>
                  <p className="text-[11px] text-zinc-400 dark:text-zinc-600 mt-1 font-mono">
                    Press Ctrl+K to search notes across every lecture.
                  </p>
                </div>
              ) : (
                visibleNotes.map((note) => (
                  <div 
                    key={note.id}
                    className="p-3 rounded-2xl bg-black/[0.02] dark:bg-white/[0.02] border border-black/[0.04] dark:border-white/[0.06] space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <button
                        onClick={() => setCurrentTime(note.timestampSeconds)}
                        className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-white dark:bg-white/10 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 border border-black/[0.05] dark:border-white/10 font-mono text-[10px] font-semibold transition-colors"
                        title="Click to seek in video"
                      >
                        <Clock className="w-3 h-3 text-indigo-500 dark:text-indigo-400" strokeWidth={1.5} />
                        <span>{formatTimestamp(note.timestampSeconds)}</span>
                      </button>
                      
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-zinc-400 dark:text-zinc-500 font-mono">
                          {new Date(note.createdAt).toLocaleDateString()}
                        </span>
                        <button
                          onClick={() => removeNote(activeLesson.id, note.id)}
                          className="p-1 rounded-lg text-zinc-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                          title="Delete this note"
                          aria-label="Delete this note"
                        >
                          <Trash2 className="w-3 h-3" strokeWidth={1.5} />
                        </button>
                      </div>
                    </div>
                    <p className="text-[12px] leading-relaxed text-zinc-800 dark:text-zinc-200 whitespace-pre-wrap select-text">
                      {note.content}
                    </p>
                    {note.slideNumber ? (
                      <span className="inline-block text-[10px] font-mono px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
                        Slide {note.slideNumber}
                      </span>
                    ) : null}
                  </div>
                ))
              )}
            </div>

            {/* Note Input */}
            <div className="p-3.5 border-t border-black/[0.06] dark:border-white/[0.08] bg-black/[0.01] dark:bg-white/[0.02] space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-400">
                  {lockedTimestamp !== null ? `Locked @ ${formatTimestamp(lockedTimestamp)}` : `Capture @ ${formatTimestamp(currentTime)}`}
                  {activeSlideNumber ? ` + Slide ${activeSlideNumber}` : ''}
                </span>

                {/* 1-Click Auto-Pause vs Continuous Mode Toggle */}
                <button
                  type="button"
                  id="toggle-auto-pause-btn"
                  onClick={toggleAutoPauseOnNote}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-mono transition-all select-none ${
                    autoPauseOnNote
                      ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30 font-semibold'
                      : 'bg-black/[0.04] dark:bg-white/[0.05] text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 border border-transparent'
                  }`}
                  title={autoPauseOnNote ? 'Auto-pause active: video pauses while typing, resumes on submit' : 'Continuous mode: video keeps playing in background'}
                >
                  {autoPauseOnNote ? (
                    <>
                      <Zap className="w-3 h-3 text-amber-500 fill-amber-500/30" />
                      <span>Auto-pause: ON</span>
                    </>
                  ) : (
                    <>
                      <ZapOff className="w-3 h-3" />
                      <span>Continuous</span>
                    </>
                  )}
                </button>
              </div>

              <form onSubmit={handleAddNote} className="space-y-2.5">
                <textarea
                  value={noteContent}
                  onChange={(e) => setNoteContent(e.target.value)}
                  onFocus={handleFocusNote}
                  onKeyDown={handleKeyDownNote}
                  placeholder={`Add a note at [${formatTimestamp(lockedTimestamp !== null ? lockedTimestamp : currentTime)}]... (Ctrl+Enter)`}
                  rows={2}
                  className="w-full bg-black/[0.02] dark:bg-white/[0.03] border border-black/[0.05] dark:border-white/10 rounded-2xl p-3 text-[12px] text-zinc-900 dark:text-white placeholder-zinc-400 dark:placeholder-zinc-500 focus:outline-none focus:border-indigo-500 resize-none transition-colors"
                />

                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono text-zinc-400 dark:text-zinc-500">
                    Timestamp: {formatTimestamp(lockedTimestamp !== null ? lockedTimestamp : currentTime)}
                  </span>

                  <button
                    type="submit"
                    disabled={!noteContent.trim()}
                    className="flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-zinc-900 dark:bg-white disabled:opacity-30 text-white dark:text-zinc-950 text-[11px] font-medium transition-all duration-200 ease-fluid shadow-sm group"
                  >
                    <span>Save Note</span>
                    <span className="w-4 h-4 rounded-full bg-white/20 dark:bg-black/10 flex items-center justify-center">
                      <Plus className="w-3 h-3" strokeWidth={1.5} />
                    </span>
                  </button>
                </div>
              </form>
            </div>
          </>
        )}

        {/* Tab Body: Bookmarks */}
        {activeTab === 'bookmarks' && (
          <>
            <div className="flex-1 overflow-y-auto p-3.5 space-y-2">
              {sortedBookmarks.length === 0 ? (
                <div className="text-center py-12 text-zinc-400 dark:text-zinc-500 text-[13px]">
                  <p>No bookmarks for this lecture yet.</p>
                  <p className="text-[11px] text-zinc-400 dark:text-zinc-600 mt-1 font-mono">
                    Press &apos;B&apos; during video playback or add a pin below.
                  </p>
                </div>
              ) : (
                sortedBookmarks.map((bm) => (
                  <div 
                    key={bm.id}
                    className="p-3 rounded-2xl bg-black/[0.02] dark:bg-white/[0.02] hover:bg-black/[0.04] dark:hover:bg-white/[0.04] border border-black/[0.04] dark:border-white/[0.06] flex items-center justify-between gap-3 group transition-all"
                  >
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                      <button
                        onClick={() => setCurrentTime(bm.timestampSeconds)}
                        className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/20 font-mono text-[11px] font-semibold transition-colors shrink-0"
                        title="Click to seek in video"
                      >
                        <Clock className="w-3 h-3" strokeWidth={1.5} />
                        <span>{formatTimestamp(bm.timestampSeconds)}</span>
                      </button>

                      <span className="text-[12px] font-medium text-zinc-800 dark:text-zinc-200 truncate select-text">
                        {bm.label || `Bookmark at ${formatTimestamp(bm.timestampSeconds)}`}
                      </span>
                    </div>

                    <button
                      onClick={() => removeBookmark(activeLesson.id, bm.id)}
                      className="p-1.5 rounded-lg text-zinc-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors shrink-0"
                      title="Delete bookmark"
                      aria-label="Delete bookmark"
                    >
                      <Trash2 className="w-3.5 h-3.5" strokeWidth={1.5} />
                    </button>
                  </div>
                ))
              )}
            </div>

            {/* Bookmark Input */}
            <div className="p-3.5 border-t border-black/[0.06] dark:border-white/[0.08] bg-black/[0.01] dark:bg-white/[0.02]">
              <form onSubmit={handleAddBookmark} className="space-y-2.5">
                <input
                  type="text"
                  value={bookmarkLabel}
                  onChange={(e) => setBookmarkLabel(e.target.value)}
                  placeholder={`Pin label (optional) at [${formatTimestamp(currentTime)}]...`}
                  className="w-full bg-black/[0.02] dark:bg-white/[0.03] border border-black/[0.05] dark:border-white/10 rounded-2xl px-3 py-2.5 text-[12px] text-zinc-900 dark:text-white placeholder-zinc-400 dark:placeholder-zinc-500 focus:outline-none focus:border-amber-500 transition-colors"
                />

                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono text-zinc-400 dark:text-zinc-500">
                    Seek: {formatTimestamp(currentTime)}
                  </span>

                  <button
                    type="submit"
                    className="flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-amber-500 hover:bg-amber-600 text-zinc-950 font-medium text-[11px] transition-all shadow-sm"
                  >
                    <span>Add Pin</span>
                    <Plus className="w-3 h-3" strokeWidth={2} />
                  </button>
                </div>
              </form>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

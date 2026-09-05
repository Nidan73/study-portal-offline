import React, { useEffect } from 'react';
import { useStore } from './store/useStore';
import { Navbar } from './components/Navbar';
import { BentoDashboard } from './components/BentoDashboard';
import { CinemaPlayer } from './components/CinemaPlayer';
import { SyllabusDrawer } from './components/SyllabusDrawer';
import { IntegratedIDE } from './components/IntegratedIDE';
import { InteractiveNotes } from './components/InteractiveNotes';
import { RightSidePanel } from './components/RightSidePanel';
import { CommandPalette } from './components/CommandPalette';
import { AddCourseModal } from './components/AddCourseModal';
import { ShortcutModal } from './components/ShortcutModal';
import { YouTubeExplorer } from './components/YouTubeExplorer';
import { Toaster } from './components/Toaster';
import { Scratchpad } from './components/Scratchpad';
import { AboutModal } from './components/AboutModal';
import { 
  PanelRightOpen, 
  Maximize2,
  Layers
} from 'lucide-react';


/** "Now Playing" strip under the video. Was pasted twice with small drifts
 *  (one copy had an id on its button, the other did not). */
const LessonStrip: React.FC<{
  lesson: NonNullable<ReturnType<typeof useStore.getState>['activeLesson']>;
  isSidebarOpen: boolean;
  onToggleSidebar: () => void;
}> = ({ lesson, isSidebarOpen, onToggleSidebar }) => (
  <div className="p-1.5 rounded-2xl bg-black/[0.03] dark:bg-white/[0.03] border border-black/[0.06] dark:border-white/[0.08]">
    <div className="p-4 rounded-[calc(1rem-0.25rem)] bg-white dark:bg-[#111218] border border-black/[0.05] dark:border-white/[0.06] shadow-[inset_0_1px_1px_rgba(255,255,255,0.15)] dark:shadow-[inset_0_1px_1px_rgba(255,255,255,0.06)] flex flex-col sm:flex-row sm:items-center justify-between gap-4 select-none">
      <div className="min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-[10px] font-mono uppercase tracking-[0.2em] px-2 py-0.5 rounded-full bg-black/[0.03] dark:bg-white/[0.06] text-zinc-600 dark:text-zinc-400">
            Now Playing
          </span>
        </div>
        <h2 className="text-sm sm:text-base font-bold text-zinc-900 dark:text-white truncate tracking-tight">
          {lesson.title}
        </h2>
        <p className="text-[11px] text-zinc-600 dark:text-zinc-400 font-mono mt-0.5 truncate">
          {lesson.relativePath}
        </p>
      </div>

      <div className="flex items-center gap-2 flex-shrink-0">
        <button
          id="toggle-sidebar-btn"
          onClick={onToggleSidebar}
          className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full border text-[11px] font-medium bg-black/[0.03] hover:bg-black/[0.06] dark:bg-white/[0.05] dark:hover:bg-white/10 border-black/[0.05] dark:border-white/[0.08] text-zinc-700 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white transition-colors select-none"
          title={isSidebarOpen ? 'Expand Video Player' : 'Show Side Panel'}
        >
          {isSidebarOpen ? (
            <>
              <Maximize2 className="w-3.5 h-3.5 text-zinc-600 dark:text-zinc-400" strokeWidth={1.5} />
              <span>Expand</span>
            </>
          ) : (
            <>
              <PanelRightOpen className="w-3.5 h-3.5 text-zinc-600 dark:text-zinc-400" strokeWidth={1.5} />
              <span>Show Panel</span>
            </>
          )}
        </button>
      </div>
    </div>
  </div>
);

/** Compact title + "Close Split" bar for the three side-by-side views. Was
 *  pasted three times, differing only in the button id. */
const SplitTitleBar: React.FC<{ title: string; closeId?: string; onClose: () => void }> = ({ title, closeId, onClose }) => (
  <div className="p-1 rounded-2xl bg-black/[0.03] dark:bg-white/[0.03] border border-black/[0.06] dark:border-white/[0.08]">
    <div className="px-4 py-3 rounded-[calc(1rem-0.25rem)] bg-white dark:bg-[#111218] border border-black/[0.05] dark:border-white/[0.06] shadow-sm flex items-center justify-between text-xs select-none">
      <span className="text-zinc-800 dark:text-zinc-200 font-medium truncate">{title}</span>
      <button
        id={closeId}
        onClick={onClose}
        className="px-3 py-1 rounded-full bg-black/[0.04] hover:bg-black/[0.08] dark:bg-white/[0.06] dark:hover:bg-white/10 text-zinc-600 dark:text-zinc-300 font-medium text-[11px] transition-colors flex-shrink-0 ml-3"
      >
        Close Split
      </button>
    </div>
  </div>
);

export const App: React.FC = () => {
  const { 
    isLoading, 
    fetchInitialData, 
    activeTab, 
    setActiveTab, 
    isSidebarOpen, 
    toggleSidebar,
    activeLesson,
    sidePanelTab,
    setSidePanelTab,
    splitRatio,
    setSplitRatio,
    splitLayout,
    setSplitLayout,
    showNotesUnderVideo
  } = useStore();

  const containerRef = React.useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = React.useState(false);
  const [confirmStop, setConfirmStop] = React.useState(false);
  const [stopped, setStopped] = React.useState(false);

  // Height of the notes dock under the video, dragged from its top edge and
  // remembered. A fixed height made it either cramped or a screen-eater.
  const [notesDockHeight, setNotesDockHeight] = React.useState<number>(() => {
    if (typeof window === 'undefined') return 260;
    const saved = parseInt(localStorage.getItem('study_hub_notes_dock_h') || '', 10);
    return !isNaN(saved) && saved >= 120 && saved <= 900 ? saved : 260;
  });
  const [isResizingDock, setIsResizingDock] = React.useState(false);

  const startDockResize = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizingDock(true);
    const startY = e.clientY;
    const startH = notesDockHeight;

    const onMove = (ev: MouseEvent) => {
      // Dragging up grows the dock, which is what the handle sitting on its
      // top edge implies.
      const next = Math.min(900, Math.max(120, startH + (startY - ev.clientY)));
      setNotesDockHeight(next);
    };
    const onUp = () => {
      setIsResizingDock(false);
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      setNotesDockHeight(h => {
        try { localStorage.setItem('study_hub_notes_dock_h', String(h)); } catch (err) {}
        return h;
      });
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  // The split panes size themselves with an inline style, which outranks every
  // Tailwind class — so `w-full` could never reclaim the layout on a phone and
  // the side panel stayed pinned to 30% of a 390px screen. Only apply those
  // inline widths once the viewport is actually wide enough to split.
  const SPLIT_QUERY = '(min-width: 1280px)';
  const [isWideEnoughToSplit, setIsWideEnoughToSplit] = React.useState(
    () => typeof window !== 'undefined' && window.matchMedia(SPLIT_QUERY).matches
  );

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia(SPLIT_QUERY);
    const onChange = (e: MediaQueryListEvent) => setIsWideEnoughToSplit(e.matches);
    mq.addEventListener('change', onChange);
    setIsWideEnoughToSplit(mq.matches);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  // Tabs that show the lecture alongside a tool. Kept as one layout so the
  // player element survives switching between them.
  const isVideoWorkspace =
    activeTab === 'player' || activeTab === 'split-slides' ||
    activeTab === 'notes'  || activeTab === 'split-code';
  // Player mode can collapse its panel; the split modes always show their tool.
  const showRightPane = activeTab === 'player' ? isSidebarOpen : true;
  // Notes gets a little more room for the video; the rest split evenly.
  const leftRatio = splitRatio;   // draggable in every split view, and persisted
  // Bottom-dock is a player-mode option; the split tools are always side-by-side.
  const isBottomDock = splitLayout === 'bottom' && activeTab === 'player';

  const startDragging = (e: React.MouseEvent) => {
    if (e.detail === 2) {
      setSplitRatio(70);
      return;
    }
    e.preventDefault();
    setIsDragging(true);

    const onMouseMove = (moveEvent: MouseEvent) => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const rawRatio = ((moveEvent.clientX - rect.left) / rect.width) * 100;
      const clamped = Math.min(78, Math.max(30, Math.round(rawRatio)));
      setSplitRatio(clamped);
    };

    const onMouseUp = () => {
      setIsDragging(false);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  useEffect(() => {
    fetchInitialData();
  }, [fetchInitialData]);

  // The navbar tab decides which tool the panel opens on.
  useEffect(() => {
    const toolForTab: Partial<Record<typeof activeTab, typeof sidePanelTab>> = {
      'notes': 'notes',
      'split-slides': 'slides',
      'split-code': 'code'
    };
    const tool = toolForTab[activeTab];
    if (tool && tool !== sidePanelTab) setSidePanelTab(tool);
    // sidePanelTab is deliberately not a dependency: changing the tool from
    // inside the panel must not bounce it back to the navbar's choice.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, setSidePanelTab]);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-[#f9f9fb] dark:bg-[#070709] text-zinc-900 dark:text-zinc-100 select-none">
        <div className="w-12 h-12 rounded-full bg-zinc-900 dark:bg-white text-white dark:text-zinc-950 flex items-center justify-center mb-4 shadow-xl">
          <Layers className="w-5 h-5" strokeWidth={1.5} />
        </div>
        <h2 className="text-[15px] font-bold text-zinc-900 dark:text-white tracking-tight">Initializing StudyHub Core</h2>
        <p className="text-[11px] font-mono text-zinc-600 dark:text-zinc-400 mt-1">Indexing local storage & course databases</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#f9f9fb] dark:bg-[#070709] text-zinc-900 dark:text-zinc-100 antialiased relative overflow-x-hidden selection:bg-indigo-500/20 selection:text-indigo-600 dark:selection:text-indigo-400 transition-colors">
      {/* Subtle Atmospheric Radial Light Glow */}
      <div className="fixed inset-0 pointer-events-none bg-[radial-gradient(ellipse_80%_60%_at_50%_-15%,rgba(99,102,241,0.06),transparent)] dark:bg-[radial-gradient(ellipse_80%_60%_at_50%_-15%,rgba(99,102,241,0.12),transparent)] z-0" />

      {/* Floating Island Navigation */}
      <Navbar />

      {/* Main Workspace Container */}
      <main className="relative z-10 flex-1 max-w-[2400px] w-full mx-auto px-3 sm:px-6 py-2 sm:py-4 flex flex-col">
        {/* YouTube Explorer Mode */}
        {activeTab === 'youtube' && (
          <YouTubeExplorer />
        )}

        {/* Library Mode */}
        {activeTab === 'library' && (
          <BentoDashboard />
        )}


        {/* Video workspace: player, slides, notes and code-along all show the
            lecture on the left with a tool beside (or below) it. Deliberately ONE
            layout with a swappable pane rather than separate branches — separate
            branches meant separate <CinemaPlayer /> instances in mutually
            exclusive positions, so React unmounted and remounted the <video> and
            the YouTube iframe on every tab switch, restarting playback. */}
        {isVideoWorkspace && (
          <div
            ref={containerRef}
            className={`flex-1 flex relative w-full ${
              isBottomDock ? 'flex-col space-y-4' : 'flex-col xl:flex-row items-start gap-4 xl:gap-0'
            }`}
          >
            {/* Left / top: the lecture. The same element in every mode. */}
            <div
              style={!isBottomDock && isWideEnoughToSplit
                ? { width: showRightPane ? `calc(${leftRatio}% - 6px)` : '100%' }
                : undefined}
              className={`w-full space-y-4 transition-[width,max-width] duration-150 ease-out ${
                isBottomDock
                  ? 'max-w-[1680px] mx-auto'
                  : showRightPane ? 'xl:pr-3' : 'max-w-[1680px] mx-auto'
              }`}
            >
              <CinemaPlayer />
              {activeLesson && (
                activeTab === 'player'
                  ? <LessonStrip lesson={activeLesson} isSidebarOpen={isSidebarOpen} onToggleSidebar={toggleSidebar} />
                  : <SplitTitleBar
                      title={activeLesson.title}
                      closeId={activeTab === 'split-slides' ? 'close-split-slides-btn' : activeTab === 'split-code' ? 'close-split-code-btn' : undefined}
                      onClose={() => setActiveTab('player')}
                    />
              )}

              {/* Second notes dock, so a deck can stay open on the right while
                  you write underneath. With a lecture playing these are its
                  timestamped notes; with none — a PDF-only course, say — it
                  falls back to the general notepad rather than rendering
                  nothing, which is what it used to do. */}
              {showNotesUnderVideo && (
                <div className="flex flex-col" style={{ height: notesDockHeight }}>
                  <div
                    id="notes-dock-resize-handle"
                    onMouseDown={startDockResize}
                    onDoubleClick={() => setNotesDockHeight(260)}
                    role="separator"
                    aria-orientation="horizontal"
                    aria-label="Resize the notes area"
                    className="h-3 flex items-center justify-center cursor-row-resize group flex-shrink-0"
                    title="Drag to resize the notes area (double-click to reset)"
                  >
                    <span className="w-10 h-1 rounded-full bg-zinc-300 dark:bg-zinc-700 group-hover:bg-indigo-500 transition-colors" />
                  </div>
                  <div className="flex-1 min-h-0">
                    {activeLesson
                      ? <InteractiveNotes variant="dock" />
                      : <Scratchpad variant="dock" />}
                  </div>
                </div>
              )}
            </div>

            {/* Draggable divider — side-by-side player mode only */}
            {showRightPane && !isBottomDock && (
              <div
                id="split-drag-divider"
                onMouseDown={startDragging}
                className="hidden xl:flex flex-col items-center justify-center w-3 self-stretch cursor-col-resize hover:bg-indigo-500/20 active:bg-indigo-500/40 rounded-full select-none group transition-colors flex-shrink-0 z-20"
                title="Drag to resize video and side panel (double-click to reset to 70/30)"
                onDoubleClick={() => setSplitRatio(70)}
              >
                <div className="w-1 h-8 rounded-full bg-zinc-300 dark:bg-zinc-700 group-hover:bg-indigo-500 transition-colors" />
              </div>
            )}

            {/* Right / bottom: whichever tool this tab selects */}
            {showRightPane && (
              <div
                style={!isBottomDock && isWideEnoughToSplit ? { width: `calc(${100 - leftRatio}% - 6px)` } : undefined}
                className={
                  isBottomDock
                    ? 'w-full h-[620px] pb-6'
                    : 'w-full xl:pl-3 h-[560px] xl:h-[calc(100vh-100px)] xl:sticky xl:top-20 min-w-0 transition-[width] duration-150 ease-out'
                }
              >
                {/* Always the full panel, so the tool switcher and split controls
                    are present however you arrived — reaching Notes from the main
                    navbar used to render the notes alone, with no way to switch
                    to Slides or Code without going back to Player first. */}
                <RightSidePanel />
              </div>
            )}
          </div>
        )}

        {/* Full-Page Dedicated IDE Mode */}
        {activeTab === 'ide' && (
          <div className="flex-1 flex flex-col">
            <IntegratedIDE />
          </div>
        )}
      </main>

      <footer className="relative z-10 py-6 flex flex-col items-center gap-2.5 select-none">
        <p className="text-[11px] font-mono text-zinc-600 dark:text-zinc-400">
          Built with care &amp; love
        </p>
        <button
          id="stop-server-btn"
          onClick={() => {
            if (!confirmStop) {
              setConfirmStop(true);
              setTimeout(() => setConfirmStop(false), 4000);
              return;
            }
            fetch('/api/shutdown', { method: 'POST', headers: { 'Content-Type': 'application/json' } })
              .catch(() => {})
              .finally(() => setStopped(true));
          }}
          className={`text-[10.5px] font-mono rounded-full px-3 py-1 transition-colors ${
            confirmStop
              ? 'bg-rose-500/15 text-rose-600 dark:text-rose-400 font-semibold'
              : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-black/[0.04] dark:hover:bg-white/[0.06]'
          }`}
        >
          {confirmStop ? 'Click again to stop the server' : 'Stop the server'}
        </button>
      </footer>

      {/* Nothing is running once the server exits, so this has to be the last
          thing the page renders — a blank tab would look like a crash. */}
      {stopped && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-white dark:bg-[#0b0c10] p-6 text-center">
          <div className="max-w-sm">
            <h2 className="text-xl font-extrabold tracking-tight text-zinc-900 dark:text-white">
              Study Hub has stopped
            </h2>
            <p className="text-[13px] leading-relaxed text-zinc-700 dark:text-zinc-300 mt-2.5">
              Your notes and progress were saved. You can close this window — run the
              launcher again whenever you want to come back.
            </p>
          </div>
        </div>
      )}

      {/* Global Overlays */}
      {isDragging && <div className="fixed inset-0 z-50 cursor-col-resize select-none pointer-events-auto" />}
      {isResizingDock && <div className="fixed inset-0 z-50 cursor-row-resize select-none pointer-events-auto" />}
      <Toaster />
      <Scratchpad />
      <AboutModal />
      <CommandPalette />
      <AddCourseModal />
      <ShortcutModal />
    </div>
  );
};
export default App;


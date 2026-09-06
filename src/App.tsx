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
import { SplitPdfViewer } from './components/SplitPdfViewer';
import { PaneSwitcher, PaneOption } from './components/PaneSwitcher';
import {
  PanelRightOpen,
  Maximize2,
  Layers,
  Video as VideoIcon,
  BookOpen,
  FileText,
  Code2
} from 'lucide-react';

/** What each of the two left-hand panes can be switched to. */
type LeftTopPane = 'video' | 'slides' | 'notes' | 'code';
type LeftBottomPane = 'notes' | 'slides' | 'code' | 'curriculum';

const LEFT_TOP_OPTIONS: ReadonlyArray<PaneOption<LeftTopPane>> = [
  { id: 'video', label: 'Video', icon: VideoIcon },
  { id: 'slides', label: 'Slides', icon: BookOpen },
  { id: 'notes', label: 'Notes', icon: FileText },
  { id: 'code', label: 'Code', icon: Code2 }
];

const LEFT_BOTTOM_OPTIONS: ReadonlyArray<PaneOption<LeftBottomPane>> = [
  { id: 'notes', label: 'Notes', icon: FileText },
  { id: 'slides', label: 'Slides', icon: BookOpen },
  { id: 'code', label: 'Code', icon: Code2 },
  { id: 'curriculum', label: 'Curriculum', icon: Layers }
];

/** Remembered like the dock height is, so a chosen layout survives a restart. */
function useRememberedPane<T extends string>(key: string, allowed: ReadonlyArray<T>, fallback: T) {
  const [value, setValue] = React.useState<T>(() => {
    if (typeof window === 'undefined') return fallback;
    const saved = localStorage.getItem(key) as T | null;
    return saved && allowed.includes(saved) ? saved : fallback;
  });
  const set = React.useCallback((next: T) => {
    setValue(next);
    try { localStorage.setItem(key, next); } catch (e) { /* private window */ }
  }, [key]);
  return [value, set] as const;
}


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
  const isStopped = useStore(state => state.isStopped);
  const setStopped = useStore(state => state.setStopped);

  // Every action in this app is a call to a local server that the user can now
  // stop from the navbar — and that a laptop suspend or a crash can end too.
  // Without this the page keeps looking alive and each click just does nothing.
  React.useEffect(() => {
    let cancelled = false;
    const tick = async () => {
      try {
        const res = await fetch('/api/health', { signal: AbortSignal.timeout(4000) });
        if (!cancelled && res.ok) setStopped(false);
      } catch (e) {
        if (!cancelled) setStopped(true);
      }
    };
    const id = setInterval(tick, 10000);
    return () => { cancelled = true; clearInterval(id); };
  }, [setStopped]);
  const [reconnecting, setReconnecting] = React.useState(false);
  const [reconnectFailed, setReconnectFailed] = React.useState(false);
  const [isDragging, setIsDragging] = React.useState(false);

  // Height of the notes dock under the video, dragged from its top edge and
  // remembered. A fixed height made it either cramped or a screen-eater.
  const [notesDockHeight, setNotesDockHeight] = React.useState<number>(() => {
    if (typeof window === 'undefined') return 260;
    const saved = parseInt(localStorage.getItem('study_hub_notes_dock_h') || '', 10);
    return !isNaN(saved) && saved >= 120 && saved <= 900 ? saved : 260;
  });
  const [isResizingDock, setIsResizingDock] = React.useState(false);

  const [leftTopPane, setLeftTopPane] = useRememberedPane<LeftTopPane>(
    'study_hub_left_top_pane', ['video', 'slides', 'notes', 'code'], 'video');
  // A pane is mounted from the first time it is opened and then kept, hidden.
  // Unmounting threw away whatever was open in it, so a deck you were reading
  // was gone the moment you glanced at another tab and came back — the same
  // reason the player is hidden rather than unmounted.
  // Opening a document from the curriculum should show it, not leave you on
  // the player wondering where it went.
  const activePdf = useStore(state => state.activePdf);
  const seenPdfRef = React.useRef<string | null>(null);
  React.useEffect(() => {
    const id = activePdf?.id ?? null;
    // Only react to a document being opened *now*. Firing on mount as well
    // overrode the pane you had chosen last time, every reload.
    if (id && seenPdfRef.current !== null && id !== seenPdfRef.current) {
      setLeftTopPane('slides');
    }
    seenPdfRef.current = id;
  }, [activePdf?.id]);

  const [visitedTop, setVisitedTop] = React.useState<Set<LeftTopPane>>(
    () => new Set<LeftTopPane>([leftTopPane]));
  React.useEffect(() => {
    setVisitedTop(prev => prev.has(leftTopPane) ? prev : new Set(prev).add(leftTopPane));
  }, [leftTopPane]);
  const [leftBottomPane, setLeftBottomPane] = useRememberedPane<LeftBottomPane>(
    'study_hub_left_bottom_pane', ['notes', 'slides', 'code', 'curriculum'], 'notes');

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
              // The player caps its height at 100vh minus this reservation.
              // A flat 220px was fine when the video was the only thing in this
              // column; with the notes dock open it pushed the composer below
              // the fold, so the space the dock actually takes is reserved too.
              style={{
                ...(!isBottomDock && isWideEnoughToSplit
                  ? { width: showRightPane ? `calc(${leftRatio}% - 6px)` : '100%' }
                  : {}),
                ['--player-reserve' as string]: showNotesUnderVideo
                  ? `${notesDockHeight + 300}px`
                  : '220px',
                // Same idea for a tool in this pane, minus the Now Playing
                // strip the video needs room for.
                ['--pane-reserve' as string]: showNotesUnderVideo
                  ? `${notesDockHeight + 210}px`
                  : '150px'
              } as React.CSSProperties}
              className={`w-full space-y-4 flex flex-col min-h-0 transition-[width,max-width] duration-150 ease-out ${
                isBottomDock
                  ? 'max-w-[1680px] mx-auto'
                  : 'xl:self-stretch'
              } ${
                isBottomDock
                  ? ''
                  : showRightPane ? 'xl:pr-3' : 'max-w-[1680px] mx-auto'
              }`}
            >
              <PaneSwitcher
                idPrefix="left-top-pane"
                label="Choose what to show above"
                options={LEFT_TOP_OPTIONS}
                value={leftTopPane}
                onChange={setLeftTopPane}
              />

              {/* The player is hidden, never unmounted. Swapping it out by
                  conditional rendering tears down the <video> and the YouTube
                  iframe, which restarts playback on every switch — the exact
                  bug this one-layout structure exists to prevent. */}
              <div className={leftTopPane === 'video' ? '' : 'hidden'}>
                <CinemaPlayer />
              </div>

              {leftTopPane !== 'video' && (
                <div className="flex-1 min-h-[320px] max-h-[calc(100vh-var(--pane-reserve,150px))] overflow-hidden">
                  {visitedTop.has('slides') && (
                    <div className={`h-full ${leftTopPane === 'slides' ? '' : 'hidden'}`}>
                      <SplitPdfViewer paneId="deck-left-top" />
                    </div>
                  )}
                  {visitedTop.has('notes') && (
                    <div className={`h-full ${leftTopPane === 'notes' ? '' : 'hidden'}`}>
                      {activeLesson
                        ? <InteractiveNotes variant="dock" paneId="dock-left-top" />
                        : <Scratchpad variant="dock" paneId="scratch-left-top" />}
                    </div>
                  )}
                  {visitedTop.has('code') && (
                    <div className={`h-full ${leftTopPane === 'code' ? '' : 'hidden'}`}>
                      <IntegratedIDE isSplit paneId="ide-left-top" onCloseSplit={() => setLeftTopPane('video')} />
                    </div>
                  )}
                </div>
              )}

              {activeLesson && leftTopPane === 'video' && (
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
                  <PaneSwitcher
                    idPrefix="left-bottom-pane"
                    label="Choose what to show below"
                    options={LEFT_BOTTOM_OPTIONS}
                    value={leftBottomPane}
                    onChange={setLeftBottomPane}
                  />
                  <div className="flex-1 min-h-0 mt-2">
                    {leftBottomPane === 'notes' && (activeLesson
                      ? <InteractiveNotes variant="dock" paneId="dock-left-bottom" />
                      : <Scratchpad variant="dock" paneId="scratch-left-bottom" />)}
                    {leftBottomPane === 'slides' && <SplitPdfViewer paneId="deck-left-bottom" />}
                    {leftBottomPane === 'code' && <IntegratedIDE isSplit paneId="ide-left-bottom" onCloseSplit={() => setLeftBottomPane('notes')} />}
                    {leftBottomPane === 'curriculum' && <SyllabusDrawer />}
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

      <footer className="relative z-10 py-6 text-center select-none">
        <p className="text-[11px] font-mono text-zinc-600 dark:text-zinc-400">
          Built with care &amp; love
        </p>
      </footer>

      {isStopped && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-white dark:bg-[#0b0c10] p-6 text-center">
          <div className="max-w-sm">
            <h2 className="text-xl font-extrabold tracking-tight text-zinc-900 dark:text-white">
              Study Hub is not running
            </h2>
            <p className="text-[13px] leading-relaxed text-zinc-700 dark:text-zinc-300 mt-2.5">
              Your notes and progress were saved. Nothing on this page will work until
              the server is running again — start it with the launcher, then reconnect.
            </p>
            <button
              id="reconnect-btn"
              disabled={reconnecting}
              onClick={async () => {
                setReconnecting(true);
                setReconnectFailed(false);
                try {
                  const res = await fetch('/api/health', { signal: AbortSignal.timeout(4000) });
                  if (res.ok) { setStopped(false); window.location.reload(); return; }
                  setReconnectFailed(true);
                } catch (e) {
                  // Swallowing this left the click doing nothing at all: no
                  // spinner, no message, for up to the four second timeout.
                  // A button that answers silence reads as a broken button.
                  setReconnectFailed(true);
                }
                setReconnecting(false);
              }}
              className="mt-5 px-5 py-2.5 rounded-full bg-zinc-900 dark:bg-white text-white dark:text-zinc-950 text-[12px] font-bold hover:opacity-90 transition-opacity disabled:opacity-60"
            >
              {reconnecting ? 'Checking…' : 'Reconnect'}
            </button>

            {reconnectFailed && !reconnecting && (
              <p
                id="reconnect-failed"
                role="status"
                className="mt-3 text-[12px] leading-relaxed text-red-600 dark:text-red-400"
              >
                Still not running. Start it with the launcher, then try again.
              </p>
            )}
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


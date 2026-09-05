import React, { useEffect } from 'react';
import { useStore } from './store/useStore';
import { Navbar } from './components/Navbar';
import { BentoDashboard } from './components/BentoDashboard';
import { CinemaPlayer } from './components/CinemaPlayer';
import { SyllabusDrawer } from './components/SyllabusDrawer';
import { SplitPdfViewer } from './components/SplitPdfViewer';
import { InteractiveNotes } from './components/InteractiveNotes';
import { IntegratedIDE } from './components/IntegratedIDE';
import { RightSidePanel } from './components/RightSidePanel';
import { CommandPalette } from './components/CommandPalette';
import { AddCourseModal } from './components/AddCourseModal';
import { ShortcutModal } from './components/ShortcutModal';
import { YouTubeExplorer } from './components/YouTubeExplorer';
import { 
  PanelRightOpen, 
  Maximize2,
  Layers
} from 'lucide-react';

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
    setSplitLayout
  } = useStore();

  const containerRef = React.useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = React.useState(false);

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

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-[#f9f9fb] dark:bg-[#070709] text-zinc-900 dark:text-zinc-100 select-none">
        <div className="w-12 h-12 rounded-full bg-zinc-900 dark:bg-white text-white dark:text-zinc-950 flex items-center justify-center mb-4 shadow-xl">
          <Layers className="w-5 h-5" strokeWidth={1.5} />
        </div>
        <h2 className="text-[15px] font-bold text-zinc-900 dark:text-white tracking-tight">Initializing StudyHub Core</h2>
        <p className="text-[11px] font-mono text-zinc-400 dark:text-zinc-500 mt-1">Indexing local storage & course databases</p>
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

        {/* Player Mode: Video + Multi-Tool Side Panel */}
        {activeTab === 'player' && (
          splitLayout === 'bottom' ? (
            <div className="flex-1 flex flex-col space-y-4 w-full">
              {/* Full-width Video Column */}
              <div className="w-full max-w-[1680px] mx-auto space-y-4">
                <CinemaPlayer />

                {/* Lecture Context Strip - Double-Bezel Hardware Enclosure */}
                {activeLesson && (
                  <div className="p-1.5 rounded-2xl bg-black/[0.03] dark:bg-white/[0.03] border border-black/[0.06] dark:border-white/[0.08]">
                    <div className="p-4 rounded-[calc(1rem-0.25rem)] bg-white dark:bg-[#111218] border border-black/[0.05] dark:border-white/[0.06] shadow-[inset_0_1px_1px_rgba(255,255,255,0.15)] dark:shadow-[inset_0_1px_1px_rgba(255,255,255,0.06)] flex flex-col sm:flex-row sm:items-center justify-between gap-4 select-none">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-[10px] font-mono uppercase tracking-[0.2em] px-2 py-0.5 rounded-full bg-black/[0.03] dark:bg-white/[0.06] text-zinc-500 dark:text-zinc-400">
                            Now Playing
                          </span>
                        </div>
                        <h2 className="text-sm sm:text-base font-bold text-zinc-900 dark:text-white truncate tracking-tight">
                          {activeLesson.title}
                        </h2>
                        <p className="text-[11px] text-zinc-400 dark:text-zinc-500 font-mono mt-0.5 truncate">
                          {activeLesson.relativePath}
                        </p>
                      </div>

                      <div className="flex items-center gap-2 flex-shrink-0">
                        <button
                          id="toggle-sidebar-btn"
                          onClick={toggleSidebar}
                          className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full border text-[11px] font-medium bg-black/[0.03] hover:bg-black/[0.06] dark:bg-white/[0.05] dark:hover:bg-white/10 border-black/[0.05] dark:border-white/[0.08] text-zinc-700 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white transition-colors select-none"
                          title={isSidebarOpen ? 'Expand Video Player' : 'Show Side Panel'}
                        >
                          {isSidebarOpen ? (
                            <>
                              <Maximize2 className="w-3.5 h-3.5 text-zinc-500 dark:text-zinc-400" strokeWidth={1.5} />
                              <span>Expand</span>
                            </>
                          ) : (
                            <>
                              <PanelRightOpen className="w-3.5 h-3.5 text-zinc-500 dark:text-zinc-400" strokeWidth={1.5} />
                              <span>Show Panel</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Bottom Docked Panel Spanning Full Width */}
              {isSidebarOpen && (
                <div className="w-full h-[620px] pb-6">
                  <RightSidePanel />
                </div>
              )}
            </div>
          ) : (
            <div 
              ref={containerRef}
              className="flex-1 flex flex-col xl:flex-row items-start gap-4 xl:gap-0 relative w-full"
            >
              {/* Left Column: Video + Context Strip */}
              <div 
                style={isWideEnoughToSplit ? { width: isSidebarOpen ? `calc(${splitRatio}% - 6px)` : '100%' } : undefined}
                className={`w-full ${isSidebarOpen ? 'xl:pr-3' : 'max-w-[1680px] mx-auto'} space-y-4 transition-[width,max-width] duration-150 ease-out`}
              >
                <CinemaPlayer />

                {/* Lecture Context Strip - Double-Bezel Hardware Enclosure */}
                {activeLesson && (
                  <div className="p-1.5 rounded-2xl bg-black/[0.03] dark:bg-white/[0.03] border border-black/[0.06] dark:border-white/[0.08]">
                    <div className="p-4 rounded-[calc(1rem-0.25rem)] bg-white dark:bg-[#111218] border border-black/[0.05] dark:border-white/[0.06] shadow-[inset_0_1px_1px_rgba(255,255,255,0.15)] dark:shadow-[inset_0_1px_1px_rgba(255,255,255,0.06)] flex flex-col sm:flex-row sm:items-center justify-between gap-4 select-none">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-[10px] font-mono uppercase tracking-[0.2em] px-2 py-0.5 rounded-full bg-black/[0.03] dark:bg-white/[0.06] text-zinc-500 dark:text-zinc-400">
                            Now Playing
                          </span>
                        </div>
                        <h2 className="text-sm sm:text-base font-bold text-zinc-900 dark:text-white truncate tracking-tight">
                          {activeLesson.title}
                        </h2>
                        <p className="text-[11px] text-zinc-400 dark:text-zinc-500 font-mono mt-0.5 truncate">
                          {activeLesson.relativePath}
                        </p>
                      </div>

                      <div className="flex items-center gap-2 flex-shrink-0">
                        <button
                          id="toggle-sidebar-btn"
                          onClick={toggleSidebar}
                          className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full border text-[11px] font-medium bg-black/[0.03] hover:bg-black/[0.06] dark:bg-white/[0.05] dark:hover:bg-white/10 border-black/[0.05] dark:border-white/[0.08] text-zinc-700 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white transition-colors select-none"
                          title={isSidebarOpen ? 'Expand Video Player' : 'Show Side Panel'}
                        >
                          {isSidebarOpen ? (
                            <>
                              <Maximize2 className="w-3.5 h-3.5 text-zinc-500 dark:text-zinc-400" strokeWidth={1.5} />
                              <span>Expand</span>
                            </>
                          ) : (
                            <>
                              <PanelRightOpen className="w-3.5 h-3.5 text-zinc-500 dark:text-zinc-400" strokeWidth={1.5} />
                              <span>Show Panel</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Draggable Divider (Desktop) */}
              {isSidebarOpen && (
                <div
                  id="split-drag-divider"
                  onMouseDown={startDragging}
                  className="hidden xl:flex flex-col items-center justify-center w-3 self-stretch cursor-col-resize hover:bg-indigo-500/20 active:bg-indigo-500/40 rounded-full select-none group transition-colors flex-shrink-0 z-20"
                  title="Drag to resize video and code along width (Double click to reset 70/30)"
                  onDoubleClick={() => setSplitRatio(70)}
                >
                  <div className="w-1 h-8 rounded-full bg-zinc-300 dark:bg-zinc-700 group-hover:bg-indigo-500 transition-colors" />
                </div>
              )}

              {/* Right Column: Side Panel */}
              {isSidebarOpen && (
                <div 
                  style={isWideEnoughToSplit ? { width: `calc(${100 - splitRatio}% - 6px)` } : undefined}
                  className="w-full xl:pl-3 h-[560px] xl:h-[calc(100vh-100px)] xl:sticky xl:top-20 min-w-0 transition-[width] duration-150 ease-out"
                >
                  <RightSidePanel />
                </div>
              )}
            </div>
          )
        )}

        {/* Side-by-Side Split View: Video (Left) + Slides (Right) */}
        {activeTab === 'split-slides' && (
          <div className="flex-1 grid grid-cols-1 xl:grid-cols-12 gap-5 items-start">
            <div className="xl:col-span-6 space-y-4">
              <CinemaPlayer />
              {activeLesson && (
                <div className="p-1 rounded-2xl bg-black/[0.03] dark:bg-white/[0.03] border border-black/[0.06] dark:border-white/[0.08]">
                  <div className="px-4 py-3 rounded-[calc(1rem-0.25rem)] bg-white dark:bg-[#111218] border border-black/[0.05] dark:border-white/[0.06] shadow-sm flex items-center justify-between text-xs select-none">
                    <span className="text-zinc-800 dark:text-zinc-200 font-medium truncate">{activeLesson.title}</span>
                    <button
                      id="close-split-slides-btn"
                      onClick={() => setActiveTab('player')}
                      className="px-3 py-1 rounded-full bg-black/[0.04] hover:bg-black/[0.08] dark:bg-white/[0.06] dark:hover:bg-white/10 text-zinc-600 dark:text-zinc-300 font-medium text-[11px] transition-colors"
                    >
                      Close Split
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className="xl:col-span-6 h-[560px] xl:h-[calc(100vh-100px)] w-full xl:sticky xl:top-20">
              <SplitPdfViewer />
            </div>
          </div>
        )}

        {/* Side-by-Side Split View: Video (Left) + Notes (Right) */}
        {activeTab === 'notes' && (
          <div className="flex-1 grid grid-cols-1 xl:grid-cols-12 gap-5 items-start">
            <div className="xl:col-span-7 space-y-4">
              <CinemaPlayer />
              {activeLesson && (
                <div className="p-1 rounded-2xl bg-black/[0.03] dark:bg-white/[0.03] border border-black/[0.06] dark:border-white/[0.08]">
                  <div className="px-4 py-3 rounded-[calc(1rem-0.25rem)] bg-white dark:bg-[#111218] border border-black/[0.05] dark:border-white/[0.06] shadow-sm flex items-center justify-between text-xs select-none">
                    <span className="text-zinc-800 dark:text-zinc-200 font-medium truncate">{activeLesson.title}</span>
                    <button
                      onClick={() => setActiveTab('player')}
                      className="px-3 py-1 rounded-full bg-black/[0.04] hover:bg-black/[0.08] dark:bg-white/[0.06] dark:hover:bg-white/10 text-zinc-600 dark:text-zinc-300 font-medium text-[11px] transition-colors"
                    >
                      Close Split
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className="xl:col-span-5 h-[560px] xl:h-[calc(100vh-100px)] w-full xl:sticky xl:top-20">
              <InteractiveNotes />
            </div>
          </div>
        )}

        {/* Side-by-Side Split View: Video (Left) + Code Along IDE (Right) */}
        {activeTab === 'split-code' && (
          <div className="flex-1 grid grid-cols-1 xl:grid-cols-12 gap-5 items-start">
            <div className="xl:col-span-6 space-y-4">
              <CinemaPlayer />
              {activeLesson && (
                <div className="p-1 rounded-2xl bg-black/[0.03] dark:bg-white/[0.03] border border-black/[0.06] dark:border-white/[0.08]">
                  <div className="px-4 py-3 rounded-[calc(1rem-0.25rem)] bg-white dark:bg-[#111218] border border-black/[0.05] dark:border-white/[0.06] shadow-sm flex items-center justify-between text-xs select-none">
                    <span className="text-zinc-800 dark:text-zinc-200 font-medium truncate">{activeLesson.title}</span>
                    <button
                      id="close-split-code-btn"
                      onClick={() => setActiveTab('player')}
                      className="px-3 py-1 rounded-full bg-black/[0.04] hover:bg-black/[0.08] dark:bg-white/[0.06] dark:hover:bg-white/10 text-zinc-600 dark:text-zinc-300 font-medium text-[11px] transition-colors"
                    >
                      Close Split
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className="xl:col-span-6 h-[560px] xl:h-[calc(100vh-100px)] w-full xl:sticky xl:top-20">
              <IntegratedIDE isSplit onCloseSplit={() => setActiveTab('player')} />
            </div>
          </div>
        )}

        {/* Full-Page Dedicated IDE Mode */}
        {activeTab === 'ide' && (
          <div className="flex-1 flex flex-col">
            <IntegratedIDE />
          </div>
        )}
      </main>

      {/* Global Overlays */}
      {isDragging && <div className="fixed inset-0 z-50 cursor-col-resize select-none pointer-events-auto" />}
      <CommandPalette />
      <AddCourseModal />
      <ShortcutModal />
    </div>
  );
};
export default App;


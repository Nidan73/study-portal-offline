import React from 'react';
import { useStore, SidePanelTab, NavTab } from '../store/useStore';
import { SyllabusDrawer } from './SyllabusDrawer';
import { IntegratedIDE } from './IntegratedIDE';
import { InteractiveNotes } from './InteractiveNotes';
import { SplitPdfViewer } from './SplitPdfViewer';
import { 
  Layers, 
  Code2, 
  FileText, 
  BookOpen, 
  Columns, 
  Rows,
  PanelRightClose,
  PanelBottom,
  LucideIcon,
  Youtube
} from 'lucide-react';

export const RightSidePanel: React.FC = () => {
  // Per-field selectors: a whole-store destructure re-renders this on every
  // change, including the ~4/sec currentTime tick during playback.
  const sidePanelTab = useStore(state => state.sidePanelTab);
  const setSidePanelTab = useStore(state => state.setSidePanelTab);
  const splitRatio = useStore(state => state.splitRatio);
  const setSplitRatio = useStore(state => state.setSplitRatio);
  const splitLayout = useStore(state => state.splitLayout);
  const setSplitLayout = useStore(state => state.setSplitLayout);
  const toggleSplitWidth = useStore(state => state.toggleSplitWidth);
  const toggleSidebar = useStore(state => state.toggleSidebar);
  const activeLesson = useStore(state => state.activeLesson);
  const catalog = useStore(state => state.catalog);
  const activeTab = useStore(state => state.activeTab);
  const setActiveTab = useStore(state => state.setActiveTab);
  const showNotesUnderVideo = useStore(state => state.showNotesUnderVideo);
  const toggleNotesUnderVideo = useStore(state => state.toggleNotesUnderVideo);

  const isYouTubeActive = Boolean(activeLesson?.source === 'youtube' || activeLesson?.youtubeVideoId);
  const isVirtualCatalog = Boolean(catalog?.isVirtual);
  const isStandaloneYouTube = isYouTubeActive && !isVirtualCatalog;

  const tabs: Array<{ id: SidePanelTab; label: string; shortLabel: string; icon: LucideIcon }> = [
    { 
      id: 'curriculum', 
      label: isStandaloneYouTube ? 'Lecture Hub' : 'Curriculum', 
      shortLabel: isStandaloneYouTube ? 'Hub' : 'Curriculum', 
      icon: isStandaloneYouTube ? Youtube : Layers 
    },
    { id: 'code', label: 'Code Along', shortLabel: 'Code', icon: Code2 },
    { id: 'notes', label: 'Notes', shortLabel: 'Notes', icon: FileText },
    { id: 'slides', label: 'Slides', shortLabel: 'Slides', icon: BookOpen }
  ];

  // In a split view the navbar tab and the panel tool are the same choice shown
  // twice, so switching tool here keeps the navbar highlight honest instead of
  // leaving it pointing at whichever tab you originally arrived through.
  const tabToNav: Record<SidePanelTab, NavTab> = {
    curriculum: 'player', notes: 'notes', slides: 'split-slides', code: 'split-code'
  };
  const isSplitView = activeTab === 'notes' || activeTab === 'split-slides' || activeTab === 'split-code';

  const pickTool = (tab: SidePanelTab) => {
    setSidePanelTab(tab);
    if (isSplitView) setActiveTab(tabToNav[tab]);
  };

  return (
    <div className="flex flex-col h-full space-y-2 select-none">
      {/* Side Panel Tool Switcher Floating Bar */}
      <div className="flex items-center justify-between gap-1.5 px-0.5">
        <div className="flex items-center gap-0.5 sm:gap-1 p-1 rounded-full bg-black/[0.03] dark:bg-white/[0.05] border border-black/[0.05] dark:border-white/[0.08] backdrop-blur-xl overflow-x-auto no-scrollbar min-w-0 flex-1">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = sidePanelTab === tab.id;
            return (
              <button
                key={tab.id}
                id={`panel-tab-${tab.id}`}
                title={tab.label}
                aria-label={tab.label}
                onClick={() => pickTool(tab.id)}
                className={`flex items-center gap-1 sm:gap-1.5 px-2 sm:px-2.5 py-1 rounded-full text-[11px] font-medium whitespace-nowrap transition-all duration-200 ease-fluid ${
                  isActive
                    ? 'bg-zinc-900 dark:bg-white text-white dark:text-zinc-950 shadow-xs'
                    : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white'
                }`}
              >
                <Icon className="w-3.5 h-3.5 flex-shrink-0" strokeWidth={1.5} />
                <span className="hidden min-[1750px]:inline">{tab.label}</span>
                <span className="hidden min-[1500px]:inline min-[1750px]:hidden">{tab.shortLabel}</span>
              </button>
            );
          })}
        </div>

        {/* Panel Options: Split Presets, Layout Mode & Collapse */}
        <div className="flex items-center gap-1 flex-shrink-0">
          {/* The 70/30 · 60/40 · 50/50 presets used to live here. The divider is
              draggable in every split view now, so they were a third way to do
              the same thing — and they crowded the tab strip badly enough to
              clip the Slides tab at every width. */}
          {/* Notes beneath the video, alongside whatever is in this panel */}
          <button
            id="toggle-notes-under-video-btn"
            onClick={toggleNotesUnderVideo}
            className={`hidden xl:block p-1.5 rounded-full border transition-colors ${
              showNotesUnderVideo
                ? 'bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 border-indigo-500/30'
                : 'bg-black/[0.02] hover:bg-black/[0.05] dark:bg-white/[0.04] dark:hover:bg-white/10 text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white border-black/[0.04] dark:border-white/[0.07]'
            }`}
            title={showNotesUnderVideo
              ? 'Hide the notes dock under the video'
              : 'Open notes under the video, so you can keep slides open here at the same time'}
            aria-pressed={showNotesUnderVideo}
          >
            <PanelBottom className="w-3.5 h-3.5" strokeWidth={1.5} />
          </button>

          {/* Layout Orientation: Side-by-Side vs Bottom Dock */}
          <button
            id="toggle-split-layout-btn"
            onClick={() => setSplitLayout(splitLayout === 'side' ? 'bottom' : 'side')}
            className={`hidden xl:block p-1.5 rounded-full border transition-colors ${
              splitLayout === 'bottom'
                ? 'bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 border-indigo-500/30'
                : 'bg-black/[0.02] hover:bg-black/[0.05] dark:bg-white/[0.04] dark:hover:bg-white/10 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white border-black/[0.04] dark:border-white/[0.07]'
            }`}
            title={splitLayout === 'side' ? 'Dock Underneath Video' : 'Dock Side-by-Side'}
          >
            {splitLayout === 'side' ? <Rows className="w-3.5 h-3.5" strokeWidth={1.5} /> : <Columns className="w-3.5 h-3.5" strokeWidth={1.5} />}
          </button>

          <button
            onClick={toggleSidebar}
            className="hidden xl:block p-1.5 rounded-full text-zinc-600 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 bg-black/[0.02] hover:bg-black/[0.05] dark:bg-white/[0.04] dark:hover:bg-white/10 border border-black/[0.04] dark:border-white/[0.07] transition-colors"
            title="Collapse Side Panel"
          >
            <PanelRightClose className="w-3.5 h-3.5" strokeWidth={1.5} />
          </button>
        </div>
      </div>

      {/* Panel Content (Double-Bezel Container inside child views) */}
      <div className="flex-1 min-h-0">
        {sidePanelTab === 'curriculum' && <SyllabusDrawer />}
        {sidePanelTab === 'code' && <IntegratedIDE isSplit onCloseSplit={() => setSidePanelTab('curriculum')} />}
        {sidePanelTab === 'notes' && <InteractiveNotes />}
        {sidePanelTab === 'slides' && <SplitPdfViewer />}
      </div>
    </div>
  );
};

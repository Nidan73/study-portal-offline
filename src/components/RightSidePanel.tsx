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
  const { 
    sidePanelTab, 
    setSidePanelTab, 
    splitRatio,
    setSplitRatio,
    splitLayout,
    setSplitLayout,
    toggleSplitWidth,
    toggleSidebar,
    activeLesson,
    catalog,
    activeTab,
    setActiveTab,
    showNotesUnderVideo,
    toggleNotesUnderVideo
  } = useStore();

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
        <div className="flex items-center gap-0.5 sm:gap-1 p-1 rounded-full bg-black/[0.03] dark:bg-white/[0.05] border border-black/[0.05] dark:border-white/[0.08] backdrop-blur-xl overflow-x-auto no-scrollbar min-w-0">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = sidePanelTab === tab.id;
            return (
              <button
                key={tab.id}
                id={`panel-tab-${tab.id}`}
                onClick={() => pickTool(tab.id)}
                className={`flex items-center gap-1 sm:gap-1.5 px-2 sm:px-2.5 py-1 rounded-full text-[11px] font-medium whitespace-nowrap transition-all duration-200 ease-fluid ${
                  isActive
                    ? 'bg-zinc-900 dark:bg-white text-white dark:text-zinc-950 shadow-xs'
                    : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white'
                }`}
              >
                <Icon className="w-3.5 h-3.5 flex-shrink-0" strokeWidth={1.5} />
                <span className="hidden xl:inline">{tab.label}</span>
                <span className="inline xl:hidden">{tab.shortLabel}</span>
              </button>
            );
          })}
        </div>

        {/* Panel Options: Split Presets, Layout Mode & Collapse */}
        <div className="flex items-center gap-1 flex-shrink-0">
          {/* Split Ratio Presets — only meaningful once the layout splits */}
          <div className="hidden xl:flex items-center p-0.5 rounded-full bg-black/[0.03] dark:bg-white/[0.05] border border-black/[0.04] dark:border-white/[0.07] text-[10px] font-mono">
            <button
              onClick={() => setSplitRatio(70)}
              className={`px-2 py-0.5 rounded-full transition-colors ${
                splitRatio >= 68 ? 'bg-zinc-900 dark:bg-white text-white dark:text-zinc-950 font-semibold shadow-xs' : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
              }`}
              title="70% Video / 30% Side Panel (Default)"
            >
              70/30
            </button>
            <button
              onClick={() => setSplitRatio(60)}
              className={`hidden min-[1800px]:block px-2 py-0.5 rounded-full transition-colors ${
                splitRatio >= 55 && splitRatio < 68 ? 'bg-zinc-900 dark:bg-white text-white dark:text-zinc-950 font-semibold shadow-xs' : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
              }`}
              title="60% Video / 40% Side Panel"
            >
              60/40
            </button>
            <button
              id="split-width-toggle-btn"
              onClick={toggleSplitWidth}
              className={`px-2 py-0.5 rounded-full transition-colors ${
                splitRatio <= 52 ? 'bg-zinc-900 dark:bg-white text-white dark:text-zinc-950 font-semibold shadow-xs' : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
              }`}
              title={splitRatio <= 52 ? 'Switch to Default (70/30)' : 'Switch to Balanced (50/50)'}
            >
              <span>{splitRatio <= 52 ? '70/30' : '50/50'}</span>
            </button>
          </div>

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

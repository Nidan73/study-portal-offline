import React, { useState, useEffect } from 'react';
import { useStore, NavTab } from '../store/useStore';
import { 
  ChevronDown, 
  Layers, 
  FileText, 
  Video, 
  FolderPlus, 
  Maximize2, 
  Check, 
  Search, 
  Flame, 
  LayoutGrid, 
  Sun, 
  Moon, 
  Globe,
  Code2,
  HelpCircle,
  Youtube,
  Loader2,
  LucideIcon
} from 'lucide-react';

type NavTabSpec = {
  id: string;
  label: string;
  icon: LucideIcon;
  /** Where clicking goes, given the current tab (Slides toggles back to player). */
  target: (current: NavTab) => NavTab;
  isActive: (current: NavTab) => boolean;
  activeClass?: string;
};

const NAV_TABS: NavTabSpec[] = [
  { id: 'player',  label: 'Player',  icon: Video,      target: () => 'player',  isActive: t => t === 'player' },
  { id: 'youtube', label: 'YouTube', icon: Youtube,    target: () => 'youtube', isActive: t => t === 'youtube',
    activeClass: 'bg-red-600 text-white shadow-sm' },
  { id: 'slides',  label: 'Slides',  icon: FileText,   target: t => (t === 'split-slides' ? 'player' : 'split-slides'),
    isActive: t => t === 'split-slides' },
  { id: 'notes',   label: 'Notes',   icon: Layers,     target: () => 'notes',   isActive: t => t === 'notes' },
  { id: 'ide',     label: 'IDE',     icon: Code2,      target: () => 'ide',     isActive: t => t === 'ide' || t === 'split-code' },
  { id: 'library', label: 'Library', icon: LayoutGrid, target: () => 'library', isActive: t => t === 'library' }
];

export const Navbar: React.FC = () => {
  const { 
    courses, 
    activeCourseId, 
    activeLesson,
    selectCourse, 
    catalog, 
    userData, 
    activeTab, 
    setActiveTab, 
    setCommandPalette, 
    setAddCourseModal,
    setShortcutHelpOpen,
    theme,
    toggleTheme
  } = useStore();

  const [isCourseDropdownOpen, setIsCourseDropdownOpen] = useState(false);

  // Background transcoding used to run silently, so an unexplained CPU spike was
  // the only sign anything was happening. Poll it and say so.
  const [transcode, setTranscode] = useState<{ active: boolean; currentTitle: string; done: number; total: number } | null>(null);
  useEffect(() => {
    let stop = false;
    const poll = async () => {
      try {
        const res = await fetch('/api/transcode/status');
        if (!res.ok) return;
        const data = await res.json();
        if (!stop) setTranscode(data);
      } catch (e) {}
    };
    poll();
    const timer = setInterval(poll, 4000);
    return () => { stop = true; clearInterval(timer); };
  }, []);

  const isYouTubeActive = Boolean(activeLesson?.source === 'youtube' || activeLesson?.youtubeVideoId);
  const isVirtualCatalog = Boolean(catalog?.isVirtual);

  const activeCourse = courses.find(c => c.id === activeCourseId) || courses[0];
  const userCourseData = userData?.courses?.[activeCourseId];
  const completedCount = userCourseData?.completedLessonIds?.length || 0;
  const totalCount = catalog?.totalVideos || 0;
  const percentage = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
  const streak = userData?.globalStats?.streakDays || 1;

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  };

  return (
    <div className="sticky top-0 z-40 w-full pt-3 sm:pt-4 pb-2 px-3 sm:px-6 pointer-events-none select-none">
      <header className="pointer-events-auto max-w-7xl mx-auto rounded-full backdrop-blur-2xl bg-white/85 dark:bg-[#111218]/90 border border-black/[0.06] dark:border-white/[0.08] shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-[0_8px_32px_rgba(0,0,0,0.6)] px-3 sm:px-5 h-[54px] flex items-center justify-between gap-2 transition-all duration-300 ease-fluid">
        {/* Brand & Course Selector */}
        <div className="flex items-center gap-3 min-w-0 flex-shrink">
          <div 
            onClick={() => setActiveTab('library')}
            className="flex items-center gap-2.5 cursor-pointer group"
          >
            <div className="w-8 h-8 rounded-full bg-zinc-900 dark:bg-white text-white dark:text-zinc-950 flex items-center justify-center shadow-sm transition-transform duration-300 ease-fluid group-hover:scale-105">
              <Globe className="w-4 h-4" strokeWidth={1.5} />
            </div>
            <div className="hidden sm:flex flex-col">
              <span className="font-bold text-[13px] tracking-tight text-zinc-900 dark:text-white leading-tight">
                StudyHub
              </span>
              <span className="text-[10px] font-mono uppercase tracking-widest text-zinc-400 dark:text-zinc-500 leading-none">
                Offline Core
              </span>
            </div>
          </div>

          <div className="h-4 w-[1px] bg-black/[0.06] dark:bg-white/10 mx-0.5 hidden md:block" />

          {/* Course Dropdown */}
          <div className="relative hidden md:block">
            <button
              onClick={() => setIsCourseDropdownOpen(!isCourseDropdownOpen)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-black/[0.03] hover:bg-black/[0.06] dark:bg-white/[0.05] dark:hover:bg-white/[0.09] border border-black/[0.05] dark:border-white/[0.07] text-[12px] font-medium text-zinc-800 dark:text-zinc-200 transition-all duration-200 ease-fluid max-w-[160px] sm:max-w-[240px] truncate"
            >
              <span className="truncate">{activeCourse ? activeCourse.name : 'Select Course'}</span>
              <ChevronDown 
                className={`w-3.5 h-3.5 text-zinc-400 dark:text-zinc-500 transition-transform duration-300 ease-fluid flex-shrink-0 ${isCourseDropdownOpen ? 'rotate-180' : ''}`} 
                strokeWidth={1.5}
              />
            </button>

            {isCourseDropdownOpen && (
              <>
                <div 
                  className="fixed inset-0 z-40" 
                  onClick={() => setIsCourseDropdownOpen(false)} 
                />
                <div className="absolute left-0 mt-2 w-80 rounded-[1.5rem] bg-white/95 dark:bg-[#12131b]/95 backdrop-blur-2xl border border-black/[0.06] dark:border-white/10 shadow-[0_20px_50px_rgba(0,0,0,0.15)] dark:shadow-[0_20px_50px_rgba(0,0,0,0.6)] p-2 z-50 animate-in fade-in duration-200">
                  <div className="px-3 py-1.5 text-[10px] font-mono font-medium uppercase tracking-[0.2em] text-zinc-400 dark:text-zinc-500">
                    Courses ({courses.length})
                  </div>
                  <div className="space-y-1 max-h-60 overflow-y-auto pr-1">
                    {courses.map((course) => {
                      const isCurrent = course.id === activeCourseId;
                      return (
                        <button
                          key={course.id}
                          onClick={() => {
                            selectCourse(course.id);
                            setIsCourseDropdownOpen(false);
                          }}
                          className={`w-full flex items-center justify-between p-2.5 rounded-xl text-left text-[12px] transition-all duration-200 ${
                            isCurrent 
                              ? 'bg-zinc-900 dark:bg-white text-white dark:text-zinc-950 font-medium shadow-sm' 
                              : 'text-zinc-700 dark:text-zinc-300 hover:bg-black/[0.04] dark:hover:bg-white/[0.06]'
                          }`}
                        >
                          <div className="truncate pr-2">
                            <div className="truncate font-semibold">{course.name}</div>
                            <div className={`text-[10px] font-mono truncate mt-0.5 ${isCurrent ? 'text-white/70 dark:text-zinc-950/70' : 'text-zinc-400 dark:text-zinc-500'}`}>
                              {course.badge || 'Local Repository'}
                            </div>
                          </div>
                          {isCurrent && <Check className="w-3.5 h-3.5 flex-shrink-0" strokeWidth={1.5} />}
                        </button>
                      );
                    })}
                  </div>

                  <div className="border-t border-black/[0.06] dark:border-white/[0.08] mt-1.5 pt-1.5">
                    <button
                      onClick={() => {
                        setIsCourseDropdownOpen(false);
                        setAddCourseModal(true);
                      }}
                      className="w-full flex items-center gap-2 p-2.5 rounded-xl text-[12px] text-zinc-700 dark:text-zinc-300 hover:bg-black/[0.04] dark:hover:bg-white/[0.06] transition-colors"
                    >
                      <FolderPlus className="w-3.5 h-3.5 text-indigo-500" strokeWidth={1.5} />
                      <span>Scan New Folder...</span>
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Active YouTube Stream Pill */}
          {isYouTubeActive && !isVirtualCatalog && activeLesson && (
            <div 
              id="navbar-youtube-active-pill"
              onClick={() => setActiveTab('player')}
              className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-red-500/10 hover:bg-red-500/15 border border-red-500/20 text-red-600 dark:text-red-400 text-[11px] font-medium cursor-pointer max-w-[180px] lg:max-w-[240px] truncate transition-colors animate-in fade-in"
              title={`Now Playing on YouTube: ${activeLesson.title}`}
            >
              <Youtube className="w-3.5 h-3.5 text-red-500 shrink-0" />
              <span className="truncate">{activeLesson.title}</span>
            </div>
          )}
        </div>

        {/* Center: Navigation Tabs Pill */}
        <div className="flex items-center p-1 rounded-full bg-black/[0.03] dark:bg-white/[0.04] border border-black/[0.05] dark:border-white/[0.06] overflow-x-auto no-scrollbar min-w-0 flex-shrink">
          {NAV_TABS.map(({ id, label, icon: Icon, target, isActive, activeClass }) => {
            const active = isActive(activeTab);
            return (
              <button
                key={id}
                id={`nav-tab-${id}`}
                onClick={() => setActiveTab(target(activeTab))}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-[12px] font-medium whitespace-nowrap flex-shrink-0 transition-all duration-200 ease-fluid ${
                  active
                    ? (activeClass || 'bg-white dark:bg-zinc-100 text-zinc-900 dark:text-zinc-900 shadow-sm')
                    : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
                }`}
                title={label}
              >
                <Icon className="w-3.5 h-3.5" strokeWidth={1.5} />
                <span className="hidden lg:inline">{label}</span>
              </button>
            );
          })}
        </div>

        {/* Right Controls: Progress, Streak, Theme Toggle, Search */}
        <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
          {/* Progress Display or YouTube Live Status */}
          {isYouTubeActive && !isVirtualCatalog ? (
            <div 
              id="navbar-youtube-status-badge"
              className="hidden lg:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-[11px] font-mono font-medium animate-in fade-in"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
              <span>YouTube Live</span>
            </div>
          ) : (
            <div className="hidden lg:flex items-center gap-2 text-[11px] font-mono text-zinc-500 dark:text-zinc-400 px-2.5 py-1 rounded-full bg-black/[0.02] dark:bg-white/[0.03]">
              <span>{completedCount}/{totalCount}</span>
              <div className="w-12 h-1 bg-black/[0.08] dark:bg-white/10 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-indigo-500 rounded-full transition-all duration-500 ease-fluid" 
                  style={{ width: `${percentage}%` }}
                />
              </div>
              <span className="text-zinc-900 dark:text-zinc-200 font-semibold">{percentage}%</span>
            </div>
          )}

          {/* Background transcode indicator */}
          {transcode?.active && (
            <div
              id="transcode-indicator"
              className="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/25 text-indigo-600 dark:text-indigo-400 text-[11px] font-mono font-medium"
              title={`Preparing "${transcode.currentTitle}" for instant playback (${transcode.done + 1} of ${transcode.total}). Videos in formats the browser cannot play natively are converted in the background.`}
            >
              <Loader2 className="w-3 h-3 animate-spin" strokeWidth={2} />
              <span>Preparing {transcode.done + 1}/{transcode.total}</span>
            </div>
          )}

          {/* Streak Indicator */}
          <div className="hidden sm:flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 text-[11px] font-mono font-medium">
            <Flame className="w-3.5 h-3.5 fill-amber-500/20" strokeWidth={1.5} />
            <span>{streak}d</span>
          </div>

          {/* Theme Toggle (Dark / Normal) */}
          <button
            onClick={toggleTheme}
            className="w-8 h-8 rounded-full flex items-center justify-center text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white bg-black/[0.03] hover:bg-black/[0.06] dark:bg-white/[0.05] dark:hover:bg-white/10 border border-black/[0.05] dark:border-white/[0.08] transition-all duration-200 ease-fluid active:scale-95"
            title={theme === 'dark' ? 'Switch to Normal Mode' : 'Switch to Dark Mode'}
            aria-label="Toggle Theme"
          >
            {theme === 'dark' ? (
              <Sun className="w-3.5 h-3.5 text-amber-400 hover:rotate-45 transition-transform" strokeWidth={1.5} />
            ) : (
              <Moon className="w-3.5 h-3.5 text-zinc-700 hover:-rotate-12 transition-transform" strokeWidth={1.5} />
            )}
          </button>

          {/* Search Trigger (Ctrl+K) */}
          <button
            onClick={() => setCommandPalette(true)}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-black/[0.03] hover:bg-black/[0.06] dark:bg-white/[0.05] dark:hover:bg-white/10 border border-black/[0.05] dark:border-white/[0.08] text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-all duration-200 text-[11px]"
            title="Search (Ctrl+K)"
          >
            <Search className="w-3.5 h-3.5" strokeWidth={1.5} />
            <kbd className="hidden md:inline-block font-mono text-[9px] px-1 py-0.5 rounded bg-black/[0.04] dark:bg-white/10 text-zinc-500 dark:text-zinc-400">
              ⌘K
            </kbd>
          </button>

          {/* Keyboard Shortcuts Trigger */}
          <button
            id="navbar-shortcuts-btn"
            onClick={() => setShortcutHelpOpen(true)}
            className="w-8 h-8 rounded-full hidden xl:flex items-center justify-center text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white bg-black/[0.03] hover:bg-black/[0.06] dark:bg-white/[0.05] dark:hover:bg-white/10 border border-black/[0.05] dark:border-white/[0.08] transition-all duration-200 ease-fluid"
            title="Keyboard Shortcuts (?)"
            aria-label="Keyboard Shortcuts"
          >
            <HelpCircle className="w-3.5 h-3.5" strokeWidth={1.5} />
          </button>

          {/* Fullscreen Toggle */}
          <button
            onClick={toggleFullscreen}
            className="w-8 h-8 rounded-full hidden xl:flex items-center justify-center text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white bg-black/[0.03] hover:bg-black/[0.06] dark:bg-white/[0.05] dark:hover:bg-white/10 border border-black/[0.05] dark:border-white/[0.08] transition-all duration-200 ease-fluid"
            title="Toggle Fullscreen"
          >
            <Maximize2 className="w-3.5 h-3.5" strokeWidth={1.5} />
          </button>
        </div>
      </header>
    </div>
  );
};


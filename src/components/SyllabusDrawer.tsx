import React, { useState } from 'react';
import { useStore } from '../store/useStore';
import { SkeletonList } from './Skeleton';
import { 
  Check, 
  Circle, 
  Play, 
  ChevronDown, 
  ChevronRight, 
  FileText, 
  Search, 
  Layers,
  Youtube,
  Code2,
  BookOpen,
  ArrowLeftRight,
  Sparkles
} from 'lucide-react';

export const SyllabusDrawer: React.FC = () => {
  // Per-field selectors, not a whole-store destructure: this component used to
  // re-render on every currentTime tick (~4x/sec during playback).
  const catalog = useStore(state => state.catalog);
  const activeCourseId = useStore(state => state.activeCourseId);
  const activeLesson = useStore(state => state.activeLesson);
  const selectLesson = useStore(state => state.selectLesson);
  const selectPdf = useStore(state => state.selectPdf);
  const userData = useStore(state => state.userData);
  const toggleLessonComplete = useStore(state => state.toggleLessonComplete);
  const setSidePanelTab = useStore(state => state.setSidePanelTab);
  const setActiveTab = useStore(state => state.setActiveTab);
  const isCatalogLoading = useStore(state => state.isCatalogLoading);

  const [searchQuery, setSearchQuery] = useState('');
  const [expandedModules, setExpandedModules] = useState<Record<string, boolean>>({});
  const [isLocalCourseExpanded, setIsLocalCourseExpanded] = useState(false);

  const userCourseData = userData?.courses?.[activeCourseId];
  const completedSet = new Set(userCourseData?.completedLessonIds || []);

  const isYouTubeActive = Boolean(activeLesson?.source === 'youtube' || activeLesson?.youtubeVideoId);
  const isVirtualCatalog = Boolean(catalog?.isVirtual);

  React.useEffect(() => {
    if (activeLesson && catalog && !isYouTubeActive) {
      const activeMod = catalog.modules.find(m => m.lessons.some(l => l.id === activeLesson.id));
      if (activeMod && expandedModules[activeMod.id] === undefined) {
        setExpandedModules(prev => ({ ...prev, [activeMod.id]: true }));
      }
    }
  }, [activeLesson?.id, catalog, isYouTubeActive]);

  const formatDuration = (secs?: number) => {
    if (!secs) return 'Video';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const handleReturnToLocalCourse = () => {
    if (!catalog || !catalog.modules || catalog.modules.length === 0) return;
    const savedLessonId = userCourseData?.lastWatched?.lessonId;
    let targetLesson = null;
    if (savedLessonId) {
      for (const m of catalog.modules) {
        const found = m.lessons.find(l => l.id === savedLessonId);
        if (found) {
          targetLesson = found;
          break;
        }
      }
    }
    if (!targetLesson) {
      targetLesson = catalog.modules[0]?.lessons[0];
    }
    if (targetLesson) {
      selectLesson(targetLesson, userCourseData?.lastWatched?.timestampSeconds || 0);
      setSidePanelTab('curriculum');
    }
  };

  // Shape-matched placeholder rather than the old centred text, which was also
  // hardcoded to #141413 and therefore near-invisible on the dark theme.
  // isCatalogLoading was previously computed by the store and consumed nowhere,
  // so switching course showed stale lessons until the new ones popped in.
  if (!catalog || isCatalogLoading) {
    return (
      <div className="p-1.5 rounded-[2rem] bg-black/[0.03] dark:bg-white/[0.03] border border-black/[0.06] dark:border-white/[0.08] h-full">
        <div className="h-full bg-white dark:bg-[#111218] border border-black/[0.05] dark:border-white/[0.06] rounded-[calc(2rem-0.375rem)] p-4 overflow-hidden">
          <SkeletonList rows={7} label={isCatalogLoading ? 'Loading the new course' : 'Loading syllabus'} />
        </div>
      </div>
    );
  }

  const toggleModule = (modId: string) => {
    setExpandedModules(prev => ({
      ...prev,
      [modId]: !prev[modId]
    }));
  };

  const handleToggleComplete = (e: React.MouseEvent, lessonId: string) => {
    e.stopPropagation();
    toggleLessonComplete(lessonId);
  };

  const filteredModules = catalog.modules.map(mod => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return mod;

    const matchesModule = mod.title.toLowerCase().includes(q);
    const matchingLessons = mod.lessons.filter(l => l.title.toLowerCase().includes(q));
    const matchingPdfs = mod.supplementaryFiles.filter(p => p.title.toLowerCase().includes(q));

    if (matchesModule || matchingLessons.length > 0 || matchingPdfs.length > 0) {
      return {
        ...mod,
        lessons: matchesModule ? mod.lessons : matchingLessons,
        supplementaryFiles: matchesModule ? mod.supplementaryFiles : matchingPdfs
      };
    }
    return null;
  }).filter(Boolean) as typeof catalog.modules;

  return (
    <div className="p-1.5 rounded-[2rem] bg-black/[0.03] dark:bg-white/[0.03] border border-black/[0.06] dark:border-white/[0.08] h-full">
      <div className="flex flex-col h-full bg-white dark:bg-[#111218] border border-black/[0.05] dark:border-white/[0.06] rounded-[calc(2rem-0.375rem)] shadow-[inset_0_1px_1px_rgba(255,255,255,0.15)] dark:shadow-[inset_0_1px_1px_rgba(255,255,255,0.06)] overflow-hidden select-none transition-colors">
        {/* If Active Lesson is a Standalone YouTube Video, show YouTube Masterclass Companion */}
        {isYouTubeActive && !isVirtualCatalog && activeLesson ? (
          <div className="flex-1 overflow-y-auto p-3.5 space-y-4">
            
            {/* Header Eyebrow */}
            <div className="flex items-center justify-between px-1">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-red-500/10 flex items-center justify-center text-red-700 dark:text-red-400">
                  <Youtube className="w-3.5 h-3.5" />
                </div>
                <h2 className="font-bold text-[14px] tracking-tight text-zinc-900 dark:text-white">YouTube Companion</h2>
              </div>
              <span className="text-[10px] font-mono px-2.5 py-0.5 rounded-full bg-red-500/10 text-red-700 dark:text-red-400 border border-red-500/20 font-medium">
                Live Stream
              </span>
            </div>

            {/* Active Video Card - Double Bezel Hardware Enclosure */}
            <div className="p-1 rounded-2xl bg-black/[0.03] dark:bg-white/[0.03] border border-black/[0.06] dark:border-white/[0.08]">
              <div className="p-3.5 rounded-[calc(1rem-0.25rem)] bg-white dark:bg-[#14151e] border border-black/[0.04] dark:border-white/[0.06] shadow-sm space-y-3">
                {activeLesson.thumbnailUrl && (
                  <div className="relative aspect-video w-full rounded-xl overflow-hidden bg-zinc-900 shadow-inner">
                    <img
                      src={activeLesson.thumbnailUrl}
                      alt={activeLesson.title}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent flex items-end justify-between p-2.5">
                      <span className="text-[10px] font-mono text-white/90 bg-black/60 px-2 py-0.5 rounded-md backdrop-blur-md">
                        {formatDuration(activeLesson.durationSeconds)}
                      </span>
                      <span className="text-[10px] font-mono text-white/70 bg-black/60 px-2 py-0.5 rounded-md backdrop-blur-md">
                        ID: {activeLesson.youtubeVideoId || activeLesson.relativePath}
                      </span>
                    </div>
                  </div>
                )}

                <div>
                  <h3 className="text-[13px] font-bold text-zinc-900 dark:text-white leading-snug tracking-tight line-clamp-2">
                    {activeLesson.title}
                  </h3>
                  <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-1 leading-relaxed">
                    Studio session active. Take synchronized timestamped notes, code along side-by-side, or review slides.
                  </p>
                </div>

                {/* 2x2 Quick Action Tiles */}
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <button
                    id="yt-quick-notes-btn"
                    onClick={() => setSidePanelTab('notes')}
                    className="flex items-center gap-2 p-2.5 rounded-xl bg-black/[0.03] hover:bg-black/[0.06] dark:bg-white/[0.05] dark:hover:bg-white/10 border border-black/[0.05] dark:border-white/[0.08] text-left transition-colors group"
                  >
                    <div className="w-7 h-7 rounded-lg bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 flex items-center justify-center shrink-0">
                      <FileText className="w-3.5 h-3.5" strokeWidth={1.5} />
                    </div>
                    <div className="min-w-0">
                      <div className="text-[11px] font-semibold text-zinc-900 dark:text-white truncate">Take Notes</div>
                      <div className="text-[9px] text-zinc-500 dark:text-zinc-400 font-mono">Timestamped</div>
                    </div>
                  </button>

                  <button
                    id="yt-quick-code-btn"
                    onClick={() => setSidePanelTab('code')}
                    className="flex items-center gap-2 p-2.5 rounded-xl bg-black/[0.03] hover:bg-black/[0.06] dark:bg-white/[0.05] dark:hover:bg-white/10 border border-black/[0.05] dark:border-white/[0.08] text-left transition-colors group"
                  >
                    <div className="w-7 h-7 rounded-lg bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 flex items-center justify-center shrink-0">
                      <Code2 className="w-3.5 h-3.5" strokeWidth={1.5} />
                    </div>
                    <div className="min-w-0">
                      <div className="text-[11px] font-semibold text-zinc-900 dark:text-white truncate">Code Along</div>
                      <div className="text-[9px] text-zinc-500 dark:text-zinc-400 font-mono">In-App IDE</div>
                    </div>
                  </button>

                  <button
                    id="yt-quick-slides-btn"
                    onClick={() => setSidePanelTab('slides')}
                    className="flex items-center gap-2 p-2.5 rounded-xl bg-black/[0.03] hover:bg-black/[0.06] dark:bg-white/[0.05] dark:hover:bg-white/10 border border-black/[0.05] dark:border-white/[0.08] text-left transition-colors group"
                  >
                    <div className="w-7 h-7 rounded-lg bg-amber-500/10 text-amber-700 dark:text-amber-400 flex items-center justify-center shrink-0">
                      <BookOpen className="w-3.5 h-3.5" strokeWidth={1.5} />
                    </div>
                    <div className="min-w-0">
                      <div className="text-[11px] font-semibold text-zinc-900 dark:text-white truncate">Open Slides</div>
                      <div className="text-[9px] text-zinc-500 dark:text-zinc-400 font-mono">PDF & PPTX</div>
                    </div>
                  </button>

                  <button
                    id="yt-more-explorer-btn"
                    onClick={() => setActiveTab('youtube')}
                    className="flex items-center gap-2 p-2.5 rounded-xl bg-black/[0.03] hover:bg-black/[0.06] dark:bg-white/[0.05] dark:hover:bg-white/10 border border-black/[0.05] dark:border-white/[0.08] text-left transition-colors group"
                  >
                    <div className="w-7 h-7 rounded-lg bg-red-500/10 text-red-700 dark:text-red-400 flex items-center justify-center shrink-0">
                      <Youtube className="w-3.5 h-3.5" strokeWidth={1.5} />
                    </div>
                    <div className="min-w-0">
                      <div className="text-[11px] font-semibold text-zinc-900 dark:text-white truncate">Explorer</div>
                      <div className="text-[9px] text-zinc-500 dark:text-zinc-400 font-mono">More Videos</div>
                    </div>
                  </button>
                </div>
              </div>
            </div>

            {/* Local Course Switcher Accordion */}
            <div className="rounded-2xl bg-black/[0.02] dark:bg-white/[0.02] border border-black/[0.04] dark:border-white/[0.06] overflow-hidden">
              <div className="p-3 bg-black/[0.01] dark:bg-white/[0.01] flex flex-col space-y-2">
                <div className="flex items-center justify-between">
                  <div className="min-w-0 pr-2">
                    <span className="text-[10px] font-mono text-zinc-500 dark:text-zinc-400 uppercase tracking-wider block">
                      Local Offline Repository
                    </span>
                    <div className="text-[12px] font-bold text-zinc-800 dark:text-zinc-200 truncate mt-0.5">
                      {catalog.name}
                    </div>
                  </div>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-black/[0.03] dark:bg-white/[0.06] text-zinc-500 dark:text-zinc-400 border border-black/[0.04] dark:border-white/[0.08] shrink-0 font-medium">
                    {catalog.totalVideos} Lectures
                  </span>
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <button
                    id="return-to-local-course-btn"
                    onClick={handleReturnToLocalCourse}
                    className="flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-zinc-900 hover:bg-zinc-800 dark:bg-white dark:hover:bg-zinc-200 text-white dark:text-zinc-950 text-[11px] font-semibold transition-all shadow-xs active:scale-[0.99]"
                  >
                    <Play className="w-3 h-3 fill-current" />
                    <span className="truncate">Resume {catalog.name.split(' ')[0]}</span>
                  </button>

                  <button
                    onClick={() => setIsLocalCourseExpanded(!isLocalCourseExpanded)}
                    className="p-2 rounded-xl bg-black/[0.03] hover:bg-black/[0.06] dark:bg-white/[0.05] dark:hover:bg-white/10 text-zinc-600 dark:text-zinc-400 border border-black/[0.04] dark:border-white/[0.06] transition-colors"
                    title={isLocalCourseExpanded ? 'Hide Local Lectures' : 'Browse Local Lectures'}
                  >
                    {isLocalCourseExpanded ? (
                      <ChevronDown className="w-3.5 h-3.5" />
                    ) : (
                      <ChevronRight className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>
              </div>

              {/* Collapsible Local Course Syllabus */}
              {isLocalCourseExpanded && (
                <div className="p-2 border-t border-black/[0.04] dark:border-white/[0.06] space-y-1.5 max-h-72 overflow-y-auto">
                  {catalog.modules.map(mod => (
                    <div key={mod.id} className="rounded-xl bg-white dark:bg-[#111218] border border-black/[0.04] dark:border-white/[0.06] p-2">
                      <div className="text-[11px] font-semibold text-zinc-700 dark:text-zinc-300 mb-1 truncate">
                        {mod.title}
                      </div>
                      <div className="space-y-1">
                        {mod.lessons.map(lesson => (
                          <div
                            key={lesson.id}
                            onClick={() => {
                              selectLesson(lesson, 0);
                              setSidePanelTab('curriculum');
                            }}
                            className="flex items-center justify-between p-1.5 rounded-lg hover:bg-black/[0.03] dark:hover:bg-white/[0.04] text-[11px] text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white cursor-pointer transition-colors"
                          >
                            <span className="truncate pr-2">{lesson.title}</span>
                            <Play className="w-2.5 h-2.5 shrink-0 opacity-60" />
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>
        ) : (
          /* Standard Course Syllabus (for local offline courses or imported virtual playlists) */
          <>
            {/* Syllabus Header & Search */}
            <div className="p-4 border-b border-black/[0.06] dark:border-white/[0.08] bg-black/[0.01] dark:bg-white/[0.02]">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-indigo-500/10 flex items-center justify-center text-indigo-700 dark:text-indigo-400">
                    <Layers className="w-3.5 h-3.5" strokeWidth={1.5} />
                  </div>
                  <h2 className="font-bold text-[14px] tracking-tight text-zinc-900 dark:text-white">Curriculum</h2>
                </div>
                <span className="text-[10px] font-mono px-2.5 py-0.5 rounded-full bg-black/[0.03] dark:bg-white/[0.06] text-zinc-500 dark:text-zinc-400 border border-black/[0.04] dark:border-white/[0.08] font-medium">
                  {catalog.totalVideos} Lectures
                </span>
              </div>

              {/* Search */}
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-zinc-500 dark:text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" strokeWidth={1.5} />
                <input
                  type="text"
                  placeholder="Search lectures & topics..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-black/[0.03] dark:bg-white/[0.04] border border-black/[0.05] dark:border-white/[0.07] rounded-full pl-9 pr-4 py-1.5 text-[12px] text-zinc-900 dark:text-white placeholder-zinc-500 dark:placeholder-zinc-400 focus:outline-none focus:border-indigo-500 focus-visible:ring-2 focus-visible:ring-indigo-500/40 transition-colors"
                />
              </div>
            </div>

            {/* Modules List */}
            <div className="flex-1 overflow-y-auto p-2.5 space-y-2">
              {filteredModules.length === 0 ? (
                <div className="p-8 text-center text-zinc-500 dark:text-zinc-400 text-[12px] font-mono">
                  No lectures matching "{searchQuery}"
                </div>
              ) : (
                filteredModules.map((mod) => {
                  const isExpanded = searchQuery.trim().length > 0 ? true : (expandedModules[mod.id] ?? false);
                  const completedInMod = mod.lessons.filter(l => completedSet.has(l.id)).length;
                  const isModAllCompleted = mod.lessons.length > 0 && completedInMod === mod.lessons.length;

                  return (
                    <div 
                      key={mod.id}
                      className="rounded-2xl bg-black/[0.02] dark:bg-white/[0.02] border border-black/[0.04] dark:border-white/[0.06] overflow-hidden transition-all duration-200"
                    >
                      {/* Module Header */}
                      <button
                        onClick={() => toggleModule(mod.id)}
                        className="w-full flex items-center justify-between p-3 text-left hover:bg-black/[0.03] dark:hover:bg-white/[0.04] transition-colors group"
                      >
                        <div className="flex items-center gap-2 min-w-0 pr-2">
                          {isExpanded ? (
                            <ChevronDown className="w-3.5 h-3.5 text-zinc-500 dark:text-zinc-400 flex-shrink-0" strokeWidth={1.5} />
                          ) : (
                            <ChevronRight className="w-3.5 h-3.5 text-zinc-500 dark:text-zinc-400 flex-shrink-0" strokeWidth={1.5} />
                          )}
                          <h4 className="text-[12px] font-semibold text-zinc-800 dark:text-zinc-200 truncate tracking-tight">
                            {mod.title}
                          </h4>
                        </div>

                        <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full font-medium ${
                          isModAllCompleted
                            ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30'
                            : 'text-zinc-500 dark:text-zinc-400 bg-black/[0.03] dark:bg-white/[0.06] border border-black/[0.04] dark:border-white/[0.08]'
                        }`}>
                          {completedInMod}/{mod.lessons.length}
                        </span>
                      </button>

                      {/* Module Items */}
                      {isExpanded && (
                        <div className="p-1 space-y-0.5 border-t border-black/[0.04] dark:border-white/[0.06] bg-white dark:bg-[#111218]">
                          {/* Slides */}
                          {mod.supplementaryFiles.map((pdf) => (
                            <button
                              key={pdf.id}
                              onClick={() => selectPdf(pdf)}
                              className="w-full flex items-center justify-between p-2 rounded-xl hover:bg-black/[0.03] dark:hover:bg-white/[0.04] text-left text-[12px] text-zinc-600 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white transition-colors group"
                            >
                              <div className="flex items-center gap-2 truncate pr-2">
                                <FileText className="w-3.5 h-3.5 text-indigo-500 flex-shrink-0" strokeWidth={1.5} />
                                <span className="truncate font-medium">{pdf.title}</span>
                              </div>
                              <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-600 dark:text-zinc-400">PDF</span>
                            </button>
                          ))}

                          {/* Lessons */}
                          {mod.lessons.map((lesson) => {
                            const isActive = activeLesson?.id === lesson.id;
                            const isDone = completedSet.has(lesson.id);

                            return (
                              <div
                                key={lesson.id}
                                onClick={() => selectLesson(lesson)}
                                className={`w-full flex items-center justify-between p-2 rounded-xl text-left text-[12px] transition-all duration-200 cursor-pointer ${
                                  isActive
                                    ? 'bg-zinc-900 dark:bg-white text-white dark:text-zinc-950 font-medium shadow-sm'
                                    : 'hover:bg-black/[0.03] dark:hover:bg-white/[0.04] text-zinc-800 dark:text-zinc-200'
                                }`}
                              >
                                <div className="flex items-center gap-2.5 min-w-0 pr-2">
                                  <button
                                    onClick={(e) => handleToggleComplete(e, lesson.id)}
                                    className={`transition-colors flex-shrink-0 ${isActive ? 'text-white dark:text-zinc-950' : 'text-zinc-500 dark:text-zinc-400 hover:text-indigo-600'}`}
                                  >
                                    {isDone ? (
                                      <Check className={`w-3.5 h-3.5 ${isActive ? 'text-emerald-400 dark:text-emerald-600' : 'text-emerald-500'}`} strokeWidth={1.5} />
                                    ) : (
                                      <Circle className="w-3.5 h-3.5" strokeWidth={1.5} />
                                    )}
                                  </button>

                                  <div className="truncate">
                                    <div className="truncate text-[12px] tracking-tight">
                                      {lesson.title}
                                    </div>
                                    <div className={`text-[10px] font-mono ${isActive ? 'text-white/70 dark:text-zinc-950/70' : 'text-zinc-500 dark:text-zinc-400'}`}>
                                      {lesson.fileSizeBytes > 0 ? `${(lesson.fileSizeBytes / (1024 * 1024)).toFixed(0)} MB` : 'Video'}
                                    </div>
                                  </div>
                                </div>

                                {isActive && (
                                  <Play className="w-3 h-3 fill-current flex-shrink-0" strokeWidth={1.5} />
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

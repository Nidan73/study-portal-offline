import React from 'react';
import { useStore } from '../store/useStore';
import { SkeletonCards } from './Skeleton';
import { 
  Play, 
  Flame, 
  Check, 
  ArrowRight, 
  Plus, 
  Clock,
  FolderPlus,
  FolderOpen,
  Globe,
  Layers,
  Sparkles,
  Trash2
} from 'lucide-react';

export const BentoDashboard: React.FC = () => {
  const [confirmRemoveId, setConfirmRemoveId] = React.useState<string | null>(null);
  // Per-field selectors, not a whole-store destructure: this component used to
  // re-render on every currentTime tick (~4x/sec during playback).
  const courses = useStore(state => state.courses);
  const activeCourseId = useStore(state => state.activeCourseId);
  const selectCourse = useStore(state => state.selectCourse);
  const removeCourse = useStore(state => state.removeCourse);
  const catalog = useStore(state => state.catalog);
  const activeLesson = useStore(state => state.activeLesson);
  const selectLesson = useStore(state => state.selectLesson);
  const setActiveTab = useStore(state => state.setActiveTab);
  const userData = useStore(state => state.userData);
  const setAddCourseModal = useStore(state => state.setAddCourseModal);
  const setAboutOpen = useStore(state => state.setAboutOpen);
  const pushToast = useStore(state => state.pushToast);
  const isCatalogLoading = useStore(state => state.isCatalogLoading);

  const activeCourse = courses.find(c => c.id === activeCourseId) || courses[0];
  const userCourseData = userData?.courses?.[activeCourseId];
  const completedCount = userCourseData?.completedLessonIds?.length || 0;
  const totalCount = catalog?.totalVideos || 0;
  const percent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
  const streak = userData?.globalStats?.streakDays || 1;
  const totalHours = ((userData?.globalStats?.totalHoursWatchedSeconds || 0) / 3600).toFixed(1);

  const resumeLesson = activeLesson || catalog?.modules[0]?.lessons[0] || null;

  // How far into THIS lesson you are — not course completion, which is what the
  // bar used to show.
  const resumeSeconds = resumeLesson
    ? (userCourseData?.resumePositions?.[resumeLesson.id]
       ?? (userCourseData?.lastWatched?.lessonId === resumeLesson.id ? userCourseData.lastWatched.timestampSeconds : 0)
       ?? 0)
    : 0;
  const resumeDuration = resumeLesson?.durationSeconds || 0;
  const lessonPercent = resumeDuration > 0
    ? Math.min(100, Math.round((resumeSeconds / resumeDuration) * 100))
    : 0;

  return (
    <div className="space-y-8 max-w-7xl mx-auto py-4 sm:py-6 pb-20 select-none transition-colors">
      {/* Top Hero Banner - Double-Bezel Hardware Enclosure */}
      <div className="p-1.5 sm:p-2 rounded-[2.5rem] bg-black/[0.03] dark:bg-white/[0.03] border border-black/[0.06] dark:border-white/[0.08] shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-[0_20px_50px_rgba(0,0,0,0.5)]">
        <div className="p-6 sm:p-10 rounded-[calc(2.5rem-0.375rem)] sm:rounded-[calc(2.5rem-0.5rem)] bg-white dark:bg-[#111218] border border-black/[0.05] dark:border-white/[0.06] shadow-[inset_0_1px_1px_rgba(255,255,255,0.15)] dark:shadow-[inset_0_1px_1px_rgba(255,255,255,0.06)] flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-3 max-w-3xl">
            <div className="flex items-center gap-2">
              <span className="rounded-full px-3 py-1 text-[10px] uppercase tracking-[0.2em] font-medium font-mono bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-400 border border-indigo-200/50 dark:border-indigo-800/40">
                Active Repository
              </span>
              <span className="text-[11px] font-mono text-zinc-600 dark:text-zinc-400">
                Offline Verified
              </span>
            </div>
            <h1 className="text-2xl sm:text-4xl font-extrabold text-zinc-900 dark:text-white tracking-tight leading-tight">
              {activeCourse?.name || 'StudyHub Platform'}
            </h1>
            <p className="text-[13px] sm:text-[14px] text-zinc-600 dark:text-zinc-400 leading-relaxed max-w-2xl">
              {activeCourse?.description || 'Instant byte-range video streaming, companion slide synchronization, and local progress tracking.'}
            </p>
          </div>

          <div className="flex items-center gap-3 flex-shrink-0">
            {/* Button-in-Button CTA */}
            <button
              onClick={() => setAddCourseModal(true)}
              className="px-5 py-3 rounded-full bg-black/[0.04] hover:bg-black/[0.07] dark:bg-white/[0.06] dark:hover:bg-white/[0.1] border border-black/[0.06] dark:border-white/[0.08] text-zinc-800 dark:text-zinc-200 text-[12px] font-medium transition-all duration-300 ease-fluid flex items-center gap-3 group active:scale-[0.98]"
            >
              <span>Scan Directory</span>
              <span className="w-7 h-7 rounded-full bg-black/[0.05] dark:bg-white/10 flex items-center justify-center transition-transform duration-300 ease-fluid group-hover:scale-110">
                <FolderPlus className="w-3.5 h-3.5 text-zinc-600 dark:text-zinc-300" strokeWidth={1.5} />
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* Asymmetrical Bento Grid */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-5">
        {/* Card 1: Continue Watching (Asymmetrical 8-col) */}
        <div className="md:col-span-8 p-1.5 rounded-[2rem] bg-black/[0.03] dark:bg-white/[0.03] border border-black/[0.06] dark:border-white/[0.08] shadow-[0_8px_25px_rgba(0,0,0,0.03)] dark:shadow-[0_15px_35px_rgba(0,0,0,0.4)] flex flex-col">
          <div className="p-6 sm:p-8 rounded-[calc(2rem-0.375rem)] bg-white dark:bg-[#111218] border border-black/[0.05] dark:border-white/[0.06] shadow-[inset_0_1px_1px_rgba(255,255,255,0.15)] dark:shadow-[inset_0_1px_1px_rgba(255,255,255,0.06)] flex-1 flex flex-col justify-between space-y-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-full bg-indigo-500/10 flex items-center justify-center text-indigo-700 dark:text-indigo-400">
                  <Clock className="w-3.5 h-3.5" strokeWidth={1.5} />
                </div>
                <span className="text-[10px] font-mono font-medium uppercase tracking-[0.2em] text-zinc-600 dark:text-zinc-400">
                  Continue Watching
                </span>
              </div>
              <span className="text-[11px] font-mono font-semibold text-indigo-700 dark:text-indigo-400 px-2.5 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950/50">
                {percent}% Mastered
              </span>
            </div>

            {resumeLesson ? (
              <div className="space-y-4">
                <div>
                  <h3 className="text-lg sm:text-xl font-bold text-zinc-900 dark:text-white tracking-tight line-clamp-1">
                    {resumeLesson.title}
                  </h3>
                  <p className="text-[12px] text-zinc-600 dark:text-zinc-400 font-mono mt-1 truncate">
                    {resumeLesson.relativePath}
                  </p>
                </div>

                <div className="space-y-1.5">
                  <div className="w-full bg-black/[0.04] dark:bg-white/[0.06] h-1.5 rounded-full overflow-hidden">
                    <div 
                      className="bg-indigo-500 h-full rounded-full transition-all duration-500 ease-fluid"
                      style={{ width: `${lessonPercent}%` }}
                    />
                  </div>
                  {resumeDuration > 0 && (
                    <p className="text-[11px] font-mono text-zinc-600 dark:text-zinc-400">
                      {Math.floor(resumeSeconds / 60)}m of {Math.round(resumeDuration / 60)}m watched
                    </p>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-3 pt-2">
                  {/* Button-in-Button Trailing CTA */}
                  <button
                    onClick={() => {
                      selectLesson(resumeLesson);
                      setActiveTab('player');
                    }}
                    className="px-6 py-3 rounded-full bg-zinc-900 dark:bg-white text-white dark:text-zinc-950 text-[12px] font-semibold transition-all duration-300 ease-fluid shadow-sm flex items-center gap-3 group active:scale-[0.98]"
                  >
                    <span>Resume Playback</span>
                    <span className="w-6 h-6 rounded-full bg-white/20 dark:bg-black/10 flex items-center justify-center transition-transform duration-300 ease-fluid group-hover:translate-x-0.5 group-hover:-translate-y-0.5">
                      <Play className="w-3 h-3 fill-current ml-0.5" strokeWidth={1.5} />
                    </span>
                  </button>

                  <button
                    onClick={() => setActiveTab('player')}
                    className="px-5 py-3 rounded-full bg-black/[0.03] hover:bg-black/[0.06] dark:bg-white/[0.05] dark:hover:bg-white/[0.09] border border-black/[0.05] dark:border-white/[0.08] text-zinc-700 dark:text-zinc-300 text-[12px] font-medium transition-all duration-200 ease-fluid"
                  >
                    View Curriculum
                  </button>
                </div>
              </div>
            ) : (
              <div className="py-10 text-center text-zinc-600 dark:text-zinc-400 text-[13px] font-mono">
                No lectures found in directory.
              </div>
            )}
          </div>
        </div>

        {/* Card 2: Learning Streak (Asymmetrical 4-col) */}
        <div className="md:col-span-4 p-1.5 rounded-[2rem] bg-black/[0.03] dark:bg-white/[0.03] border border-black/[0.06] dark:border-white/[0.08] shadow-[0_8px_25px_rgba(0,0,0,0.03)] dark:shadow-[0_15px_35px_rgba(0,0,0,0.4)] flex flex-col">
          <div className="p-6 sm:p-7 rounded-[calc(2rem-0.375rem)] bg-white dark:bg-[#111218] border border-black/[0.05] dark:border-white/[0.06] shadow-[inset_0_1px_1px_rgba(255,255,255,0.15)] dark:shadow-[inset_0_1px_1px_rgba(255,255,255,0.06)] flex-1 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-full bg-amber-500/10 flex items-center justify-center text-amber-500">
                    <Flame className="w-3.5 h-3.5" strokeWidth={1.5} />
                  </div>
                  <span className="text-[10px] font-mono font-medium uppercase tracking-[0.2em] text-zinc-600 dark:text-zinc-400">
                    Streak
                  </span>
                </div>
                <span className="text-[11px] font-mono font-bold text-amber-700 dark:text-amber-400 px-2 py-0.5 rounded-full bg-amber-500/10">
                  {streak} Days
                </span>
              </div>

              <div className="text-3xl sm:text-4xl font-extrabold tracking-tight text-zinc-900 dark:text-white">
                {streak} <span className="text-[13px] font-mono font-normal text-zinc-600 dark:text-zinc-400">consecutive</span>
              </div>
            </div>

            <div className="flex items-center justify-between pt-5 border-t border-black/[0.04] dark:border-white/[0.06] mt-6 text-[11px] font-mono text-zinc-600 dark:text-zinc-400">
              <span>Last studied</span>
              <span className="text-zinc-900 dark:text-white font-bold">
                {userData?.globalStats?.lastActiveDate || '—'}
              </span>
            </div>
          </div>
        </div>

        {/* Card 3: Overall Progress (Asymmetrical 4-col) */}
        <div className="md:col-span-4 p-1.5 rounded-[2rem] bg-black/[0.03] dark:bg-white/[0.03] border border-black/[0.06] dark:border-white/[0.08] shadow-[0_8px_25px_rgba(0,0,0,0.03)] dark:shadow-[0_15px_35px_rgba(0,0,0,0.4)] flex flex-col">
          <div className="p-6 sm:p-7 rounded-[calc(2rem-0.375rem)] bg-white dark:bg-[#111218] border border-black/[0.05] dark:border-white/[0.06] shadow-[inset_0_1px_1px_rgba(255,255,255,0.15)] dark:shadow-[inset_0_1px_1px_rgba(255,255,255,0.06)] flex-1 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="text-[10px] font-mono font-medium uppercase tracking-[0.2em] text-zinc-600 dark:text-zinc-400">
                  Course Completion
                </span>
                <span className="text-[11px] font-mono font-bold text-zinc-900 dark:text-white">{percent}%</span>
              </div>

              <div className="text-3xl sm:text-4xl font-extrabold tracking-tight text-zinc-900 dark:text-white">
                {completedCount} <span className="text-[13px] font-mono font-normal text-zinc-600 dark:text-zinc-400">/ {totalCount}</span>
              </div>
              <p className="text-[12px] text-zinc-600 dark:text-zinc-400 mt-1 font-mono">
                {catalog?.modules.length || 0} modules indexed
              </p>
            </div>

            <div className="pt-4 border-t border-black/[0.04] dark:border-white/[0.06] mt-4 flex items-center justify-between text-[11px] font-mono text-zinc-600 dark:text-zinc-400">
              <span>Playback Time</span>
              <span className="text-zinc-900 dark:text-white font-bold">{totalHours} hrs</span>
            </div>
          </div>
        </div>

        {/* Card 4: Offline Index Banner (Asymmetrical 8-col) */}
        <div className="md:col-span-8 p-1.5 rounded-[2rem] bg-black/[0.03] dark:bg-white/[0.03] border border-black/[0.06] dark:border-white/[0.08] shadow-[0_8px_25px_rgba(0,0,0,0.03)] dark:shadow-[0_15px_35px_rgba(0,0,0,0.4)] flex flex-col">
          <div className="p-6 sm:p-7 rounded-[calc(2rem-0.375rem)] bg-white dark:bg-[#111218] border border-black/[0.05] dark:border-white/[0.06] shadow-[inset_0_1px_1px_rgba(255,255,255,0.15)] dark:shadow-[inset_0_1px_1px_rgba(255,255,255,0.06)] flex-1 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Sparkles className="w-3.5 h-3.5 text-indigo-500" strokeWidth={1.5} />
                <span className="text-[10px] font-mono font-medium uppercase tracking-[0.2em] text-zinc-600 dark:text-zinc-400">
                  Local-First Engine
                </span>
              </div>
              <h4 className="text-base font-bold text-zinc-900 dark:text-white tracking-tight">
                Zero Cloud Dependencies
              </h4>
              <p className="text-[12px] text-zinc-600 dark:text-zinc-400 max-w-md">
                Native RFC-7233 partial-content streaming allows instant scrubbing with zero RAM bloat.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setActiveTab('player')}
                className="px-4 py-2 rounded-full bg-black/[0.03] hover:bg-black/[0.06] dark:bg-white/[0.05] dark:hover:bg-white/[0.09] border border-black/[0.05] dark:border-white/[0.08] text-zinc-700 dark:text-zinc-300 text-[11px] font-medium transition-colors"
              >
                Launch Cinema Mode
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Courses on Disk Section */}
      <div className="pt-4">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2.5">
            <div className="w-6 h-6 rounded-full bg-zinc-900 dark:bg-white text-white dark:text-zinc-950 flex items-center justify-center">
              <Globe className="w-3.5 h-3.5" strokeWidth={1.5} />
            </div>
            <h2 className="text-lg font-bold tracking-tight text-zinc-900 dark:text-white">Local Library</h2>
          </div>
          <span className="text-[11px] font-mono text-zinc-600 dark:text-zinc-400">
            {courses.length} courses loaded
          </span>
        </div>

        {isCatalogLoading && courses.length === 0 ? <SkeletonCards count={3} /> :
         courses.length === 0 ? (
          /* First run. Without this the library is a header reading "0 courses
             loaded" above a dashed square, which tells a new user nothing about
             where their material is supposed to go. */
          <div className="p-1.5 rounded-[2rem] bg-black/[0.03] dark:bg-white/[0.03] border border-black/[0.06] dark:border-white/[0.08]">
            <div className="p-8 sm:p-10 rounded-[calc(2rem-0.375rem)] bg-white dark:bg-[#111218] border border-black/[0.05] dark:border-white/[0.06]">
              <div className="max-w-xl">
                <div className="w-10 h-10 rounded-full bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 flex items-center justify-center mb-4">
                  <FolderOpen className="w-4 h-4" strokeWidth={1.5} />
                </div>
                <h3 className="text-lg font-bold tracking-tight text-zinc-900 dark:text-white">
                  Your library is empty
                </h3>
                <p className="text-[13px] leading-relaxed text-zinc-700 dark:text-zinc-300 mt-2">
                  Nothing is uploaded anywhere — this reads folders that are already on your
                  disk. There are two ways to fill it:
                </p>

                <ol className="mt-5 space-y-4">
                  <li className="flex gap-3.5">
                    <span className="w-6 h-6 rounded-full bg-black/[0.04] dark:bg-white/[0.08] text-zinc-700 dark:text-zinc-300 text-[11px] font-mono font-bold flex items-center justify-center flex-shrink-0 mt-px">1</span>
                    <div className="min-w-0">
                      <p className="text-[13px] font-semibold text-zinc-900 dark:text-white">
                        Put a course folder next to this app
                      </p>
                      <p className="text-[12px] leading-relaxed text-zinc-600 dark:text-zinc-400 mt-0.5">
                        Any folder holding a few videos or PDFs is picked up automatically and
                        named after the folder. Sub-folders become modules, so
                        <span className="font-mono text-[11px]"> Rust Course/Week 1</span> reads
                        as a week of Rust Course. Refresh once it is in place.
                      </p>
                    </div>
                  </li>
                  <li className="flex gap-3.5">
                    <span className="w-6 h-6 rounded-full bg-black/[0.04] dark:bg-white/[0.08] text-zinc-700 dark:text-zinc-300 text-[11px] font-mono font-bold flex items-center justify-center flex-shrink-0 mt-px">2</span>
                    <div className="min-w-0">
                      <p className="text-[13px] font-semibold text-zinc-900 dark:text-white">
                        Or point the scanner at a drive
                      </p>
                      <p className="text-[12px] leading-relaxed text-zinc-600 dark:text-zinc-400 mt-0.5">
                        It searches for folders that look like study material — lectures, slides
                        or PDFs — and lists what each one holds. Nothing is added until you pick it.
                      </p>
                    </div>
                  </li>
                </ol>

                <div className="flex flex-wrap items-center gap-3 mt-7">
                  <button
                    onClick={() => setAddCourseModal(true)}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-zinc-900 dark:bg-white text-white dark:text-zinc-950 text-[12px] font-bold hover:opacity-90 transition-opacity"
                  >
                    <Plus className="w-3.5 h-3.5" strokeWidth={2} />
                    <span>Scan a folder</span>
                  </button>
                  <button
                    onClick={() => setAboutOpen(true)}
                    className="px-5 py-2.5 rounded-full bg-black/[0.03] hover:bg-black/[0.06] dark:bg-white/[0.05] dark:hover:bg-white/10 border border-black/[0.06] dark:border-white/[0.08] text-zinc-700 dark:text-zinc-300 text-[12px] font-medium transition-colors"
                  >
                    What can I do here?
                  </button>
                </div>

                <p className="text-[11px] text-zinc-600 dark:text-zinc-400 mt-5">
                  You can also study from YouTube right now without adding anything.
                </p>
              </div>
            </div>
          </div>
        ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {courses.map((course) => {
            const isCurrent = course.id === activeCourseId;
            return (
              <div
                key={course.id}
                className={`p-1.5 rounded-[2rem] transition-all duration-300 ease-fluid ${
                  isCurrent
                    ? 'bg-zinc-900/5 dark:bg-white/10 ring-1 ring-zinc-900/20 dark:ring-white/20'
                    : 'bg-black/[0.03] dark:bg-white/[0.03]'
                } border border-black/[0.06] dark:border-white/[0.08]`}
              >
                <div className="p-6 rounded-[calc(2rem-0.375rem)] bg-white dark:bg-[#111218] border border-black/[0.05] dark:border-white/[0.06] shadow-[inset_0_1px_1px_rgba(255,255,255,0.15)] dark:shadow-[inset_0_1px_1px_rgba(255,255,255,0.06)] h-full flex flex-col justify-between space-y-4">
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-[10px] font-mono font-medium px-2.5 py-0.5 rounded-full bg-black/[0.03] dark:bg-white/[0.06] text-zinc-600 dark:text-zinc-400 uppercase tracking-wider">
                        {course.badge || 'Local Course'}
                      </span>
                      {isCurrent && (
                        <span className="flex items-center gap-1 text-[10px] font-mono font-semibold text-emerald-700 dark:text-emerald-400">
                          <Check className="w-3 h-3" strokeWidth={1.5} />
                          <span>Active</span>
                        </span>
                      )}
                    </div>

                    <h3 className="text-[15px] font-bold text-zinc-900 dark:text-white tracking-tight line-clamp-1">
                      {course.name}
                    </h3>
                    <p className="text-[12px] leading-relaxed text-zinc-600 dark:text-zinc-400 mt-1 line-clamp-2">
                      {course.description}
                    </p>
                  </div>

                  <div className="pt-4 border-t border-black/[0.04] dark:border-white/[0.06] flex items-center justify-between">
                    <span className="text-[10px] font-mono text-zinc-600 dark:text-zinc-400 truncate max-w-[150px]" title={course.rootPath || ''}>
                      {course.isVirtual ? 'YouTube Series' : (course.rootPath ? course.rootPath.split('/').filter(Boolean).slice(-2).join('/') : 'Local')}
                    </span>

                    <div className="flex items-center gap-1.5">
                      {!isCurrent && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            // Two-step in the UI's own language rather than a
                            // native confirm() dialog. Removing only un-indexes
                            // the course; nothing on disk is touched.
                            if (confirmRemoveId !== course.id) {
                              setConfirmRemoveId(course.id);
                              setTimeout(() => setConfirmRemoveId(prev => (prev === course.id ? null : prev)), 4000);
                              return;
                            }
                            setConfirmRemoveId(null);
                            removeCourse(course.id).then(ok =>
                              pushToast(
                                ok ? `Removed "${course.name}" from the library. Files on disk are untouched.` : `Could not remove "${course.name}".`,
                                ok ? 'success' : 'error'
                              )
                            );
                          }}
                          className={`rounded-full transition-colors ${confirmRemoveId === course.id ? 'px-2.5 py-1.5 bg-rose-500/15 text-rose-500 text-[10px] font-mono font-semibold' : 'p-1.5 hover:bg-red-500/10 text-zinc-600 dark:text-zinc-400 hover:text-red-500'}`}
                          title={confirmRemoveId === course.id ? 'Click again to remove' : 'Remove course from library'}
                        >
                          {confirmRemoveId === course.id ? <span>Confirm?</span> : <Trash2 className="w-3.5 h-3.5" strokeWidth={1.5} />}
                        </button>
                      )}

                      {isCurrent ? (
                        <button
                          onClick={() => setActiveTab('player')}
                          className="px-4 py-2 rounded-full bg-zinc-900 dark:bg-white text-white dark:text-zinc-950 text-[11px] font-semibold flex items-center gap-2 transition-all duration-200 ease-fluid group"
                        >
                          <span>Study</span>
                          <span className="w-4 h-4 rounded-full bg-white/20 dark:bg-black/10 flex items-center justify-center transition-transform group-hover:translate-x-0.5">
                            <ArrowRight className="w-2.5 h-2.5" strokeWidth={1.5} />
                          </span>
                        </button>
                      ) : (
                        <button
                          onClick={() => selectCourse(course.id)}
                          className="px-4 py-2 rounded-full bg-black/[0.03] hover:bg-black/[0.06] dark:bg-white/[0.05] dark:hover:bg-white/10 border border-black/[0.05] dark:border-white/[0.08] text-zinc-700 dark:text-zinc-300 text-[11px] font-medium transition-colors"
                        >
                          Switch
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}

          {/* Add Course Card - Double-Bezel Dashed Core */}
          <div 
            onClick={() => setAddCourseModal(true)}
            className="p-1.5 rounded-[2rem] bg-black/[0.02] dark:bg-white/[0.02] border border-black/[0.04] dark:border-white/[0.06] cursor-pointer group"
          >
            <div className="p-6 rounded-[calc(2rem-0.375rem)] border-2 border-dashed border-black/[0.08] dark:border-white/[0.1] group-hover:border-zinc-400 dark:group-hover:border-white/30 h-full flex flex-col items-center justify-center text-center min-h-[160px] transition-all duration-200">
              <div className="w-10 h-10 rounded-full bg-black/[0.03] dark:bg-white/[0.06] flex items-center justify-center text-zinc-600 dark:text-zinc-400 group-hover:text-zinc-900 dark:group-hover:text-white transition-colors mb-2">
                <Plus className="w-4 h-4" strokeWidth={1.5} />
              </div>
              <h4 className="text-[13px] font-bold text-zinc-800 dark:text-zinc-200">
                Scan Course Folder
              </h4>
              <p className="text-[11px] text-zinc-600 dark:text-zinc-400 mt-0.5 font-mono">
                Index videos, slides or PDFs
              </p>
            </div>
          </div>
        </div>
        )}
      </div>
    </div>
  );
};

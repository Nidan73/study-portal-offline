import { create } from 'zustand';
import { CourseSummary, CourseCatalog, LessonItem, SupplementaryFile, StudyHubData, LessonBookmark } from '../types';

/** YouTube videos belong to no course, so their notes, pins and positions live
 *  in one shared bucket instead of under whichever course was active when you
 *  made them — which is why opening the same video later showed nothing. */
export const YOUTUBE_BUCKET = '__youtube__';
export const dataBucketFor = (lessonId: string, activeCourseId: string) =>
  lessonId.startsWith('yt_') ? YOUTUBE_BUCKET : activeCourseId;

export type NavTab = 'player' | 'split-slides' | 'split-code' | 'notes' | 'ide' | 'library' | 'youtube';
export type SidePanelTab = 'curriculum' | 'code' | 'notes' | 'slides';

export interface YouTubeHistoryEntry {
  id: string;
  videoId: string;
  title: string;
  thumbnailUrl?: string;
  durationSeconds?: number;
  lastWatchedAt: string;
  positionSeconds: number;
  notes: number;
  bookmarks: number;
}

export interface ScratchNote {
  id: string;
  content: string;
  createdAt: string;
  updatedAt: string;
}

export interface Toast {
  id: string;
  message: string;
  tone: 'success' | 'error' | 'info';
  /** Optional single action, used for Undo on destructive operations. */
  action?: { label: string; run: () => void };
  /** ms before auto-dismiss; undoable toasts get longer. */
  durationMs: number;
}

export interface StoreState {
  // Course State
  courses: CourseSummary[];
  activeCourseId: string;
  catalog: CourseCatalog | null;
  activeLesson: LessonItem | null;
  activePdf: SupplementaryFile | null;
  
  // UI State
  theme: 'dark' | 'light';
  activeTab: NavTab;
  sidePanelTab: SidePanelTab;
  splitWidth: 'balanced' | 'compact';
  splitRatio: number;
  splitLayout: 'side' | 'bottom';
  isLoading: boolean;
  isCatalogLoading: boolean;
  isSidebarOpen: boolean;
  isCommandPaletteOpen: boolean;
  isAddCourseModalOpen: boolean;
  isShortcutHelpOpen: boolean;
  isDarkPdf: boolean;
  autoPauseOnNote: boolean;
  /** Second notes dock beneath the video, so a deck can stay open beside it. */
  showNotesUnderVideo: boolean;
  /** Slide currently on screen in the deck viewer, so notes can attach it. */
  activeSlideNumber: number | null;
  
  // Player State
  currentTime: number;
  duration: number;
  isPlaying: boolean;
  playbackRate: number;
  volume: number;
  isMuted: boolean;
  audioBoost: number;
  abLoop: {
    a: number | null;
    b: number | null;
    active: boolean;
  };

  // IDE State
  activeCodeLanguage: 'javascript' | 'python' | 'cpp' | 'c' | 'html';
  currentCode: string;
  codeOutput: {
    stdout: string;
    stderr: string;
    exitCode: number;
    executionTimeMs: number;
    compileError?: boolean;
    timedOut?: boolean;
  } | null;
  isExecutingCode: boolean;
  
  toasts: Toast[];
  /** General notepad — notes with no lesson or course attached. */
  scratchNotes: ScratchNote[];
  youtubeHistory: YouTubeHistoryEntry[];
  isScratchpadOpen: boolean;

  // User Data State
  userData: StudyHubData | null;
  lastSyncedTimestamp: number;

  // Actions
  pushToast: (message: string, tone?: Toast['tone'], action?: Toast['action']) => void;
  dismissToast: (id: string) => void;
  setScratchpadOpen: (open: boolean) => void;
  fetchScratchNotes: () => Promise<void>;
  fetchYouTubeHistory: () => Promise<void>;
  removeYouTubeHistoryEntry: (id: string) => Promise<void>;
  clearYouTubeHistory: () => Promise<void>;
  saveScratchNote: (content: string, id?: string) => Promise<void>;
  removeScratchNote: (id: string) => Promise<void>;
  fetchInitialData: () => Promise<void>;
  selectCourse: (courseId: string) => Promise<void>;
  selectLesson: (lesson: LessonItem, startAt?: number) => void;
  selectPdf: (pdf: SupplementaryFile | null) => void;
  closePdf: () => void;
  toggleTheme: () => void;
  setTheme: (theme: 'dark' | 'light') => void;
  setActiveTab: (tab: NavTab) => void;
  setSidePanelTab: (tab: SidePanelTab) => void;
  setSplitWidth: (width: 'balanced' | 'compact') => void;
  setSplitRatio: (ratio: number) => void;
  setSplitLayout: (layout: 'side' | 'bottom') => void;
  toggleSplitWidth: () => void;
  toggleSidebar: () => void;
  setCommandPalette: (open: boolean) => void;
  setAddCourseModal: (open: boolean) => void;
  setShortcutHelpOpen: (open: boolean) => void;
  toggleDarkPdf: () => void;
  setActiveSlideNumber: (n: number | null) => void;
  toggleAutoPauseOnNote: () => void;
  toggleNotesUnderVideo: () => void;
  setAutoPauseOnNote: (enabled: boolean) => void;
  setPlaybackRate: (rate: number) => void;
  setIsPlaying: (playing: boolean) => void;
  setCurrentTime: (time: number) => void;
  setDuration: (dur: number) => void;
  setVolume: (vol: number) => void;
  toggleMute: () => void;
  setAudioBoost: (boost: number) => void;
  setLoopA: (time?: number) => void;
  setLoopB: (time?: number) => void;
  toggleLoop: () => void;
  clearLoop: () => void;
  addBookmark: (lessonId: string, timestampSeconds: number, label?: string) => Promise<void>;
  removeBookmark: (lessonId: string, bookmarkId: string) => Promise<void>;
  clearAllBookmarks: (lessonId: string) => Promise<void>;
  toggleLessonComplete: (lessonId: string) => Promise<void>;
  addNote: (lessonId: string, timestamp: number, content: string, slideNumber?: number) => Promise<void>;
  removeNote: (lessonId: string, noteId: string) => Promise<void>;
  clearAllNotes: (lessonId: string) => Promise<void>;
  syncProgressToDisk: (force?: boolean) => Promise<void>;
  addCustomCourse: (folderPath: string, name?: string) => Promise<boolean>;
  saveYouTubeCourse: (title: string, playlistId: string, videos: any[]) => Promise<string | null>;
  removeCourse: (courseId: string) => Promise<boolean>;
  playYouTubeVideoImmediately: (video: { id: string; title: string; durationSeconds?: number; thumbnailUrl?: string }) => void;
  playDirectUrl: (url: string, title?: string) => void;
  goToNextLesson: () => void;
  goToPrevLesson: () => void;

  // IDE Actions
  setActiveCodeLanguage: (lang: 'javascript' | 'python' | 'cpp' | 'c' | 'html') => void;
  setCurrentCode: (code: string) => void;
  executeCode: () => Promise<void>;
  resetCodeTemplate: () => void;
  saveLessonCode: (lessonId: string, language: string, code: string) => Promise<void>;
}

let syncTimeout: any = null;

const getInitialTheme = (): 'dark' | 'light' => {
  if (typeof window !== 'undefined') {
    const saved = localStorage.getItem('study_hub_theme');
    if (saved === 'light' || saved === 'dark') {
      if (saved === 'dark') document.documentElement.classList.add('dark');
      else document.documentElement.classList.remove('dark');
      return saved;
    }
    // Default to dark mode for video platform
    document.documentElement.classList.add('dark');
    return 'dark';
  }
  return 'dark';
};

export const getInitialSplitRatio = (): number => {
  if (typeof window !== 'undefined') {
    const saved = localStorage.getItem('study_hub_split_ratio');
    if (saved) {
      const parsed = parseFloat(saved);
      // Automatically migrate previous 62 default to user requested 70 default
      if (parsed === 62) {
        localStorage.setItem('study_hub_split_ratio', '70');
        return 70;
      }
      if (!isNaN(parsed) && parsed >= 30 && parsed <= 80) return parsed;
    }
  }
  return 70;
};

export const getInitialSplitLayout = (): 'side' | 'bottom' => {
  if (typeof window !== 'undefined') {
    const saved = localStorage.getItem('study_hub_split_layout');
    if (saved === 'side' || saved === 'bottom') return saved;
  }
  return 'side';
};

export const getInitialAutoPauseOnNote = (): boolean => {
  if (typeof window !== 'undefined') {
    return localStorage.getItem('study_hub_auto_pause_on_note') === 'true';
  }
  return false;
};

export const getInitialTab = (): NavTab => {
  if (typeof window !== 'undefined') {
    const path = window.location.pathname.toLowerCase();
    if (path === '/ide') return 'ide';
    if (path === '/library') return 'library';
    if (path === '/notes') return 'notes';
    if (path === '/slides') return 'split-slides';
    if (path === '/split-code' || path === '/code') return 'split-code';
    if (path === '/youtube') return 'youtube';
    return 'player';
  }
  return 'player';
};

export const getPathFromTab = (tab: NavTab): string => {
  switch (tab) {
    case 'ide': return '/ide';
    case 'library': return '/library';
    case 'notes': return '/notes';
    case 'split-slides': return '/slides';
    case 'split-code': return '/code';
    case 'youtube': return '/youtube';
    default: return '/';
  }
};

export const DEFAULT_CODE_TEMPLATES: Record<string, string> = {
  javascript: `// JavaScript & Node.js Execution Playground
// Shortcut: Press ⌘ + Enter or Ctrl + Enter to run

function solve() {
  const items = [10, 25, 40, 55, 70];
  const total = items.reduce((acc, curr) => acc + curr, 0);
  console.log('Dataset:', items);
  console.log('Calculated sum:', total);
}

solve();
`,
  python: `# Python 3 Execution Playground
# Shortcut: Press ⌘ + Enter or Ctrl + Enter to run

def fibonacci(n):
    sequence = []
    a, b = 0, 1
    for _ in range(n):
        sequence.append(a)
        a, b = b, a + b
    return sequence

print("Generated Fibonacci series:")
print(fibonacci(10))
`,
  cpp: `// C++ (g++ -O2) Execution Playground
// Shortcut: Press ⌘ + Enter or Ctrl + Enter to compile & run

#include <iostream>
#include <vector>
#include <numeric>

int main() {
    std::vector<int> nums = {1, 2, 3, 4, 5, 6, 7, 8, 9, 10};
    int sum = std::accumulate(nums.begin(), nums.end(), 0);
    
    std::cout << "C++ Native Execution" << std::endl;
    std::cout << "Sum of 1 to 10: " << sum << std::endl;
    return 0;
}
`,
  c: `// C (gcc -O2) Execution Playground
// Shortcut: Press ⌘ + Enter or Ctrl + Enter to compile & run

#include <stdio.h>

int main() {
    printf("C Native Execution\\n");
    int sum = 0;
    for (int i = 1; i <= 10; i++) {
        sum += i;
    }
    printf("Sum 1..10 = %d\\n", sum);
    return 0;
}
`,
  html: `<!DOCTYPE html>
<html>
<head>
  <style>
    body {
      font-family: system-ui, -apple-system, sans-serif;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      margin: 0;
      background: #0f1016;
      color: #fafafa;
    }
    .card {
      padding: 2.5rem;
      border-radius: 1.5rem;
      background: rgba(255, 255, 255, 0.04);
      border: 1px solid rgba(255, 255, 255, 0.08);
      text-align: center;
      box-shadow: 0 20px 40px rgba(0,0,0,0.5);
    }
    button {
      padding: 0.6rem 1.4rem;
      border-radius: 9999px;
      border: none;
      background: #6366f1;
      color: white;
      font-weight: 600;
      cursor: pointer;
      margin-top: 1.25rem;
      transition: transform 0.2s;
    }
    button:hover {
      transform: scale(1.05);
    }
  </style>
</head>
<body>
  <div class="card">
    <h2>Interactive Web Preview</h2>
    <p>Live sandbox rendering directly in browser.</p>
    <button onclick="handleClick()">Click Me</button>
    <p id="counter" style="margin-top: 1rem; font-family: monospace; color: #818cf8;">Clicks: 0</p>
  </div>
  <script>
    let count = 0;
    function handleClick() {
      count++;
      document.getElementById('counter').innerText = 'Clicks: ' + count;
    }
  </script>
</body>
</html>
`
};

export const useStore = create<StoreState>((set, get) => ({
  courses: [],
  activeCourseId: '100xdevs-cohort',
  catalog: null,
  activeLesson: null,
  activePdf: null,
  
  theme: getInitialTheme(),
  activeTab: getInitialTab(),
  sidePanelTab: 'curriculum',
  splitWidth: 'compact',
  splitRatio: getInitialSplitRatio(),
  splitLayout: getInitialSplitLayout(),
  isLoading: true,
  isCatalogLoading: false,
  isSidebarOpen: true,
  isCommandPaletteOpen: false,
  isAddCourseModalOpen: false,
  isShortcutHelpOpen: false,
  isDarkPdf: true,
  autoPauseOnNote: getInitialAutoPauseOnNote(),
  showNotesUnderVideo: typeof window !== 'undefined' && localStorage.getItem('study_hub_notes_under_video') === 'true',
  activeSlideNumber: null,
  
  currentTime: 0,
  duration: 0,
  isPlaying: false,
  playbackRate: 1,
  volume: 1,
  isMuted: false,
  audioBoost: 1,
  abLoop: { a: null, b: null, active: false },

  activeCodeLanguage: 'javascript',
  currentCode: DEFAULT_CODE_TEMPLATES.javascript,
  codeOutput: null,
  isExecutingCode: false,
  
  toasts: [],
  scratchNotes: [],
  youtubeHistory: [],
  isScratchpadOpen: false,

  userData: null,
  lastSyncedTimestamp: 0,

  pushToast: (message, tone = 'info', action) => {
    const id = `t-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    // Undoable toasts stay long enough to actually undo.
    const durationMs = action ? 8000 : tone === 'error' ? 6000 : 3000;
    set(state => ({ toasts: [...state.toasts, { id, message, tone, action, durationMs }] }));
    setTimeout(() => get().dismissToast(id), durationMs);
  },

  dismissToast: (id) => set(state => ({ toasts: state.toasts.filter(t => t.id !== id) })),

  setScratchpadOpen: (open) => {
    set({ isScratchpadOpen: open });
    if (open) get().fetchScratchNotes();
  },

  fetchYouTubeHistory: async () => {
    try {
      const res = await fetch('/api/youtube/history');
      if (!res.ok) return;
      const data = await res.json();
      set({ youtubeHistory: data.history || [] });
    } catch (e) {
      console.error('Failed to load watch history:', e);
    }
  },

  removeYouTubeHistoryEntry: async (id) => {
    const removed = get().youtubeHistory.find(h => h.id === id);
    try {
      const res = await fetch('/api/youtube/history', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ removeId: id })
      });
      if (!res.ok) throw new Error('failed');
      await get().fetchYouTubeHistory();
      if (removed) {
        get().pushToast('Removed from history.', 'info', {
          label: 'Undo',
          run: async () => {
            await fetch('/api/youtube/history', {
              method: 'POST', headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                id: removed.id, videoId: removed.videoId, title: removed.title,
                thumbnailUrl: removed.thumbnailUrl, durationSeconds: removed.durationSeconds,
                positionSeconds: removed.positionSeconds
              })
            });
            await get().fetchYouTubeHistory();
          }
        });
      }
    } catch (e) {
      get().pushToast('Could not remove that from history.', 'error');
    }
  },

  clearYouTubeHistory: async () => {
    const previous = get().youtubeHistory;
    try {
      await fetch('/api/youtube/history', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clearAll: true })
      });
      set({ youtubeHistory: [] });
      get().pushToast(`Cleared ${previous.length} from history. Your notes are kept.`, 'info', {
        label: 'Undo',
        run: async () => {
          for (const h of [...previous].reverse()) {
            await fetch('/api/youtube/history', {
              method: 'POST', headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ id: h.id, videoId: h.videoId, title: h.title,
                thumbnailUrl: h.thumbnailUrl, durationSeconds: h.durationSeconds,
                positionSeconds: h.positionSeconds })
            });
          }
          await get().fetchYouTubeHistory();
        }
      });
    } catch (e) {
      get().pushToast('Could not clear history.', 'error');
    }
  },

  fetchScratchNotes: async () => {
    try {
      const res = await fetch('/api/scratchpad');
      if (!res.ok) return;
      const data = await res.json();
      set({ scratchNotes: data.notes || [] });
    } catch (e) {
      console.error('Failed to load notepad:', e);
    }
  },

  saveScratchNote: async (content, id) => {
    try {
      const res = await fetch('/api/scratchpad', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content, id })
      });
      if (!res.ok) throw new Error('save failed');
      const data = await res.json();
      set({ scratchNotes: data.notes || [] });
    } catch (e) {
      console.error('Failed to save notepad entry:', e);
      get().pushToast('That notepad entry could not be saved.', 'error');
    }
  },

  removeScratchNote: async (id) => {
    const removed = get().scratchNotes.find(n => n.id === id);
    try {
      const res = await fetch('/api/scratchpad', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ removeId: id })
      });
      if (!res.ok) throw new Error('delete failed');
      const data = await res.json();
      set({ scratchNotes: data.notes || [] });
      if (removed) {
        get().pushToast('Note deleted.', 'info', {
          label: 'Undo',
          run: () => get().saveScratchNote(removed.content)
        });
      }
    } catch (e) {
      console.error('Failed to delete notepad entry:', e);
      get().pushToast('Could not delete that note.', 'error');
    }
  },

  fetchInitialData: async () => {
    try {
      set({ isLoading: true });
      const [coursesRes, progressRes] = await Promise.all([
        fetch('/api/courses'),
        fetch('/api/progress')
      ]);

      const coursesData = await coursesRes.json();
      const progressData = await progressRes.json();

      const initialCourseId = progressData.activeCourseId || (coursesData.courses[0]?.id || '100xdevs-cohort');

      set({
        courses: coursesData.courses || [],
        activeCourseId: initialCourseId,
        userData: progressData,
        isLoading: false
      });

      await get().selectCourse(initialCourseId);
    } catch (err) {
      console.error('Failed to fetch initial data:', err);
      get().pushToast('Could not reach the StudyHub server. Is it still running?', 'error');
      set({ isLoading: false });
    }
  },

  selectCourse: async (courseId: string) => {
    try {
      // Clear the outgoing lesson immediately. The catalog fetch is async, so
      // leaving it in place meant the previous course's video kept playing —
      // and a YouTube video could sit under a freshly-selected local course.
      set({
        isCatalogLoading: true,
        activeCourseId: courseId,
        activeLesson: null,
        activePdf: null,
        isPlaying: false,
        currentTime: 0,
        duration: 0
      });
      const res = await fetch(`/api/catalog/${courseId}`);
      if (!res.ok) throw new Error('Failed to load course catalog');
      const catalogData: CourseCatalog = await res.json();

      // Find saved last watched lesson or default to first lesson of first module
      const savedCourse = get().userData?.courses?.[courseId];
      let resumeLesson: LessonItem | null = null;
      let resumeTime = 0;

      if (savedCourse?.lastWatched?.lessonId) {
        for (const mod of catalogData.modules) {
          const found = mod.lessons.find(l => l.id === savedCourse.lastWatched?.lessonId);
          if (found) {
            resumeLesson = found;
            resumeTime = savedCourse.lastWatched.timestampSeconds;
            break;
          }
        }
      }

      // A directly-played YouTube video is in no catalog, so the loop above
      // cannot find it. Restore it from the saved descriptor before falling
      // back to the first lesson — otherwise reloading silently swapped you
      // onto an unrelated local lecture.
      // Only for a virtual/YouTube course. Restoring a YouTube video when the
      // user has just picked a local course is not what they asked for, and a
      // stale yt_ pointer left in a local course would do exactly that.
      if (!resumeLesson && catalogData.isVirtual && savedCourse?.lastWatched?.lessonId?.startsWith('yt_')) {
        const saved = get().userData?.lastYouTubeLesson;
        if (saved && saved.id === savedCourse.lastWatched.lessonId) {
          resumeLesson = {
            id: saved.id,
            title: saved.title,
            filename: `${saved.youtubeVideoId}.mp4`,
            relativePath: saved.youtubeVideoId,
            fileSizeBytes: 0,
            durationSeconds: saved.durationSeconds || 0,
            extension: '.mp4',
            source: 'youtube',
            youtubeVideoId: saved.youtubeVideoId,
            thumbnailUrl: saved.thumbnailUrl
          } as LessonItem;
          resumeTime = savedCourse.resumePositions?.[saved.id]
            ?? savedCourse.lastWatched.timestampSeconds ?? 0;
        }
      }

      if (!resumeLesson && catalogData.modules.length > 0 && catalogData.modules[0].lessons.length > 0) {
        resumeLesson = catalogData.modules[0].lessons[0];
      }

      set({
        catalog: catalogData,
        activeLesson: resumeLesson,
        currentTime: resumeTime,
        activePdf: resumeLesson?.companionPdf || (catalogData.modules[0]?.supplementaryFiles?.[0] || null),
        isCatalogLoading: false
      });

      // Update active course on backend
      fetch('/api/progress', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ activeCourseId: courseId })
      }).catch(console.error);

    } catch (err) {
      console.error('Failed to load catalog for course:', courseId, err);
      set({ isCatalogLoading: false });

      // Fall back to any course that does still exist, rather than stranding
      // the app on an empty state (this happens when a course is removed, or
      // its drive is unplugged, while it was the active one).
      const fallback = get().courses.find(c => c.id !== courseId);
      if (fallback) {
        get().pushToast(`That course is no longer available. Switched to "${fallback.name}".`, 'error');
        await get().selectCourse(fallback.id);
      } else {
        get().pushToast('Could not load that course. The folder may have moved or been unplugged.', 'error');
        set({ catalog: null, activeLesson: null });
      }
    }
  },

  selectLesson: (lesson: LessonItem, startAt?: number) => {
    const { activeCourseId, userData } = get();
    const bucketId = dataBucketFor(lesson.id, activeCourseId);
    const course = userData?.courses?.[bucketId];
    // Per-lesson position first; fall back to lastWatched for data saved before
    // resumePositions existed, so existing progress is not lost on upgrade.
    const savedTime = startAt !== undefined
      ? startAt
      : (course?.resumePositions?.[lesson.id]
         ?? (course?.lastWatched?.lessonId === lesson.id ? course.lastWatched.timestampSeconds : 0)
         ?? 0);

    const savedSnippet = userData?.courses?.[bucketId]?.codeSnippets?.[lesson.id];
    let nextLang = get().activeCodeLanguage;
    let nextCode = get().currentCode;

    if (savedSnippet) {
      nextLang = (savedSnippet.language as any) || 'javascript';
      nextCode = savedSnippet.code;
    }

    set({
      activeLesson: lesson,
      currentTime: savedTime,
      activePdf: lesson.companionPdf || null,
      activeCodeLanguage: nextLang,
      currentCode: nextCode,
      isPlaying: true
    });

    get().syncProgressToDisk(true);
  },

  selectPdf: (pdf: SupplementaryFile | null) => {
    set({ activePdf: pdf });
  },

  closePdf: () => {
    const currentTab = get().activeTab;
    const currentSidePanel = get().sidePanelTab;
    set({
      activePdf: null,
      activeTab: currentTab === 'split-slides' ? 'player' : currentTab,
      sidePanelTab: currentSidePanel === 'slides' ? 'curriculum' : currentSidePanel
    });
  },

  toggleTheme: () => {
    const current = get().theme;
    const next = current === 'dark' ? 'light' : 'dark';
    if (typeof window !== 'undefined') {
      localStorage.setItem('study_hub_theme', next);
      if (next === 'dark') {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    }
    set({ theme: next });
  },

  setTheme: (next: 'dark' | 'light') => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('study_hub_theme', next);
      if (next === 'dark') {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    }
    set({ theme: next });
  },

  setActiveTab: (tab: NavTab) => {
    if (typeof window !== 'undefined') {
      const targetPath = getPathFromTab(tab);
      if (window.location.pathname !== targetPath) {
        window.history.pushState(null, '', targetPath);
      }
    }
    set({ activeTab: tab });
  },

  setSidePanelTab: (tab: SidePanelTab) => set({ sidePanelTab: tab, isSidebarOpen: true }),
  setSplitRatio: (ratio: number) => {
    const clamped = Math.min(80, Math.max(30, Math.round(ratio)));
    if (typeof window !== 'undefined') {
      localStorage.setItem('study_hub_split_ratio', clamped.toString());
    }
    set({ splitRatio: clamped, splitWidth: clamped <= 52 ? 'balanced' : 'compact' });
  },
  setSplitLayout: (layout: 'side' | 'bottom') => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('study_hub_split_layout', layout);
    }
    set({ splitLayout: layout });
  },
  setSplitWidth: (width: 'balanced' | 'compact') => {
    const ratio = width === 'balanced' ? 50 : 70;
    get().setSplitRatio(ratio);
  },
  toggleSplitWidth: () => {
    const current = get().splitRatio;
    const next = current <= 52 ? 70 : 50;
    get().setSplitRatio(next);
  },
  toggleSidebar: () => set((state) => ({ isSidebarOpen: !state.isSidebarOpen })),
  setCommandPalette: (open) => set({ isCommandPaletteOpen: open }),
  setAddCourseModal: (open) => set({ isAddCourseModalOpen: open }),
  toggleDarkPdf: () => set((state) => ({ isDarkPdf: !state.isDarkPdf })),
  setActiveSlideNumber: (n: number | null) => set({ activeSlideNumber: n }),
  toggleNotesUnderVideo: () => {
    const next = !get().showNotesUnderVideo;
    if (typeof window !== 'undefined') {
      localStorage.setItem('study_hub_notes_under_video', String(next));
    }
    set({ showNotesUnderVideo: next });
  },

  toggleAutoPauseOnNote: () => {
    const next = !get().autoPauseOnNote;
    if (typeof window !== 'undefined') {
      localStorage.setItem('study_hub_auto_pause_on_note', String(next));
    }
    set({ autoPauseOnNote: next });
  },
  setAutoPauseOnNote: (enabled: boolean) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('study_hub_auto_pause_on_note', String(enabled));
    }
    set({ autoPauseOnNote: enabled });
  },
  setPlaybackRate: (rate) => set({ playbackRate: rate }),
  setIsPlaying: (playing) => set({ isPlaying: playing }),
  setCurrentTime: (time) => set({ currentTime: time }),
  setDuration: (dur) => set({ duration: dur }),
  setVolume: (vol) => set({ volume: vol, isMuted: vol === 0 }),
  toggleMute: () => set((state) => ({ isMuted: !state.isMuted })),
  setShortcutHelpOpen: (open) => set({ isShortcutHelpOpen: open }),
  setAudioBoost: (boost) => set({ audioBoost: Math.max(1, Math.min(3, Number(boost.toFixed(2)))) }),
  setLoopA: (time) => {
    const t = time !== undefined ? time : get().currentTime;
    set((state) => ({
      abLoop: {
        ...state.abLoop,
        a: t,
        active: state.abLoop.active && state.abLoop.b !== null && state.abLoop.b > t
      }
    }));
  },
  setLoopB: (time) => {
    const t = time !== undefined ? time : get().currentTime;
    set((state) => ({
      abLoop: {
        ...state.abLoop,
        b: t,
        active: state.abLoop.active && state.abLoop.a !== null && t > state.abLoop.a
      }
    }));
  },
  toggleLoop: () => set((state) => ({
    abLoop: { ...state.abLoop, active: !state.abLoop.active }
  })),
  clearLoop: () => set({
    abLoop: { a: null, b: null, active: false }
  }),

  toggleLessonComplete: async (lessonId: string) => {
    const { activeCourseId, userData } = get();
    const bucketId = dataBucketFor(lessonId, activeCourseId);
    const currentCompleted = userData?.courses?.[bucketId]?.completedLessonIds || [];
    const isNowCompleted = !currentCompleted.includes(lessonId);

    // Optimistic local update
    const updatedCompleted = isNowCompleted 
      ? [...currentCompleted, lessonId] 
      : currentCompleted.filter(id => id !== lessonId);

    const updatedUserData: StudyHubData = {
      ...userData!,
      courses: {
        ...userData?.courses,
        [bucketId]: {
          ...(userData?.courses?.[bucketId] || { id: bucketId, notes: {} }),
          completedLessonIds: updatedCompleted
        }
      }
    };

    set({ userData: updatedUserData });

    try {
      await fetch('/api/progress', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          courseId: bucketId,
          lessonId,
          completed: isNowCompleted
        })
      });
    } catch (e) {
      console.error('Failed to update completion:', e);
      get().pushToast('Could not save that completion change. Your progress may be out of date.', 'error');
    }
  },

  addNote: async (lessonId: string, timestamp: number, content: string, slideNumber?: number) => {
    const { activeCourseId, userData } = get();
    const bucketId = dataBucketFor(lessonId, activeCourseId);
    const newNote = {
      id: `note-${Date.now()}`,
      timestampSeconds: Math.floor(timestamp),
      content,
      createdAt: new Date().toISOString(),
      ...(slideNumber ? { slideNumber } : {})
    };

    const courseNotes = userData?.courses?.[bucketId]?.notes?.[lessonId] || [];
    const updatedNotes = [...courseNotes, newNote];

    const updatedUserData: StudyHubData = {
      ...userData!,
      courses: {
        ...userData?.courses,
        [bucketId]: {
          ...(userData?.courses?.[bucketId] || { id: bucketId, completedLessonIds: [] }),
          notes: {
            ...(userData?.courses?.[bucketId]?.notes || {}),
            [lessonId]: updatedNotes
          }
        }
      }
    };

    set({ userData: updatedUserData });

    try {
      await fetch('/api/progress', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          courseId: bucketId,
          lessonId,
          note: {
            timestamp,
            content,
            slideNumber
          }
        })
      });
    } catch (e) {
      console.error('Failed to save note:', e);
      get().pushToast('That note could not be saved to disk.', 'error');
    }
  },

  removeNote: async (lessonId: string, noteId: string) => {
    const { activeCourseId, userData } = get();
    const bucketId = dataBucketFor(lessonId, activeCourseId);
    const existing = userData?.courses?.[bucketId]?.notes?.[lessonId] || [];
    const removed = existing.find(n => n.id === noteId);
    const updated = existing.filter(n => n.id !== noteId);

    set({
      userData: {
        ...userData!,
        courses: {
          ...userData?.courses,
          [bucketId]: {
            ...(userData?.courses?.[bucketId] || { id: bucketId, completedLessonIds: [] }),
            notes: { ...(userData?.courses?.[bucketId]?.notes || {}), [lessonId]: updated }
          }
        }
      } as StudyHubData
    });

    try {
      await fetch('/api/progress', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ courseId: activeCourseId, lessonId, removeNoteId: noteId })
      });
      // Deleting writing with no way back is the one place this app could
      // actually lose your work. Offer the way back.
      if (removed) {
        get().pushToast('Note deleted.', 'info', {
          label: 'Undo',
          run: () => get().addNote(lessonId, removed.timestampSeconds, removed.content, removed.slideNumber)
        });
      }
    } catch (e) {
      console.error('Failed to remove note:', e);
      get().pushToast('Could not delete that note on disk — it may reappear.', 'error');
    }
  },

  clearAllNotes: async (lessonId: string) => {
    const { activeCourseId, userData } = get();
    const bucketId = dataBucketFor(lessonId, activeCourseId);
    const removedAll = userData?.courses?.[bucketId]?.notes?.[lessonId] || [];

    set({
      userData: {
        ...userData!,
        courses: {
          ...userData?.courses,
          [bucketId]: {
            ...(userData?.courses?.[bucketId] || { id: bucketId, completedLessonIds: [] }),
            notes: { ...(userData?.courses?.[bucketId]?.notes || {}), [lessonId]: [] }
          }
        }
      } as StudyHubData
    });

    try {
      await fetch('/api/progress', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ courseId: activeCourseId, lessonId, clearAllNotes: true })
      });
      if (removedAll.length) {
        get().pushToast(`Cleared ${removedAll.length} note${removedAll.length === 1 ? '' : 's'}.`, 'info', {
          label: 'Undo',
          run: async () => {
            for (const n of removedAll) await get().addNote(lessonId, n.timestampSeconds, n.content, n.slideNumber);
          }
        });
      }
    } catch (e) {
      console.error('Failed to clear notes:', e);
      get().pushToast('Could not clear notes on disk.', 'error');
    }
  },

  addBookmark: async (lessonId: string, timestampSeconds: number, label?: string) => {
    const { activeCourseId, userData } = get();
    const bucketId = dataBucketFor(lessonId, activeCourseId);
    const formattedTime = `${Math.floor(timestampSeconds / 60)}:${String(Math.floor(timestampSeconds % 60)).padStart(2, '0')}`;
    const newBookmark: LessonBookmark = {
      id: `bm-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      timestampSeconds: Math.floor(timestampSeconds),
      label: label || `Pin @ ${formattedTime}`,
      createdAt: new Date().toISOString()
    };

    const courseBookmarks = userData?.courses?.[bucketId]?.bookmarks?.[lessonId] || [];
    const updatedBookmarks = [...courseBookmarks, newBookmark];

    const updatedUserData: StudyHubData = {
      ...userData!,
      courses: {
        ...userData?.courses,
        [bucketId]: {
          ...(userData?.courses?.[bucketId] || { id: bucketId, completedLessonIds: [], notes: {} }),
          bookmarks: {
            ...(userData?.courses?.[bucketId]?.bookmarks || {}),
            [lessonId]: updatedBookmarks
          }
        }
      }
    };

    set({ userData: updatedUserData });

    try {
      await fetch('/api/progress', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          courseId: bucketId,
          lessonId,
          bookmark: newBookmark
        })
      });
    } catch (e) {
      console.error('Failed to save bookmark:', e);
      get().pushToast('That bookmark could not be saved.', 'error');
    }
  },

  removeBookmark: async (lessonId: string, bookmarkId: string) => {
    const { activeCourseId, userData } = get();
    const bucketId = dataBucketFor(lessonId, activeCourseId);
    const courseBookmarks = userData?.courses?.[bucketId]?.bookmarks?.[lessonId] || [];
    const updatedBookmarks = courseBookmarks.filter(b => b.id !== bookmarkId);

    const updatedUserData: StudyHubData = {
      ...userData!,
      courses: {
        ...userData?.courses,
        [bucketId]: {
          ...(userData?.courses?.[bucketId] || { id: bucketId, completedLessonIds: [], notes: {} }),
          bookmarks: {
            ...(userData?.courses?.[bucketId]?.bookmarks || {}),
            [lessonId]: updatedBookmarks
          }
        }
      }
    };

    set({ userData: updatedUserData });

    try {
      await fetch('/api/progress', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          courseId: bucketId,
          lessonId,
          removeBookmarkId: bookmarkId
        })
      });
      const gone = courseBookmarks.find(b => b.id === bookmarkId);
      if (gone) {
        get().pushToast('Bookmark deleted.', 'info', {
          label: 'Undo',
          run: () => get().addBookmark(lessonId, gone.timestampSeconds, gone.label)
        });
      }
    } catch (e) {
      console.error('Failed to remove bookmark:', e);
      get().pushToast('Could not delete that bookmark on disk.', 'error');
    }
  },

  clearAllBookmarks: async (lessonId: string) => {
    const { activeCourseId, userData } = get();
    const bucketId = dataBucketFor(lessonId, activeCourseId);
    const updatedUserData: StudyHubData = {
      ...userData!,
      courses: {
        ...userData?.courses,
        [bucketId]: {
          ...(userData?.courses?.[bucketId] || { id: bucketId, completedLessonIds: [], notes: {} }),
          bookmarks: {
            ...(userData?.courses?.[bucketId]?.bookmarks || {}),
            [lessonId]: []
          }
        }
      }
    };

    set({ userData: updatedUserData });

    try {
      await fetch('/api/progress', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          courseId: bucketId,
          lessonId,
          clearAllBookmarks: true
        })
      });
    } catch (e) {
      console.error('Failed to clear bookmarks:', e);
    }
  },

  syncProgressToDisk: async (force = false) => {
    const { activeCourseId, activeLesson, currentTime, lastSyncedTimestamp } = get();
    if (!activeLesson) return;
    const bucketId = dataBucketFor(activeLesson.id, activeCourseId);

    // Credit only real forward playback. The old code posted a flat 15s on every
    // sync — including every seek, pause and lesson switch — so scrubbing around
    // inflated "hours watched" faster than actually watching did. A jump larger
    // than a minute is a seek, not viewing, so it counts for nothing.
    const elapsed = currentTime - lastSyncedTimestamp;
    const watchedSeconds = elapsed > 0 && elapsed <= 60 ? Math.round(elapsed) : 0;

    // Only sync if timestamp shifted by more than 5s or force is true
    if (!force && Math.abs(currentTime - lastSyncedTimestamp) < 5) return;

    if (syncTimeout) clearTimeout(syncTimeout);

    const performSync = async () => {
      try {
        await fetch('/api/progress', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            courseId: bucketId,
            lessonId: activeLesson.id,
            timestamp: currentTime,
            streakUpdate: { addedSeconds: watchedSeconds }
          })
        });
        set({ lastSyncedTimestamp: currentTime });
      } catch (err) {
        console.error('Failed to sync progress:', err);
      }
    };

    if (force) {
      await performSync();
    } else {
      syncTimeout = setTimeout(performSync, 2000);
    }
  },

  addCustomCourse: async (folderPath: string, name?: string) => {
    try {
      const res = await fetch('/api/courses/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ folderPath, name })
      });
      if (!res.ok) throw new Error('Failed to add course');
      const data = await res.json();
      
      // Refresh course list
      const coursesRes = await fetch('/api/courses');
      const coursesData = await coursesRes.json();
      set({ courses: coursesData.courses });

      // Switch to new course
      await get().selectCourse(data.course.id);
      return true;
    } catch (err) {
      console.error('Error adding course:', err);
      get().pushToast('Could not index that folder. Check the path exists and contains videos.', 'error');
      return false;
    }
  },

  saveYouTubeCourse: async (title: string, playlistId: string, videos: any[]) => {
    try {
      set({ isLoading: true });
      const res = await fetch('/api/courses/add-virtual', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: title,
          playlistId,
          videos,
          badge: 'YouTube Course',
          gradient: 'from-red-600 via-rose-600 to-amber-500',
          description: `Full YouTube playlist series (${videos.length} lessons) imported into Universal Study Hub.`
        })
      });
      if (!res.ok) throw new Error('Failed to save YouTube playlist as course');
      const data = await res.json();

      // Refresh course list
      const coursesRes = await fetch('/api/courses');
      const coursesData = await coursesRes.json();
      set({ courses: coursesData.courses || [], isLoading: false });

      if (data.course?.id) {
        await get().selectCourse(data.course.id);
        get().setActiveTab('player');
        return data.course.id;
      }
      return null;
    } catch (err) {
      console.error('Error saving YouTube course:', err);
      get().pushToast('Could not save that playlist as a course.', 'error');
      set({ isLoading: false });
      return null;
    }
  },

  removeCourse: async (courseId: string) => {
    try {
      const res = await fetch(`/api/courses/${courseId}`, {
        method: 'DELETE'
      });
      if (!res.ok) throw new Error('Failed to remove course');
      const data = await res.json();

      // Refresh course list
      const coursesRes = await fetch('/api/courses');
      const coursesData = await coursesRes.json();
      const updatedCourses: CourseSummary[] = coursesData.courses || [];

      set({ courses: updatedCourses });

      // If active course was removed, switch to another course
      if (get().activeCourseId === courseId) {
        const nextCourseId = data.activeCourseId || (updatedCourses[0]?.id || '');
        if (nextCourseId) {
          await get().selectCourse(nextCourseId);
        } else {
          set({ catalog: null, activeLesson: null, activeCourseId: '' });
        }
      }
      return true;
    } catch (err) {
      console.error('Error removing course:', err);
      return false;
    }
  },

  playYouTubeVideoImmediately: (video: { id: string; title: string; durationSeconds?: number; thumbnailUrl?: string }) => {
    const ytLesson: LessonItem = {
      id: `yt_${video.id}`,
      title: video.title,
      filename: `${video.id}.mp4`,
      relativePath: video.id,
      fileSizeBytes: 0,
      durationSeconds: video.durationSeconds || 0,
      extension: '.mp4',
      source: 'youtube',
      youtubeVideoId: video.id,
      thumbnailUrl: video.thumbnailUrl
    };

    // Resume this specific video where it was left, rather than always at 0.
    const { activeCourseId, userData } = get();
    const bucketId = dataBucketFor(ytLesson.id, activeCourseId);
    const resumeAt = userData?.courses?.[bucketId]?.resumePositions?.[ytLesson.id] || 0;

    // Record it in the watch history so it can be found and resumed later.
    fetch('/api/youtube/history', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: ytLesson.id, videoId: video.id, title: video.title,
        thumbnailUrl: video.thumbnailUrl, durationSeconds: video.durationSeconds,
        positionSeconds: resumeAt
      })
    }).then(() => get().fetchYouTubeHistory()).catch(() => {});

    // A video played straight from the explorer belongs to no catalog, so the
    // boot-time resume lookup cannot find it. Persist the lesson itself.
    fetch('/api/progress', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        youtubeLesson: {
          id: ytLesson.id,
          title: ytLesson.title,
          youtubeVideoId: video.id,
          durationSeconds: video.durationSeconds,
          thumbnailUrl: video.thumbnailUrl
        }
      })
    }).catch(() => {});

    set({
      activeLesson: ytLesson,
      activePdf: null,
      currentTime: resumeAt,
      duration: video.durationSeconds || 0,
      isPlaying: true,
      sidePanelTab: 'curriculum'
    });

    // setActiveTab already syncs the URL; doing it by hand here drifted.
    get().setActiveTab('player');
  },

  playDirectUrl: (url: string, title?: string) => {
    // Any direct media link (mp4/webm/mov/ogv/m3u8, or a self-hosted stream)
    // plays through the same element as local files, so scrubbing, speed,
    // bookmarks and timestamped notes all behave identically.
    let label = title;
    if (!label) {
      try {
        const parsed = new URL(url);
        label = decodeURIComponent(parsed.pathname.split('/').filter(Boolean).pop() || parsed.hostname);
      } catch (e) {
        label = 'Linked video';
      }
    }

    const lesson: LessonItem = {
      id: `url_${btoa(url).replace(/[^a-zA-Z0-9]/g, '').slice(0, 40)}`,
      title: label!,
      filename: label!,
      relativePath: url,
      fileSizeBytes: 0,
      durationSeconds: 0,
      extension: (url.split('?')[0].match(/\.(\w{2,5})$/)?.[0] || '.mp4'),
      source: 'direct',
      directUrl: url
    };

    set({
      activeLesson: lesson,
      activePdf: null,
      currentTime: get().userData?.courses?.[dataBucketFor(lesson.id, get().activeCourseId)]?.resumePositions?.[lesson.id] || 0,
      duration: 0,
      isPlaying: true,
      sidePanelTab: 'curriculum'
    });
    get().setActiveTab('player');
  },

  goToNextLesson: () => {
    const { catalog, activeLesson } = get();
    if (!catalog || !activeLesson) return;

    let foundCurrent = false;
    for (const mod of catalog.modules) {
      for (const lesson of mod.lessons) {
        if (foundCurrent) {
          get().selectLesson(lesson, 0);
          return;
        }
        if (lesson.id === activeLesson.id) {
          foundCurrent = true;
        }
      }
    }
  },

  goToPrevLesson: () => {
    const { catalog, activeLesson } = get();
    if (!catalog || !activeLesson) return;

    let prevLesson: LessonItem | null = null;
    for (const mod of catalog.modules) {
      for (const lesson of mod.lessons) {
        if (lesson.id === activeLesson.id) {
          if (prevLesson) {
            get().selectLesson(prevLesson, 0);
          }
          return;
        }
        prevLesson = lesson;
      }
    }
  },

  setActiveCodeLanguage: (lang: 'javascript' | 'python' | 'cpp' | 'c' | 'html') => {
    const currentCode = get().currentCode;
    const currentLang = get().activeCodeLanguage;
    const isCurrentDefault = currentCode.trim() === (DEFAULT_CODE_TEMPLATES[currentLang] || '').trim() || currentCode.trim() === '';

    set({
      activeCodeLanguage: lang,
      currentCode: isCurrentDefault ? (DEFAULT_CODE_TEMPLATES[lang] || '') : currentCode,
      codeOutput: null
    });
  },

  setCurrentCode: (code: string) => {
    set({ currentCode: code });
  },

  resetCodeTemplate: () => {
    const lang = get().activeCodeLanguage;
    set({
      currentCode: DEFAULT_CODE_TEMPLATES[lang] || '',
      codeOutput: null
    });
  },

  saveLessonCode: async (lessonId: string, language: string, code: string) => {
    const { activeCourseId, userData } = get();
    const bucketId = dataBucketFor(lessonId, activeCourseId);
    if (!activeCourseId || !lessonId) return;

    if (userData?.courses?.[bucketId]) {
      if (!userData.courses[activeCourseId].codeSnippets) {
        userData.courses[activeCourseId].codeSnippets = {};
      }
      userData.courses[activeCourseId].codeSnippets[lessonId] = {
        language,
        code,
        updatedAt: new Date().toISOString()
      };
      set({ userData: { ...userData } });
    }

    try {
      await fetch('/api/progress', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          courseId: bucketId,
          lessonId,
          codeSnippet: { language, code }
        })
      });
    } catch (e) {
      console.warn('Failed to save code snippet to server:', e);
    }
  },

  executeCode: async () => {
    const { activeCodeLanguage, currentCode, activeLesson, saveLessonCode } = get();
    if (activeCodeLanguage === 'html') {
      set({
        codeOutput: {
          stdout: 'Live Web Sandbox rendered.',
          stderr: '',
          exitCode: 0,
          executionTimeMs: 1
        },
        isExecutingCode: false
      });
      if (activeLesson) {
        saveLessonCode(activeLesson.id, activeCodeLanguage, currentCode);
      }
      return;
    }

    set({ isExecutingCode: true });
    try {
      const res = await fetch('/api/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          language: activeCodeLanguage,
          code: currentCode
        })
      });
      const data = await res.json();
      set({
        codeOutput: data,
        isExecutingCode: false
      });

      if (activeLesson) {
        saveLessonCode(activeLesson.id, activeCodeLanguage, currentCode);
      }
    } catch (err: any) {
      set({
        codeOutput: {
          stdout: '',
          stderr: err.message || 'Execution failed',
          exitCode: 1,
          executionTimeMs: 0
        },
        isExecutingCode: false
      });
    }
  }
}));

// Setup Beacon Sync on tab close / unload
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    const state = useStore.getState();
    if (state.activeLesson && state.activeCourseId) {
      const payload = JSON.stringify({
        courseId: state.activeCourseId,
        lessonId: state.activeLesson.id,
        timestamp: state.currentTime
      });
      navigator.sendBeacon('/api/progress/beacon', payload);
    }
  });

  window.addEventListener('popstate', () => {
    const tab = getInitialTab();
    useStore.setState({ activeTab: tab });
  });
}

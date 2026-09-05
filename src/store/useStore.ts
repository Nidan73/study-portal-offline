import { create } from 'zustand';
import { CourseSummary, CourseCatalog, LessonItem, SupplementaryFile, StudyHubData, LessonBookmark } from '../types';

export type NavTab = 'player' | 'split-slides' | 'split-code' | 'notes' | 'ide' | 'library' | 'youtube';
export type SidePanelTab = 'curriculum' | 'code' | 'notes' | 'slides';

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
  
  // User Data State
  userData: StudyHubData | null;
  lastSyncedTimestamp: number;

  // Actions
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
  toggleAutoPauseOnNote: () => void;
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
  
  userData: null,
  lastSyncedTimestamp: 0,

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
      set({ isLoading: false });
    }
  },

  selectCourse: async (courseId: string) => {
    try {
      set({ isCatalogLoading: true, activeCourseId: courseId });
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
    }
  },

  selectLesson: (lesson: LessonItem, startAt?: number) => {
    const { activeCourseId, userData } = get();
    const course = userData?.courses?.[activeCourseId];
    // Per-lesson position first; fall back to lastWatched for data saved before
    // resumePositions existed, so existing progress is not lost on upgrade.
    const savedTime = startAt !== undefined
      ? startAt
      : (course?.resumePositions?.[lesson.id]
         ?? (course?.lastWatched?.lessonId === lesson.id ? course.lastWatched.timestampSeconds : 0)
         ?? 0);

    const savedSnippet = userData?.courses?.[activeCourseId]?.codeSnippets?.[lesson.id];
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
    const currentCompleted = userData?.courses?.[activeCourseId]?.completedLessonIds || [];
    const isNowCompleted = !currentCompleted.includes(lessonId);

    // Optimistic local update
    const updatedCompleted = isNowCompleted 
      ? [...currentCompleted, lessonId] 
      : currentCompleted.filter(id => id !== lessonId);

    const updatedUserData: StudyHubData = {
      ...userData!,
      courses: {
        ...userData?.courses,
        [activeCourseId]: {
          ...(userData?.courses?.[activeCourseId] || { id: activeCourseId, notes: {} }),
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
          courseId: activeCourseId,
          lessonId,
          completed: isNowCompleted
        })
      });
    } catch (e) {
      console.error('Failed to update completion:', e);
    }
  },

  addNote: async (lessonId: string, timestamp: number, content: string, slideNumber?: number) => {
    const { activeCourseId, userData } = get();
    const newNote = {
      id: `note-${Date.now()}`,
      timestampSeconds: Math.floor(timestamp),
      content,
      createdAt: new Date().toISOString(),
      ...(slideNumber ? { slideNumber } : {})
    };

    const courseNotes = userData?.courses?.[activeCourseId]?.notes?.[lessonId] || [];
    const updatedNotes = [...courseNotes, newNote];

    const updatedUserData: StudyHubData = {
      ...userData!,
      courses: {
        ...userData?.courses,
        [activeCourseId]: {
          ...(userData?.courses?.[activeCourseId] || { id: activeCourseId, completedLessonIds: [] }),
          notes: {
            ...(userData?.courses?.[activeCourseId]?.notes || {}),
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
          courseId: activeCourseId,
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
    }
  },

  removeNote: async (lessonId: string, noteId: string) => {
    const { activeCourseId, userData } = get();
    const existing = userData?.courses?.[activeCourseId]?.notes?.[lessonId] || [];
    const updated = existing.filter(n => n.id !== noteId);

    set({
      userData: {
        ...userData!,
        courses: {
          ...userData?.courses,
          [activeCourseId]: {
            ...(userData?.courses?.[activeCourseId] || { id: activeCourseId, completedLessonIds: [] }),
            notes: { ...(userData?.courses?.[activeCourseId]?.notes || {}), [lessonId]: updated }
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
    } catch (e) {
      console.error('Failed to remove note:', e);
    }
  },

  clearAllNotes: async (lessonId: string) => {
    const { activeCourseId, userData } = get();

    set({
      userData: {
        ...userData!,
        courses: {
          ...userData?.courses,
          [activeCourseId]: {
            ...(userData?.courses?.[activeCourseId] || { id: activeCourseId, completedLessonIds: [] }),
            notes: { ...(userData?.courses?.[activeCourseId]?.notes || {}), [lessonId]: [] }
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
    } catch (e) {
      console.error('Failed to clear notes:', e);
    }
  },

  addBookmark: async (lessonId: string, timestampSeconds: number, label?: string) => {
    const { activeCourseId, userData } = get();
    const formattedTime = `${Math.floor(timestampSeconds / 60)}:${String(Math.floor(timestampSeconds % 60)).padStart(2, '0')}`;
    const newBookmark: LessonBookmark = {
      id: `bm-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      timestampSeconds: Math.floor(timestampSeconds),
      label: label || `Pin @ ${formattedTime}`,
      createdAt: new Date().toISOString()
    };

    const courseBookmarks = userData?.courses?.[activeCourseId]?.bookmarks?.[lessonId] || [];
    const updatedBookmarks = [...courseBookmarks, newBookmark];

    const updatedUserData: StudyHubData = {
      ...userData!,
      courses: {
        ...userData?.courses,
        [activeCourseId]: {
          ...(userData?.courses?.[activeCourseId] || { id: activeCourseId, completedLessonIds: [], notes: {} }),
          bookmarks: {
            ...(userData?.courses?.[activeCourseId]?.bookmarks || {}),
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
          courseId: activeCourseId,
          lessonId,
          bookmark: newBookmark
        })
      });
    } catch (e) {
      console.error('Failed to save bookmark:', e);
    }
  },

  removeBookmark: async (lessonId: string, bookmarkId: string) => {
    const { activeCourseId, userData } = get();
    const courseBookmarks = userData?.courses?.[activeCourseId]?.bookmarks?.[lessonId] || [];
    const updatedBookmarks = courseBookmarks.filter(b => b.id !== bookmarkId);

    const updatedUserData: StudyHubData = {
      ...userData!,
      courses: {
        ...userData?.courses,
        [activeCourseId]: {
          ...(userData?.courses?.[activeCourseId] || { id: activeCourseId, completedLessonIds: [], notes: {} }),
          bookmarks: {
            ...(userData?.courses?.[activeCourseId]?.bookmarks || {}),
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
          courseId: activeCourseId,
          lessonId,
          removeBookmarkId: bookmarkId
        })
      });
    } catch (e) {
      console.error('Failed to remove bookmark:', e);
    }
  },

  clearAllBookmarks: async (lessonId: string) => {
    const { activeCourseId, userData } = get();
    const updatedUserData: StudyHubData = {
      ...userData!,
      courses: {
        ...userData?.courses,
        [activeCourseId]: {
          ...(userData?.courses?.[activeCourseId] || { id: activeCourseId, completedLessonIds: [], notes: {} }),
          bookmarks: {
            ...(userData?.courses?.[activeCourseId]?.bookmarks || {}),
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
          courseId: activeCourseId,
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
            courseId: activeCourseId,
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
    const resumeAt = userData?.courses?.[activeCourseId]?.resumePositions?.[ytLesson.id] || 0;

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
    if (!activeCourseId || !lessonId) return;

    if (userData?.courses?.[activeCourseId]) {
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
          courseId: activeCourseId,
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

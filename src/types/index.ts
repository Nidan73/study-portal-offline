export interface CourseSummary {
  id: string;
  name: string;
  rootPath: string;
  badge?: string;
  gradient?: string;
  description?: string;
  isVirtual?: boolean;
  modules?: CourseModule[];
}

export interface LessonItem {
  id: string; // Base64URL encoded relative path or yt_{videoId}
  title: string;
  filename: string;
  relativePath: string;
  fileSizeBytes: number;
  durationSeconds?: number;
  extension: string;
  companionPdf?: SupplementaryFile;
  source?: 'local' | 'youtube';
  youtubeVideoId?: string;
  thumbnailUrl?: string;
}

export interface SupplementaryFile {
  id: string;
  title: string;
  filename: string;
  relativePath: string;
  fileSizeBytes: number;
  type: string;
  filePath?: string;
  courseId?: string;
  courseName?: string;
  moduleName?: string;
  isCustomLocal?: boolean;
  localFile?: File;
}

export interface CourseModule {
  id: string;
  title: string;
  relativeDir: string;
  order: number;
  lessons: LessonItem[];
  supplementaryFiles: SupplementaryFile[];
}

export interface CourseCatalog {
  id: string;
  name: string;
  rootPath: string;
  modules: CourseModule[];
  totalVideos: number;
  totalPdfs: number;
  isVirtual?: boolean;
}

export interface LessonNote {
  id: string;
  timestampSeconds: number;
  content: string;
  createdAt: string;
  slideNumber?: number;
}

export interface LessonBookmark {
  id: string;
  timestampSeconds: number;
  label: string;
  createdAt: string;
}

export interface YouTubeSearchResult {
  id: string;
  title: string;
  description: string;
  channelTitle: string;
  thumbnail: string;
  durationText?: string;
  durationSeconds?: number;
  viewCountText?: string;
  publishedTimeText?: string;
  isPlaylist?: boolean;
  playlistId?: string;
  videoCount?: number;
}

export interface CourseUserData {
  id: string;
  completedLessonIds: string[];
  notes: Record<string, LessonNote[]>;
  bookmarks?: Record<string, LessonBookmark[]>;
  codeSnippets?: Record<string, {
    language: string;
    code: string;
    updatedAt: string;
  }>;
  lastWatched?: {
    lessonId: string;
    timestampSeconds: number;
    updatedAt: string;
  } | null;
}

export interface StudyHubData {
  schemaVersion: number;
  activeCourseId: string;
  customCourses: CourseSummary[];
  courses: Record<string, CourseUserData>;
  globalStats: {
    totalHoursWatchedSeconds: number;
    streakDays: number;
    lastActiveDate: string;
  };
}

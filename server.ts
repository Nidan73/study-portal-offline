import express, { Request, Response, NextFunction } from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execFile } from 'child_process';
import crypto from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface VideoStreamInfo {
  index?: number;
  codec_name?: string;
  codec_type?: string;
}

export interface CourseFile {
  id: string;
  title: string;
  filename: string;
  relativePath: string;
  fileSizeBytes: number;
  extension?: string;
  type?: string;
  companionPdf?: CourseFile;
  duration?: string;
  source?: 'local' | 'youtube';
  youtubeVideoId?: string;
  thumbnailUrl?: string;
}

export interface CourseModule {
  id: string;
  title: string;
  relativeDir: string;
  order: number;
  lessons: CourseFile[];
  supplementaryFiles: CourseFile[];
}

export interface CourseSummary {
  id: string;
  name: string;
  rootPath: string;
  badge: string;
  gradient: string;
  description: string;
  isVirtual?: boolean;
  modules?: CourseModule[];
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

export interface CodeSnippet {
  language: string;
  code: string;
  updatedAt: string;
}

export interface CourseProgressRecord {
  id: string;
  completedLessonIds: string[];
  notes: Record<string, LessonNote[]>;
  codeSnippets?: Record<string, CodeSnippet>;
  bookmarks?: Record<string, LessonBookmark[]>;
  /** Per-lesson resume position in seconds, keyed by lesson id. */
  resumePositions?: Record<string, number>;
  lastWatched: {
    lessonId: string;
    timestampSeconds: number;
    updatedAt: string;
  } | null;
}

export interface ScratchNote {
  id: string;
  content: string;
  createdAt: string;
  updatedAt: string;
}

export interface YouTubeHistoryEntry {
  /** Lesson id, i.e. `yt_<videoId>` — the key notes and positions are stored under. */
  id: string;
  videoId: string;
  title: string;
  thumbnailUrl?: string;
  durationSeconds?: number;
  lastWatchedAt: string;
  positionSeconds: number;
}

export interface HubProgressData {
  schemaVersion: number;
  activeCourseId: string;
  customCourses: CourseSummary[];
  courses: Record<string, CourseProgressRecord>;
  /** Notes that belong to no lesson — the general notepad. */
  scratchpad?: ScratchNote[];
  /** The last YouTube video played directly from the explorer. Such a video
   *  belongs to no catalog, so without this it cannot be restored on boot. */
  lastYouTubeLesson?: {
    id: string;
    title: string;
    youtubeVideoId: string;
    durationSeconds?: number;
    thumbnailUrl?: string;
  } | null;
  /** Most-recent-first watch history, capped so the file cannot grow forever. */
  youtubeHistory?: YouTubeHistoryEntry[];
  globalStats: {
    totalHoursWatchedSeconds: number;
    streakDays: number;
    lastActiveDate: string;
  };
}

export interface YouTubeSearchResult {
  id: string;
  title: string;
  duration: string;
  views: string;
  author: string;
  thumbnail: string;
}

const app = express();
const portArgIndex = process.argv.indexOf('--port');
const cliPort = portArgIndex !== -1 && process.argv[portArgIndex + 1] ? parseInt(process.argv[portArgIndex + 1], 10) : null;
// 47285: deliberately outside the ranges dev tooling squats on — 3000/3001
// (CRA, Express, Next), 5173 (Vite), 8080 (Apache/Tomcat), 8000 (Django),
// 5000 (Flask, macOS AirPlay), 4200 (Angular), 8888 (Jupyter), 9229 (Node
// debug) — and below 49152 so it cannot clash with an OS-assigned ephemeral
// port. Override with --port or the PORT environment variable.
const DEFAULT_PORT = cliPort || parseInt(process.env.PORT || "47285", 10);

// Middleware
//
// No CORS. The client is served same-origin in production and Vite proxies /api
// in dev, so nothing legitimate needs it — while `cors()` previously answered
// preflight for every origin with `Access-Control-Allow-Origin: *`. That let any
// page you happened to have open POST to /api/execute (whose "localhost only"
// check passes, because a browser tab on this machine *is* localhost) and read
// the result back. Same-origin is the whole defence here; keep it that way.
app.use((req: Request, res: Response, next: NextFunction) => {
  const origin = req.headers.origin;
  if (origin) {
    let host: string;
    try {
      host = new URL(origin).hostname;
    } catch {
      return res.status(403).json({ error: 'Forbidden: malformed Origin' });
    }
    if (host !== 'localhost' && host !== '127.0.0.1' && host !== '::1') {
      return res.status(403).json({ error: 'Forbidden: cross-origin requests are not allowed' });
    }
  }
  next();
});
app.use(express.json({ limit: '10mb' }));

// Paths
const DATA_DIR = path.join(__dirname, 'data');
const BACKUPS_DIR = path.join(DATA_DIR, 'backups');
const PROGRESS_FILE = path.join(DATA_DIR, 'study-hub-data.json');
const VIDEO_CACHE_DIR = path.join(DATA_DIR, 'video-cache');
// Where to look for course folders. Defaults to the directory containing this
// project, so courses sit as siblings of it. Override with STUDYHUB_COURSES_ROOT
// when the clone lives somewhere unrelated to your library.
const COURSES_ROOT = process.env.STUDYHUB_COURSES_ROOT
  ? path.resolve(process.env.STUDYHUB_COURSES_ROOT)
  : path.resolve(__dirname, '..');

/**
 * True when `target` really sits inside `root`.
 *
 * `target.startsWith(root)` is not this test: a root of /courses/react also
 * "contains" /courses/react-private. path.relative gives the honest answer —
 * anything outside comes back starting with '..' or as an absolute path.
 */
function isInside(root: string, target: string): boolean {
  const rel = path.relative(path.resolve(root), path.resolve(target));
  return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel));
}

/**
 * Resolve a caller-supplied path and confirm it lands under a directory we
 * actually serve. Returns null when it does not, so callers can 403 uniformly.
 *
 * Every endpoint that accepts a path from the client must go through this.
 * Without it, `path.resolve(req.body.filePath)` reads (or launches) anything
 * on the disk that happens to have a matching extension.
 */
function resolveServable(candidate: string): string | null {
  let resolved: string;
  try {
    resolved = path.resolve(candidate);
  } catch {
    return null;
  }
  if (isInside(COURSES_ROOT, resolved)) return resolved;
  for (const course of discoverCourses()) {
    if (course.rootPath && isInside(course.rootPath, resolved)) return resolved;
  }
  return null;
}

// Ensure directories exist
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(BACKUPS_DIR)) fs.mkdirSync(BACKUPS_DIR, { recursive: true });
if (!fs.existsSync(VIDEO_CACHE_DIR)) fs.mkdirSync(VIDEO_CACHE_DIR, { recursive: true });

/** Resolved once at startup on Windows: 'py' if the launcher exists, else 'python'. */
let windowsPythonCommand: string | null = null;

if (process.platform === 'win32') {
  execFile('py', ['-3', '--version'], { timeout: 5000 }, (err) => {
    windowsPythonCommand = err ? 'python' : 'py';
    console.log(`[Study Hub Backend] Python command: ${windowsPythonCommand}`);
  });
}

/**
 * Find a toolchain binary without hardcoding a Unix path.
 *
 * /usr/bin/gcc et al. do not exist on Windows, and are wrong on distros that
 * install elsewhere (nix, homebrew, /opt). Prefer the common absolute paths
 * when present, otherwise fall back to the bare name and let PATH resolve it.
 */
function resolveTool(name: 'python3' | 'gcc' | 'g++'): string {
  if (process.platform === 'win32') {
    // CreateProcess appends .exe and searches PATH for a bare name, so gcc/g++
    // resolve from a MinGW-w64 or MSYS2 install. Python is special: python.org
    // recommends the `py` launcher, and a bare `python` may hit the Microsoft
    // Store app-execution alias and open the Store instead of running anything.
    return name === 'python3' ? (windowsPythonCommand || 'py') : name;
  }
  const candidates: Record<string, string[]> = {
    python3: ['/usr/bin/python3', '/usr/local/bin/python3', '/opt/homebrew/bin/python3'],
    gcc: ['/usr/bin/gcc', '/usr/local/bin/gcc', '/opt/homebrew/bin/gcc'],
    'g++': ['/usr/bin/g++', '/usr/local/bin/g++', '/opt/homebrew/bin/g++']
  };
  for (const p of candidates[name] || []) {
    try { if (fs.existsSync(p)) return p; } catch (e) {}
  }
  return name;   // let PATH decide
}

// Ignored folders for heuristic crawler
const IGNORED_NAMES = new Set([
  'node_modules', '.git', '.next', 'dist', 'build', 'vendor', 'target', 
  'tmp', 'data', 'study-hub', '.portal-data', '.portal', 'Assignments'
]);

// Video and doc extensions (expanded for universal container support)
const VIDEO_EXTENSIONS = new Set([
  '.mp4', '.mkv', '.webm', '.mov', '.m4v', '.avi', '.ts', '.m2ts', 
  '.flv', '.wmv', '.vob', '.ogv', '.3gp', '.f4v', '.asf'
]);
const DOC_EXTENSIONS = new Set(['.pdf', '.pptx', '.ppt', '.pptm']);

// Default Initial Data
function getInitialData(): HubProgressData {
  return {
    schemaVersion: 1,
    activeCourseId: '100xdevs-cohort',
    customCourses: [],
    courses: {},
    globalStats: {
      totalHoursWatchedSeconds: 0,
      streakDays: 1,
      lastActiveDate: new Date().toISOString().split('T')[0]
    }
  };
}

// Atomic File Writer with Windows EPERM / EBUSY Fallback
function atomicWriteJson(filePath: string, data: any): void {
  const tmpPath = `${filePath}.tmp.${Date.now()}_${process.pid}_${Math.random().toString(36).slice(2, 8)}`;
  const jsonString = JSON.stringify(data, null, 2);
  
  const fd = fs.openSync(tmpPath, 'w');
  fs.writeSync(fd, jsonString);
  fs.fdatasyncSync(fd);
  fs.closeSync(fd);
  
  try {
    fs.renameSync(tmpPath, filePath);
  } catch (err: any) {
    if (process.platform === 'win32' || err.code === 'EPERM' || err.code === 'EBUSY') {
      fs.copyFileSync(tmpPath, filePath);
      try { fs.unlinkSync(tmpPath); } catch (_) {}
    } else {
      throw err;
    }
  }
}

/**
 * Coalesced disk writer for the progress database.
 *
 * atomicWriteJson serialises everything, fdatasyncs and renames. Doing that on
 * every 2-second playback ping is a lot of write amplification for a file that
 * lives on external media. Callers that must not lose data (tab-close beacon,
 * shutdown) call flushProgressNow() instead.
 */
let progressWriteTimer: NodeJS.Timeout | null = null;
const PROGRESS_WRITE_DEBOUNCE_MS = 4000;

function scheduleProgressWrite(): void {
  if (progressWriteTimer) return;      // a write is already pending
  progressWriteTimer = setTimeout(() => {
    progressWriteTimer = null;
    try {
      atomicWriteJson(PROGRESS_FILE, inMemoryData);
    } catch (err) {
      console.error('Deferred progress write failed:', err);
    }
  }, PROGRESS_WRITE_DEBOUNCE_MS);
  // Never hold the process open just for a pending write.
  progressWriteTimer.unref?.();
}

function flushProgressNow(): void {
  if (progressWriteTimer) {
    clearTimeout(progressWriteTimer);
    progressWriteTimer = null;
  }
  atomicWriteJson(PROGRESS_FILE, inMemoryData);
}

// Read Progress Data with Auto-Recovery
function loadProgressData(): HubProgressData {
  try {
    if (fs.existsSync(PROGRESS_FILE)) {
      const raw = fs.readFileSync(PROGRESS_FILE, 'utf-8');
      if (raw.trim().length > 0) {
        return JSON.parse(raw);
      }
    }
  } catch (err) {
    console.error('Error reading progress file, attempting backup restore:', err);
    try {
      const backups = fs.readdirSync(BACKUPS_DIR).filter(f => f.endsWith('.json')).sort().reverse();
      if (backups.length > 0) {
        const latestBackup = path.join(BACKUPS_DIR, backups[0]);
        console.log(`Restoring from backup: ${latestBackup}`);
        const raw = fs.readFileSync(latestBackup, 'utf-8');
        return JSON.parse(raw);
      }
    } catch (bErr) {
      console.error('Backup restoration failed:', bErr);
    }
  }
  const init = getInitialData();
  atomicWriteJson(PROGRESS_FILE, init);
  return init;
}

/** Notes and pins for YouTube videos live here rather than under whichever
 *  course happened to be active. A YouTube video belongs to no course, so
 *  course-scoping them meant opening the same video later — from history, or
 *  after switching course — showed nothing. */
export const YOUTUBE_BUCKET = '__youtube__';

let inMemoryData: HubProgressData = loadProgressData();

/** One-time move of already-scattered YouTube data into the shared bucket. */
function migrateYouTubeDataToBucket(): void {
  let moved = 0;
  if (!inMemoryData.courses[YOUTUBE_BUCKET]) {
    inMemoryData.courses[YOUTUBE_BUCKET] = {
      id: YOUTUBE_BUCKET, completedLessonIds: [], notes: {}, bookmarks: {},
      codeSnippets: {}, resumePositions: {}, lastWatched: null
    };
  }
  const bucket = inMemoryData.courses[YOUTUBE_BUCKET];
  bucket.notes ||= {}; bucket.bookmarks ||= {};
  bucket.resumePositions ||= {}; bucket.codeSnippets ||= {};

  for (const [courseId, course] of Object.entries(inMemoryData.courses)) {
    if (courseId === YOUTUBE_BUCKET) continue;
    for (const key of Object.keys(course.notes || {})) {
      if (!key.startsWith('yt_')) continue;
      bucket.notes[key] = [...(bucket.notes[key] || []), ...course.notes[key]];
      delete course.notes[key]; moved++;
    }
    for (const key of Object.keys(course.bookmarks || {})) {
      if (!key.startsWith('yt_')) continue;
      bucket.bookmarks![key] = [...(bucket.bookmarks![key] || []), ...course.bookmarks![key]];
      delete course.bookmarks![key]; moved++;
    }
    for (const key of Object.keys(course.resumePositions || {})) {
      if (!key.startsWith('yt_')) continue;
      bucket.resumePositions![key] = Math.max(bucket.resumePositions![key] || 0, course.resumePositions![key]);
      delete course.resumePositions![key]; moved++;
    }
    for (const key of Object.keys(course.codeSnippets || {})) {
      if (!key.startsWith('yt_')) continue;
      bucket.codeSnippets![key] = course.codeSnippets![key];
      delete course.codeSnippets![key]; moved++;
    }
  }
  // A local course whose lastWatched points at a YouTube video would restore
  // that video when the course is selected, instead of the course's own lesson.
  let cleared = 0;
  for (const [courseId, course] of Object.entries(inMemoryData.courses)) {
    if (courseId === YOUTUBE_BUCKET) continue;
    const isVirtual = (inMemoryData.customCourses || []).some(c => c.id === courseId && c.isVirtual);
    if (isVirtual) continue;
    if (course.lastWatched?.lessonId?.startsWith('yt_')) {
      course.lastWatched = null;
      cleared++;
    }
  }

  if (moved > 0 || cleared > 0) {
    if (moved) console.log(`[Migration] Moved ${moved} YouTube entries into the shared bucket.`);
    if (cleared) console.log(`[Migration] Cleared ${cleared} stale YouTube pointer(s) from local courses.`);
    atomicWriteJson(PROGRESS_FILE, inMemoryData);
  }
}
migrateYouTubeDataToBucket();

// Natural numeric sorting comparator (e.g. "Week 1", "Week 2", "Week 10")
function naturalSort(a: string, b: string): number {
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
}

// Clean title formatter
function cleanTitle(filename: string): string {
  return filename
    .replace(/\.(mp4|mkv|webm|mov|m4v|avi|ts|m2ts|flv|wmv|vob|ogv|3gp|f4v|asf|pdf)$/i, '')
    .replace(/^Week\s*[-_]?\s*/i, 'Week ')
    .trim();
}

// Universal Heuristic Crawler
function crawlCourseDirectory(courseRoot: string) {
  const visitedInodes = new Set<number>();
  const modules: CourseModule[] = [];
  let totalVideos = 0;
  let totalPdfs = 0;

  function traverse(currentDir: string, relativeDir = '', depth = 0) {
    if (depth > 6) return;

    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(currentDir, { withFileTypes: true });
    } catch (e) {
      return;
    }

    const videos: CourseFile[] = [];
    const pdfs: CourseFile[] = [];
    const subdirs: { name: string; fullPath: string; relPath: string }[] = [];

    for (const entry of entries) {
      if (IGNORED_NAMES.has(entry.name) || entry.name.startsWith('.')) continue;

      const fullPath = path.join(currentDir, entry.name);
      const relPath = relativeDir ? path.join(relativeDir, entry.name) : entry.name;

      try {
        const stat = fs.statSync(fullPath);
        if (visitedInodes.has(stat.ino)) continue;
        visitedInodes.add(stat.ino);

        if (entry.isDirectory()) {
          subdirs.push({ name: entry.name, fullPath, relPath });
        } else if (entry.isFile()) {
          const ext = path.extname(entry.name).toLowerCase();
          if (VIDEO_EXTENSIONS.has(ext)) {
            // Filter out tiny clips under 1MB
            if (stat.size > 1024 * 1024) {
              videos.push({
                id: Buffer.from(relPath).toString('base64url'),
                title: cleanTitle(entry.name),
                filename: entry.name,
                relativePath: relPath,
                fileSizeBytes: stat.size,
                extension: ext
              });
              totalVideos++;
            }
          } else if (DOC_EXTENSIONS.has(ext)) {
            pdfs.push({
              id: Buffer.from(relPath).toString('base64url'),
              title: cleanTitle(entry.name),
              filename: entry.name,
              relativePath: relPath,
              fileSizeBytes: stat.size,
              type: ext.slice(1)
            });
            totalPdfs++;
          }
        }
      } catch (err) {
        // Silently ignore broken symlinks or permission denied
      }
    }

    // Sort videos and pdfs naturally
    videos.sort((a, b) => naturalSort(a.filename, b.filename));
    pdfs.sort((a, b) => naturalSort(a.filename, b.filename));

    // If current directory contains videos or pdfs, make it a module
    if (videos.length > 0 || pdfs.length > 0) {
      const moduleTitle = relativeDir ? cleanTitle(path.basename(relativeDir)) : 'General Lectures';
      
      // Auto-pair companion PDFs to videos if filenames match closely
      const normalize = (t: string) => t.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
      videos.forEach(v => {
        const vn = normalize(v.title);
        // Exact normalized match first. A plain two-way includes() let "Week 1"
        // claim "Week 10"'s deck, and natural sort meant the wrong one won.
        let matchingPdf = pdfs.find(p => normalize(p.title) === vn);
        if (!matchingPdf) {
          matchingPdf = pdfs.find(p => {
            const pn = normalize(p.title);
            if (!pn || !vn) return false;
            // Substring, but only on a word boundary, so "week 1" no longer
            // matches "week 10".
            const boundary = (hay: string, needle: string) =>
              new RegExp(`(^|\\s)${needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}($|\\s)`).test(hay);
            return boundary(pn, vn) || boundary(vn, pn);
          });
        }
        if (matchingPdf) v.companionPdf = matchingPdf;
      });

      modules.push({
        id: Buffer.from(relativeDir || 'root').toString('base64url'),
        title: moduleTitle,
        relativeDir,
        order: modules.length + 1,
        lessons: videos,
        supplementaryFiles: pdfs
      });
    }

    // Sort subdirectories naturally
    subdirs.sort((a, b) => naturalSort(a.name, b.name));
    for (const subdir of subdirs) {
      traverse(subdir.fullPath, subdir.relPath, depth + 1);
    }
  }

  traverse(courseRoot);

  // Sort modules naturally by title
  modules.sort((a, b) => naturalSort(a.title, b.title));

  return {
    modules,
    totalVideos,
    totalPdfs
  };
}

// Auto-Discover Available Courses in COURSES_ROOT
function discoverCourses(): CourseSummary[] {
  const discovered: CourseSummary[] = [];

  // 1. Check for 100xDevs Cohort
  const h100Path = path.join(COURSES_ROOT, '100xDevs_Cohort', 'Lectures_and_Material');
  if (fs.existsSync(h100Path)) {
    discovered.push({
      id: '100xdevs-cohort',
      name: '100xDevs Full Stack & DevOps (Cohort 2.0)',
      rootPath: h100Path,
      badge: 'Full Stack & DevOps',
      gradient: 'from-blue-500 to-indigo-600',
      description: 'Zero to hero in Web Development, DevOps, Docker, Kubernetes, Next.js, and System Design.'
    });
  }

  // 2. Check for AI and ML Bootcamp
  const aiPath = path.join(COURSES_ROOT, 'AI and ML Bootcamp');
  if (fs.existsSync(aiPath)) {
    discovered.push({
      id: 'ai-ml-bootcamp',
      name: 'AI & Machine Learning Bootcamp',
      rootPath: aiPath,
      badge: 'Artificial Intelligence',
      gradient: 'from-purple-500 to-pink-600',
      description: 'Core Machine Learning, Neural Networks, PyTorch, and Generative AI.'
    });
  }

  // 3. Check for Programming Hero PH
  const phPath = path.join(COURSES_ROOT, 'Programming_Hero_PH');
  if (fs.existsSync(phPath)) {
    discovered.push({
      id: 'programming-hero',
      name: 'Programming Hero (Complete Web Track)',
      rootPath: phPath,
      badge: 'Web Fundamentals',
      gradient: 'from-amber-500 to-orange-600',
      description: 'Hands-on React, Node, Express, MongoDB, and Frontend project milestones.'
    });
  }

  // 4. Any custom courses added by user (including virtual YouTube courses)
  if (Array.isArray(inMemoryData.customCourses)) {
    inMemoryData.customCourses.forEach(c => {
      const isValid = c.isVirtual || (c.rootPath && fs.existsSync(c.rootPath));
      if (isValid && !discovered.some(d => d.id === c.id)) {
        discovered.push(c);
      }
    });
  }

  return discovered;
}

// API: Candidate scan roots — mounted drives plus the home directory.
app.get('/api/scan/roots', (req: Request, res: Response) => {
  const roots: { path: string; label: string; kind: 'drive' | 'home' }[] = [];
  const seen = new Set<string>();

  const add = (p: string, label: string, kind: 'drive' | 'home') => {
    const resolved = path.resolve(p);
    if (seen.has(resolved)) return;
    try {
      if (!fs.statSync(resolved).isDirectory()) return;
    } catch (e) {
      return;
    }
    seen.add(resolved);
    roots.push({ path: resolved, label, kind });
  };

  // Removable and secondary drives, as mounted by the desktop environment.
  for (const base of ['/run/media', '/media', '/mnt']) {
    try {
      for (const entry of fs.readdirSync(base, { withFileTypes: true })) {
        if (!entry.isDirectory()) continue;
        const outer = path.join(base, entry.name);
        // /run/media/<user>/<drive> nests one level deeper than /mnt/<drive>.
        let nested: fs.Dirent[] = [];
        try {
          nested = fs.readdirSync(outer, { withFileTypes: true }).filter(d => d.isDirectory());
        } catch (e) {}
        if (base === '/run/media' && nested.length) {
          for (const drive of nested) add(path.join(outer, drive.name), drive.name, 'drive');
        } else {
          add(outer, entry.name, 'drive');
        }
      }
    } catch (e) {}
  }

  const home = process.env.HOME || process.env.USERPROFILE;
  if (home) add(home, 'Home folder', 'home');

  res.json({ roots });
});

/**
 * Guess whether a folder of videos is study material or downloaded media.
 *
 * Nothing is hidden on the strength of this — the user still picks from the
 * full list. It only decides what surfaces first, so a season of a TV show does
 * not sit above an actual course.
 */
function classifyFolder(dir: string, fileNames: string[], docCount: number): { likelyCourse: boolean; reason: string } {
  const haystack = (path.basename(dir) + ' ' + fileNames.join(' ')).toLowerCase();

  const courseWords = ['week', 'lecture', 'lesson', 'module', 'chapter', 'course', 'tutorial',
                       'bootcamp', 'cohort', 'session', 'class', 'training', 'workshop', 'part -'];
  const mediaMarkers = ['1080p', '720p', '2160p', 'web-dl', 'webrip', 'bluray', 'blu-ray', 'x265',
                        'x264', 'hevc', 'ddp5', 'aac5', 'hdtv', 'remux', 'dvdrip', 'yify', 'anarchy'];

  const hitsCourse = courseWords.filter(w => haystack.includes(w));
  const hitsMedia = mediaMarkers.filter(w => haystack.includes(w));
  const seasonPattern = /\bs\d{2}(e\d{2})?\b/i.test(haystack);

  if (hitsMedia.length > 0 || seasonPattern) {
    return { likelyCourse: false, reason: seasonPattern && !hitsMedia.length ? 'looks like a TV season' : 'looks like a media rip' };
  }
  if (docCount > 0 && hitsCourse.length > 0) {
    return { likelyCourse: true, reason: `${hitsCourse[0]} naming + ${docCount} slide deck${docCount === 1 ? '' : 's'}` };
  }
  if (hitsCourse.length > 0) return { likelyCourse: true, reason: `"${hitsCourse[0]}" in the naming` };
  if (docCount > 0) return { likelyCourse: true, reason: `${docCount} slide deck${docCount === 1 ? '' : 's'} alongside the videos` };
  return { likelyCourse: false, reason: 'no course naming or slides found' };
}

/**
 * Walk a tree looking for directories that hold course material.
 *
 * A directory qualifies when it directly contains at least MIN_VIDEOS video
 * files over 1MB — the same threshold the course crawler already uses, so what
 * the scan offers is what the crawler will actually index. Bounded by depth,
 * a wall-clock deadline and a result cap so scanning a whole drive cannot hang
 * the single-threaded server.
 */
function scanForCourses(root: string, deadlineMs: number) {
  const MIN_VIDEOS = 3;
  const MAX_DEPTH = 6;
  const MAX_RESULTS = 200;
  const found: {
    path: string; name: string; videoCount: number; totalBytes: number;
    depth: number; docCount: number; likelyCourse: boolean; reason: string;
  }[] = [];
  let truncated = false;
  const visitedDirs = new Set<string>();

  const walk = (dir: string, depth: number) => {
    if (depth > MAX_DEPTH || found.length >= MAX_RESULTS) return;
    if (Date.now() > deadlineMs) { truncated = true; return; }

    let real: string;
    try {
      real = fs.realpathSync(dir);
    } catch (e) {
      return;
    }
    if (visitedDirs.has(real)) return;   // symlink loop guard
    visitedDirs.add(real);

    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch (e) {
      return;   // unreadable / permission denied — skip quietly
    }

    let videoCount = 0;
    let totalBytes = 0;
    let docCount = 0;
    const subdirs: string[] = [];
    const fileNames: string[] = [];

    for (const entry of entries) {
      if (entry.name.startsWith('.') || IGNORED_NAMES.has(entry.name)) continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        subdirs.push(full);
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name).toLowerCase();
        if (VIDEO_EXTENSIONS.has(ext)) {
          try {
            const st = fs.statSync(full);
            if (st.size > 1024 * 1024) { videoCount++; totalBytes += st.size; fileNames.push(entry.name); }
          } catch (e) {}
        } else if (DOC_EXTENSIONS.has(ext)) {
          docCount++;
        }
      }
    }

    if (videoCount >= MIN_VIDEOS) {
      const { likelyCourse, reason } = classifyFolder(dir, fileNames, docCount);
      found.push({ path: dir, name: path.basename(dir) || dir, videoCount, totalBytes, depth, docCount, likelyCourse, reason });
      return;   // stop here: this is the course folder, not its subfolders
    }

    for (const sub of subdirs) walk(sub, depth + 1);
  };

  walk(root, 0);

  // Roll siblings up to their parent: a course usually presents as several
  // "Week N" folders that each qualify on their own. Offering the parent once
  // matches how the crawler indexes it (weeks become modules) and stops the
  // list filling with 20 rows for one course.
  const byParent = new Map<string, typeof found>();
  for (const c of found) {
    const parent = path.dirname(c.path);
    if (!byParent.has(parent)) byParent.set(parent, []);
    byParent.get(parent)!.push(c);
  }

  const rolled: typeof found = [];
  const absorbed = new Set<string>();
  for (const [parent, children] of byParent) {
    if (children.length < 2 || parent === path.dirname(root) || absorbed.has(parent)) continue;
    for (const c of children) absorbed.add(c.path);
    rolled.push({
      path: parent,
      name: path.basename(parent) || parent,
      videoCount: children.reduce((n, c) => n + c.videoCount, 0),
      totalBytes: children.reduce((n, c) => n + c.totalBytes, 0),
      docCount: children.reduce((n, c) => n + c.docCount, 0),
      depth: Math.max(0, Math.min(...children.map(c => c.depth)) - 1),
      likelyCourse: children.some(c => c.likelyCourse),
      reason: `${children.length} sub-folders of lessons`
    });
  }

  const result = [...rolled, ...found.filter(c => !absorbed.has(c.path))];
  if (found.length >= MAX_RESULTS) truncated = true;
  return { found: result, truncated };
}

// API: Scan a drive or folder for course material.
app.post('/api/scan', (req: Request, res: Response) => {
  const { rootPath, timeoutMs } = req.body || {};
  if (!rootPath || typeof rootPath !== 'string') {
    return res.status(400).json({ error: 'A folder or drive path is required' });
  }

  const resolved = path.resolve(rootPath);
  try {
    if (!fs.statSync(resolved).isDirectory()) {
      return res.status(400).json({ error: 'That path is not a folder' });
    }
  } catch (e) {
    return res.status(404).json({ error: 'That folder does not exist or cannot be read' });
  }

  const budget = Math.min(Math.max(Number(timeoutMs) || 20000, 2000), 120000);
  const started = Date.now();
  const { found, truncated } = scanForCourses(resolved, started + budget);

  // Mark anything already in the library so the UI can grey it out.
  const existingRoots = discoverCourses()
    .map(c => c.rootPath && path.resolve(c.rootPath))
    .filter(Boolean) as string[];
  // A folder counts as covered if it IS a course root or sits inside one —
  // otherwise every week of an added course reappears as a new suggestion.
  const isCovered = (p: string) => existingRoots.some(root => isInside(root, p));

  res.json({
    scannedPath: resolved,
    elapsedMs: Date.now() - started,
    truncated,
    candidates: found
      .sort((a, b) => (Number(b.likelyCourse) - Number(a.likelyCourse)) || (b.videoCount - a.videoCount))
      .map(c => ({ ...c, alreadyAdded: isCovered(path.resolve(c.path)) }))
  });
});

// API: List Courses
app.get('/api/courses', (req: Request, res: Response) => {
  const courses = discoverCourses();
  // Never hand back an activeCourseId that no longer resolves — the client would
  // request a catalog that 404s and land on a dead empty state.
  if (inMemoryData.activeCourseId && !courses.some(c => c.id === inMemoryData.activeCourseId)) {
    inMemoryData.activeCourseId = courses[0]?.id || '';
  }
  res.json({
    activeCourseId: inMemoryData.activeCourseId,
    courses
  });
});

// API: Add Custom Course Path (Local Folder)
app.post('/api/courses/add', (req: Request, res: Response) => {
  const { folderPath, name } = req.body;
  if (!folderPath || !fs.existsSync(folderPath)) {
    return res.status(400).json({ error: 'Folder path does not exist on disk' });
  }

  const courseId = path.basename(folderPath).toLowerCase().replace(/[^a-z0-9_-]/g, '-');
  const newCourse: CourseSummary = {
    id: courseId,
    name: name || path.basename(folderPath),
    rootPath: path.resolve(folderPath),
    badge: 'Custom Course',
    gradient: 'from-emerald-500 to-teal-600',
    description: `Local course stored at ${folderPath}`
  };

  if (!inMemoryData.customCourses) inMemoryData.customCourses = [];
  inMemoryData.customCourses = inMemoryData.customCourses.filter(c => c.id !== courseId);
  inMemoryData.customCourses.push(newCourse);
  atomicWriteJson(PROGRESS_FILE, inMemoryData);

  res.json({ success: true, course: newCourse });
});

// API: Add Virtual YouTube Course / Playlist
app.post('/api/courses/add-virtual', (req: Request, res: Response) => {
  // The client sends { name, playlistId, videos[] }. This used to demand
  // { id, name, modules[] } and rejected every import with "Course ID and name
  // required" — and even with an id, a flat `videos` array was silently
  // dropped because only `modules` was read. Accept both shapes.
  const { id, playlistId, name, description, badge, gradient, modules, videos } = req.body || {};

  const sourceId = id || playlistId;
  if (!sourceId || !name) {
    return res.status(400).json({ error: 'A playlist id and a course name are required' });
  }

  const courseId = String(sourceId).startsWith('yt-') ? String(sourceId) : `yt-${sourceId}`;

  let courseModules: CourseModule[] = Array.isArray(modules) ? modules : [];

  if (courseModules.length === 0 && Array.isArray(videos) && videos.length > 0) {
    const lessons: CourseFile[] = videos.map((v: any, i: number) => {
      const videoId = v.youtubeVideoId || v.videoId || v.id?.replace(/^yt_/, '') || '';
      return {
        // Keyed the same way an ad-hoc play is, so notes, bookmarks and resume
        // positions taken before the import carry straight over.
        id: `yt_${videoId}`,
        title: v.title || `Lecture ${i + 1}`,
        filename: `${videoId}.mp4`,
        relativePath: videoId,
        fileSizeBytes: 0,
        extension: '.mp4',
        duration: v.durationText || v.duration || '',
        durationSeconds: Number(v.durationSeconds) || 0,
        source: 'youtube',
        youtubeVideoId: videoId,
        thumbnailUrl: v.thumbnail || v.thumbnailUrl
      } as CourseFile;
    }).filter((l: CourseFile) => l.youtubeVideoId);

    if (lessons.length === 0) {
      return res.status(400).json({ error: 'None of the supplied videos had a usable YouTube id' });
    }

    courseModules = [{
      id: Buffer.from(courseId).toString('base64url'),
      title: name,
      relativeDir: '',
      order: 1,
      lessons,
      supplementaryFiles: []
    }];
  }

  if (courseModules.length === 0) {
    return res.status(400).json({ error: 'No videos supplied for this playlist' });
  }

  const newCourse: CourseSummary = {
    id: courseId,
    name,
    rootPath: '',
    badge: badge || 'YouTube Series',
    gradient: gradient || 'from-rose-500 to-red-600',
    description: description || 'Imported YouTube series for distraction-free study.',
    isVirtual: true,
    modules: courseModules
  };

  if (!inMemoryData.customCourses) inMemoryData.customCourses = [];
  inMemoryData.customCourses = inMemoryData.customCourses.filter(c => c.id !== courseId);
  inMemoryData.customCourses.push(newCourse);
  catalogCache.delete(courseId);
  flushProgressNow();

  const lessonCount = courseModules.reduce((n, m) => n + (m.lessons?.length || 0), 0);
  console.log(`[Playlist Import] "${name}" -> ${courseId} (${lessonCount} lessons)`);
  res.json({ success: true, course: newCourse, lessonCount });
});

// API: Delete Custom / Virtual Course
app.delete('/api/courses/:courseId', (req: Request, res: Response) => {
  const { courseId } = req.params;
  if (!courseId) return res.status(400).json({ error: 'Course ID required' });

  if (Array.isArray(inMemoryData.customCourses)) {
    inMemoryData.customCourses = inMemoryData.customCourses.filter(c => c.id !== courseId);
  }
  catalogCache.delete(courseId);
  atomicWriteJson(PROGRESS_FILE, inMemoryData);

  res.json({ success: true, courseId });
});

// --- YouTube Native Engine (Zero npm dependencies, 100% Free) ---
const searchCache = new Map<string, { data: YouTubeSearchResult[]; expiresAt: number }>();
let lastSearchTimestamp = 0;

function checkSearchRateLimit(): boolean {
  const now = Date.now();
  if (now - lastSearchTimestamp < 1500) {
    return false;
  }
  lastSearchTimestamp = now;
  return true;
}

// API: YouTube In-App Search (InnerTube Client API)
app.post('/api/youtube/search', async (req: Request, res: Response) => {
  const query = (req.body.query || '').trim();
  if (!query) {
    return res.status(400).json({ error: 'Search query required' });
  }

  const cacheKey = query.toLowerCase();
  const cached = searchCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return res.json({ results: cached.data, cached: true });
  }

  if (!checkSearchRateLimit()) {
    if (cached) {
      return res.json({ results: cached.data, cached: true, warning: 'Cooldown active, showing cached results' });
    }
    return res.status(429).json({ error: 'Search cooldown active. Please wait 1.5 seconds between searches.' });
  }

  try {
    const ytRes = await fetch('https://www.youtube.com/youtubei/v1/search?prettyPrint=false', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        context: { client: { clientName: 'WEB', clientVersion: '2.20250101.00.00', hl: 'en', gl: 'US' } },
        query
      })
    });

    if (!ytRes.ok) {
      throw new Error(`YouTube InnerTube returned status ${ytRes.status}`);
    }

    const data: any = await ytRes.json();
    const contents = data.contents?.twoColumnSearchResultsRenderer?.primaryContents?.sectionListRenderer?.contents || [];
    const results: YouTubeSearchResult[] = [];

    for (const c of contents) {
      const itemSection = c.itemSectionRenderer?.contents || [];
      for (const item of itemSection) {
        if (item.videoRenderer) {
          const v = item.videoRenderer;
          results.push({
            id: v.videoId,
            title: v.title?.runs?.map((r: any) => r.text).join('') || '',
            duration: v.lengthText?.simpleText || '',
            views: v.viewCountText?.simpleText || '',
            author: v.ownerText?.runs?.map((r: any) => r.text).join('') || '',
            thumbnail: v.thumbnail?.thumbnails?.slice(-1)[0]?.url || `https://i.ytimg.com/vi/${v.videoId}/hqdefault.jpg`
          });
        }
      }
    }

    // Cache results for 30 minutes, limit cache to 100 entries to prevent RAM bloat
    if (searchCache.size >= 100) {
      const firstKey = searchCache.keys().next().value;
      if (firstKey) searchCache.delete(firstKey);
    }
    searchCache.set(cacheKey, { data: results, expiresAt: Date.now() + 30 * 60 * 1000 });

    res.json({ results });
  } catch (err: any) {
    console.error('YouTube search error:', err.message);
    res.status(500).json({ error: 'Failed to search YouTube. Check internet connection.' });
  }
});

// API: YouTube Playlist Extraction (Supports modern 2025/2026 lockupViewModel + legacy fallback)
/**
 * Pull every video out of a playlist page's ytInitialData.
 *
 * YouTube ships several node shapes (legacy playlistVideoRenderer, the newer
 * lockupViewModel, and richItemRenderer wrappers) and moves them between tabs
 * and sections. Walking a fixed path — contents[0].itemSectionRenderer... —
 * silently returned zero videos whenever the shape differed, which is why some
 * playlists imported as empty. Recurse instead and collect whatever we find.
 */
function collectPlaylistVideos(node: any, out: any[], seen: Set<string>): void {
  if (!node || typeof node !== 'object') return;

  if (Array.isArray(node)) {
    for (const item of node) collectPlaylistVideos(item, out, seen);
    return;
  }

  // Legacy shape
  const pv = node.playlistVideoRenderer;
  if (pv?.videoId && !seen.has(pv.videoId)) {
    seen.add(pv.videoId);
    out.push({
      id: `yt_${pv.videoId}`,
      youtubeVideoId: pv.videoId,
      videoId: pv.videoId,
      title: pv.title?.runs?.[0]?.text || pv.title?.simpleText || 'Video Lecture',
      durationText: pv.lengthText?.simpleText || '',
      durationSeconds: Number(pv.lengthSeconds) || 0,
      thumbnail: pv.thumbnail?.thumbnails?.[0]?.url || `https://i.ytimg.com/vi/${pv.videoId}/hqdefault.jpg`
    });
  }

  // Current shape
  const lk = node.lockupViewModel;
  if (lk) {
    const videoId = lk.contentId
      || lk.rendererContext?.commandContext?.onTap?.innertubeCommand?.watchEndpoint?.videoId;
    const title = lk.metadata?.lockupMetadataViewModel?.title?.content;
    if (videoId && title && !seen.has(videoId)) {
      seen.add(videoId);
      let durationText = '';
      for (const ov of lk.contentImage?.thumbnailViewModel?.overlays || []) {
        durationText = ov.thumbnailBottomOverlayViewModel?.badges?.[0]?.thumbnailBadgeViewModel?.text
          || ov.thumbnailOverlayTimeStatusRenderer?.text?.runs?.[0]?.text || durationText;
        if (durationText) break;
      }
      out.push({
        id: `yt_${videoId}`,
        youtubeVideoId: videoId,
        videoId,
        title,
        durationText,
        durationSeconds: parseDurationText(durationText),
        thumbnail: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`
      });
    }
  }

  for (const key of Object.keys(node)) {
    if (key === 'playlistVideoRenderer' || key === 'lockupViewModel') continue;
    collectPlaylistVideos(node[key], out, seen);
  }
}

/** "1:02:03" / "9:41" -> seconds. */
function parseDurationText(text?: string): number {
  if (!text) return 0;
  const parts = text.trim().split(':').map(Number);
  if (parts.some(isNaN)) return 0;
  return parts.reduce((acc, n) => acc * 60 + n, 0);
}

/** Find the continuation token for the next page, wherever it sits. */
function findContinuationToken(node: any): string | null {
  if (!node || typeof node !== 'object') return null;
  if (Array.isArray(node)) {
    for (const item of node) {
      const t = findContinuationToken(item);
      if (t) return t;
    }
    return null;
  }
  const token = node.continuationCommand?.token
    || node.continuationEndpoint?.continuationCommand?.token;
  if (typeof token === 'string' && token.length > 10) return token;
  for (const key of Object.keys(node)) {
    const t = findContinuationToken(node[key]);
    if (t) return t;
  }
  return null;
}

/**
 * Pull an embedded JSON object out of a YouTube page.
 *
 * Regex cannot do this reliably: a non-greedy /{.+?}/ stops at the first brace
 * that happens to be followed by the terminator, which on some playlist pages
 * yields a truncated slice that JSON.parse rejects — the page then looked
 * unreadable even though the data was right there. Scan forward tracking brace
 * depth, skipping over string literals and their escapes.
 */
function extractEmbeddedJson(html: string, marker: string): any | null {
  let searchFrom = 0;
  for (let attempt = 0; attempt < 3; attempt++) {
    const markerAt = html.indexOf(marker, searchFrom);
    if (markerAt === -1) return null;

    const objStart = html.indexOf('{', markerAt + marker.length);
    if (objStart === -1) return null;
    searchFrom = markerAt + marker.length;

    let depth = 0;
    let inString = false;
    let escaped = false;

    for (let i = objStart; i < html.length; i++) {
      const ch = html[i];

      if (escaped) { escaped = false; continue; }
      if (ch === '\\') { escaped = true; continue; }
      if (ch === '"') { inString = !inString; continue; }
      if (inString) continue;

      if (ch === '{') depth++;
      else if (ch === '}') {
        depth--;
        if (depth === 0) {
          try {
            return JSON.parse(html.substring(objStart, i + 1));
          } catch (e) {
            break;   // malformed here; try the next occurrence of the marker
          }
        }
      }
    }
  }
  return null;
}

function extractYtInitialData(html: string): any | null {
  for (const marker of ['ytInitialData = ', 'ytInitialData"] = ', 'var ytInitialData = ', 'ytInitialData=']) {
    const data = extractEmbeddedJson(html, marker);
    if (data) return data;
  }
  return null;
}

const YT_BROWSER_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept-Language': 'en-US,en;q=0.9'
};

app.get('/api/youtube/playlist', async (req: Request, res: Response) => {
  const playlistId = req.query.id as string;
  if (!playlistId) {
    return res.status(400).json({ error: 'Playlist ID required' });
  }

  try {
    const url = `https://www.youtube.com/playlist?list=${encodeURIComponent(playlistId)}`;
    const ytRes = await fetch(url, { headers: YT_BROWSER_HEADERS });
    if (!ytRes.ok) throw new Error(`Playlist page returned ${ytRes.status}`);

    const html = await ytRes.text();
    const d = extractYtInitialData(html);
    if (!d) throw new Error('Could not read playlist data from the page');

    const playlistTitle =
      d.header?.playlistHeaderRenderer?.title?.simpleText ||
      d.metadata?.playlistMetadataRenderer?.title ||
      d.header?.pageHeaderRenderer?.pageTitle ||
      'YouTube Playlist';
    const author =
      d.header?.playlistHeaderRenderer?.ownerText?.runs?.[0]?.text ||
      d.metadata?.playlistMetadataRenderer?.ownerText?.runs?.[0]?.text ||
      'YouTube';

    const videos: any[] = [];
    const seen = new Set<string>();
    collectPlaylistVideos(d.contents, videos, seen);
    if (videos.length === 0) collectPlaylistVideos(d, videos, seen);

    // Page through the rest. YouTube only ships ~100 items in the first
    // response, so long courses were silently truncated.
    let token = findContinuationToken(d);
    const apiKey = html.match(/"INNERTUBE_API_KEY":"([^"]+)"/)?.[1];
    let guard = 0;
    while (token && apiKey && videos.length < 1000 && guard < 20) {
      guard++;
      try {
        const contRes = await fetch(`https://www.youtube.com/youtubei/v1/browse?key=${apiKey}`, {
          method: 'POST',
          headers: { ...YT_BROWSER_HEADERS, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            context: { client: { clientName: 'WEB', clientVersion: '2.20240101.00.00' } },
            continuation: token
          })
        });
        if (!contRes.ok) break;
        const contData: any = await contRes.json();
        const before = videos.length;
        collectPlaylistVideos(contData, videos, seen);
        if (videos.length === before) break;    // no progress, stop
        token = findContinuationToken(contData);
      } catch (e) {
        break;
      }
    }

    if (videos.length === 0) {
      return res.status(404).json({
        error: 'No videos found in this playlist. It may be private, empty, or region-restricted.'
      });
    }

    res.json({ id: playlistId, title: playlistTitle, author, videos, totalVideos: videos.length });
  } catch (err: any) {
    console.error('Playlist extraction error:', err.message);
    res.status(502).json({ error: `Could not read that playlist: ${err.message}` });
  }
});

// API: YouTube Single Video oEmbed Endpoint
app.get('/api/youtube/info', async (req: Request, res: Response) => {
  const videoId = req.query.id as string;
  if (!videoId) return res.status(400).json({ error: 'Video ID required' });

  try {
    const oembedUrl = `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}&format=json`;
    const ytRes = await fetch(oembedUrl);
    if (!ytRes.ok) return res.status(404).json({ error: 'Video not found or is private' });

    const data: any = await ytRes.json();
    res.json({
      id: videoId,
      title: data.title,
      author: data.author_name,
      thumbnail: data.thumbnail_url || `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch video information' });
  }
});

// Cache for course catalogs (invalidates every 5 minutes or on demand)
const catalogCache = new Map<string, { catalog: any; rootMtimeMs: number }>();

/** Newest mtime across the course root and its immediate subdirectories.
 *  Cheap enough to run per request, and moves whenever a file is added or
 *  removed at either level — which is how lessons actually get added. */
function courseRootMtimeMs(course: CourseSummary): number {
  if (!course.rootPath) return 0;
  let newest = 0;
  try {
    newest = fs.statSync(course.rootPath).mtimeMs;
    for (const entry of fs.readdirSync(course.rootPath, { withFileTypes: true })) {
      if (!entry.isDirectory() || IGNORED_NAMES.has(entry.name) || entry.name.startsWith('.')) continue;
      try {
        newest = Math.max(newest, fs.statSync(path.join(course.rootPath, entry.name)).mtimeMs);
      } catch (e) {}
    }
  } catch (e) {
    return 0;
  }
  return newest;
}

function hasCourseRootChanged(course: CourseSummary, cachedMtimeMs: number): boolean {
  if (course.isVirtual) return false;
  return courseRootMtimeMs(course) !== cachedMtimeMs;
}

// Active remux/transcode jobs map to prevent duplicate work
const activeRemuxJobs = new Map<string, Promise<string>>();

function getVideoCachePath(filePath: string, stat: fs.Stats): string {
  const hash = crypto.createHash('sha256').update(`${filePath}:${stat.size}:${stat.mtimeMs}`).digest('hex').substring(0, 20);
  const cleanBase = path.basename(filePath, path.extname(filePath)).replace(/[^a-zA-Z0-9_-]/g, '_').substring(0, 32);
  return path.join(VIDEO_CACHE_DIR, `${cleanBase}_${hash}.mp4`);
}

function probeMedia(filePath: string): Promise<VideoStreamInfo[] | null> {
  return new Promise((resolve) => {
    execFile('ffprobe', [
      '-v', 'error',
      '-show_entries', 'stream=index,codec_name,codec_type',
      '-of', 'json',
      filePath
    ], { timeout: 10000 }, (err, stdout) => {
      if (err || !stdout) {
        return resolve(null);
      }
      try {
        const data = JSON.parse(stdout);
        resolve(data.streams || []);
      } catch (e) {
        resolve(null);
      }
    });
  });
}

function ensureWebPlayableVideo(targetPath: string, stat: fs.Stats): Promise<string> {
  const cachedFile = getVideoCachePath(targetPath, stat);
  const tempFile = `${cachedFile}.tmp.${Date.now()}.mp4`;

  // If already remuxed, return cached file immediately
  if (fs.existsSync(cachedFile)) {
    try {
      const cStat = fs.statSync(cachedFile);
      if (cStat.size > 0) return Promise.resolve(cachedFile);
    } catch (e) {}
  }

  // If a job is already in flight for this exact file, return the existing promise
  if (activeRemuxJobs.has(targetPath)) {
    return activeRemuxJobs.get(targetPath)!;
  }

  const job = (async () => {
    try {
      console.log(`[Video Transcoder] Analyzing: ${path.basename(targetPath)}`);
      const streams = await probeMedia(targetPath);
      const videoStream = streams?.find(s => s.codec_type === 'video');
      const audioStream = streams?.find(s => s.codec_type === 'audio');

      const isH264 = videoStream?.codec_name === 'h264' || videoStream?.codec_name === 'avc1';
      const isAac = audioStream?.codec_name === 'aac';
      const isMp3 = audioStream?.codec_name === 'mp3';

      const ffmpegArgs = ['-y', '-i', targetPath];

      // Video: copy if H.264, else re-encode fast
      if (isH264) {
        ffmpegArgs.push('-c:v', 'copy');
      } else {
        ffmpegArgs.push('-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '23');
      }

      // Audio: copy if AAC or MP3 (with bitstream filter for AAC from MPEG-TS/MKV)
      if (isAac) {
        ffmpegArgs.push('-c:a', 'copy', '-bsf:a', 'aac_adtstoasc');
      } else if (isMp3) {
        ffmpegArgs.push('-c:a', 'copy');
      } else {
        ffmpegArgs.push('-c:a', 'aac', '-b:a', '192k');
      }

      // Faststart MP4 for instant browser byte-range seeking
      ffmpegArgs.push('-movflags', '+faststart', '-f', 'mp4', tempFile);

      await new Promise((resolve, reject) => {
        execFile('ffmpeg', ffmpegArgs, { timeout: 600000 }, (err, stdout, stderr) => {
          if (err) {
            console.warn(`[Video Transcoder] Primary remux failed, attempting fallback audio transcode...`);
            // Fallback: re-encode audio to AAC if bitstream filter failed
            const fallbackArgs = [
              '-y', '-i', targetPath,
              '-c:v', isH264 ? 'copy' : 'libx264',
              '-c:a', 'aac', '-b:a', '192k',
              '-movflags', '+faststart',
              '-f', 'mp4',
              tempFile
            ];
            execFile('ffmpeg', fallbackArgs, { timeout: 600000 }, (err2, stdout2, stderr2) => {
              if (err2) {
                return reject(new Error(stderr2 || err2.message));
              }
              resolve(true);
            });
            return;
          }
          resolve(true);
        });
      });

      if (fs.existsSync(tempFile) && fs.statSync(tempFile).size > 0) {
        fs.renameSync(tempFile, cachedFile);
        const finalSizeMb = (fs.statSync(cachedFile).size / (1024 * 1024)).toFixed(1);
        console.log(`[Video Transcoder Ready]: ${path.basename(targetPath)} -> ${path.basename(cachedFile)} (${finalSizeMb} MB)`);
        return cachedFile;
      } else {
        throw new Error('Conversion produced an empty file');
      }
    } catch (err: any) {
      console.error(`[Video Transcoder Failed for ${path.basename(targetPath)}]:`, err.message);
      if (fs.existsSync(tempFile)) {
        try { fs.unlinkSync(tempFile); } catch (e) {}
      }
      throw err;
    } finally {
      activeRemuxJobs.delete(targetPath);
    }
  })();

  activeRemuxJobs.set(targetPath, job);
  return job;
}

const warmingCourses = new Set<string>();

/** What the transcoder is doing right now, surfaced at /api/transcode/status so
 *  the UI can explain why the fan spun up instead of leaving it a mystery. */
const transcodeStatus: {
  active: boolean;
  courseName: string;
  currentTitle: string;
  done: number;
  total: number;
} = { active: false, courseName: '', currentTitle: '', done: 0, total: 0 };

/** Lessons in this course whose web-playable copy is genuinely missing. */
function pendingTranscodes(course: CourseSummary): { title: string; targetPath: string; stat: fs.Stats }[] {
  const pending: { title: string; targetPath: string; stat: fs.Stats }[] = [];
  const cached = catalogCache.get(course.id);
  const catalog = (cached && !hasCourseRootChanged(course, cached.rootMtimeMs))
    ? cached.catalog
    : crawlCourseDirectory(course.rootPath);

  for (const mod of catalog.modules) {
    for (const lesson of mod.lessons) {
      const ext = path.extname(lesson.relativePath).toLowerCase();
      if (ext === '.mp4' || ext === '.webm' || !VIDEO_EXTENSIONS.has(ext)) continue;
      const targetPath = path.resolve(course.rootPath, lesson.relativePath);
      if (!fs.existsSync(targetPath)) continue;
      const stat = fs.statSync(targetPath);
      const cachedFile = getVideoCachePath(targetPath, stat);
      if (!fs.existsSync(cachedFile) || fs.statSync(cachedFile).size === 0) {
        pending.push({ title: lesson.title, targetPath, stat });
      }
    }
  }
  return pending;
}

function warmCourseVideoCache(course: CourseSummary) {
  if (!course || !course.rootPath || warmingCourses.has(course.id)) return;
  warmingCourses.add(course.id);

  setTimeout(async () => {
    try {
      // Only spin anything up when there is real work. Previously this crawled
      // and scheduled on every catalog hit, cached or not.
      const pending = pendingTranscodes(course);
      if (pending.length === 0) return;

      transcodeStatus.active = true;
      transcodeStatus.courseName = course.name;
      transcodeStatus.total = pending.length;
      transcodeStatus.done = 0;

      for (const item of pending) {
        transcodeStatus.currentTitle = item.title;
        console.log(`[Cache Warming] Pre-transcoding: ${item.title}`);
        await ensureWebPlayableVideo(item.targetPath, item.stat)
          .catch(e => console.warn(`Failed to pre-transcode ${item.title}:`, e.message));
        transcodeStatus.done += 1;
      }
    } catch (e) {
    } finally {
      transcodeStatus.active = false;
      transcodeStatus.currentTitle = '';
      warmingCourses.delete(course.id);
    }
  }, 300);
}

// API: What the background transcoder is doing (drives the navbar indicator)
app.get('/api/transcode/status', (req: Request, res: Response) => {
  res.json(transcodeStatus);
});

// API: Get Catalog for a Course
app.get('/api/catalog/:courseId', (req: Request, res: Response) => {
  const { courseId } = req.params;
  const force = req.query.force === 'true';

  const courses = discoverCourses();
  const course = courses.find(c => c.id === courseId);

  // Serve from cache only while the course directory is untouched. Without this
  // check a video dropped into the folder never showed up until a restart, since
  // nothing in the client ever passed ?force=true.
  const cachedEntry = catalogCache.get(courseId);
  if (!force && cachedEntry && course && !hasCourseRootChanged(course, cachedEntry.rootMtimeMs)) {
    res.json(cachedEntry.catalog);
    warmCourseVideoCache(course);
    return;
  }

  if (!course) {
    return res.status(404).json({ error: 'Course not found' });
  }

  if (course.isVirtual) {
    const virtualCatalog = {
      id: course.id,
      name: course.name,
      rootPath: '',
      isVirtual: true,
      modules: course.modules || [],
      totalVideos: (course.modules || []).reduce((acc, m) => acc + (m.lessons || []).length, 0),
      totalPdfs: (course.modules || []).reduce((acc, m) => acc + (m.supplementaryFiles || []).length, 0)
    };
    catalogCache.set(courseId, { catalog: virtualCatalog, rootMtimeMs: 0 });
    return res.json(virtualCatalog);
  }

  const catalog = crawlCourseDirectory(course.rootPath);
  const result = {
    id: course.id,
    name: course.name,
    rootPath: course.rootPath,
    ...catalog
  };

  catalogCache.set(courseId, { catalog: result, rootMtimeMs: courseRootMtimeMs(course) });
  res.json(result);

  // Trigger background cache warming
  warmCourseVideoCache(course);
});

// API: RFC 7233 Range-Seeking Video Streamer (Universal Container & Codec Compatible)
app.get('/api/stream/:courseId/:lessonId', async (req: Request, res: Response) => {
  const { courseId, lessonId } = req.params;

  const courses = discoverCourses();
  const course = courses.find(c => c.id === courseId);
  if (!course) return res.status(404).send('Course not found');

  if (course.isVirtual) {
    return res.status(400).send('Virtual YouTube lessons stream directly in client player');
  }

  let relativePath: string;
  try {
    relativePath = Buffer.from(lessonId, 'base64url').toString('utf-8');
  } catch (e) {
    return res.status(400).send('Invalid lesson ID format');
  }

  const targetPath = path.resolve(course.rootPath, relativePath);

  // Security Jail: Prevent Path Traversal (real containment, not a prefix test)
  if (!isInside(course.rootPath, targetPath)) {
    return res.status(403).send('Access Denied: Path Traversal Prohibited');
  }

  if (!fs.existsSync(targetPath)) {
    return res.status(404).send('Video file not found on disk');
  }

  let stat: fs.Stats;
  try {
    stat = fs.statSync(targetPath);
  } catch (e) {
    return res.status(500).send('Failed to read video file stat');
  }

  const fileSize = stat.size;
  if (fileSize === 0) {
    return res.status(422).send('Corrupt or 0-byte video file');
  }

  const ext = path.extname(targetPath).toLowerCase();

  let servePath = targetPath;
  let serveSize = fileSize;
  let contentType = 'video/mp4';

  if (ext === '.webm') {
    contentType = 'video/webm';
  } else if (ext !== '.mp4' && ext !== '.m4v') {
    // Non-native browser container (.mkv, .avi, .ts, .flv, .wmv, etc.) -> Ensure web-playable MP4
    try {
      servePath = await ensureWebPlayableVideo(targetPath, stat);
      const cachedStat = fs.statSync(servePath);
      serveSize = cachedStat.size;
      contentType = 'video/mp4';
    } catch (err: any) {
      console.error('[Stream Transcode Error]:', err.message);
      servePath = targetPath;
      serveSize = fileSize;
      contentType = ext === '.mkv' ? 'video/x-matroska' : 'video/mp4';
    }
  }

  const range = req.headers.range;

  if (range) {
    // RFC 7233 range parsing
    const parts = range.replace(/bytes=/, '').split('-');
    let start = parseInt(parts[0], 10);
    let end = parts[1] ? parseInt(parts[1], 10) : serveSize - 1;

    // Suffix range support: bytes=-1048576 (e.g. read moov atom at end of file)
    if (isNaN(start)) {
      start = serveSize - end;
      end = serveSize - 1;
    }
    if (start < 0) start = 0;

    // Bound checks
    if (start >= serveSize || end >= serveSize || start > end) {
      res.writeHead(416, {
        'Content-Range': `bytes */${serveSize}`
      });
      return res.end();
    }

    const chunksize = (end - start) + 1;
    const stream = fs.createReadStream(servePath, { start, end });

    res.writeHead(206, {
      'Content-Range': `bytes ${start}-${end}/${serveSize}`,
      'Accept-Ranges': 'bytes',
      'Content-Length': chunksize,
      'Content-Type': contentType,
      'Access-Control-Expose-Headers': 'Content-Range, Content-Length, Accept-Ranges',
      'Cache-Control': 'no-cache'
    });

    // File Descriptor Leak Protection: Destroy stream immediately if client aborts/seeks
    req.on('close', () => {
      if (!res.writableEnded) {
        stream.destroy();
      }
    });

    stream.pipe(res);
  } else {
    // Standard full stream
    res.writeHead(200, {
      'Content-Length': serveSize,
      'Content-Type': contentType,
      'Accept-Ranges': 'bytes',
      'Access-Control-Expose-Headers': 'Content-Range, Content-Length, Accept-Ranges'
    });

    const stream = fs.createReadStream(servePath);
    req.on('close', () => {
      if (!res.writableEnded) stream.destroy();
    });
    stream.pipe(res);
  }
});

// API: PDF Slide Viewer Endpoint
app.get('/api/pdf/:courseId/:pdfId', (req: Request, res: Response) => {
  const { courseId, pdfId } = req.params;

  let targetPath = '';

  if (courseId === 'presentations') {
    let decoded: string;
    try {
      decoded = Buffer.from(pdfId, 'base64url').toString('utf-8');
    } catch (e) {
      return res.status(400).send('Invalid Presentation ID format');
    }
    const servable = resolveServable(decoded);
    if (!servable) return res.status(403).send('Access Denied: path is outside the course library');
    targetPath = servable;
  } else {
    const courses = discoverCourses();
    const course = courses.find(c => c.id === courseId);
    if (!course) return res.status(404).send('Course not found');

    let relativePath: string;
    try {
      relativePath = Buffer.from(pdfId, 'base64url').toString('utf-8');
    } catch (e) {
      return res.status(400).send('Invalid PDF ID format');
    }

    targetPath = path.resolve(course.rootPath, relativePath);

    // Path Traversal Security Guard (real containment, not a prefix test)
    if (!isInside(course.rootPath, targetPath)) {
      return res.status(403).send('Access Denied');
    }
  }

  if (!fs.existsSync(targetPath)) {
    return res.status(404).send('Presentation file not found');
  }

  const ext = path.extname(targetPath).toLowerCase();
  if (!DOC_EXTENSIONS.has(ext)) {
    return res.status(403).send('Access denied: not a presentation document');
  }

  if (ext === '.pdf') {
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'inline');
  } else if (ext === '.pptx' || ext === '.pptm') {
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.presentationml.presentation');
    res.setHeader('Content-Disposition', `inline; filename="${path.basename(targetPath)}"`);
  } else if (ext === '.ppt') {
    res.setHeader('Content-Type', 'application/vnd.ms-powerpoint');
    res.setHeader('Content-Disposition', `inline; filename="${path.basename(targetPath)}"`);
  } else {
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Disposition', `inline; filename="${path.basename(targetPath)}"`);
  }
  const stream = fs.createReadStream(targetPath);
  req.on('close', () => {
    if (!res.writableEnded) stream.destroy();
  });
  stream.pipe(res);
});

// API: Raw Slide & Presentation File Streamer (Direct Path / Deck ID)
app.get('/api/slides/raw', (req: Request, res: Response) => {
  const filePath = req.query.path as string;
  const id = req.query.id as string;
  let targetPath = '';

  let requested = '';
  if (filePath) {
    requested = filePath;
  } else if (id) {
    try {
      requested = Buffer.from(id, 'base64url').toString('utf-8');
    } catch (e) {
      return res.status(400).send('Invalid slide deck ID');
    }
  } else {
    return res.status(400).send('File path or ID required');
  }

  const servable = resolveServable(requested);
  if (!servable) return res.status(403).send('Access Denied: path is outside the course library');
  targetPath = servable;

  // Security guard: must exist and have document extension
  if (!fs.existsSync(targetPath)) {
    return res.status(404).send('Presentation file not found');
  }

  const ext = path.extname(targetPath).toLowerCase();
  if (!DOC_EXTENSIONS.has(ext)) {
    return res.status(403).send('Access denied: not a presentation document');
  }

  if (ext === '.pdf') {
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'inline');
  } else if (ext === '.pptx' || ext === '.pptm') {
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.presentationml.presentation');
    res.setHeader('Content-Disposition', `inline; filename="${path.basename(targetPath)}"`);
  } else if (ext === '.ppt') {
    res.setHeader('Content-Type', 'application/vnd.ms-powerpoint');
    res.setHeader('Content-Disposition', `inline; filename="${path.basename(targetPath)}"`);
  } else {
    res.setHeader('Content-Type', 'application/octet-stream');
  }

  const stream = fs.createReadStream(targetPath);
  req.on('close', () => {
    if (!res.writableEnded) stream.destroy();
  });
  stream.pipe(res);
});

// API: Discover All Presentation Decks Across System
app.get('/api/slides/all', (req: Request, res: Response) => {
  const decks: any[] = [];
  const visitedPaths = new Set<string>();

  // 1. Gather all slide decks from registered courses
  const courses = discoverCourses();
  for (const c of courses) {
    if (c.isVirtual || !c.rootPath) continue;
    try {
      const cached = catalogCache.get(c.id);
      const catalog = (cached && !hasCourseRootChanged(c, cached.rootMtimeMs))
        ? cached.catalog
        : crawlCourseDirectory(c.rootPath);
      for (const m of catalog.modules) {
        for (const f of m.supplementaryFiles) {
          const abs = path.resolve(c.rootPath, f.relativePath);
          if (!visitedPaths.has(abs) && fs.existsSync(abs)) {
            visitedPaths.add(abs);
            decks.push({
              id: f.id,
              title: f.title,
              filename: f.filename,
              filePath: abs,
              type: (path.extname(abs).slice(1) || 'pdf').toLowerCase(),
              courseId: c.id,
              courseName: c.name,
              moduleName: m.title,
              sizeBytes: f.fileSizeBytes
            });
          }
        }
      }
    } catch (e) {}
  }

  // 2. Discover decks in Presentations directory
  const presDir = path.join(COURSES_ROOT, 'Presentations');
  if (fs.existsSync(presDir)) {
    const walk = (d: string) => {
      try {
        const entries = fs.readdirSync(d, { withFileTypes: true });
        for (const e of entries) {
          const full = path.join(d, e.name);
          if (e.isDirectory()) {
            walk(full);
          } else if (e.isFile()) {
            const ext = path.extname(e.name).toLowerCase();
            if (DOC_EXTENSIONS.has(ext) && !visitedPaths.has(full)) {
              visitedPaths.add(full);
              const stat = fs.statSync(full);
              decks.push({
                id: Buffer.from(full).toString('base64url'),
                title: cleanTitle(e.name),
                filename: e.name,
                filePath: full,
                type: ext.slice(1),
                courseId: 'presentations',
                courseName: 'Workshop Presentations',
                moduleName: path.basename(d),
                sizeBytes: stat.size
              });
            }
          }
        }
      } catch (err) {}
    };
    walk(presDir);
  }

  res.json({ decks });
});

// API: Launch Presentation in Native Desktop App (OnlyOffice, PowerPoint, Keynote)
app.post('/api/slides/open-system', (req: Request, res: Response) => {
  const { filePath } = req.body;
  if (!filePath || typeof filePath !== 'string') {
    return res.status(400).json({ error: 'File path required' });
  }

  const resolved = resolveServable(filePath);
  if (!resolved) {
    return res.status(403).json({ error: 'Access denied: path is outside the course library' });
  }
  if (!fs.existsSync(resolved)) {
    return res.status(404).json({ error: 'File not found on disk' });
  }

  const ext = path.extname(resolved).toLowerCase();
  if (!DOC_EXTENSIONS.has(ext)) {
    return res.status(400).json({ error: 'Only presentation decks (.pdf, .pptx, .ppt) can be launched' });
  }

  const env = {
    ...process.env,
    DISPLAY: process.env.DISPLAY || ':0',
    WAYLAND_DISPLAY: process.env.WAYLAND_DISPLAY || 'wayland-0'
  };

  // On Windows `start` is a cmd.exe builtin — there is no start.exe — so
  // execFile could never launch it. Microsoft's CreateProcess documentation is
  // explicit that builtins and batch files must go through the interpreter:
  // cmd.exe /c. The empty "" is the window-title placeholder `start` expects
  // before a quoted path, otherwise it treats the path AS the title.
  let cmd: string;
  let args: string[];
  if (process.platform === 'win32') {
    cmd = process.env.COMSPEC || 'cmd.exe';
    args = ['/c', 'start', '', resolved];
  } else if (process.platform === 'darwin') {
    cmd = 'open';
    args = [resolved];
  } else {
    cmd = 'xdg-open';
    args = [resolved];
  }

  if (process.platform === 'linux' && fs.existsSync('/usr/bin/onlyoffice-desktopeditors') && (ext === '.pptx' || ext === '.ppt')) {
    cmd = '/usr/bin/onlyoffice-desktopeditors';
    args = [resolved];
  }

  execFile(cmd, args, { env }, (err) => {
    if (err) {
      console.error('Failed to open system presentation viewer:', err);
      // Fallback to xdg-open if specific binary failed
      if (cmd !== 'xdg-open' && process.platform === 'linux') {
        execFile('xdg-open', [resolved], { env }, (fallbackErr) => {
          if (fallbackErr) {
            return res.status(500).json({ error: 'Failed to launch desktop presentation app' });
          }
          return res.json({ success: true, message: `Opened ${path.basename(resolved)} via xdg-open` });
        });
        return;
      }
      return res.status(500).json({ error: 'Failed to launch desktop presentation app' });
    }
    console.log(`[Presentation Launcher] Launched ${path.basename(resolved)} with ${cmd}`);
    res.json({ success: true, message: `Opened ${path.basename(resolved)} in desktop viewer` });
  });
});

// API: Extract PPTX Outline & Slides for In-App Presentation Companion
app.post('/api/slides/extract-pptx', (req: Request, res: Response) => {
  const { filePath } = req.body;
  if (!filePath || typeof filePath !== 'string') {
    return res.status(400).json({ error: 'File path required' });
  }

  const resolved = resolveServable(filePath);
  if (!resolved) {
    return res.status(403).json({ error: 'Access denied: path is outside the course library' });
  }
  if (!fs.existsSync(resolved)) {
    return res.status(404).json({ error: 'File not found on disk' });
  }

  const pyScript = `
import zipfile, re, sys, json, html
try:
    with zipfile.ZipFile(sys.argv[1], 'r') as z:
        slides = sorted([n for n in z.namelist() if re.match(r'ppt/slides/slide\\d+\\.xml', n)], key=lambda x: int(re.search(r'\\d+', x).group()))
        out = []
        for idx, s in enumerate(slides, 1):
            content = z.read(s).decode('utf-8', errors='ignore')
            texts = re.findall(r'<a:t>(.*?)</a:t>', content)
            raw_cleaned = [html.unescape(t.strip()) for t in texts if t.strip()]
            # Filter out raw developer prompt artifacts like * [IMAGE: ...] or [IMAGE: ...]
            cleaned = [t for t in raw_cleaned if not (t.startswith('* [IMAGE') or t.startswith('[IMAGE') or t.startswith('*(IMAGE'))]
            title = ""
            bullets = []
            for item in cleaned:
                if not title:
                    title = item
                else:
                    bullets.append(item)
            if not title:
                title = f"Slide {idx}"
            out.append({'slideNumber': idx, 'title': title, 'bullets': bullets})
        print(json.dumps({'totalSlides': len(slides), 'slides': out}))
except Exception as e:
    print(json.dumps({'error': str(e)}))
`;

  const pyBin = resolveTool('python3');

  execFile(pyBin, ['-c', pyScript, resolved], { timeout: 15000 }, (err, stdout) => {
    if (err || !stdout) {
      return res.status(500).json({ error: 'Failed to extract PPTX slides' });
    }
    try {
      const data = JSON.parse(stdout);
      res.json(data);
    } catch (e) {
      res.status(500).json({ error: 'Invalid PPTX data' });
    }
  });
});

const YT_HISTORY_LIMIT = 100;

/** Record (or refresh) a video in the watch history, newest first. */
function recordYouTubeWatch(entry: Partial<YouTubeHistoryEntry> & { id: string }): void {
  if (!inMemoryData.youtubeHistory) inMemoryData.youtubeHistory = [];
  const list = inMemoryData.youtubeHistory;
  const existing = list.findIndex(e => e.id === entry.id);
  const prev = existing >= 0 ? list[existing] : null;
  if (existing >= 0) list.splice(existing, 1);

  list.unshift({
    id: entry.id,
    videoId: entry.videoId || prev?.videoId || entry.id.replace(/^yt_/, ''),
    title: entry.title || prev?.title || 'YouTube video',
    thumbnailUrl: entry.thumbnailUrl ?? prev?.thumbnailUrl,
    durationSeconds: entry.durationSeconds ?? prev?.durationSeconds,
    lastWatchedAt: new Date().toISOString(),
    positionSeconds: entry.positionSeconds ?? prev?.positionSeconds ?? 0
  });

  if (list.length > YT_HISTORY_LIMIT) list.length = YT_HISTORY_LIMIT;
}

// API: YouTube watch history
app.get('/api/youtube/history', (req: Request, res: Response) => {
  const history = inMemoryData.youtubeHistory || [];
  // Attach note/bookmark counts so the client can flag what you invested in.
  const enrich = (id: string) => {
    let notes = 0, bookmarks = 0, livePosition: number | null = null;
    for (const c of Object.values(inMemoryData.courses)) {
      notes += (c.notes?.[id] || []).length;
      bookmarks += (c.bookmarks?.[id] || []).length;
      // resumePositions is written on every sync, so it is fresher than the
      // copy stored when the video was first opened.
      const p = c.resumePositions?.[id];
      if (typeof p === 'number') livePosition = Math.max(livePosition ?? 0, p);
    }
    return { notes, bookmarks, livePosition };
  };
  res.json({
    history: history.map(h => {
      const { notes, bookmarks, livePosition } = enrich(h.id);
      return { ...h, notes, bookmarks, positionSeconds: livePosition ?? h.positionSeconds };
    })
  });
});

app.post('/api/youtube/history', async (req: Request, res: Response) => {
  const { id, videoId, title, thumbnailUrl, durationSeconds, positionSeconds, removeId, clearAll } = req.body || {};

  if (clearAll) {
    inMemoryData.youtubeHistory = [];
  } else if (removeId) {
    inMemoryData.youtubeHistory = (inMemoryData.youtubeHistory || []).filter(e => e.id !== removeId);
  } else if (id) {
    let finalTitle = title;
    let finalThumb = thumbnailUrl;
    // A client that could not resolve the title sends the placeholder, which
    // would otherwise sit in history forever as "YouTube Video" with no
    // thumbnail. Resolve it here instead.
    if (!finalTitle || finalTitle === 'YouTube Video' || !finalThumb) {
      const vid = videoId || String(id).replace(/^yt_/, '');
      try {
        const r = await fetch(`https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${vid}&format=json`);
        if (r.ok) {
          const info: any = await r.json();
          finalTitle = (!finalTitle || finalTitle === 'YouTube Video') ? (info.title || finalTitle) : finalTitle;
          finalThumb = finalThumb || info.thumbnail_url;
        }
      } catch (e) {}
    }
    recordYouTubeWatch({ id, videoId, title: finalTitle, thumbnailUrl: finalThumb, durationSeconds, positionSeconds });
  } else {
    return res.status(400).json({ error: 'id, removeId or clearAll required' });
  }

  scheduleProgressWrite();
  res.json({ success: true, history: inMemoryData.youtubeHistory || [] });
});

/**
 * Backfill history for videos that already carry notes, bookmarks or a saved
 * position but were watched before history existed — their titles were never
 * stored, so the notes were effectively orphaned. Titles come from oEmbed.
 */
app.post('/api/youtube/history/backfill', async (req: Request, res: Response) => {
  const known = new Set((inMemoryData.youtubeHistory || []).map(e => e.id));
  const orphans = new Set<string>();
  for (const c of Object.values(inMemoryData.courses)) {
    for (const src of [c.notes, c.bookmarks, c.resumePositions]) {
      for (const key of Object.keys(src || {})) {
        if (key.startsWith('yt_') && !known.has(key)) orphans.add(key);
      }
    }
  }

  const resolved: string[] = [];
  const failed: string[] = [];
  for (const lessonId of orphans) {
    const videoId = lessonId.replace(/^yt_/, '');
    try {
      const r = await fetch(`https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`);
      if (!r.ok) { failed.push(lessonId); continue; }
      const info: any = await r.json();
      let position = 0;
      for (const c of Object.values(inMemoryData.courses)) {
        position = c.resumePositions?.[lessonId] ?? position;
      }
      recordYouTubeWatch({
        id: lessonId,
        videoId,
        title: info.title || videoId,
        thumbnailUrl: info.thumbnail_url,
        positionSeconds: position
      });
      resolved.push(info.title || videoId);
    } catch (e) {
      failed.push(lessonId);
    }
  }

  if (resolved.length) flushProgressNow();
  res.json({ resolved: resolved.length, failed: failed.length, titles: resolved });
});

// API: General notepad — notes not tied to any lesson or course.
app.get('/api/scratchpad', (req: Request, res: Response) => {
  res.json({ notes: inMemoryData.scratchpad || [] });
});

app.post('/api/scratchpad', (req: Request, res: Response) => {
  const { id, content, removeId, clearAll } = req.body || {};
  if (!inMemoryData.scratchpad) inMemoryData.scratchpad = [];

  if (clearAll) {
    inMemoryData.scratchpad = [];
  } else if (removeId) {
    inMemoryData.scratchpad = inMemoryData.scratchpad.filter(n => n.id !== removeId);
  } else if (typeof content === 'string') {
    const now = new Date().toISOString();
    const existing = id ? inMemoryData.scratchpad.find(n => n.id === id) : null;
    if (existing) {
      existing.content = content;
      existing.updatedAt = now;
    } else {
      inMemoryData.scratchpad.unshift({
        id: id || `sn-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        content,
        createdAt: now,
        updatedAt: now
      });
    }
  } else {
    return res.status(400).json({ error: 'content, removeId or clearAll required' });
  }

  try {
    atomicWriteJson(PROGRESS_FILE, inMemoryData);
  } catch (err) {
    console.error('Failed to persist scratchpad:', err);
    return res.status(500).json({ error: 'Failed to save' });
  }
  res.json({ success: true, notes: inMemoryData.scratchpad });
});

// API: Get User Progress & Notes
app.get('/api/progress', (req: Request, res: Response) => {
  res.json(inMemoryData);
});

// API: Save User Progress & Notes
app.post('/api/progress', (req: Request, res: Response) => {
  const { courseId, lessonId, timestamp, completed, note, activeCourseId, streakUpdate } = req.body;

  if (activeCourseId) {
    inMemoryData.activeCourseId = activeCourseId;
  }

  if (req.body.youtubeLesson !== undefined) {
    inMemoryData.lastYouTubeLesson = req.body.youtubeLesson;
  }

  if (courseId) {
    // A yt_ lesson is course-independent; keep its data in one place.
    const targetCourseId = (typeof lessonId === 'string' && lessonId.startsWith('yt_'))
      ? YOUTUBE_BUCKET : courseId;
    if (!inMemoryData.courses[targetCourseId]) {
      inMemoryData.courses[targetCourseId] = {
        id: targetCourseId,
        completedLessonIds: [],
        notes: {},
        lastWatched: null
      };
    }

    const courseData = inMemoryData.courses[targetCourseId];

    if (lessonId && typeof timestamp === 'number') {
      courseData.lastWatched = {
        lessonId,
        timestampSeconds: Math.floor(timestamp),
        updatedAt: new Date().toISOString()
      };
      // Also remember this lesson's own position, so switching away and back
      // resumes here rather than falling back to 0.
      if (!courseData.resumePositions) courseData.resumePositions = {};
      courseData.resumePositions[lessonId] = Math.floor(timestamp);
    }

    if (lessonId && typeof completed === 'boolean') {
      const set = new Set(courseData.completedLessonIds);
      if (completed) {
        set.add(lessonId);
      } else {
        set.delete(lessonId);
      }
      courseData.completedLessonIds = Array.from(set);
    }

    if (lessonId && note) {
      if (!courseData.notes[lessonId]) courseData.notes[lessonId] = [];
      courseData.notes[lessonId].push({
        id: `note-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        timestampSeconds: Math.floor(note.timestamp || 0),
        content: note.content,
        createdAt: new Date().toISOString(),
        ...(note.slideNumber ? { slideNumber: Number(note.slideNumber) } : {})
      });
    }

    if (lessonId && req.body.removeNoteId) {
      if (courseData.notes[lessonId]) {
        courseData.notes[lessonId] = courseData.notes[lessonId].filter(n => n.id !== req.body.removeNoteId);
      }
    }

    if (lessonId && req.body.clearAllNotes) {
      if (courseData.notes[lessonId]) {
        courseData.notes[lessonId] = [];
      }
    }

    if (lessonId && req.body.codeSnippet) {
      if (!courseData.codeSnippets) courseData.codeSnippets = {};
      courseData.codeSnippets[lessonId] = {
        language: req.body.codeSnippet.language || 'javascript',
        code: req.body.codeSnippet.code || '',
        updatedAt: new Date().toISOString()
      };
    }

    if (lessonId && req.body.bookmark) {
      if (!courseData.bookmarks) courseData.bookmarks = {};
      if (!courseData.bookmarks[lessonId]) courseData.bookmarks[lessonId] = [];
      const newBm: LessonBookmark = {
        id: req.body.bookmark.id || `bm-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        timestampSeconds: Math.floor(req.body.bookmark.timestampSeconds || 0),
        label: req.body.bookmark.label || 'Timestamp Marker',
        createdAt: new Date().toISOString()
      };
      courseData.bookmarks[lessonId].push(newBm);
    }

    if (lessonId && req.body.removeBookmarkId) {
      if (courseData.bookmarks && courseData.bookmarks[lessonId]) {
        courseData.bookmarks[lessonId] = courseData.bookmarks[lessonId].filter(b => b.id !== req.body.removeBookmarkId);
      }
    }

    if (lessonId && req.body.clearAllBookmarks) {
      if (courseData.bookmarks && courseData.bookmarks[lessonId]) {
        courseData.bookmarks[lessonId] = [];
      }
    }

    if (streakUpdate) {
      const today = new Date().toISOString().split('T')[0];
      if (inMemoryData.globalStats.lastActiveDate !== today) {
        const lastDate = new Date(inMemoryData.globalStats.lastActiveDate);
        const currentDate = new Date(today);
        const diffDays = Math.round((currentDate.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24));
        if (diffDays === 1) {
          inMemoryData.globalStats.streakDays += 1;
        } else if (diffDays > 1) {
          inMemoryData.globalStats.streakDays = 1;
        }
        inMemoryData.globalStats.lastActiveDate = today;
      }
      if (typeof streakUpdate.addedSeconds === 'number') {
        inMemoryData.globalStats.totalHoursWatchedSeconds += streakUpdate.addedSeconds;
      }
    }
  }

  // Deferred write: this endpoint fires every couple of seconds during playback.
  scheduleProgressWrite();

  // Deliberately not echoing inMemoryData: the client never reads it, and this
  // endpoint fires every couple of seconds during playback.
  res.json({ success: true });
});

// API: Isolated Multi-Language Compiler & Runner
app.post('/api/execute', async (req: Request, res: Response) => {
  const clientIp = req.ip || req.socket?.remoteAddress || '';
  const isLocalhost = 
    clientIp === '127.0.0.1' || 
    clientIp === '::1' || 
    clientIp === '::ffff:127.0.0.1' ||
    clientIp === 'localhost';

  if (!isLocalhost) {
    return res.status(403).json({ error: 'Forbidden: Code execution is strictly limited to localhost for security.' });
  }

  const { language, code, stdin } = req.body;
  if (!code || typeof code !== 'string') {
    return res.status(400).json({ error: 'Code string required' });
  }

  const validLangs = new Set(['javascript', 'js', 'python', 'py', 'cpp', 'c++', 'c']);
  const lang = (language || 'javascript').toLowerCase();
  if (!validLangs.has(lang)) {
    return res.status(400).json({ error: `Unsupported language: ${lang}` });
  }

  const tmpDir = path.join(DATA_DIR, 'tmp_exec');
  if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });

  const id = `run_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
  const filesToCleanup: string[] = [];
  const startTime = performance.now();

  try {
    let binary = '';
    let args: string[] = [];

    if (lang === 'javascript' || lang === 'js') {
      const srcFile = path.join(tmpDir, `${id}.js`);
      fs.writeFileSync(srcFile, code);
      filesToCleanup.push(srcFile);
      binary = process.execPath;
      args = [srcFile];
    } else if (lang === 'python' || lang === 'py') {
      const srcFile = path.join(tmpDir, `${id}.py`);
      fs.writeFileSync(srcFile, code);
      filesToCleanup.push(srcFile);
      binary = resolveTool('python3');
      args = [srcFile];
    } else if (lang === 'cpp' || lang === 'c++') {
      const srcFile = path.join(tmpDir, `${id}.cpp`);
      const binFile = path.join(tmpDir, `${id}.bin`);
      fs.writeFileSync(srcFile, code);
      filesToCleanup.push(srcFile, binFile);

      // Compile stage
      const compileRes: any = await new Promise((resolve) => {
        execFile(resolveTool('g++'), ['-O2', srcFile, '-o', binFile], { timeout: 10000, maxBuffer: 512 * 1024 }, (err, stdout, stderr) => {
          resolve({ err, stdout, stderr });
        });
      });

      if (compileRes.err) {
        return res.json({
          success: false,
          compileError: true,
          stdout: compileRes.stdout || '',
          stderr: compileRes.stderr || compileRes.err.message,
          exitCode: compileRes.err.code || 1,
          executionTimeMs: Math.round(performance.now() - startTime)
        });
      }

      binary = binFile;
      args = [];
    } else if (lang === 'c') {
      const srcFile = path.join(tmpDir, `${id}.c`);
      const binFile = path.join(tmpDir, `${id}.bin`);
      fs.writeFileSync(srcFile, code);
      filesToCleanup.push(srcFile, binFile);

      // Compile stage
      const compileRes: any = await new Promise((resolve) => {
        execFile(resolveTool('gcc'), ['-O2', srcFile, '-o', binFile], { timeout: 10000, maxBuffer: 512 * 1024 }, (err, stdout, stderr) => {
          resolve({ err, stdout, stderr });
        });
      });

      if (compileRes.err) {
        return res.json({
          success: false,
          compileError: true,
          stdout: compileRes.stdout || '',
          stderr: compileRes.stderr || compileRes.err.message,
          exitCode: compileRes.err.code || 1,
          executionTimeMs: Math.round(performance.now() - startTime)
        });
      }

      binary = binFile;
      args = [];
    }

    // Execute stage with 5-second process timeout
    const execRes = await new Promise((resolve) => {
      const child = execFile(binary, args, {
        cwd: tmpDir,
        timeout: 5000,
        maxBuffer: 512 * 1024,
        env: {
          PATH: process.env.PATH,
          NODE_PATH: process.env.NODE_PATH || '',
          LANG: 'en_US.UTF-8'
        }
      }, (err: any, stdout, stderr) => {
        const executionTimeMs = Math.round(performance.now() - startTime);
        if (err && err.killed) {
          return resolve({
            success: false,
            timedOut: true,
            stdout: stdout || '',
            stderr: 'Execution timed out (5s limit exceeded)',
            exitCode: 124,
            executionTimeMs
          });
        }
        resolve({
          success: !err,
          stdout: stdout || '',
          stderr: stderr || (err ? err.message : ''),
          exitCode: err ? (err.code || 1) : 0,
          executionTimeMs
        });
      });

      if (stdin && typeof stdin === 'string') {
        try {
          child.stdin?.write(stdin);
          child.stdin?.end();
        } catch (e) {}
      }
    });

    res.json(execRes);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  } finally {
    for (const f of filesToCleanup) {
      try {
        if (fs.existsSync(f)) fs.unlinkSync(f);
      } catch (e) {}
    }
  }
});

// Beacon endpoint (for tab close)
app.post('/api/progress/beacon', express.text({ type: '*/*' }), (req: Request, res: Response) => {
  try {
    const payload = JSON.parse(req.body);
    if (payload.courseId && payload.lessonId && typeof payload.timestamp === 'number') {
      if (!inMemoryData.courses[payload.courseId]) {
        inMemoryData.courses[payload.courseId] = {
          id: payload.courseId,
          completedLessonIds: [],
          notes: {},
          codeSnippets: {},
          lastWatched: null
        };
      }
      const rec = inMemoryData.courses[payload.courseId];
      rec.lastWatched = {
        lessonId: payload.lessonId,
        timestampSeconds: Math.floor(payload.timestamp),
        updatedAt: new Date().toISOString()
      };
      if (!rec.resumePositions) rec.resumePositions = {};
      rec.resumePositions[payload.lessonId] = Math.floor(payload.timestamp);
      flushProgressNow();   // the page is closing; do not defer this one
    }
  } catch (e) {}
  res.status(204).end();
});

// Serve Web Favicon & Icons with proper MIME types
const publicPath = path.join(__dirname, 'public');
if (fs.existsSync(publicPath)) {
  app.use(express.static(publicPath, {
    maxAge: '1d',
    setHeaders: (res, filePath) => {
      if (filePath.endsWith('.ico')) res.setHeader('Content-Type', 'image/x-icon');
      else if (filePath.endsWith('.svg')) res.setHeader('Content-Type', 'image/svg+xml');
      else if (filePath.endsWith('.png')) res.setHeader('Content-Type', 'image/png');
    }
  }));
}

app.get('/favicon.ico', (req: Request, res: Response) => {
  const icoPath = path.join(__dirname, 'public', 'favicon.ico');
  if (fs.existsSync(icoPath)) {
    res.setHeader('Content-Type', 'image/x-icon');
    return res.sendFile(icoPath);
  }
  res.status(404).end();
});

// Serve production build if exists with strict no-cache on index.html
const distPath = path.join(__dirname, 'dist');
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath, {
    setHeaders: (res, filePath) => {
      if (filePath.endsWith('.html')) {
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
      }
    }
  }));
  app.get('*', (req: Request, res: Response) => {
    // Never answer an unknown API route with the SPA shell — that turns a typo
    // into an opaque JSON parse failure on the client.
    if (req.path.startsWith('/api/')) {
      return res.status(404).json({ error: `Unknown API endpoint: ${req.path}` });
    }
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.sendFile(path.join(distPath, 'index.html'));
  });
}

// Daily Rolling Backup on Boot
try {
  const today = new Date().toISOString().split('T')[0];
  const backupPath = path.join(BACKUPS_DIR, `backup-${today}.json`);
  if (!fs.existsSync(backupPath) && fs.existsSync(PROGRESS_FILE)) {
    fs.copyFileSync(PROGRESS_FILE, backupPath);
    // Keep last 5 backups
    const allBackups = fs.readdirSync(BACKUPS_DIR).filter(f => f.endsWith('.json')).sort();
    while (allBackups.length > 5) {
      const oldest = allBackups.shift();
      if (oldest) fs.unlinkSync(path.join(BACKUPS_DIR, oldest));
    }
  }
} catch (e: any) {
  console.warn('Backup rotation note:', e.message);
}

// Dynamic Port Hunter
function startServer(port: number) {
  const server = app.listen(port, () => {
    console.log(`[Study Hub Backend] TypeScript server listening on http://localhost:${port}`);
    const found = discoverCourses().length;
    console.log(`[Study Hub Backend] Scanning for courses in: ${COURSES_ROOT}`);
    if (found === 0) {
      console.log('[Study Hub Backend] No courses found yet — use "Scan Directory" in the app,');
      console.log('[Study Hub Backend] or set STUDYHUB_COURSES_ROOT to where your course folders live.');
    } else {
      console.log(`[Study Hub Backend] ${found} course(s) available.`);
    }
  });

  server.on('error', (err: any) => {
    if (err.code === 'EADDRINUSE') {
      console.warn(`[Study Hub Backend] Port ${port} occupied, trying ${port + 1}...`);
      startServer(port + 1);
    } else {
      console.error('[Study Hub Backend] Server error:', err);
    }
  });

  // Graceful shutdown
  const shutdown = () => {
    console.log('\n[Study Hub Backend] Flushing state and shutting down cleanly...');
    try {
      flushProgressNow();
    } catch (e) {}
    server.close(() => process.exit(0));
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

startServer(DEFAULT_PORT);

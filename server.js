import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execFile } from 'child_process';
import crypto from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const portArgIndex = process.argv.indexOf('--port');
const cliPort = portArgIndex !== -1 && process.argv[portArgIndex + 1] ? parseInt(process.argv[portArgIndex + 1], 10) : null;
const DEFAULT_PORT = cliPort || parseInt(process.env.PORT || "3000", 10);

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Paths
const DATA_DIR = path.join(__dirname, 'data');
const BACKUPS_DIR = path.join(DATA_DIR, 'backups');
const PROGRESS_FILE = path.join(DATA_DIR, 'study-hub-data.json');
const VIDEO_CACHE_DIR = path.join(DATA_DIR, 'video-cache');
const COURSES_ROOT = path.resolve(__dirname, '..'); // /run/media/nidan73/M44L/03_Courses_and_Learning

// Ensure directories exist
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(BACKUPS_DIR)) fs.mkdirSync(BACKUPS_DIR, { recursive: true });
if (!fs.existsSync(VIDEO_CACHE_DIR)) fs.mkdirSync(VIDEO_CACHE_DIR, { recursive: true });

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
function getInitialData() {
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
function atomicWriteJson(filePath, data) {
  const tmpPath = `${filePath}.tmp.${Date.now()}_${process.pid}_${Math.random().toString(36).slice(2, 8)}`;
  const jsonString = JSON.stringify(data, null, 2);
  
  const fd = fs.openSync(tmpPath, 'w');
  fs.writeSync(fd, jsonString);
  fs.fdatasyncSync(fd);
  fs.closeSync(fd);
  
  try {
    fs.renameSync(tmpPath, filePath);
  } catch (err) {
    if (process.platform === 'win32' || err.code === 'EPERM' || err.code === 'EBUSY') {
      fs.copyFileSync(tmpPath, filePath);
      try { fs.unlinkSync(tmpPath); } catch (_) {}
    } else {
      throw err;
    }
  }
}

// Read Progress Data with Auto-Recovery
function loadProgressData() {
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

let inMemoryData = loadProgressData();

// Natural numeric sorting comparator (e.g. "Week 1", "Week 2", "Week 10")
function naturalSort(a, b) {
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
}

// Clean title formatter
function cleanTitle(filename) {
  return filename
    .replace(/\.(mp4|mkv|webm|mov|m4v|avi|ts|m2ts|flv|wmv|vob|ogv|3gp|f4v|asf|pdf)$/i, '')
    .replace(/^Week\s*[-_]?\s*/i, 'Week ')
    .trim();
}

// Universal Heuristic Crawler
function crawlCourseDirectory(courseRoot) {
  const visitedInodes = new Set();
  const modules = [];
  let totalVideos = 0;
  let totalPdfs = 0;

  function traverse(currentDir, relativeDir = '', depth = 0) {
    if (depth > 6) return;

    let entries;
    try {
      entries = fs.readdirSync(currentDir, { withFileTypes: true });
    } catch (e) {
      return;
    }

    const videos = [];
    const pdfs = [];
    const subdirs = [];

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
      videos.forEach(v => {
        const matchingPdf = pdfs.find(p => 
          p.title.toLowerCase().includes(v.title.toLowerCase()) || 
          v.title.toLowerCase().includes(p.title.toLowerCase())
        );
        if (matchingPdf) {
          v.companionPdf = matchingPdf;
        }
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
function discoverCourses() {
  const discovered = [];

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

// API: List Courses
app.get('/api/courses', (req, res) => {
  const courses = discoverCourses();
  res.json({
    activeCourseId: inMemoryData.activeCourseId,
    courses
  });
});

// API: Add Custom Course Path (Local Folder)
app.post('/api/courses/add', (req, res) => {
  const { folderPath, name } = req.body;
  if (!folderPath || !fs.existsSync(folderPath)) {
    return res.status(400).json({ error: 'Folder path does not exist on disk' });
  }

  const courseId = path.basename(folderPath).toLowerCase().replace(/[^a-z0-9_-]/g, '-');
  const newCourse = {
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
app.post('/api/courses/add-virtual', (req, res) => {
  const { id, name, description, badge, modules } = req.body;
  if (!id || !name) {
    return res.status(400).json({ error: 'Course ID and name required' });
  }

  const courseId = id.startsWith('yt-') ? id : `yt-${id}`;
  const newCourse = {
    id: courseId,
    name,
    rootPath: '',
    badge: badge || 'YouTube Series',
    gradient: 'from-rose-500 to-red-600',
    description: description || 'Imported YouTube series for distraction-free study.',
    isVirtual: true,
    modules: modules || []
  };

  if (!inMemoryData.customCourses) inMemoryData.customCourses = [];
  inMemoryData.customCourses = inMemoryData.customCourses.filter(c => c.id !== courseId);
  inMemoryData.customCourses.push(newCourse);
  catalogCache.delete(courseId);
  atomicWriteJson(PROGRESS_FILE, inMemoryData);

  res.json({ success: true, course: newCourse });
});

// API: Delete Custom / Virtual Course
app.delete('/api/courses/:courseId', (req, res) => {
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
const searchCache = new Map(); // key: query, value: { data, expiresAt }
let lastSearchTimestamp = 0;

function checkSearchRateLimit() {
  const now = Date.now();
  if (now - lastSearchTimestamp < 1500) {
    return false;
  }
  lastSearchTimestamp = now;
  return true;
}

// API: YouTube In-App Search (InnerTube Client API)
app.post('/api/youtube/search', async (req, res) => {
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

    const data = await ytRes.json();
    const contents = data.contents?.twoColumnSearchResultsRenderer?.primaryContents?.sectionListRenderer?.contents || [];
    const results = [];

    for (const c of contents) {
      const itemSection = c.itemSectionRenderer?.contents || [];
      for (const item of itemSection) {
        if (item.videoRenderer) {
          const v = item.videoRenderer;
          results.push({
            id: v.videoId,
            title: v.title?.runs?.map(r => r.text).join('') || '',
            duration: v.lengthText?.simpleText || '',
            views: v.viewCountText?.simpleText || '',
            author: v.ownerText?.runs?.map(r => r.text).join('') || '',
            thumbnail: v.thumbnail?.thumbnails?.slice(-1)[0]?.url || `https://i.ytimg.com/vi/${v.videoId}/hqdefault.jpg`
          });
        }
      }
    }

    // Cache results for 30 minutes, limit cache to 100 entries to prevent RAM bloat
    if (searchCache.size >= 100) {
      const firstKey = searchCache.keys().next().value;
      searchCache.delete(firstKey);
    }
    searchCache.set(cacheKey, { data: results, expiresAt: Date.now() + 30 * 60 * 1000 });

    res.json({ results });
  } catch (err) {
    console.error('YouTube search error:', err.message);
    res.status(500).json({ error: 'Failed to search YouTube. Check internet connection.' });
  }
});

// API: YouTube Playlist Extraction (Supports modern 2025/2026 lockupViewModel + legacy fallback)
app.get('/api/youtube/playlist', async (req, res) => {
  const playlistId = req.query.id;
  if (!playlistId) {
    return res.status(400).json({ error: 'Playlist ID required' });
  }

  try {
    const url = `https://www.youtube.com/playlist?list=${encodeURIComponent(playlistId)}`;
    const ytRes = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9'
      }
    });

    if (!ytRes.ok) throw new Error(`Playlist fetch failed: ${ytRes.status}`);
    const html = await ytRes.text();
    let d = null;
    const idx = html.indexOf('ytInitialData = ');
    if (idx !== -1) {
      const start = idx + 'ytInitialData = '.length;
      const scriptEnd = html.indexOf('</script>', start);
      if (scriptEnd !== -1) {
        try {
          const jsonStr = html.substring(start, scriptEnd).replace(/;[\s\n]*$/, '').trim();
          d = JSON.parse(jsonStr);
        } catch (e) {
          // ignore and fallback
        }
      }
    }
    if (!d) {
      const match = html.match(/ytInitialData\s*=\s*({.+?});<\/script>/);
      if (match) d = JSON.parse(match[1]);
    }
    if (!d) throw new Error('Could not parse playlist metadata');

    const playlistTitle = d.header?.playlistHeaderRenderer?.title?.simpleText || 
                          d.metadata?.playlistMetadataRenderer?.title || 'YouTube Course Series';
    const author = d.header?.playlistHeaderRenderer?.ownerText?.runs?.[0]?.text || 'YouTube Creator';

    const sec = d.contents?.twoColumnBrowseResultsRenderer?.tabs?.[0]?.tabRenderer?.content
                  ?.sectionListRenderer?.contents?.[0]?.itemSectionRenderer?.contents || [];

    const videos = [];
    // 1. Try modern lockupViewModel (2025/2026 YouTube)
    for (const s of sec) {
      const lk = s.lockupViewModel;
      if (lk) {
        const title = lk.metadata?.lockupMetadataViewModel?.title?.content;
        const videoId = lk.rendererContext?.commandContext?.onTap?.innertubeCommand?.watchEndpoint?.videoId;
        let duration = '';
        const overlays = lk.contentImage?.thumbnailViewModel?.overlays || [];
        for (const ov of overlays) {
          const badgeText = ov.thumbnailBottomOverlayViewModel?.badges?.[0]?.thumbnailBadgeViewModel?.text;
          if (badgeText) { duration = badgeText; break; }
          const timeRendererText = ov.thumbnailOverlayTimeStatusRenderer?.text?.runs?.[0]?.text;
          if (timeRendererText) { duration = timeRendererText; break; }
        }
        if (!duration) duration = lk.rendererContext?.accessibilityContext?.label || '';
        if (videoId && title) {
          videos.push({
            id: `yt_${videoId}`,
            youtubeVideoId: videoId,
            title,
            duration,
            thumbnail: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`
          });
        }
      }
    }

    // 2. Fallback to legacy playlistVideoRenderer if lockupViewModel was empty
    if (videos.length === 0) {
      const rawVideos = d.contents?.twoColumnBrowseResultsRenderer?.tabs?.[0]?.tabRenderer?.content
                          ?.sectionListRenderer?.contents?.[0]?.itemSectionRenderer?.contents?.[0]
                          ?.playlistVideoListRenderer?.contents || [];
      for (const item of rawVideos) {
        if (item.playlistVideoRenderer) {
          const v = item.playlistVideoRenderer;
          videos.push({
            id: `yt_${v.videoId}`,
            youtubeVideoId: v.videoId,
            title: v.title?.runs?.[0]?.text || 'Video Lecture',
            duration: v.lengthText?.simpleText || '',
            thumbnail: v.thumbnail?.thumbnails?.[0]?.url || `https://i.ytimg.com/vi/${v.videoId}/hqdefault.jpg`
          });
        }
      }
    }

    res.json({
      id: playlistId,
      title: playlistTitle,
      author,
      videos
    });
  } catch (err) {
    console.error('Playlist extraction error:', err.message);
    res.status(500).json({ error: 'Failed to extract playlist. Check that playlist is public.' });
  }
});

// API: YouTube Single Video oEmbed Endpoint
app.get('/api/youtube/info', async (req, res) => {
  const videoId = req.query.id;
  if (!videoId) return res.status(400).json({ error: 'Video ID required' });

  try {
    const oembedUrl = `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}&format=json`;
    const ytRes = await fetch(oembedUrl);
    if (!ytRes.ok) return res.status(404).json({ error: 'Video not found or is private' });

    const data = await ytRes.json();
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
const catalogCache = new Map();

// Active remux/transcode jobs map to prevent duplicate work
const activeRemuxJobs = new Map();

function getVideoCachePath(filePath, stat) {
  const hash = crypto.createHash('sha256').update(`${filePath}:${stat.size}:${stat.mtimeMs}`).digest('hex').substring(0, 20);
  const cleanBase = path.basename(filePath, path.extname(filePath)).replace(/[^a-zA-Z0-9_-]/g, '_').substring(0, 32);
  return path.join(VIDEO_CACHE_DIR, `${cleanBase}_${hash}.mp4`);
}

function probeMedia(filePath) {
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

function ensureWebPlayableVideo(targetPath, stat) {
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
    return activeRemuxJobs.get(targetPath);
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
    } catch (err) {
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

const warmingCourses = new Set();

function warmCourseVideoCache(course) {
  if (!course || warmingCourses.has(course.id)) return;
  warmingCourses.add(course.id);

  setTimeout(async () => {
    try {
      const catalog = crawlCourseDirectory(course.rootPath);
      for (const mod of catalog.modules) {
        for (const lesson of mod.lessons) {
          const ext = path.extname(lesson.relativePath).toLowerCase();
          if (ext !== '.mp4' && ext !== '.webm' && VIDEO_EXTENSIONS.has(ext)) {
            const targetPath = path.resolve(course.rootPath, lesson.relativePath);
            if (fs.existsSync(targetPath)) {
              const stat = fs.statSync(targetPath);
              const cached = getVideoCachePath(targetPath, stat);
              if (!fs.existsSync(cached) || fs.statSync(cached).size === 0) {
                console.log(`[Cache Warming] Pre-transcoding: ${lesson.title} (${ext})`);
                await ensureWebPlayableVideo(targetPath, stat).catch(e => console.warn(`Failed to pre-transcode ${lesson.title}:`, e.message));
              }
            }
          }
        }
      }
    } catch (e) {
    } finally {
      warmingCourses.delete(course.id);
    }
  }, 300);
}

// API: Get Catalog for a Course
app.get('/api/catalog/:courseId', (req, res) => {
  const { courseId } = req.params;
  const force = req.query.force === 'true';

  if (!force && catalogCache.has(courseId)) {
    const cached = catalogCache.get(courseId);
    res.json(cached);
    const courses = discoverCourses();
    const course = courses.find(c => c.id === courseId);
    if (course) warmCourseVideoCache(course);
    return;
  }

  const courses = discoverCourses();
  const course = courses.find(c => c.id === courseId);
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
    catalogCache.set(courseId, virtualCatalog);
    return res.json(virtualCatalog);
  }

  const catalog = crawlCourseDirectory(course.rootPath);
  const result = {
    id: course.id,
    name: course.name,
    rootPath: course.rootPath,
    ...catalog
  };

  catalogCache.set(courseId, result);
  res.json(result);

  // Trigger background cache warming
  warmCourseVideoCache(course);
});

// API: RFC 7233 Range-Seeking Video Streamer (Universal Container & Codec Compatible)
app.get('/api/stream/:courseId/:lessonId', async (req, res) => {
  const { courseId, lessonId } = req.params;

  const courses = discoverCourses();
  const course = courses.find(c => c.id === courseId);
  if (!course) return res.status(404).send('Course not found');

  if (course.isVirtual) {
    return res.status(400).send('Virtual YouTube lessons stream directly in client player');
  }

  let relativePath;
  try {
    relativePath = Buffer.from(lessonId, 'base64url').toString('utf-8');
  } catch (e) {
    return res.status(400).send('Invalid lesson ID format');
  }

  const targetPath = path.resolve(course.rootPath, relativePath);

  // Security Jail: Prevent Path Traversal
  if (!targetPath.startsWith(course.rootPath)) {
    return res.status(403).send('Access Denied: Path Traversal Prohibited');
  }

  if (!fs.existsSync(targetPath)) {
    return res.status(404).send('Video file not found on disk');
  }

  let stat;
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
    } catch (err) {
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
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': '*',
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
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': '*',
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
app.get('/api/pdf/:courseId/:pdfId', (req, res) => {
  const { courseId, pdfId } = req.params;

  const courses = discoverCourses();
  const course = courses.find(c => c.id === courseId);
  if (!course) return res.status(404).send('Course not found');

  let relativePath;
  try {
    relativePath = Buffer.from(pdfId, 'base64url').toString('utf-8');
  } catch (e) {
    return res.status(400).send('Invalid PDF ID format');
  }

  const targetPath = path.resolve(course.rootPath, relativePath);

  // Path Traversal Security Guard
  if (!targetPath.startsWith(course.rootPath)) {
    return res.status(403).send('Access Denied');
  }

  if (!fs.existsSync(targetPath)) {
    return res.status(404).send('PDF file not found');
  }

  const ext = path.extname(targetPath).toLowerCase();
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

// API: Get User Progress & Notes
app.get('/api/progress', (req, res) => {
  res.json(inMemoryData);
});

// API: Save User Progress & Notes
app.post('/api/progress', (req, res) => {
  const { courseId, lessonId, timestamp, completed, note, activeCourseId, streakUpdate } = req.body;

  if (activeCourseId) {
    inMemoryData.activeCourseId = activeCourseId;
  }

  if (courseId) {
    if (!inMemoryData.courses[courseId]) {
      inMemoryData.courses[courseId] = {
        id: courseId,
        completedLessonIds: [],
        notes: {},
        lastWatched: null
      };
    }

    const courseData = inMemoryData.courses[courseId];

    if (lessonId && typeof timestamp === 'number') {
      courseData.lastWatched = {
        lessonId,
        timestampSeconds: Math.floor(timestamp),
        updatedAt: new Date().toISOString()
      };
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
        id: `note-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
        timestampSeconds: Math.floor(note.timestamp || 0),
        content: note.content,
        createdAt: new Date().toISOString(),
        ...(note.slideNumber ? { slideNumber: Number(note.slideNumber) } : {})
      });
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
      const newBm = {
        id: req.body.bookmark.id || `bm-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
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
        const diffDays = Math.round((currentDate - lastDate) / (1000 * 60 * 60 * 24));
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

  // Atomic write to disk
  try {
    atomicWriteJson(PROGRESS_FILE, inMemoryData);
  } catch (err) {
    console.error('Failed to write progress to disk:', err);
    return res.status(500).json({ error: 'Failed to persist progress' });
  }

  res.json({ success: true, data: inMemoryData });
});

// API: Isolated Multi-Language Compiler & Runner
app.post('/api/execute', async (req, res) => {
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

  const validLangs = new Set(['javascript', 'js', 'python', 'py', 'cpp', 'c++', 'c', 'bash', 'sh']);
  const lang = (language || 'javascript').toLowerCase();
  if (!validLangs.has(lang)) {
    return res.status(400).json({ error: `Unsupported language: ${lang}` });
  }

  const tmpDir = path.join(DATA_DIR, 'tmp_exec');
  if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });

  const id = `run_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
  const filesToCleanup = [];
  const startTime = performance.now();

  try {
    let binary = '';
    let args = [];

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
      binary = process.platform === 'win32' ? 'python' : (fs.existsSync('/usr/bin/python3') ? '/usr/bin/python3' : 'python3');
      args = [srcFile];
    } else if (lang === 'bash' || lang === 'sh') {
      const srcFile = path.join(tmpDir, `${id}.sh`);
      fs.writeFileSync(srcFile, code);
      filesToCleanup.push(srcFile);
      binary = process.platform === 'win32' ? 'cmd.exe' : (fs.existsSync('/usr/bin/bash') ? '/usr/bin/bash' : 'bash');
      args = process.platform === 'win32' ? ['/c', srcFile] : [srcFile];
    } else if (lang === 'cpp' || lang === 'c++') {
      const srcFile = path.join(tmpDir, `${id}.cpp`);
      const binFile = path.join(tmpDir, `${id}.bin`);
      fs.writeFileSync(srcFile, code);
      filesToCleanup.push(srcFile, binFile);

      // Compile stage
      const compileRes = await new Promise((resolve) => {
        execFile('/usr/bin/g++', ['-O2', srcFile, '-o', binFile], { timeout: 10000, maxBuffer: 512 * 1024 }, (err, stdout, stderr) => {
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
      const compileRes = await new Promise((resolve) => {
        execFile('/usr/bin/gcc', ['-O2', srcFile, '-o', binFile], { timeout: 10000, maxBuffer: 512 * 1024 }, (err, stdout, stderr) => {
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
      }, (err, stdout, stderr) => {
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
          child.stdin.write(stdin);
          child.stdin.end();
        } catch (e) {}
      }
    });

    res.json(execRes);
  } catch (err) {
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
app.post('/api/progress/beacon', express.text({ type: '*/*' }), (req, res) => {
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
      inMemoryData.courses[payload.courseId].lastWatched = {
        lessonId: payload.lessonId,
        timestampSeconds: Math.floor(payload.timestamp),
        updatedAt: new Date().toISOString()
      };
      atomicWriteJson(PROGRESS_FILE, inMemoryData);
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

app.get('/favicon.ico', (req, res) => {
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
  app.get('*', (req, res) => {
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
      fs.unlinkSync(path.join(BACKUPS_DIR, oldest));
    }
  }
} catch (e) {
  console.warn('Backup rotation note:', e.message);
}

// Dynamic Port Hunter
function startServer(port) {
  const server = app.listen(port, () => {
    console.log(`[Study Hub Backend] Server listening on http://localhost:${port}`);
  });

  server.on('error', (err) => {
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
      atomicWriteJson(PROGRESS_FILE, inMemoryData);
    } catch (e) {}
    server.close(() => process.exit(0));
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

startServer(DEFAULT_PORT);

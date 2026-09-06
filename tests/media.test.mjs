/**
 * ffmpeg/ffprobe pipeline.
 *
 * A .mkv cannot play in a browser, so the stream route probes it and remuxes
 * to MP4 on the way out. Nothing else in the suite touches that path, which
 * left the app's only two external binaries untested — on Windows especially,
 * where nothing had ever exercised them.
 *
 * The content type is what makes this honest: when ffmpeg fails, the route
 * catches and quietly serves the raw file as video/x-matroska. So a reply of
 * video/mp4 is proof the probe and the remux both actually ran, rather than
 * proof that some bytes came back.
 */
import { execFileSync } from 'child_process';
import { mkdtempSync, mkdirSync, existsSync, readdirSync, statSync } from 'fs';
import { tmpdir } from 'os';
import path from 'path';
import { startServer, get, check, section, summary } from './harness.mjs';

const have = (bin) => {
  try { execFileSync(bin, ['-version'], { stdio: 'ignore' }); return true; }
  catch { return false; }
};

if (!have('ffmpeg') || !have('ffprobe')) {
  // Skipping is right on a dev box without ffmpeg, and wrong in CI: the step
  // would go green having tested nothing at all. CI sets this to insist.
  if (process.env.STUDYHUB_REQUIRE_FFMPEG) {
    console.error('ffmpeg/ffprobe missing, and STUDYHUB_REQUIRE_FFMPEG is set — failing rather than skipping');
    process.exit(1);
  }
  console.log('ffmpeg/ffprobe not installed — skipping the media suite');
  process.exit(0);
}

const lib = mkdtempSync(path.join(tmpdir(), 'studyhub-media-'));
const week = path.join(lib, 'Video Course', 'Week 1');
mkdirSync(week, { recursive: true });

// Real footage, not zero-filled placeholders: the catalog skips anything under
// 1MB, and ffprobe has to find actual streams for the remux to make sense.
const make = (file, codec) => execFileSync('ffmpeg', [
  '-y', '-loglevel', 'error',
  '-f', 'lavfi', '-i', 'testsrc2=size=1280x720:rate=30',
  '-f', 'lavfi', '-i', 'sine=frequency=440',
  '-t', '6', ...codec, path.join(week, file)
], { timeout: 180000 });

const H264 = ['-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '18', '-c:a', 'aac'];

console.log('building fixtures with ffmpeg...');
make('lesson1.mkv', H264);                                       // needs remux: wrong container
make('lesson2.mp4', H264);                                       // already web-native
// A fixed bitrate, because mpeg4 ignores -crf and drifts under the 1MB floor.
make('lesson3.avi', ['-c:v', 'mpeg4', '-b:v', '3M', '-c:a', 'libmp3lame']);

for (const f of ['lesson1.mkv', 'lesson2.mp4', 'lesson3.avi']) {
  const mb = statSync(path.join(week, f)).size / 1024 / 1024;
  if (mb < 1) throw new Error(`${f} is ${mb.toFixed(2)}MB — under the 1MB catalog floor`);
}

const srv = await startServer({ coursesRoot: lib });
try {
  section('Video pipeline (ffmpeg/ffprobe)');

  const { body } = await get(srv.base, '/api/courses');
  const course = (body?.courses || []).find(c => c.id === 'video-course');
  check('the video course is discovered', !!course,
    (body?.courses || []).map(c => c.id).join(','));

  const cat = await get(srv.base, `/api/catalog/${course?.id}`);
  const lessons = (cat.body?.modules || []).flatMap(m => m.lessons || []);
  check('all three videos are indexed', lessons.length === 3,
    lessons.map(l => l.filename).join(','));

  const byExt = (ext) => lessons.find(l => l.filename.endsWith(ext));
  const stream = (id, headers = {}) =>
    fetch(`${srv.base}/api/stream/${course.id}/${id}`, { headers });

  // --- a container the browser cannot play must come back remuxed ----------
  const mkv = byExt('.mkv');
  const r1 = await stream(mkv.id, { Range: 'bytes=0-1023' });
  check('an .mkv streams rather than erroring', r1.status === 206 || r1.status === 200,
    String(r1.status));
  check('it is remuxed to MP4, not served raw as matroska',
    r1.headers.get('content-type') === 'video/mp4',
    r1.headers.get('content-type'));

  // --- the remux landed in the cache, and is a real MP4 --------------------
  const cacheDir = path.join(srv.dataDir, 'video-cache');
  const cached = existsSync(cacheDir) ? readdirSync(cacheDir).filter(f => f.endsWith('.mp4')) : [];
  check('the remux is cached for next time', cached.length > 0, cached.join(','));

  if (cached.length) {
    const probe = JSON.parse(execFileSync('ffprobe', [
      '-v', 'error', '-show_entries', 'stream=codec_name,codec_type',
      '-show_format', '-of', 'json', path.join(cacheDir, cached[0])
    ], { encoding: 'utf-8', timeout: 30000 }));
    const codecs = (probe.streams || []).map(s => `${s.codec_type}:${s.codec_name}`);
    check('the cached file is a valid MP4 ffprobe can read',
      /mp4/.test(probe.format?.format_name || ''), probe.format?.format_name);
    check('it carries a browser-playable video codec',
      codecs.some(c => c === 'video:h264'), codecs.join(','));
    check('it carries a browser-playable audio codec',
      codecs.some(c => c.startsWith('audio:aac') || c.startsWith('audio:mp3')), codecs.join(','));
  }

  // --- an .avi needs a genuine re-encode, not a stream copy ----------------
  const avi = byExt('.avi');
  const r2 = await stream(avi.id, { Range: 'bytes=0-1023' });
  check('an .avi is re-encoded and served as MP4',
    r2.headers.get('content-type') === 'video/mp4', r2.headers.get('content-type'));

  // --- byte ranges over the transcoded file -------------------------------
  const r3 = await stream(mkv.id, { Range: 'bytes=100-199' });
  const buf = Buffer.from(await r3.arrayBuffer());
  check('a byte range over the remuxed file returns 206', r3.status === 206, String(r3.status));
  check('the range returns exactly the bytes asked for', buf.length === 100, `${buf.length} bytes`);
  check('Content-Range describes the transcoded file, not the original',
    /^bytes 100-199\/\d+$/.test(r3.headers.get('content-range') || ''),
    r3.headers.get('content-range'));

  // --- an .mp4 must NOT be transcoded -------------------------------------
  const mp4 = byExt('.mp4');
  const before = readdirSync(cacheDir).length;
  const r4 = await stream(mp4.id, { Range: 'bytes=0-1023' });
  check('an .mp4 streams directly', r4.status === 206, String(r4.status));
  check('an already-playable file is not needlessly transcoded',
    readdirSync(cacheDir).length === before, `${before} -> ${readdirSync(cacheDir).length}`);
} finally {
  srv.stop();
}
// ---------------------------------------------------------------------------
// The background warmer. Opening a course pre-transcodes everything the
// browser cannot play, so the fan noise has an explanation and the second
// lesson starts instantly. Nothing streams in this block: the only thing that
// can produce a cache file here is the warmer itself.
// ---------------------------------------------------------------------------
const warmLib = mkdtempSync(path.join(tmpdir(), 'studyhub-warm-'));
const warmWeek = path.join(warmLib, 'Warm Course', 'Week 1');
mkdirSync(warmWeek, { recursive: true });
const makeIn = (dir, file, codec) => execFileSync('ffmpeg', [
  '-y', '-loglevel', 'error',
  '-f', 'lavfi', '-i', 'testsrc2=size=1280x720:rate=30',
  '-f', 'lavfi', '-i', 'sine=frequency=440',
  '-t', '6', ...codec, path.join(dir, file)
], { timeout: 180000 });

console.log('building warmer fixtures...');
makeIn(warmWeek, 'a.mkv', H264);
makeIn(warmWeek, 'b.avi', ['-c:v', 'mpeg4', '-b:v', '3M', '-c:a', 'libmp3lame']);
makeIn(warmWeek, 'c.mp4', H264);   // already playable — must be left alone

const warm = await startServer({ coursesRoot: warmLib });
try {
  section('Background transcode warmer');

  const status = () => fetch(`${warm.base}/api/transcode/status`).then(r => r.json());
  const cache = path.join(warm.dataDir, 'video-cache');
  const mp4s = () => (existsSync(cache) ? readdirSync(cache).filter(f => f.endsWith('.mp4')) : []);

  const idle = await status();
  check('the warmer reports idle before any course is opened',
    idle.active === false && idle.total === 0, JSON.stringify(idle));
  check('nothing is cached yet', mp4s().length === 0, mp4s().join(','));

  // Opening the course is the only trigger.
  const cat = await get(warm.base, '/api/catalog/warm-course');
  check('the course opens', (cat.body?.modules || []).length > 0,
    `${(cat.body?.modules || []).length} modules`);

  // Poll tightly so the active window cannot be missed.
  let sawActive = false, sawCourseName = '', sawTitle = '';
  const deadline = Date.now() + 180000;
  let last = idle;
  while (Date.now() < deadline) {
    last = await status();
    if (last.active) {
      sawActive = true;
      sawCourseName = sawCourseName || last.courseName;
      sawTitle = sawTitle || last.currentTitle;
    } else if (sawActive) {
      break;                              // ran, and has now finished
    }
    await new Promise(r => setTimeout(r, 25));
  }

  check('opening a course starts the warmer on its own', sawActive);
  check('it names the course it is working on', sawCourseName === 'Warm Course', sawCourseName);
  check('it names the file it is working on', sawTitle.length > 0, sawTitle);
  check('it counts only what the browser cannot play, skipping the .mp4',
    last.total === 2, `total=${last.total}`);
  check('it finishes everything it queued', last.done === last.total,
    `${last.done}/${last.total}`);
  check('it goes idle when done', last.active === false, JSON.stringify(last));

  const produced = mp4s();
  check('the warmer produced a cached copy per unplayable file',
    produced.length === 2, produced.join(','));
  check('the already-playable .mp4 was not transcoded',
    !produced.some(f => f.startsWith('c_')), produced.join(','));

  for (const f of produced) {
    const probe = JSON.parse(execFileSync('ffprobe', [
      '-v', 'error', '-show_entries', 'stream=codec_name,codec_type',
      '-show_format', '-of', 'json', path.join(cache, f)
    ], { encoding: 'utf-8', timeout: 30000 }));
    const codecs = (probe.streams || []).map(x => `${x.codec_type}:${x.codec_name}`);
    check(`the warmed file ${f.slice(0, 12)}… is a playable MP4`,
      /mp4/.test(probe.format?.format_name || '') && codecs.includes('video:h264'),
      `${probe.format?.format_name} ${codecs.join(',')}`);
  }

  // Reopening must not redo the work — this is what the pending check is for.
  const before = produced.map(f => `${f}:${statSync(path.join(cache, f)).mtimeMs}`).sort();
  await get(warm.base, '/api/catalog/warm-course');
  await new Promise(r => setTimeout(r, 2500));
  const after = mp4s().map(f => `${f}:${statSync(path.join(cache, f)).mtimeMs}`).sort();
  check('reopening the course re-transcodes nothing',
    JSON.stringify(before) === JSON.stringify(after), `${before.length} -> ${after.length} files`);
  check('and it does not spin the warmer back up',
    (await status()).active === false);
} finally {
  warm.stop();
}

process.exit(summary('Media') === 0 ? 0 : 1);

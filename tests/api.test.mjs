import { startServer, post, get, check, section, summary } from './harness.mjs';

/**
 * Server-side regression suite. No browser, so it runs in seconds.
 *
 * These cover the behaviours that were actually broken at some point: the
 * cross-origin hole, path containment, the write paths that store your notes,
 * and the endpoints whose client/server contracts had drifted apart.
 */

import { mkdtempSync, mkdirSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import path from 'path';

const srv = await startServer();
const B = srv.base;
const CID = 'test-course';

// Paths like /etc/hostname and /proc do not exist on Windows, so tests built on
// them asserted "rejects a file" while actually exercising "rejects a missing
// path" — and passed for the wrong reason, or failed for one. Build the shapes
// instead of borrowing them from the host.
const FIX = mkdtempSync(path.join(tmpdir(), 'studyhub-fixtures-'));
const A_FILE = path.join(FIX, 'not-a-folder.txt');
writeFileSync(A_FILE, 'plain file');
const EMPTY_DIR = path.join(FIX, 'empty');
mkdirSync(EMPTY_DIR);
const MISSING = path.join(FIX, 'no', 'such', 'place');
// A small library of documents, for the scan-shape checks.
const DOC_TREE = path.join(FIX, 'library');
for (const sub of ['Algorithms', 'Networks']) {
  mkdirSync(path.join(DOC_TREE, sub), { recursive: true });
  for (const f of ['one.pdf', 'two.pdf', 'three.pdf'])
    writeFileSync(path.join(DOC_TREE, sub, f), '%PDF-1.4\n');
}
// The drive/volume this machine's temp dir lives on — '/' on Unix, 'C:\\' on Windows.
const FS_ROOT = path.parse(FIX).root;

try {
  // ---------------------------------------------------------------- security
  section('Security');
  {
    const evil = { origin: 'https://evil.example.com' };
    const exec = await post(B, '/api/execute', { language: 'python', code: 'print(1)' }, evil);
    check('cross-origin code execution is refused', exec.status === 403, `got ${exec.status}`);

    const raw = await fetch(`${B}/api/slides/raw?path=/etc/passwd`);
    check('reading outside the course library is refused', raw.status === 403, `got ${raw.status}`);

    const open = await post(B, '/api/slides/open-system', { filePath: '/etc/passwd.pdf' });
    check('launching a file outside the library is refused', open.status === 403, `got ${open.status}`);

    const sameOrigin = await post(B, '/api/execute', { language: 'javascript', code: 'console.log(1)' });
    check('same-origin execution still works', sameOrigin.status === 200, `got ${sameOrigin.status}`);

    const shell = await post(B, '/api/execute', { language: 'bash', code: 'id' });
    check('shell languages are not exposed', shell.status === 400, `got ${shell.status}`);
  }

  // --------------------------------------------------------------- execution
  section('Code execution');
  {
    const cases = [
      ['javascript', 'console.log("JS", 6*7)', 'JS 42'],
      ['python', 'print("PY", sum(range(11)))', 'PY 55'],
      ['c', '#include <stdio.h>\nint main(){printf("C 55\\n");return 0;}', 'C 55'],
      ['cpp', '#include <iostream>\nint main(){std::cout<<"CPP ok";}', 'CPP ok']
    ];
    for (const [lang, code, expect] of cases) {
      const r = await post(B, '/api/execute', { language: lang, code });
      check(`${lang} runs`, r.body?.exitCode === 0 && (r.body?.stdout || '').includes(expect),
        `exit=${r.body?.exitCode} out=${JSON.stringify((r.body?.stdout || '').trim().slice(0, 24))}`);
    }

    const bad = await post(B, '/api/execute', { language: 'c', code: 'int main(){ not c }' });
    check('compile errors are reported, not swallowed', bad.body?.compileError === true && !!bad.body?.stderr);

    const loop = await post(B, '/api/execute', { language: 'python', code: 'while True: pass' });
    check('runaway code hits the timeout', loop.body?.timedOut === true && loop.body?.exitCode === 124,
      `${loop.body?.executionTimeMs}ms`);
  }

  // ------------------------------------------------------------------- notes
  section('Notes');
  {
    await post(B, '/api/progress', { courseId: CID, lessonId: 'L1', note: { timestamp: 42, content: 'first', slideNumber: 7 } });
    await post(B, '/api/progress', { courseId: CID, lessonId: 'L1', note: { timestamp: 90, content: 'second' } });
    let d = (await get(B, '/api/progress')).body;
    let notes = d.courses[CID].notes.L1;
    check('notes are saved', notes.length === 2, `${notes.length}`);
    check('slide number is attached', notes[0].slideNumber === 7);

    await post(B, '/api/progress', { courseId: CID, lessonId: 'L1', removeNoteId: notes[0].id });
    notes = (await get(B, '/api/progress')).body.courses[CID].notes.L1;
    check('a single note can be deleted', notes.length === 1, `${notes.length}`);

    await post(B, '/api/progress', { courseId: CID, lessonId: 'L1', clearAllNotes: true });
    notes = (await get(B, '/api/progress')).body.courses[CID].notes.L1;
    check('all notes can be cleared', notes.length === 0);
  }

  // --------------------------------------------------------------- bookmarks
  section('Bookmarks');
  {
    await post(B, '/api/progress', { courseId: CID, lessonId: 'L1', bookmark: { timestampSeconds: 12, label: 'pin A' } });
    await post(B, '/api/progress', { courseId: CID, lessonId: 'L1', bookmark: { timestampSeconds: 34, label: 'pin B' } });
    let bm = (await get(B, '/api/progress')).body.courses[CID].bookmarks.L1;
    check('bookmarks are saved', bm.length === 2, `${bm.length}`);

    await post(B, '/api/progress', { courseId: CID, lessonId: 'L1', removeBookmarkId: bm[0].id });
    bm = (await get(B, '/api/progress')).body.courses[CID].bookmarks.L1;
    check('a bookmark can be deleted', bm.length === 1);
    check('the right one survived', bm[0].label === 'pin B', bm[0].label);
  }

  // ---------------------------------------------------------------- progress
  section('Progress and resume');
  {
    await post(B, '/api/progress', { courseId: CID, lessonId: 'L1', timestamp: 123 });
    await post(B, '/api/progress', { courseId: CID, lessonId: 'L2', timestamp: 456 });
    const c = (await get(B, '/api/progress')).body.courses[CID];
    check('each lesson keeps its own resume position',
      c.resumePositions.L1 === 123 && c.resumePositions.L2 === 456,
      `L1=${c.resumePositions.L1} L2=${c.resumePositions.L2}`);

    await post(B, '/api/progress', { courseId: CID, lessonId: 'L1', completed: true });
    let done = (await get(B, '/api/progress')).body.courses[CID].completedLessonIds;
    check('completion is recorded', done.includes('L1'));
    await post(B, '/api/progress', { courseId: CID, lessonId: 'L1', completed: false });
    done = (await get(B, '/api/progress')).body.courses[CID].completedLessonIds;
    check('completion can be undone', !done.includes('L1'));

    const before = (await get(B, '/api/progress')).body.globalStats.totalHoursWatchedSeconds;
    await post(B, '/api/progress', { courseId: CID, lessonId: 'L1', timestamp: 200, streakUpdate: { addedSeconds: 0 } });
    const seek = (await get(B, '/api/progress')).body.globalStats.totalHoursWatchedSeconds;
    await post(B, '/api/progress', { courseId: CID, lessonId: 'L1', timestamp: 209, streakUpdate: { addedSeconds: 9 } });
    const watch = (await get(B, '/api/progress')).body.globalStats.totalHoursWatchedSeconds;
    check('seeking does not inflate watch time', seek === before, `${before} -> ${seek}`);
    check('watching credits real seconds', watch - seek === 9, `+${watch - seek}`);
  }

  // ----------------------------------------------------- youtube data bucket
  section('YouTube data is course-independent');
  {
    await post(B, '/api/progress', { courseId: 'course-A', lessonId: 'yt_ABC', note: { timestamp: 5, content: 'yt note' } });
    await post(B, '/api/progress', { courseId: 'course-B', lessonId: 'yt_ABC', bookmark: { timestampSeconds: 9, label: 'yt pin' } });
    const d = (await get(B, '/api/progress')).body;
    const bucket = d.courses['__youtube__'];
    check('a YouTube note lands in the shared bucket', bucket?.notes?.yt_ABC?.length === 1);
    check('a YouTube pin lands in the same bucket regardless of course',
      bucket?.bookmarks?.yt_ABC?.length === 1);
    check('it is not scattered across the courses',
      !d.courses['course-A']?.notes?.yt_ABC && !d.courses['course-B']?.bookmarks?.yt_ABC);
  }

  // --------------------------------------------------------- code snippets
  section('Code snippets');
  {
    await post(B, '/api/progress', { courseId: CID, lessonId: 'L1', codeSnippet: { language: 'python', code: 'print(1)' } });
    let snip = (await get(B, '/api/progress')).body.courses[CID].codeSnippets?.L1;
    check('a code snippet is saved against its lesson', snip?.code === 'print(1)', snip?.language);

    // Regression: this used to read the YouTube bucket but write the active
    // course, sending the snippet to the wrong record or throwing outright.
    await post(B, '/api/progress', { courseId: 'some-course', lessonId: 'yt_XYZ', codeSnippet: { language: 'javascript', code: 'let a=1' } });
    const d = (await get(B, '/api/progress')).body;
    check('a YouTube lesson snippet lands in the shared bucket',
      d.courses['__youtube__']?.codeSnippets?.yt_XYZ?.code === 'let a=1');
    check('it does not leak into the active course',
      !d.courses['some-course']?.codeSnippets?.yt_XYZ);
  }

  // -------------------------------------------------------------- scratchpad
  section('Notepad');
  {
    const a = await post(B, '/api/scratchpad', { content: 'note one' });
    const id = a.body.notes[0].id;
    await post(B, '/api/scratchpad', { content: 'note two' });
    const edited = await post(B, '/api/scratchpad', { id, content: 'note one edited' });
    check('notepad entries save', edited.body.notes.length === 2, `${edited.body.notes.length}`);
    check('editing updates in place rather than duplicating',
      edited.body.notes.find(n => n.id === id)?.content === 'note one edited');
    const del = await post(B, '/api/scratchpad', { removeId: id });
    check('an entry can be deleted', del.body.notes.length === 1);
    const cleared = await post(B, '/api/scratchpad', { clearAll: true });
    check('the notepad can be cleared', cleared.body.notes.length === 0);
    const bad = await post(B, '/api/scratchpad', {});
    check('a malformed request is rejected', bad.status === 400, `got ${bad.status}`);
  }

  // ----------------------------------------------------------- watch history
  section('Watch history');
  {
    await post(B, '/api/youtube/history', {
      id: 'yt_ABC', videoId: 'ABC', title: 'A lecture', durationSeconds: 600, positionSeconds: 30
    });
    let h = (await get(B, '/api/youtube/history')).body.history;
    check('a watch is recorded', h.length === 1 && h[0].title === 'A lecture');
    check('note and pin counts are attached', h[0].notes === 1 && h[0].bookmarks === 1,
      `${h[0].notes}n ${h[0].bookmarks}p`);

    await post(B, '/api/progress', { courseId: 'anything', lessonId: 'yt_ABC', timestamp: 321 });
    h = (await get(B, '/api/youtube/history')).body.history;
    check('position is read live, not from a stale copy', h[0].positionSeconds === 321,
      `${h[0].positionSeconds}`);

    await post(B, '/api/youtube/history', { removeId: 'yt_ABC' });
    h = (await get(B, '/api/youtube/history')).body.history;
    check('an entry can be removed', h.length === 0);
  }

  // ------------------------------------------------------------ virtual course
  section('Playlist import contract');
  {
    const videos = [
      { videoId: 'V1', title: 'Lesson one', durationText: '10:00', durationSeconds: 600 },
      { videoId: 'V2', title: 'Lesson two', durationText: '5:00', durationSeconds: 300 }
    ];
    const r = await post(B, '/api/courses/add-virtual', {
      name: 'Imported playlist', playlistId: 'PLTEST', videos
    });
    check('a playlist imports from the shape the client sends', r.status === 200, `got ${r.status}`);
    check('every video becomes a lesson', r.body?.lessonCount === 2, `${r.body?.lessonCount}`);

    const cat = await get(B, `/api/catalog/${r.body.course.id}`);
    const first = cat.body?.modules?.[0]?.lessons?.[0];
    check('lessons are keyed so earlier notes carry over', first?.id === 'yt_V1', first?.id);
    check('lessons are marked as YouTube', first?.source === 'youtube');
    check('durations survive the import', first?.durationSeconds === 600, `${first?.durationSeconds}`);

    const missing = await post(B, '/api/courses/add-virtual', { name: 'No id' });
    check('an import without a playlist id is rejected', missing.status === 400);
  }

  // ----------------------------------------------------------- slide folders
  section('Slide folders');
  {
    const bad = await post(B, '/api/slides/folders', {});
    check('adding a folder with no path is rejected', bad.status === 400);
    const missing = await post(B, '/api/slides/folders', { folderPath: MISSING });
    check('adding a missing folder 404s', missing.status === 404, String(missing.status));
    const notDir = await post(B, '/api/slides/folders', { folderPath: A_FILE });
    check('adding a file rather than a folder is rejected', notDir.status === 400, String(notDir.status));
    const empty = await post(B, '/api/slides/folders', { folderPath: EMPTY_DIR });
    check('a folder with no decks is rejected rather than silently added', empty.status === 400,
      String(empty.status));

    const listed = await get(B, '/api/slides/folders');
    check('the folder list is readable', Array.isArray(listed.body?.folders));
  }

  // -------------------------------------------------------------------- scan
  section('Drive scanner');
  {
    check('scan roots are discoverable', (await get(B, '/api/scan/roots')).body?.roots?.length >= 1);
    const bad = await post(B, '/api/scan', {});
    check('a scan with no path is rejected', bad.status === 400);
    const missing = await post(B, '/api/scan', { rootPath: MISSING });
    check('a scan of a missing folder 404s', missing.status === 404, String(missing.status));
    const file = await post(B, '/api/scan', { rootPath: A_FILE });
    check('a scan of a file rather than a folder is rejected', file.status === 400, String(file.status));
    const wide = await post(B, '/api/scan', { rootPath: FS_ROOT, timeoutMs: 3000 });
    check('a whole-filesystem scan stays inside its deadline',
      wide.status === 200 && wide.body.elapsedMs < 12000, `${wide.body?.elapsedMs}ms`);

    // A folder of slides with no video used to be invisible to the scanner.
    const docs = await post(B, '/api/scan', { rootPath: DOC_TREE, timeoutMs: 8000 });
    const found = docs.body?.candidates || [];
    const kinds = new Set(found.map(c => c.kind));
    check('a document library is actually found', found.length > 0, `${found.length} candidates`);
    check('every candidate says what it holds',
      found.length > 0 && found.every(c => ['videos', 'documents', 'mixed'].includes(c.kind)),
      [...kinds].join(','));
    check('no candidate is nested inside another',
      found.every(a => !found.some(b => b !== a && a.path.startsWith(b.path + path.sep))));
  }

  // ------------------------------------------------------- generic discovery
  section('Course discovery works for any layout');
  {
    // Discovery used to be hardcoded to three folders on one machine, so
    // everybody else opened the app to an empty library.
    const { mkdtempSync, mkdirSync, writeFileSync } = await import('fs');
    const { tmpdir } = await import('os');
    const pathMod = (await import('path')).default;

    const lib = mkdtempSync(pathMod.join(tmpdir(), 'studyhub-lib-'));
    mkdirSync(pathMod.join(lib, 'Rust Course', 'Week 1'), { recursive: true });
    mkdirSync(pathMod.join(lib, 'Maths Notes'), { recursive: true });
    for (const n of [1, 2, 3]) {
      writeFileSync(pathMod.join(lib, 'Rust Course', 'Week 1', `lesson${n}.mp4`), Buffer.alloc(2 * 1024 * 1024));
    }
    writeFileSync(pathMod.join(lib, 'Maths Notes', 'algebra.pdf'), '%PDF-1.4\n');
    writeFileSync(pathMod.join(lib, 'Maths Notes', 'calculus.pdf'), '%PDF-1.4\n');

    const fresh = await startServer({ coursesRoot: lib });
    try {
      const { body } = await get(fresh.base, '/api/courses');
      const ids = (body?.courses || []).map(c => c.id).sort();
      check('a video folder is discovered with no configuration',
        ids.includes('rust-course'), ids.join(','));
      check('a folder of documents is discovered too',
        ids.includes('maths-notes'), ids.join(','));
      const rust = body.courses.find(c => c.id === 'rust-course');
      check('the course is named from its folder, readably',
        rust?.name === 'Rust Course', rust?.name);
      const maths = body.courses.find(c => c.id === 'maths-notes');
      check('a document folder is badged as reading material',
        maths?.badge === 'Reading Material', maths?.badge);
    } finally {
      fresh.stop();
    }
  }

  // ------------------------------------------------ slide folders as courses
  section('A folder of slides is a course');
  {
    // Registering a folder of PDFs used to put them in the slide dropdown and
    // nowhere else — no card in the library, no curriculum, no structure.
    const { mkdtempSync, mkdirSync, writeFileSync } = await import('fs');
    const { tmpdir } = await import('os');
    const pathMod = (await import('path')).default;

    const lib = mkdtempSync(pathMod.join(tmpdir(), 'studyhub-empty-'));
    const decks = mkdtempSync(pathMod.join(tmpdir(), 'Seminar Slides-'));
    mkdirSync(pathMod.join(decks, 'Week 1'), { recursive: true });
    mkdirSync(pathMod.join(decks, 'Week 2'), { recursive: true });
    writeFileSync(pathMod.join(decks, 'Week 1', 'intro.pdf'), '%PDF-1.4\n');
    writeFileSync(pathMod.join(decks, 'Week 1', 'theory.pdf'), '%PDF-1.4\n');
    writeFileSync(pathMod.join(decks, 'Week 2', 'applied.pdf'), '%PDF-1.4\n');

    const fresh = await startServer({ coursesRoot: lib });
    try {
      const before = await get(fresh.base, '/api/courses');
      check('an empty library starts with no courses',
        (before.body?.courses || []).length === 0);

      await post(fresh.base, '/api/slides/folders', { folderPath: decks });

      const after = await get(fresh.base, '/api/courses');
      const course = (after.body?.courses || [])[0];
      check('registering a slide folder adds it to the library',
        !!course, (after.body?.courses || []).length + ' courses');
      check('it is badged as reading material',
        course?.badge === 'Reading Material', course?.badge);

      const cat = await get(fresh.base, `/api/catalog/${course?.id}`);
      check('it has a curriculum even with no video in it',
        (cat.body?.modules || []).length === 2, `${(cat.body?.modules || []).length} modules`);
      check('the curriculum groups the files by their folders',
        (cat.body?.modules || []).map(m => m.title).sort().join(',') === 'Week 1,Week 2',
        (cat.body?.modules || []).map(m => m.title).join(','));
      check('every document is listed under a module',
        cat.body?.totalPdfs === 3, String(cat.body?.totalPdfs));
    } finally {
      fresh.stop();
    }
  }

  // ---------------------------------------------------------------- liveness
  section('Word documents are study material');
  {
    // .docx was missing from DOC_EXTENSIONS, so thesis drafts and methodology
    // notes were invisible to the scanner, the curriculum and the browser.
    const { mkdtempSync, mkdirSync, writeFileSync } = await import('fs');
    const { tmpdir } = await import('os');
    const pathMod = (await import('path')).default;

    const lib = mkdtempSync(pathMod.join(tmpdir(), 'studyhub-empty-'));
    const docs = mkdtempSync(pathMod.join(tmpdir(), 'Thesis-'));
    mkdirSync(pathMod.join(docs, 'Drafts'), { recursive: true });
    writeFileSync(pathMod.join(docs, 'Drafts', 'thesis.docx'), 'PK\x03\x04');
    writeFileSync(pathMod.join(docs, 'Drafts', 'methodology.docx'), 'PK\x03\x04');
    writeFileSync(pathMod.join(docs, 'Drafts', 'proposal.doc'), '\xd0\xcf');
    // Word leaves this behind whenever a document is open. It is not content.
    writeFileSync(pathMod.join(docs, 'Drafts', '~$thesis.docx'), 'lock');

    const fresh = await startServer({ coursesRoot: lib });
    try {
      await post(fresh.base, '/api/slides/folders', { folderPath: docs });

      const after = await get(fresh.base, '/api/courses');
      const course = (after.body?.courses || [])[0];
      check('a folder of Word documents becomes a course', !!course,
        (after.body?.courses || []).length + ' courses');

      const cat = await get(fresh.base, `/api/catalog/${course?.id}`);
      check('Word documents are indexed', cat.body?.totalPdfs === 3,
        String(cat.body?.totalPdfs));

      const files = (cat.body?.modules || []).flatMap(m => m.supplementaryFiles || []);
      check('the Word lock file is not indexed',
        !files.some(f => f.filename.startsWith('~$')),
        files.map(f => f.filename).join(','));
      check('a .docx keeps its type so the viewer can branch on it',
        files.some(f => f.type === 'docx'), files.map(f => f.type).join(','));

      const doc = files.find(f => f.type === 'docx');
      const raw = await fetch(`${fresh.base}/api/pdf/${course?.id}/${doc?.id}`);
      check('a Word document is served, not refused', raw.status === 200, String(raw.status));
      check('it is served as Word, not as a generic blob',
        (raw.headers.get('content-type') || '').includes('wordprocessingml'),
        raw.headers.get('content-type'));
      check('it is sent as a download, since no browser renders it',
        (raw.headers.get('content-disposition') || '').startsWith('attachment'),
        raw.headers.get('content-disposition'));
    } finally {
      fresh.stop();
    }
  }

  section('Windows layouts');
  {
    // The scanner only knew /run/media, /media and /mnt, and its ignore list
    // only knew Unix build dirs. On Windows the natural thing to scan is C:\,
    // which is mostly Windows itself.
    const { mkdtempSync, mkdirSync, writeFileSync } = await import('fs');
    const { tmpdir } = await import('os');
    const pathMod = (await import('path')).default;

    const fakeDrive = mkdtempSync(pathMod.join(tmpdir(), 'studyhub-cdrive-'));
    const put = (dir, ...files) => {
      mkdirSync(pathMod.join(fakeDrive, dir), { recursive: true });
      for (const f of files) writeFileSync(pathMod.join(fakeDrive, dir, f), '%PDF-1.4\n');
    };
    // What a real C:\ looks like.
    put('Windows/System32', 'a.pdf', 'b.pdf', 'c.pdf');
    put('Program Files/Adobe', 'd.pdf', 'e.pdf', 'f.pdf');
    put('PROGRAMDATA/Thing', 'g.pdf', 'h.pdf', 'i.pdf');
    put('$Recycle.Bin', 'j.pdf', 'k.pdf', 'l.pdf');
    put('System Volume Information', 'm.pdf', 'n.pdf');
    // ...and the one folder that is actually coursework.
    put('Courses/Databases', 'week1.pdf', 'week2.pdf', 'week3.pdf');

    const fresh = await startServer({ coursesRoot: mkdtempSync(pathMod.join(tmpdir(), 'studyhub-empty-')) });
    try {
      const roots = await get(fresh.base, '/api/scan/roots');
      check('the roots endpoint reports the platform for path examples',
        roots.body?.platform === process.platform, String(roots.body?.platform));
      check('it reports the path separator too',
        roots.body?.sep === pathMod.sep, JSON.stringify(roots.body?.sep));

      const scan = await post(fresh.base, '/api/scan', { rootPath: fakeDrive, timeoutMs: 20000 });
      const names = (scan.body?.candidates || []).map(c => c.name);
      check('coursework on the drive is still found',
        names.some(n => /Databases|Courses/i.test(n)), names.join(','));
      check('the Windows system tree is skipped',
        !names.some(n => /Windows|System32/i.test(n)), names.join(','));
      check('Program Files is skipped',
        !names.some(n => /Program Files|Adobe/i.test(n)), names.join(','));
      check('the ignore list is case-insensitive, as NTFS is',
        !names.some(n => /PROGRAMDATA|Thing/i.test(n)), names.join(','));
      check('the recycle bin is skipped',
        !names.some(n => /Recycle/i.test(n)), names.join(','));
      check('System Volume Information is skipped',
        !names.some(n => /Volume Information/i.test(n)), names.join(','));
    } finally {
      fresh.stop();
    }
  }

  section('The server is not on the network');
  {
    // app.listen(port) with no host binds every interface, so /api/progress --
    // your notes -- answered anyone on the same Wi-Fi. The Origin guard does
    // not help: it only inspects requests that carry an Origin, and a plain
    // HTTP client sends none.
    const os = await import('os');
    const lan = Object.values(os.networkInterfaces()).flat()
      .find(i => i && i.family === 'IPv4' && !i.internal);

    if (!lan) {
      check('skipped: this machine has no non-loopback address', true);
    } else {
      const reach = async (base) => {
        try {
          const r = await fetch(`${base}/api/health`, { signal: AbortSignal.timeout(4000) });
          return r.ok;
        } catch (e) { return false; }
      };

      check('the app answers on loopback', await reach(B));
      check('but not on this machine\'s network address',
        !(await reach(`http://${lan.address}:${new URL(B).port}`)), lan.address);

      // Reaching it from a phone on the same network is a real thing to want;
      // it just has to be asked for rather than being the default.
      const open = await startServer({ env: { STUDYHUB_HOST: '0.0.0.0' } });
      try {
        check('STUDYHUB_HOST can opt back in to the network',
          await reach(`http://${lan.address}:${open.port}`), lan.address);
      } finally {
        open.stop();
      }
    }
  }

  section('Companion window');
  {
    // Opens DeepSeek in a chromeless browser window beside the app. Chromium's
    // --app uses the person's normal profile, so they are already signed in --
    // the app never sees a credential. The URL is fixed server-side: this runs
    // a browser, and a loopback-only app must not become a launcher for
    // whatever a page asks for.
    const dry = await startServer({ env: { STUDYHUB_COMPANION_DRY_RUN: '1' } });
    try {
      const no = await post(dry.base, '/api/companion/open', {});
      check('opening with no app named is rejected', no.status === 400, String(no.status));

      const unknown = await post(dry.base, '/api/companion/open', { app: 'nope' });
      check('an unknown companion is rejected', unknown.status === 400, String(unknown.status));

      // The important one: a URL from the client must never be launched.
      const evil = await post(dry.base, '/api/companion/open', { url: 'https://evil.example/x' });
      check('a client-supplied URL alone is refused', evil.status === 400, String(evil.status));

      const smuggled = await post(dry.base, '/api/companion/open',
        { app: 'deepseek', url: 'https://evil.example/x' });
      const args = (smuggled.body?.args || []).join(' ');
      check('a URL smuggled alongside a known app is ignored',
        smuggled.status === 200 && !args.includes('evil.example'), args.slice(0, 120));

      const ok = await post(dry.base, '/api/companion/open', { app: 'deepseek' });
      check('DeepSeek opens', ok.status === 200, String(ok.status));
      check('it is named for the person, not the key', ok.body?.name === 'DeepSeek', ok.body?.name);
      const argv = (ok.body?.args || []).join(' ');
      check('the launched command points at DeepSeek',
        argv.includes('chat.deepseek.com'), argv.slice(0, 140));
      check('a chromium browser gets a chromeless app window, otherwise a plain one',
        ok.body?.appMode ? argv.includes('--app=https://chat.deepseek.com/') : argv.includes('chat.deepseek.com'),
        `appMode=${ok.body?.appMode} ${argv.slice(0, 140)}`);
      check('no private browser profile is forced, so the existing login is used',
        !argv.includes('--user-data-dir'), argv.slice(0, 140));

      const cross = await post(dry.base, '/api/companion/open', { app: 'deepseek' },
        { origin: 'https://evil.example' });
      check('a cross-origin page cannot open windows on this machine',
        cross.status === 403, String(cross.status));
    } finally {
      dry.stop();
    }
  }

  section('Liveness');
  {
    const { status, body } = await get(srv.base, '/api/health');
    check('the health probe answers', status === 200 && body?.ok === true, String(status));
  }

  // ------------------------------------------------------------- stop control
  section('Stopping the server from the app');
  {
    // Someone who launched by double-clicking has no terminal to Ctrl+C in.
    const fresh = await startServer();
    const { status } = await post(fresh.base, '/api/shutdown', {});
    check('the shutdown endpoint accepts the request', status === 200, String(status));
    await new Promise(r => setTimeout(r, 1500));
    let stillUp = true;
    try {
      await fetch(`${fresh.base}/api/courses`, { signal: AbortSignal.timeout(1500) });
    } catch (e) { stillUp = false; }
    check('the server actually exits', !stillUp);
    fresh.stop();
  }

  // --------------------------------------------------------------- durability
  section('Durability');
  {
    const unknown = await fetch(`${B}/api/definitely-not-a-route`);
    check('an unknown API route 404s instead of returning the app shell', unknown.status === 404,
      `got ${unknown.status}`);

    const beacon = await fetch(`${B}/api/progress/beacon`, {
      method: 'POST', headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify({ courseId: CID, lessonId: 'L9', timestamp: 777 })
    });
    check('the tab-close beacon is accepted', beacon.ok);
    await new Promise(r => setTimeout(r, 300));
    const pos = (await get(B, '/api/progress')).body.courses[CID].resumePositions.L9;
    check('the beacon is flushed immediately, not deferred', pos === 777, `${pos}`);
  }
} finally {
  srv.stop();
}

process.exit(summary('API suite'));

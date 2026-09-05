import { startServer, post, get, check, section, summary } from './harness.mjs';

/**
 * Server-side regression suite. No browser, so it runs in seconds.
 *
 * These cover the behaviours that were actually broken at some point: the
 * cross-origin hole, path containment, the write paths that store your notes,
 * and the endpoints whose client/server contracts had drifted apart.
 */

const srv = await startServer();
const B = srv.base;
const CID = 'test-course';

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
    const missing = await post(B, '/api/slides/folders', { folderPath: '/no/such/dir' });
    check('adding a missing folder 404s', missing.status === 404);
    const notDir = await post(B, '/api/slides/folders', { folderPath: '/etc/hostname' });
    check('adding a file rather than a folder is rejected', notDir.status === 400);
    const empty = await post(B, '/api/slides/folders', { folderPath: '/proc' });
    check('a folder with no decks is rejected rather than silently added', empty.status === 400);

    const listed = await get(B, '/api/slides/folders');
    check('the folder list is readable', Array.isArray(listed.body?.folders));
  }

  // -------------------------------------------------------------------- scan
  section('Drive scanner');
  {
    check('scan roots are discoverable', (await get(B, '/api/scan/roots')).body?.roots?.length >= 1);
    const bad = await post(B, '/api/scan', {});
    check('a scan with no path is rejected', bad.status === 400);
    const missing = await post(B, '/api/scan', { rootPath: '/no/such/place' });
    check('a scan of a missing folder 404s', missing.status === 404);
    const file = await post(B, '/api/scan', { rootPath: '/etc/hostname' });
    check('a scan of a file rather than a folder is rejected', file.status === 400);
    const wide = await post(B, '/api/scan', { rootPath: '/', timeoutMs: 3000 });
    check('a whole-filesystem scan stays inside its deadline',
      wide.status === 200 && wide.body.elapsedMs < 12000, `${wide.body?.elapsedMs}ms`);

    // A folder of slides with no video used to be invisible to the scanner.
    const docs = await post(B, '/api/scan', { rootPath: '/usr/share/doc', timeoutMs: 8000 });
    const kinds = new Set((docs.body?.candidates || []).map(c => c.kind));
    check('every candidate says what it holds',
      (docs.body?.candidates || []).every(c => ['videos', 'documents', 'mixed'].includes(c.kind)),
      [...kinds].join(','));
    check('no candidate is nested inside another',
      (docs.body?.candidates || []).every(a =>
        !(docs.body.candidates || []).some(b => b !== a && a.path.startsWith(b.path + '/'))));
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

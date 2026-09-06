import { spawn } from 'child_process';
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'fs';
import { tmpdir } from 'os';
import path from 'path';

/**
 * Shared test harness.
 *
 * Every server the suite starts gets its own STUDYHUB_DATA_DIR, so tests can
 * write notes, bookmarks and history freely without touching real study data.
 * Previously the only checks that existed were ad-hoc scripts pointed at the
 * live instance, which is how earlier runs managed to delete real notes.
 */

const SEED = {
  schemaVersion: 1,
  activeCourseId: '',
  customCourses: [],
  courses: {},
  globalStats: { totalHoursWatchedSeconds: 0, streakDays: 1, lastActiveDate: '' }
};

let passed = 0;
let failed = 0;
const failures = [];

export function check(name, condition, detail = '') {
  if (condition) {
    passed++;
    console.log(`  \x1b[32mPASS\x1b[0m  ${name}${detail ? `  (${detail})` : ''}`);
  } else {
    failed++;
    failures.push(`${name}${detail ? `  (${detail})` : ''}`);
    console.log(`  \x1b[31mFAIL\x1b[0m  ${name}${detail ? `  (${detail})` : ''}`);
  }
}

export function section(title) {
  console.log(`\n\x1b[1m${title}\x1b[0m`);
}

export function summary(label) {
  console.log(`\n${'─'.repeat(60)}`);
  if (failed === 0) {
    console.log(`\x1b[32m${label}: ${passed} passed\x1b[0m`);
  } else {
    console.log(`\x1b[31m${label}: ${failed} FAILED, ${passed} passed\x1b[0m`);
    failures.forEach(f => console.log(`  \x1b[31m✗\x1b[0m ${f}`));
  }
  return failed;
}

/** Start a server on its own port with a throwaway data directory. */
export async function startServer({ coursesRoot } = {}) {
  const dataDir = mkdtempSync(path.join(tmpdir(), 'studyhub-test-'));
  mkdirSync(path.join(dataDir, 'backups'), { recursive: true });
  writeFileSync(path.join(dataDir, 'study-hub-data.json'), JSON.stringify(SEED, null, 2));

  // A high port well away from the app's own default, so a running instance
  // never collides with a test run.
  const port = 48000 + Math.floor(Math.random() * 900);

  // npx is npx.cmd on Windows and CreateProcess only ever appends .exe, so a
  // bare 'npx' is ENOENT there. Naming the .cmd beats shell:true, which would
  // put argument quoting back in play.
  const npx = process.platform === 'win32' ? 'npx.cmd' : 'npx';
  const child = spawn(npx, ['tsx', 'server.ts', '--port', String(port)], {
    env: {
      ...process.env,
      STUDYHUB_DATA_DIR: dataDir,
      ...(coursesRoot ? { STUDYHUB_COURSES_ROOT: coursesRoot } : {})
    },
    stdio: ['ignore', 'pipe', 'pipe']
  });

  const logs = [];
  child.stdout.on('data', d => logs.push(String(d)));
  child.stderr.on('data', d => logs.push(String(d)));

  const base = `http://localhost:${port}`;
  const deadline = Date.now() + 60000;
  while (Date.now() < deadline) {
    try {
      const r = await fetch(`${base}/api/courses`, { signal: AbortSignal.timeout(2000) });
      if (r.ok) break;
    } catch (e) { /* not up yet */ }
    await new Promise(r => setTimeout(r, 500));
  }
  if (Date.now() >= deadline) {
    throw new Error(`server did not start on ${port}\n${logs.join('')}`);
  }

  return {
    base,
    port,
    dataDir,
    logs: () => logs.join(''),
    stop() {
      try { child.kill('SIGTERM'); } catch (e) {}
      try { rmSync(dataDir, { recursive: true, force: true }); } catch (e) {}
    }
  };
}

/** POST helper that keeps the same-origin header the app itself sends. */
export async function post(base, pathname, body, { origin = base } = {}) {
  const res = await fetch(base + pathname, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: origin },
    body: JSON.stringify(body)
  });
  let json = null;
  try { json = await res.json(); } catch (e) { /* non-JSON is fine for some paths */ }
  return { status: res.status, body: json };
}

export async function get(base, pathname) {
  const res = await fetch(base + pathname);
  let json = null;
  try { json = await res.json(); } catch (e) {}
  return { status: res.status, body: json };
}

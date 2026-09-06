/**
 * What the page does when the server goes away.
 *
 * The stop button shuts the server down, so the page has to notice and say so.
 * The Reconnect button on that overlay swallowed its failure in a bare catch:
 * clicking it while the server was still down did nothing at all — no spinner,
 * no message, for up to the four second timeout. A button that answers with
 * silence reads as a broken button, and was reported as one.
 *
 * This owns its server rather than using the shared harness one, because it
 * has to kill it mid-test and bring it back on the same port.
 */
import { chromium } from 'playwright';
import { spawn } from 'child_process';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import path from 'path';
import { check, section, summary } from './harness.mjs';

const dataDir = mkdtempSync(path.join(tmpdir(), 'studyhub-offline-'));
mkdirSync(path.join(dataDir, 'backups'), { recursive: true });
writeFileSync(path.join(dataDir, 'study-hub-data.json'), JSON.stringify({
  schemaVersion: 1, activeCourseId: '', courses: {}, notepadEntries: [],
  watchHistory: [], slideFolders: [], customCourses: []
}, null, 2));

const port = 48900 + Math.floor(Math.random() * 90);
const base = `http://127.0.0.1:${port}`;

const boot = async () => {
  const child = spawn(process.execPath,
    ['--import', 'tsx', 'server.ts', '--port', String(port)],
    { env: { ...process.env, STUDYHUB_DATA_DIR: dataDir }, stdio: 'ignore' });
  const deadline = Date.now() + 60000;
  while (Date.now() < deadline) {
    try {
      const r = await fetch(`${base}/api/health`, { signal: AbortSignal.timeout(2000) });
      if (r.ok) return child;
    } catch (e) { /* not up yet */ }
    await new Promise(r => setTimeout(r, 400));
  }
  throw new Error(`server did not start on ${port}`);
};

const down = async () => {
  for (let i = 0; i < 40; i++) {
    try { await fetch(`${base}/api/health`, { signal: AbortSignal.timeout(1000) }); }
    catch (e) { return true; }
    await new Promise(r => setTimeout(r, 250));
  }
  return false;
};

let server = await boot();
const browser = await chromium.launch();
const page = await browser.newPage();

try {
  section('When the server goes away');

  await page.goto(base, { waitUntil: 'networkidle', timeout: 30000 });
  check('the app loads while the server is up',
    !(await page.$('#reconnect-btn')), 'no overlay expected yet');

  // Kill it behind the page's back — the same thing the stop button does.
  server.kill('SIGKILL');
  check('the server is actually gone', await down());

  // The heartbeat runs every 10s.
  await page.waitForSelector('#reconnect-btn', { timeout: 25000 });
  check('the page notices on its own, without a click', true);

  // The reported bug: this click used to do nothing observable at all.
  await page.click('#reconnect-btn');
  const failed = await page.waitForSelector('#reconnect-failed', { timeout: 15000 })
    .then(() => true).catch(() => false);
  check('clicking Reconnect while still down says so, instead of nothing', failed);
  check('the button is usable again afterwards',
    await page.isEnabled('#reconnect-btn'));
  check('the overlay is still shown, since nothing was fixed',
    !!(await page.$('#reconnect-btn')));

  // Bring it back on the same port and try again.
  server = await boot();
  await page.click('#reconnect-btn');
  await page.waitForSelector('#reconnect-btn', { state: 'detached', timeout: 30000 })
    .then(() => check('Reconnect brings the app back once the server is up', true))
    .catch(() => check('Reconnect brings the app back once the server is up', false,
      'overlay still present'));
} finally {
  await browser.close();
  try { server.kill('SIGKILL'); } catch (e) {}
  try { rmSync(dataDir, { recursive: true, force: true }); } catch (e) {}
}
process.exit(summary('Offline') === 0 ? 0 : 1);

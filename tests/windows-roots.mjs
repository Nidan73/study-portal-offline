/**
 * Windows-only probe, run by .github/workflows/windows.yml.
 *
 * /api/scan/roots looked for /run/media, /media and /mnt, which do not exist on
 * Windows — a Windows user saw one button ("Home folder") and no drives at all.
 * Only a real Windows filesystem can prove the drive-letter enumeration works,
 * so this asserts it there rather than pretending a Linux box can.
 */
import { startServer, get, check, summary, section } from './harness.mjs';

if (process.platform !== 'win32') {
  console.log('not Windows — skipping');
  process.exit(0);
}

section('Drive detection on Windows');
const s = await startServer();
try {
  const res = await get(s.base, '/api/scan/roots');
  const roots = res.body?.roots || [];
  const labels = roots.map(r => `${r.label}=${r.path}`).join(', ');

  check('the platform is reported as win32', res.body?.platform === 'win32', String(res.body?.platform));
  check('the separator is reported as a backslash', res.body?.sep === '\\', JSON.stringify(res.body?.sep));

  const drives = roots.filter(r => r.kind === 'drive');
  check('at least one drive letter is offered', drives.length > 0, labels);
  check('the system drive C: is among them',
    drives.some(d => /^C:/i.test(d.path)), labels);
  check('every drive root is a real drive-letter path',
    drives.every(d => /^[C-Z]:\\?$/i.test(d.path)), labels);
  check('the home folder is still offered',
    roots.some(r => r.kind === 'home'), labels);
} finally {
  s.stop();
}
process.exit(summary('Windows roots') === 0 ? 0 : 1);

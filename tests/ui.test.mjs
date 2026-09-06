import { chromium } from 'playwright';
import { startServer, check, section, summary } from './harness.mjs';

/**
 * Browser regression suite.
 *
 * Covers the failures that only show up in a real page: layout overflow,
 * contrast, component remounts, and the reduced-motion contract. Runs against
 * a server with its own scratch data directory.
 */

/** WCAG AA, measured against each element's real painted background. */
const contrastProbe = () => {
  const lum = c => {
    const m = c.match(/[\d.]+/g).map(Number);
    const [r, g, b] = m.slice(0, 3).map(v => {
      v /= 255;
      return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const ratio = (fg, bg) => {
    const [x, y] = [lum(fg), lum(bg)].sort((a, b) => b - a);
    return +((x + 0.05) / (y + 0.05)).toFixed(2);
  };
  // Walk up for the first ancestor that actually paints, otherwise a element on
  // an inverted pill is compared against the page background and reads as a
  // false failure.
  const effBg = el => {
    let n = el;
    while (n && n !== document.documentElement) {
      const c = getComputedStyle(n).backgroundColor;
      if (c && !/rgba\(0,\s*0,\s*0,\s*0\)|transparent/.test(c)) {
        const a = c.match(/[\d.]+/g);
        if (!a[3] || parseFloat(a[3]) > 0.85) return c;
      }
      n = n.parentElement;
    }
    return getComputedStyle(document.body).backgroundColor;
  };
  const fails = [];
  for (const el of document.querySelectorAll('p,span,div,button,h1,h2,h3,label,kbd')) {
    const t = (el.textContent || '').trim();
    if (!t || el.children.length) continue;
    const r = el.getBoundingClientRect();
    if (r.width < 4 || r.height < 4) continue;
    const cs = getComputedStyle(el);
    if (parseFloat(cs.opacity) < 0.6) continue;
    const rt = ratio(cs.color, effBg(el));
    const px = parseFloat(cs.fontSize);
    const bold = parseInt(cs.fontWeight) >= 700;
    const need = px >= 24 || (px >= 18.66 && bold) ? 3 : 4.5;
    if (rt < need) fails.push(`${rt} ${cs.fontSize} ${cs.color} "${t.slice(0, 18)}"`);
  }
  return fails;
};

const srv = await startServer();
const browser = await chromium.launch({
  args: ['--autoplay-policy=no-user-gesture-required', '--mute-audio']
});

const TABS = ['#nav-tab-player', '#nav-tab-slides', '#nav-tab-notes',
              '#nav-tab-ide', '#nav-tab-library', '#nav-tab-youtube'];

try {
  // ------------------------------------------------------------ page health
  section('Page health');
  {
    const ctx = await browser.newContext({ viewport: { width: 1600, height: 1000 }, reducedMotion: 'reduce' });
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(String(e).slice(0, 120)));
    page.on('console', m => {
      if (m.type() === 'error' && !/favicon|404/.test(m.text())) errors.push(m.text().slice(0, 120));
    });

    await page.goto(srv.base, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3500);
    check('the app renders', await page.locator('#nav-tab-player').count() > 0);

    for (const tab of TABS) {
      await page.click(tab).catch(() => {});
      await page.waitForTimeout(900);
      const overflow = await page.evaluate(() =>
        document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
      check(`${tab.replace('#nav-tab-', '')} renders without horizontal overflow`, !overflow);
    }
    check('no page errors across every tab', errors.length === 0, errors[0] || '');
    await ctx.close();
  }

  // -------------------------------------------------------------- responsive
  section('Responsive layout');
  {
    for (const width of [390, 768, 1024, 1280, 1600, 1920]) {
      const ctx = await browser.newContext({ viewport: { width, height: 900 } });
      const page = await ctx.newPage();
      await page.goto(srv.base, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(2500);
      const r = await page.evaluate(() => ({
        page: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
        tabsFit: (() => {
          const strip = document.querySelector('#nav-tab-player')?.parentElement;
          const last = document.querySelector('#nav-tab-library');
          if (!strip || !last) return true;
          return last.getBoundingClientRect().right <= strip.getBoundingClientRect().right + 1;
        })()
      }));
      check(`${width}px: page does not scroll sideways`, !r.page);
      // Below 1024 the tab strip scrolls by design; above it, every tab must fit.
      if (width >= 1024) check(`${width}px: every navbar tab is reachable without scrolling`, r.tabsFit);
      await ctx.close();
    }
  }

  // ---------------------------------------------------------------- contrast
  section('Contrast (WCAG AA)');
  {
    for (const theme of ['dark', 'light']) {
      const ctx = await browser.newContext({ viewport: { width: 1600, height: 1000 } });
      const page = await ctx.newPage();
      await page.goto(srv.base, { waitUntil: 'domcontentloaded' });
      await page.evaluate(t => localStorage.setItem('study_hub_theme', t), theme);
      await page.reload({ waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(3000);
      let all = [];
      for (const tab of TABS) {
        await page.click(tab).catch(() => {});
        await page.waitForTimeout(900);
        all = all.concat(await page.evaluate(contrastProbe));
      }
      check(`${theme} theme has no AA failures`, all.length === 0, all[0] || '');
      await ctx.close();
    }
  }

  // ------------------------------------------------------------------ motion
  section('Reduced motion');
  {
    const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 }, reducedMotion: 'reduce' });
    const page = await ctx.newPage();
    await page.goto(srv.base, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2500);
    const running = await page.evaluate(() =>
      [...document.querySelectorAll('*')]
        .map(e => getComputedStyle(e).animationDuration)
        .filter(d => d && parseFloat(d) > 0.05).length);
    check('prefers-reduced-motion is honoured', running === 0, `${running} long animations`);
    await ctx.close();
  }

  // ------------------------------------------------------------------ offline
  section('Offline');
  {
    const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 } });
    const page = await ctx.newPage();
    const external = [];
    await page.route('**/*', route => {
      const u = route.request().url();
      if (u.startsWith(srv.base) || u.startsWith('data:') || u.startsWith('blob:')) return route.continue();
      external.push(u.split('?')[0].slice(0, 50));
      return route.abort();
    });
    await page.goto(srv.base, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3500);
    const state = await page.evaluate(async () => {
      await document.fonts.ready;
      return {
        rendered: !!document.querySelector('#nav-tab-player'),
        fonts: document.fonts.check('700 16px "Plus Jakarta Sans"') &&
               document.fonts.check('400 12px "Geist Mono"')
      };
    });
    check('nothing external is requested', external.length === 0, [...new Set(external)].join(','));
    check('the app renders with no network', state.rendered);
    check('self-hosted fonts load with no network', state.fonts);
    await ctx.close();
  }

  // ---------------------------------------------------------- notepad + panel
  section('Notepad and panel');
  {
    const ctx = await browser.newContext({ viewport: { width: 1700, height: 1000 }, reducedMotion: 'reduce' });
    const page = await ctx.newPage();
    await page.goto(srv.base, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3000);

    await page.click('#nav-tab-library');
    await page.waitForTimeout(1000);
    await page.keyboard.press('Control+Shift+KeyN');
    await page.waitForTimeout(1200);
    check('the notepad opens with no lecture selected',
      await page.locator('[aria-label="Notepad"]').count() > 0);

    await page.locator('textarea').first().fill('regression note');
    await page.keyboard.press('Control+Enter');
    await page.waitForTimeout(1500);
    check('a notepad entry saves',
      await page.evaluate(() => document.body.innerText.includes('regression note')));

    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2500);
    await page.keyboard.press('Control+Shift+KeyN');
    await page.waitForTimeout(1200);
    check('notepad entries survive a reload',
      await page.evaluate(() => document.body.innerText.includes('regression note')));
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);

    // the panel toolbar must exist however you reach a split view
    for (const [tab, name] of [['#nav-tab-notes', 'Notes'], ['#nav-tab-slides', 'Slides']]) {
      await page.click(tab);
      await page.waitForTimeout(1400);
      const r = await page.evaluate(() => ({
        toolbar: !!document.getElementById('panel-tab-notes'),
        divider: !!document.getElementById('split-drag-divider')
      }));
      check(`${name} from the navbar shows the panel tool switcher`, r.toolbar);
      check(`${name} from the navbar has a drag divider`, r.divider);
    }
    await ctx.close();
  }

  // -------------------------------------------------------- dialog semantics
  section('DeepSeek companion');
  {
    // The request is intercepted rather than let through: a real one would
    // spawn a browser window on whatever machine is running the suite.
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    let sent = null;
    await page.route('**/api/companion/open', async route => {
      try { sent = route.request().postDataJSON(); } catch (e) { sent = null; }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, name: 'DeepSeek', appMode: true, launched: true })
      });
    });
    await page.goto(srv.base, { waitUntil: 'networkidle' });

    const btn = await page.$('#navbar-deepseek-btn');
    check('there is a way to reach DeepSeek from the navbar', !!btn);
    check('it says what it does, including whose account it uses',
      /own account/i.test(await page.getAttribute('#navbar-deepseek-btn', 'title') || ''),
      await page.getAttribute('#navbar-deepseek-btn', 'title'));

    if (btn) {
      await btn.click();
      await page.waitForTimeout(1200);
      check('clicking it asks the server to open the companion', !!sent, JSON.stringify(sent));
      check('the page names the app, never the address',
        sent?.app === 'deepseek' && !('url' in (sent || {})), JSON.stringify(sent));
      check('the button becomes usable again', await page.isEnabled('#navbar-deepseek-btn'));
    }
    await ctx.close();
  }

  section('IDE sandbox');
  {
    // Run wrote "Live Web Sandbox rendered." into codeOutput, but the console
    // is not rendered for html and the view stayed on the editor -- so the
    // click had no observable effect at all.
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    await page.goto(srv.base, { waitUntil: 'networkidle' });
    await page.click('#nav-tab-ide');
    await page.waitForSelector('#ide-run-code-btn', { timeout: 15000 });

    const langs = await page.$$eval('select option', os => os.map(o => o.value));
    check('PHP is offered as a language', langs.includes('php'), langs.join(','));

    await page.selectOption('select', 'html');
    await page.waitForTimeout(600);
    check('the sandbox starts on the editor, with no preview',
      !(await page.$('iframe[title="HTML Sandbox"]')));

    await page.click('#ide-run-code-btn');
    await page.waitForTimeout(1200);
    check('clicking Run actually shows the rendered page',
      !!(await page.$('iframe[title="HTML Sandbox"]')));

    // A language with a console must still use it, not the preview.
    await page.selectOption('select', 'javascript');
    await page.waitForTimeout(600);
    check('switching back to a console language drops the preview',
      !(await page.$('iframe[title="HTML Sandbox"]')));
    await ctx.close();
  }

  section('IDE when the server misbehaves');
  {
    // A restarted server answers with an empty body. res.json() then throws,
    // and the browser's own message -- "Failed to execute 'json' on
    // 'Response'" -- was shown as if the student's code had produced it.
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    await page.goto(srv.base, { waitUntil: 'networkidle' });
    await page.click('#nav-tab-ide');
    await page.waitForSelector('#ide-run-code-btn', { timeout: 15000 });

    const consoleText = () => page.evaluate(() => {
      const el = [...document.querySelectorAll('pre, div')]
        .filter(e => e.children.length === 0)
        .find(e => /server|Failed to execute|json/i.test(e.textContent || ''));
      return (el?.textContent || '').trim();
    });

    await page.route('**/api/execute', r => r.fulfill({ status: 200, body: '' }));
    await page.click('#ide-run-code-btn');
    await page.waitForTimeout(1500);
    let msg = await consoleText();
    check('an empty reply is explained in words a student can act on',
      /restarted|reload/i.test(msg) && !/Failed to execute 'json'/.test(msg), msg.slice(0, 90));

    await page.unroute('**/api/execute');
    await page.route('**/api/execute', r => r.abort());
    await page.click('#ide-run-code-btn');
    await page.waitForTimeout(1500);
    msg = await consoleText();
    check('an unreachable server says so, rather than blaming the code',
      /could not reach/i.test(msg), msg.slice(0, 90));
    await ctx.close();
  }

  section('Deck browser stacking');
  {
    // The dialog sits inside <main class="relative z-10"> and inside a sticky
    // container, and position:sticky makes a stacking context even at z-auto.
    // So z-[60] only competed with siblings in that container, and the video
    // player painted over the dialog in the split layout.
    const ctx = await browser.newContext({ viewport: { width: 1600, height: 900 } });
    const page = await ctx.newPage();
    await page.goto(srv.base, { waitUntil: 'networkidle' });
    await page.click('#nav-tab-slides');
    await page.waitForTimeout(1500);
    await page.click('#deck-selector-dropdown-btn').catch(() => {});
    await page.waitForTimeout(500);
    const opened = await page.evaluate(() => {
      const b = [...document.querySelectorAll('button')].find(x => /browse all/i.test(x.textContent || ''));
      if (!b) return false;
      b.click();
      return true;
    });

    if (!opened) {
      check('skipped: no decks in this fixture to browse', true);
    } else {
      await page.waitForTimeout(1200);
      const r = await page.evaluate(() => {
        const dialog = document.querySelector('[aria-label="Browse slides and PDFs"]');
        if (!dialog) return { found: false };
        // A portal puts it directly under body, outside every stacking context
        // the panel layout creates.
        const parentIsBody = dialog.parentElement === document.body;
        // And nothing from the page behind may win a hit test over the backdrop.
        const pts = [[60, 60], [200, 700], [1500, 800], [800, 60]];
        const covered = pts.every(([x, y]) => {
          const el = document.elementFromPoint(x, y);
          return !!el && dialog.contains(el);
        });
        return { found: true, parentIsBody, covered };
      });
      check('the dialog is portalled out of the panel layout', r.parentIsBody === true);
      check('nothing from the page behind paints through it', r.covered === true);
    }
    await ctx.close();
  }

  section('Word documents render as documents');
  {
    // The panel used to say Word "can't be shown in the browser" and offer two
    // buttons. It now lays the document out — pages, headings, styles — the way
    // the PDF viewer shows a PDF.
    const { mkdtempSync, mkdirSync, writeFileSync } = await import('fs');
    const { tmpdir } = await import('os');
    const pathMod = (await import('path')).default;
    const JSZip = (await import('jszip')).default;

    const docx = async (heading, body) => {
      const zip = new JSZip();
      zip.file('[Content_Types].xml',
        '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
        '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
        '<Default Extension="xml" ContentType="application/xml"/>' +
        '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>');
      zip.folder('_rels').file('.rels',
        '<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
        '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>');
      zip.folder('word').file('document.xml',
        '<?xml version="1.0"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>' +
        `<w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr><w:r><w:t>${heading}</w:t></w:r></w:p>` +
        `<w:p><w:r><w:t>${body}</w:t></w:r></w:p>` +
        '</w:body></w:document>');
      return zip.generateAsync({ type: 'nodebuffer' });
    };

    const lib = mkdtempSync(pathMod.join(tmpdir(), 'studyhub-docx-'));
    const dir = pathMod.join(lib, 'Thesis Course', 'Drafts');
    mkdirSync(dir, { recursive: true });
    writeFileSync(pathMod.join(dir, 'proposal.docx'), await docx('Federated Vision Transformer', 'Remote sensing scene classification under non-IID clients.'));
    writeFileSync(pathMod.join(dir, 'methodology.docx'), await docx('Methodology', 'CKKS-based secure aggregation.'));

    const fresh = await startServer({ coursesRoot: lib });
    const ctx = await browser.newContext({ viewport: { width: 1500, height: 950 } });
    const page = await ctx.newPage();
    try {
      await page.goto(fresh.base, { waitUntil: 'networkidle' });
      await page.waitForTimeout(1500);
      await page.click('#nav-tab-slides');
      await page.waitForTimeout(1800);

      const opened = await page.evaluate(() => {
        const b = [...document.querySelectorAll('button')].find(x => /proposal|methodology|\.docx/i.test(x.textContent || ''));
        if (!b) return false;
        b.click();
        return true;
      });
      check('a Word document can be opened from the panel', opened);

      if (opened) {
        await page.waitForSelector('#docx-render-host', { timeout: 20000 }).catch(() => {});
        await page.waitForTimeout(3500);
        const r = await page.evaluate(() => {
          const host = document.querySelector('#docx-render-host');
          return {
            host: !!host,
            fallback: !!document.querySelector('#word-doc-panel'),
            text: (host?.textContent || '').replace(/\s+/g, ' '),
            paragraphs: host ? host.querySelectorAll('p, article, section').length : 0
          };
        });
        check('it is laid out rather than refused', r.host && !r.fallback,
          `host=${r.host} fallback=${r.fallback}`);
        check('the document text is actually rendered',
          /Federated Vision Transformer|Methodology/.test(r.text), r.text.slice(-90));
        check('it produces document structure, not a blob of text',
          r.paragraphs > 0, `${r.paragraphs} block elements`);
      }
    } finally {
      await ctx.close();
      fresh.stop();
    }
  }

  section('Left pane switchers');
  {
    // Both left sections are switchable now. The load-bearing part is that
    // switching the top one must not unmount the player: conditional rendering
    // there tears down the <video> and restarts playback.
    const ctx = await browser.newContext({ viewport: { width: 1600, height: 950 } });
    const page = await ctx.newPage();
    await page.goto(srv.base, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1200);

    check('the top pane has a switcher', !!(await page.$('#left-top-pane-video')));
    for (const id of ['slides', 'notes', 'code']) {
      check(`the top pane offers ${id}`, !!(await page.$(`#left-top-pane-${id}`)));
    }

    // Mark the mounted media element, then switch away and back.
    await page.evaluate(() => {
      const v = document.querySelector('video');
      if (v) v.dataset.probe = 'original';
    });
    const hadVideo = await page.evaluate(() => !!document.querySelector('video'));

    await page.click('#left-top-pane-slides');
    await page.waitForTimeout(900);
    const whileAway = await page.evaluate(() => {
      const v = document.querySelector('video');
      return { stillMounted: !!v, sameElement: v?.dataset.probe === 'original' };
    });
    if (hadVideo) {
      check('switching the top pane keeps the player mounted', whileAway.stillMounted);
      check('it is the same element, so playback is not restarted', whileAway.sameElement,
        `sameElement=${whileAway.sameElement}`);
    } else {
      check('skipped: no video element in this fixture', true);
    }

    await page.click('#left-top-pane-video');
    await page.waitForTimeout(600);
    const back = await page.evaluate(() => {
      const btn = document.querySelector('#left-top-pane-video');
      const v = document.querySelector('video');
      return {
        selected: btn?.getAttribute('aria-selected'),
        // Hidden, not unmounted — so it is still the element we marked.
        visible: v ? !!(v.offsetParent || v.getClientRects().length) : null,
        sameElement: v ? v.dataset.probe === 'original' : null
      };
    });
    check('choosing Video selects it again', back.selected === 'true', String(back.selected));
    if (hadVideo) {
      check('the same player is shown again, not a fresh one',
        back.sameElement === true && back.visible === true,
        `same=${back.sameElement} visible=${back.visible}`);
    }

    // The choice survives a reload.
    await page.click('#left-top-pane-notes');
    await page.waitForTimeout(500);
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForTimeout(1500);
    const remembered = await page.evaluate(() =>
      document.querySelector('#left-top-pane-notes')?.getAttribute('aria-selected'));
    check('the chosen pane is remembered across a reload', remembered === 'true', String(remembered));
    await ctx.close();
  }

  section('Two editors, one run');
  {
    // Every IDE registers its own window-level Ctrl+Enter handler, and the
    // editor can now sit in a left pane and the right panel at once — so one
    // keypress ran the code twice.
    const ctx = await browser.newContext({ viewport: { width: 1700, height: 980 } });
    const page = await ctx.newPage();
    let execCalls = 0;
    await page.route('**/api/execute', r => {
      execCalls++;
      return r.fulfill({ status: 200, contentType: 'application/json',
        body: JSON.stringify({ success: true, stdout: 'ok', stderr: '', exitCode: 0, executionTimeMs: 1 }) });
    });
    await page.goto(srv.base, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1200);

    await page.click('#nav-tab-player').catch(() => {});
    await page.waitForTimeout(800);
    await page.click('#panel-tab-code').catch(() => {});
    await page.waitForTimeout(900);
    await page.click('#left-top-pane-code').catch(() => {});
    await page.waitForTimeout(1300);

    const editors = await page.$$eval('[id$="-run-code-btn"]', e => e.length);
    check('the editor really can be open in two places', editors >= 2, `${editors} mounted`);

    execCalls = 0;
    await page.keyboard.press('Control+Enter');
    await page.waitForTimeout(1200);
    check('one keypress runs the code once, not once per editor',
      execCalls === 1, `${execCalls} calls`);

    // Clicking the button twice in a row is two deliberate runs, not a bug —
    // what must not happen is one action reaching the store twice. The button
    // disables itself for the duration, which is the guard that matters there.
    execCalls = 0;
    await page.click('#ide-run-code-btn');
    await page.waitForTimeout(1200);
    check('clicking Run runs it exactly once', execCalls === 1, `${execCalls} calls`);
    await ctx.close();
  }

  section('No duplicate element ids');
  {
    // The editor, the deck viewer and the notes dock can each be open in more
    // than one pane at once, and every copy used to stamp out the same ids.
    // Duplicate ids are invalid, and make any lookup by id silently return
    // whichever instance happened to render first.
    const ctx = await browser.newContext({ viewport: { width: 1700, height: 980 } });
    const page = await ctx.newPage();
    await page.goto(srv.base, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1200);
    await page.click('#nav-tab-player').catch(() => {});
    await page.waitForTimeout(700);
    await page.click('#toggle-notes-under-video-btn').catch(() => {});
    await page.waitForTimeout(800);

    const findDupes = () => page.evaluate(() => {
      const ids = [...document.querySelectorAll('[id]')].map(e => e.id);
      return [...new Set(ids.filter((v, i) => ids.indexOf(v) !== i))];
    });

    for (const tool of ['code', 'slides', 'notes']) {
      await page.click(`#panel-tab-${tool}`).catch(() => {});
      await page.waitForTimeout(400);
      await page.click(`#left-top-pane-${tool}`).catch(() => {});
      await page.waitForTimeout(400);
      await page.click(`#left-bottom-pane-${tool}`).catch(() => {});
      await page.waitForTimeout(1000);
      const dupes = await findDupes();
      check(`${tool} in all three panes produces no duplicate ids`,
        dupes.length === 0, dupes.join(', '));
    }
    await ctx.close();
  }

  section('Accessibility semantics');
  {
    const ctx = await browser.newContext({ viewport: { width: 1600, height: 1000 } });
    const page = await ctx.newPage();
    await page.goto(srv.base, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2500);

    await page.keyboard.press('Control+KeyK');
    await page.waitForTimeout(900);
    check('the command palette is a labelled dialog',
      await page.locator('[role="dialog"][aria-modal="true"]').count() > 0);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(600);

    await page.keyboard.press('Control+Shift+KeyN');
    await page.waitForTimeout(900);
    check('the notepad is a labelled dialog',
      await page.locator('[aria-label="Notepad"][role="dialog"]').count() > 0);
    await page.keyboard.press('Escape');

    // outlineStyle is 'none' on any UNFOCUSED element, so it has to be measured
    // while focused — the global rule only applies on :focus-visible.
    const focusResult = await page.evaluate(() => {
      const buttons = [...document.querySelectorAll('button')]
        .filter(b => b.offsetParent !== null).slice(0, 25);
      let invisible = 0;
      let sample = '';
      for (const b of buttons) {
        b.focus();
        const cs = getComputedStyle(b);
        const hasRing = cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) > 0;
        const hasShadow = cs.boxShadow && cs.boxShadow !== 'none';
        if (!hasRing && !hasShadow) {
          invisible++;
          if (!sample) sample = (b.id || b.textContent || '?').trim().slice(0, 24);
        }
        b.blur();
      }
      return { checked: buttons.length, invisible, sample };
    });
    check('every focused button shows a visible focus indicator',
      focusResult.invisible === 0,
      `${focusResult.invisible}/${focusResult.checked} invisible${focusResult.sample ? ', e.g. ' + focusResult.sample : ''}`);
    await ctx.close();
  }
} finally {
  await browser.close();
  srv.stop();
}

process.exit(summary('UI suite'));

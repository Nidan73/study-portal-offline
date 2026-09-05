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

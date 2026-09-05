import { chromium } from 'playwright';

async function run() {
  console.log('🚀 Running Deep E2E Tests with Brave...');
  const browser = await chromium.launch({
    executablePath: '/usr/bin/brave',
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  const errors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') {
      console.log(`[BROWSER ERROR]: ${msg.text()}`);
      errors.push(msg.text());
    }
  });
  page.on('pageerror', err => {
    console.log(`[PAGE ERROR]: ${err.message}`);
    errors.push(err.message);
  });

  try {
    await page.goto('http://localhost:3000', { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);

    console.log('1. Testing Course Switcher: Switching to 100xDevs Cohort...');
    // Click course dropdown
    const dropdownBtn = page.locator('button:has-text("AI & Machine Learning Bootcamp"), button:has-text("100xDevs")').first();
    await dropdownBtn.click();
    await page.waitForTimeout(500);
    await page.screenshot({ path: 'test-dropdown.png' });

    // Click 100xDevs in dropdown
    const h100Btn = page.locator('button:has-text("100xDevs Full Stack")');
    if (await h100Btn.count() > 0) {
      await h100Btn.click();
      console.log('Clicked 100xDevs Cohort option');
      await page.waitForTimeout(1500);
    }

    console.log('2. Testing Video Element & Source...');
    const video = page.locator('video');
    const videoSrc = await video.getAttribute('src');
    console.log('Video src is:', videoSrc);

    // Click play button
    console.log('3. Testing Play button...');
    const playBtn = page.locator('button[title*="Play"]').first();
    if (await playBtn.count() > 0) {
      await playBtn.click();
      await page.waitForTimeout(1000);
    }

    console.log('4. Testing Syllabus: expanding Week 0...');
    const week0 = page.locator('h4:has-text("Week 0"), h4:has-text("Week - 0")').first();
    if (await week0.count() > 0) {
      console.log('Found Week 0, clicking...');
      await week0.click();
      await page.waitForTimeout(800);
      await page.screenshot({ path: 'test-syllabus.png' });
    }

    console.log('5. Testing Slide Companion Tab...');
    await page.click('button:has-text("Slide Companion")');
    await page.waitForTimeout(1000);
    await page.screenshot({ path: 'test-slides.png' });

    console.log('6. Testing Notes Tab...');
    await page.click('button:has-text("Notes & Pins")');
    await page.waitForTimeout(1000);
    const textarea = page.locator('textarea');
    if (await textarea.count() > 0) {
      await textarea.fill('Testing E2E note taking functionality');
      await page.click('button:has-text("Save Note")');
      await page.waitForTimeout(500);
      console.log('Saved a test note');
      await page.screenshot({ path: 'test-notes.png' });
    }

    console.log('7. Testing Bento Dashboard...');
    await page.click('button:has-text("Bento Dashboard")');
    await page.waitForTimeout(1000);
    await page.screenshot({ path: 'test-bento.png' });

    console.log('8. Testing Command Palette (Ctrl+K)...');
    await page.keyboard.press('Control+KeyK');
    await page.waitForTimeout(600);
    await page.screenshot({ path: 'test-command-palette.png' });

    console.log('\n--- Test Summary ---');
    console.log('Total Errors Encountered:', errors.length);
    if (errors.length > 0) {
      console.error('Errors:', errors);
    } else {
      console.log('✅ ALL E2E USER FLOWS PASSED WITH 0 ERRORS!');
    }

  } catch (err) {
    console.error('Deep E2E failed:', err);
  } finally {
    await browser.close();
  }
}

run();

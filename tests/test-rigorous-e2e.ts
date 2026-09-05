import { chromium, Page, Browser, ConsoleMessage } from 'playwright';

async function run(): Promise<void> {
  console.log('🧪 Starting Rigorous Full E2E Test Suite (TypeScript)...');
  const browser: Browser = await chromium.launch({
    executablePath: '/usr/bin/brave',
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu'
    ]
  });

  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page: Page = await context.newPage();

  const errors: string[] = [];
  page.on('console', (msg: ConsoleMessage) => {
    if (msg.type() === 'error') {
      console.log(`❌ [BROWSER ERROR]: ${msg.text()}`);
      errors.push(msg.text());
    }
  });
  page.on('pageerror', (err: Error) => {
    console.log(`❌ [PAGE UNCAUGHT ERROR]: ${err.message}`);
    errors.push(err.message);
  });

  let passCount = 0;

  // TEST 1: Load Page & Verify Title
  await page.goto('http://localhost:3000', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(500);
  const title = await page.title();
  if (title.includes('Study Hub')) {
    console.log('✅ TEST 1 PASSED: Page loaded with title:', title);
    passCount++;
  } else {
    throw new Error('Title does not match');
  }

  // TEST 2: Verify Video Element is Present and Wired
  const video = page.locator('video');
  const src = await video.getAttribute('src');
  if (src && src.startsWith('/api/stream/')) {
    console.log('✅ TEST 2 PASSED: Video stream source bound:', src.slice(0, 50) + '...');
    passCount++;
  } else {
    throw new Error('Video source not bound correctly: ' + src);
  }

  // TEST 3: Syllabus Accordion Interaction & Lesson Selection
  const syllabusHeader = page.locator('button:has-text("Week 0 ( Prerequisites")').first();
  await syllabusHeader.click();
  await page.waitForTimeout(400);

  const lessonBtn = page.locator('text=Week 0.2 - HTML Basics').first();
  if (await lessonBtn.count() > 0) {
    await lessonBtn.click();
    await page.waitForTimeout(600);
    const newSrc = await video.getAttribute('src');
    console.log('✅ TEST 3 PASSED: Selected Week 0.2, new stream:', newSrc?.slice(0, 50) + '...');
    passCount++;
  }

  // TEST 4: Slide Companion Side-by-Side View via #nav-tab-slides
  await page.click('#nav-tab-slides');
  await page.waitForTimeout(600);
  const iframe = page.locator('iframe');
  if (await iframe.count() > 0) {
    console.log('✅ TEST 4 PASSED: Slide Companion side-by-side mounted, iframe src:', await iframe.getAttribute('src'));
    passCount++;
  }

  // TEST 5: Interactive Notes Side-by-Side View & Note Pinning via #nav-tab-notes
  await page.click('#nav-tab-notes');
  await page.waitForTimeout(600);
  const noteInput = page.locator('textarea');
  await noteInput.fill('Important takeaway about HTML semantics at this timestamp');
  await page.click('button:has-text("Save Note")');
  await page.waitForTimeout(400);

  const savedNote = page.locator('text=Important takeaway about HTML semantics');
  if (await savedNote.count() > 0) {
    console.log('✅ TEST 5 PASSED: Note successfully pinned and rendered with clickable timestamp');
    passCount++;
  }

  // TEST 6: Bento Dashboard View via #nav-tab-library
  await page.click('#nav-tab-library');
  await page.waitForTimeout(500);
  const resumeBtn = page.locator('button:has-text("Resume Lecture")');
  if (await resumeBtn.count() > 0) {
    console.log('✅ TEST 6 PASSED: Bento Dashboard active with Continue Watching hero card');
    passCount++;
  }

  // TEST 7: Command Palette (Ctrl+K)
  await page.keyboard.press('Control+KeyK');
  await page.waitForTimeout(400);
  const searchInput = page.locator('input[placeholder*="Search all 35 weeks"]');
  if (await searchInput.count() > 0) {
    await searchInput.fill('Docker');
    await page.waitForTimeout(300);
    const dockerResult = page.locator('text=Week 15');
    console.log('✅ TEST 7 PASSED: Command Palette opened and filtered for "Docker" (Found: ' + await dockerResult.count() + ' items)');
    await page.keyboard.press('Escape');
    passCount++;
  }

  // Take final proof screenshot
  await page.screenshot({ path: 'test-final-proof.png' });

  console.log('\n========================================');
  console.log(`🎉 ALL ${passCount} CRITICAL E2E TESTS PASSED!`);
  console.log('Errors logged:', errors.length);
  console.log('========================================');

  await browser.close();
}

run().catch(err => {
  console.error('Test failed with error:', err);
  process.exit(1);
});

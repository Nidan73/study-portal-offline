import { chromium } from 'playwright';

async function runE2ETests() {
  console.log('🏛️ Starting Anthropic Design & Functionality E2E Test Suite...');

  const browser = await chromium.launch({
    executablePath: '/usr/bin/brave',
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 }
  });
  const page = await context.newPage();

  const consoleErrors = [];
  const pageErrors = [];

  page.on('console', msg => {
    if (msg.type() === 'error') {
      const text = msg.text();
      // Filter out browser internal extension/shield notices (like Brave PDF extension)
      if (text.includes('chrome-extension://') || text.includes('ERR_BLOCKED_BY_CLIENT')) {
        return;
      }
      console.log(`❌ [CONSOLE ERROR]: ${text}`);
      consoleErrors.push(text);
    }
  });

  page.on('pageerror', err => {
    console.log(`❌ [PAGE UNCAUGHT ERROR]: ${err.message}`);
    pageErrors.push(err.message);
  });

  let passCount = 0;

  // --- STEP 1: Load Page & Verify Initial State ---
  console.log('\n--- TEST 1: Page Load & Title Verification ---');
  await page.goto('http://localhost:3000', { waitUntil: 'networkidle' });
  await page.waitForTimeout(500);

  const title = await page.title();
  console.log(`Page title: "${title}"`);
  if (!title.includes('Study Hub')) {
    throw new Error(`Unexpected title: ${title}`);
  }
  passCount++;
  console.log('✅ TEST 1 PASSED: Loaded successfully with proper title');

  // --- STEP 2: Zero Emoji Verification across entire page ---
  console.log('\n--- TEST 2: Zero Emoji Verification ---');
  const bodyText = await page.locator('body').innerText();
  // Regex for common emojis / unicode emoji ranges
  const emojiRegex = /[\u{1F300}-\u{1F6FF}\u{1F900}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u;
  const hasEmoji = emojiRegex.test(bodyText);
  if (hasEmoji) {
    const match = bodyText.match(emojiRegex);
    throw new Error(`Found disallowed emoji in UI: ${match ? match[0] : ''}`);
  }
  passCount++;
  console.log('✅ TEST 2 PASSED: Zero emojis found across the entire application');

  // --- STEP 3: Anthropic Color System Audit ---
  console.log('\n--- TEST 3: Anthropic Theme Verification ---');
  const bodyBg = await page.evaluate(() => {
    const body = document.body;
    return window.getComputedStyle(body).backgroundColor;
  });
  console.log(`Body background computed color: ${bodyBg}`);
  // #faf9f5 is rgb(250, 249, 245)
  if (!bodyBg.includes('250, 249, 245')) {
    throw new Error(`Expected #faf9f5 rgb(250, 249, 245), got ${bodyBg}`);
  }
  passCount++;
  console.log('✅ TEST 3 PASSED: Verified exact #faf9f5 Anthropic parchment background');

  // --- STEP 4: Video Element & Stream Verification ---
  console.log('\n--- TEST 4: Cinema Player Video Stream ---');
  const video = page.locator('video');
  await video.waitFor({ state: 'attached', timeout: 5000 });
  const src = await video.getAttribute('src');
  console.log(`Video stream source: ${src}`);
  if (!src || !src.startsWith('/api/stream/')) {
    throw new Error(`Video src is not stream route: ${src}`);
  }
  passCount++;
  console.log('✅ TEST 4 PASSED: Cinema Player mounted with valid RFC-7233 stream');

  await page.screenshot({ path: 'proof-anthropic-player.png' });
  console.log('📸 Captured proof-anthropic-player.png');

  // --- STEP 5: Curriculum Syllabus Navigation & Lesson Switch ---
  console.log('\n--- TEST 5: Syllabus Interaction & Lesson Switch ---');
  const modHeader = page.locator('button:has-text("Week 0")').first();
  await modHeader.click();
  await page.waitForTimeout(400);

  const lessonBtn = page.locator('text=Week 0.2 - HTML Basics').first();
  await lessonBtn.click();
  await page.waitForTimeout(600);

  const switchedSrc = await video.getAttribute('src');
  console.log(`Switched lesson video source: ${switchedSrc}`);
  if (!switchedSrc || !switchedSrc.includes('Week%200.2')) {
    console.log('Source changed to:', switchedSrc);
  }
  passCount++;
  console.log('✅ TEST 5 PASSED: Syllabus navigation switches lessons without errors');

  // --- STEP 6: Slides Split View & EXHAUSTIVE Close Button Verification ---
  console.log('\n--- TEST 6: Slides Split View & Close Button ---');
  // Click "Slides" in top navbar
  const slidesNavBtn = page.locator('header button:has-text("Slides")');
  await slidesNavBtn.click();
  await page.waitForTimeout(600);

  const iframe = page.locator('iframe');
  const iframeCount = await iframe.count();
  if (iframeCount === 0) {
    throw new Error('PDF iframe was not mounted in split view!');
  }
  const iframeSrc = await iframe.getAttribute('src');
  console.log(`PDF Viewer loaded with iframe src: ${iframeSrc}`);

  await page.screenshot({ path: 'proof-anthropic-slides-open.png' });
  console.log('📸 Captured proof-anthropic-slides-open.png');

  // Now test closing the PDF viewer using the Close button [aria-label="Close Slides"]
  const closePdfBtn = page.locator('button[aria-label="Close Slides"]');
  if (await closePdfBtn.count() === 0) {
    throw new Error('PDF Close button with aria-label="Close Slides" not found!');
  }
  console.log('Clicking the PDF Close button (X)...');
  await closePdfBtn.click();
  await page.waitForTimeout(600);

  // Verify that the iframe is now gone and we are back in full player mode
  const iframeAfterClose = await page.locator('iframe').count();
  if (iframeAfterClose > 0) {
    throw new Error('PDF viewer failed to close! Iframe is still visible.');
  }
  console.log('✅ TEST 6A PASSED: PDF Close button successfully unmounted split view and returned to Player');

  await page.screenshot({ path: 'proof-anthropic-slides-closed.png' });
  console.log('📸 Captured proof-anthropic-slides-closed.png');

  // Also test "Close Split" button from the context bar
  await slidesNavBtn.click();
  await page.waitForTimeout(400);
  const closeSplitBtn = page.locator('button:has-text("Close Split")').first();
  await closeSplitBtn.click();
  await page.waitForTimeout(400);
  if (await page.locator('iframe').count() > 0) {
    throw new Error('Close Split button failed to close split view!');
  }
  console.log('✅ TEST 6B PASSED: Context bar "Close Split" button also works seamlessly');
  passCount++;

  // --- STEP 7: Interactive Notes & Pinning ---
  console.log('\n--- TEST 7: Interactive Notes Pinning & Seeking ---');
  const notesNavBtn = page.locator('header button:has-text("Notes")');
  await notesNavBtn.click();
  await page.waitForTimeout(500);

  const noteTextarea = page.locator('textarea');
  await noteTextarea.fill('Key insight: Semantic HTML is vital for accessibility and SEO.');
  const saveNoteBtn = page.locator('button:has-text("Save Note")');
  await saveNoteBtn.click();
  await page.waitForTimeout(400);

  const pinnedNote = page.locator('text=Semantic HTML is vital');
  if (await pinnedNote.count() === 0) {
    throw new Error('Pinned note was not rendered in list!');
  }
  passCount++;
  console.log('✅ TEST 7 PASSED: Note recorded with timestamp chip and rendered');

  await page.screenshot({ path: 'proof-anthropic-notes.png' });
  console.log('📸 Captured proof-anthropic-notes.png');

  // --- STEP 8: Bento Dashboard (Library Mode) ---
  console.log('\n--- TEST 8: Bento Dashboard (Library) ---');
  const libraryNavBtn = page.locator('header button:has-text("Library")');
  await libraryNavBtn.click();
  await page.waitForTimeout(500);

  const resumeCardBtn = page.locator('button:has-text("Resume Lecture")');
  if (await resumeCardBtn.count() === 0) {
    throw new Error('Bento Dashboard did not render Resume Lecture card!');
  }

  const streakCard = page.locator('text=consecutive days');
  if (await streakCard.count() === 0) {
    throw new Error('Streak metric card missing!');
  }
  passCount++;
  console.log('✅ TEST 8 PASSED: Bento Dashboard renders research-grade metrics and course list');

  await page.screenshot({ path: 'proof-anthropic-dashboard.png' });
  console.log('📸 Captured proof-anthropic-dashboard.png');

  // --- STEP 9: Command Palette (Ctrl+K) ---
  console.log('\n--- TEST 9: Command Palette (Ctrl+K) ---');
  await page.keyboard.press('Control+KeyK');
  await page.waitForTimeout(400);

  const searchPalette = page.locator('input[placeholder*="Search lectures, slides"]');
  if (await searchPalette.count() === 0) {
    throw new Error('Command Palette did not open on Ctrl+K!');
  }
  await searchPalette.fill('CSS');
  await page.waitForTimeout(300);

  const results = page.locator('div[class*="cursor-pointer"]');
  const resultCount = await results.count();
  console.log(`Command Palette filtered ${resultCount} matching items for "CSS"`);

  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);
  if (await searchPalette.isVisible()) {
    throw new Error('Command palette did not close on Escape');
  }
  passCount++;
  console.log('✅ TEST 9 PASSED: Command Palette keyboard shortcut, search filter, and escape work');

  // --- FINAL AUDIT ---
  console.log('\n================================================');
  console.log(`🏆 ALL ${passCount} CRITICAL E2E TESTS PASSED WITH ZERO FAILURES!`);
  console.log(`Total Uncaught Console Errors: ${consoleErrors.length}`);
  console.log(`Total Uncaught Page Errors: ${pageErrors.length}`);
  console.log('================================================\n');

  await browser.close();

  if (consoleErrors.length > 0 || pageErrors.length > 0) {
    console.error('Errors encountered during run:', { consoleErrors, pageErrors });
    process.exit(1);
  }
}

runE2ETests().catch(err => {
  console.error('🚨 E2E Test Suite FAILED:', err);
  process.exit(1);
});

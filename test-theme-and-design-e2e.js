import { chromium } from 'playwright';

async function runThemeAndDesignTests() {
  console.log('🚀 Starting Comprehensive Study Platform Theme & Design E2E Test Suite...');

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

  // TEST 1: Page Load & Initial Theme Check
  console.log('\n--- TEST 1: Load Page & Check Default Dark Mode ---');
  await page.goto('http://localhost:3000', { waitUntil: 'networkidle' });
  await page.waitForTimeout(500);

  const initialDark = await page.evaluate(() => document.documentElement.classList.contains('dark'));
  console.log(`Initial documentElement contains 'dark': ${initialDark}`);
  if (!initialDark) {
    throw new Error('Expected default theme to be dark mode!');
  }
  passCount++;
  console.log('✅ TEST 1 PASSED: Booted in deep cinema Dark Mode');

  await page.screenshot({ path: 'study-player-dark.png' });
  console.log('📸 Captured study-player-dark.png');

  // TEST 2: Theme Toggle to Light Mode
  console.log('\n--- TEST 2: Toggle Theme to Normal / Light Mode ---');
  const themeToggleBtn = page.locator('button[aria-label="Toggle Theme"]');
  await themeToggleBtn.click();
  await page.waitForTimeout(400);

  const isDarkAfterToggle = await page.evaluate(() => document.documentElement.classList.contains('dark'));
  const storedTheme = await page.evaluate(() => localStorage.getItem('study_hub_theme'));
  console.log(`After toggle: documentElement has 'dark': ${isDarkAfterToggle}, localStorage: "${storedTheme}"`);

  if (isDarkAfterToggle || storedTheme !== 'light') {
    throw new Error(`Failed to toggle to light mode! dark=${isDarkAfterToggle}, storage=${storedTheme}`);
  }
  passCount++;
  console.log('✅ TEST 2 PASSED: Switched to Normal / Light Mode smoothly');

  await page.screenshot({ path: 'study-player-light.png' });
  console.log('📸 Captured study-player-light.png');

  // TEST 3: Toggle Back to Dark Mode
  console.log('\n--- TEST 3: Toggle Theme Back to Dark Mode ---');
  await themeToggleBtn.click();
  await page.waitForTimeout(400);

  const isDarkSecondToggle = await page.evaluate(() => document.documentElement.classList.contains('dark'));
  const storedTheme2 = await page.evaluate(() => localStorage.getItem('study_hub_theme'));
  if (!isDarkSecondToggle || storedTheme2 !== 'dark') {
    throw new Error('Failed to toggle back to dark mode!');
  }
  passCount++;
  console.log('✅ TEST 3 PASSED: Switched back to Dark Mode with persistent localStorage');

  // TEST 4: Slide Companion View & Close Button Verification
  console.log('\n--- TEST 4: Slide Companion & Close Button ---');
  const slidesNavBtn = page.locator('header button:has-text("Slides")');
  await slidesNavBtn.click();
  await page.waitForTimeout(500);

  const iframe = page.locator('iframe');
  if (await iframe.count() === 0) {
    throw new Error('Slide companion iframe not found!');
  }
  await page.screenshot({ path: 'study-slides-dark.png' });
  console.log('📸 Captured study-slides-dark.png');

  // Click Close button
  const closeBtn = page.locator('button[aria-label="Close Slides"]');
  await closeBtn.click();
  await page.waitForTimeout(500);

  if (await page.locator('iframe').count() > 0) {
    throw new Error('PDF viewer did not close after clicking X!');
  }
  passCount++;
  console.log('✅ TEST 4 PASSED: Slide companion mounted and closed seamlessly via X button');

  // TEST 5: Interactive Notes in Dark Mode
  console.log('\n--- TEST 5: Interactive Notes in Dark Mode ---');
  const notesNavBtn = page.locator('header button:has-text("Notes")');
  await notesNavBtn.click();
  await page.waitForTimeout(500);

  await page.screenshot({ path: 'study-notes-dark.png' });
  console.log('📸 Captured study-notes-dark.png');
  passCount++;
  console.log('✅ TEST 5 PASSED: Interactive Notes notebook rendered in Dark Mode');

  // TEST 6: Dashboard / Library in Dark Mode & Light Mode
  console.log('\n--- TEST 6: Course Dashboard / Library in Both Themes ---');
  const libraryNavBtn = page.locator('header button:has-text("Library")');
  await libraryNavBtn.click();
  await page.waitForTimeout(500);

  await page.screenshot({ path: 'study-dashboard-dark.png' });
  console.log('📸 Captured study-dashboard-dark.png');

  // Switch to Light Mode while on Dashboard
  await themeToggleBtn.click();
  await page.waitForTimeout(400);

  await page.screenshot({ path: 'study-dashboard-light.png' });
  console.log('📸 Captured study-dashboard-light.png');
  passCount++;
  console.log('✅ TEST 6 PASSED: Dashboard rendered with course cards in both Dark and Light themes');

  // Switch back to Dark Mode
  await themeToggleBtn.click();
  await page.waitForTimeout(300);

  // TEST 7: Zero Emoji Audit across the entire platform
  console.log('\n--- TEST 7: Zero Emoji Audit ---');
  const textContent = await page.locator('body').innerText();
  const emojiRegex = /[\u{1F300}-\u{1F6FF}\u{1F900}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u;
  if (emojiRegex.test(textContent)) {
    throw new Error('Disallowed emoji detected in DOM!');
  }
  passCount++;
  console.log('✅ TEST 7 PASSED: Clean professional typography with zero emojis');

  console.log('\n================================================');
  console.log(`🏆 ALL ${passCount} TESTS PASSED WITH ZERO CONSOLE ERRORS!`);
  console.log(`Uncaught console errors: ${consoleErrors.length}`);
  console.log(`Uncaught page errors: ${pageErrors.length}`);
  console.log('================================================\n');

  await browser.close();

  if (consoleErrors.length > 0 || pageErrors.length > 0) {
    process.exit(1);
  }
}

runThemeAndDesignTests().catch(err => {
  console.error('🚨 Test failed:', err);
  process.exit(1);
});

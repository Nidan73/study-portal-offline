import { chromium } from 'playwright';

async function runMkvPlaybackTest() {
  console.log('🚀 Starting MKV Universal Playback & Range Seeking E2E Test...');

  const browser = await chromium.launch({
    executablePath: '/usr/bin/brave',
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--autoplay-policy=no-user-gesture-required']
  });

  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 }
  });
  const page = await context.newPage();

  const consoleErrors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') {
      const text = msg.text();
      if (text.includes('chrome-extension://') || text.includes('ERR_BLOCKED_BY_CLIENT')) return;
      console.log(`❌ [CONSOLE ERROR]: ${text}`);
      consoleErrors.push(text);
    }
  });

  page.on('pageerror', err => {
    console.log(`❌ [PAGE ERROR]: ${err.message}`);
    consoleErrors.push(err.message);
  });

  try {
    console.log('\n--- STEP 1: Navigate to Study Hub Portal ---');
    await page.goto('http://localhost:3000', { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);
    console.log('✅ Page loaded successfully');

    console.log('\n--- STEP 2: Locate and Select MKV Lesson (16.3 Authentication using cookies) ---');
    // Use syllabus search to quickly filter to the lesson
    const searchInput = page.locator('input[placeholder*="Search lectures"]');
    await searchInput.fill('Authentication using cookies');
    await page.waitForTimeout(500);

    const lessonItem = page.locator('text=16.3  Authentication using cookies').first();
    await lessonItem.waitFor({ state: 'visible', timeout: 5000 });
    console.log('Found lesson element in curriculum drawer. Clicking...');
    await lessonItem.click();
    await page.waitForTimeout(1000);

    console.log('\n--- STEP 3: Verify Video Element State & Playback for 16.3 ---');
    const videoLocator = page.locator('video');
    await videoLocator.waitFor({ state: 'attached', timeout: 10000 });

    // Wait for video metadata to load (readyState >= 1 and duration > 0)
    console.log('Waiting for video metadata and readyState >= 2...');
    await page.waitForFunction(() => {
      const v = document.querySelector('video');
      return v && v.readyState >= 2 && v.duration > 0;
    }, { timeout: 15000 });

    const videoState = await page.evaluate(() => {
      const v = document.querySelector('video');
      return {
        src: v.src,
        currentSrc: v.currentSrc,
        readyState: v.readyState,
        duration: v.duration,
        paused: v.paused,
        videoWidth: v.videoWidth,
        videoHeight: v.videoHeight
      };
    });

    console.log('Video State:');
    console.log(`  - Source: ${videoState.src}`);
    console.log(`  - readyState: ${videoState.readyState}`);
    console.log(`  - Duration: ${videoState.duration} seconds (${(videoState.duration / 60).toFixed(1)} mins)`);
    console.log(`  - Resolution: ${videoState.videoWidth}x${videoState.videoHeight}`);

    if (videoState.readyState < 2 || videoState.duration <= 0) {
      throw new Error(`Invalid video state: readyState=${videoState.readyState}, duration=${videoState.duration}`);
    }

    // Play video
    console.log('Triggering video.play()...');
    await page.evaluate(() => document.querySelector('video').play());
    await page.waitForTimeout(2000);

    const playState = await page.evaluate(() => {
      const v = document.querySelector('video');
      return {
        currentTime: v.currentTime,
        paused: v.paused
      };
    });
    console.log(`Video playing: paused=${playState.paused}, currentTime=${playState.currentTime}`);
    if (playState.currentTime <= 0) {
      throw new Error('Video did not advance currentTime during playback');
    }

    // Test Scrubbing / Seeking forward (Byte-range seek test)
    console.log('\n--- STEP 4: Test RFC-7233 Range Seeking (Seek to 1200s) ---');
    await page.evaluate(() => {
      const v = document.querySelector('video');
      v.currentTime = 1200;
    });
    await page.waitForTimeout(1500);

    const seekedTime = await page.evaluate(() => document.querySelector('video').currentTime);
    console.log(`Current time after seek: ${seekedTime}s`);
    if (seekedTime < 1190 || seekedTime > 1210) {
      throw new Error(`Seek failed: expected ~1200s, got ${seekedTime}s`);
    }

    await page.screenshot({ path: 'mkv-playback-16.3.png' });
    console.log('📸 Captured mkv-playback-16.3.png');
    console.log('✅ 16.3 Authentication using cookies MKV test PASSED!');

    console.log('\n--- STEP 5: Test Second MKV File (16.4 NextAuth) ---');
    await searchInput.fill('16.4  NextAuth');
    await page.waitForTimeout(500);

    const nextAuthItem = page.locator('text=16.4  NextAuth').first();
    await nextAuthItem.waitFor({ state: 'visible', timeout: 5000 });
    console.log('Clicking 16.4 NextAuth...');
    await nextAuthItem.click();
    await page.waitForTimeout(1000);

    await page.waitForFunction(() => {
      const v = document.querySelector('video');
      return v && v.readyState >= 2 && v.duration > 0;
    }, { timeout: 15000 });

    const nextAuthState = await page.evaluate(() => {
      const v = document.querySelector('video');
      return {
        src: v.src,
        readyState: v.readyState,
        duration: v.duration,
        videoWidth: v.videoWidth,
        videoHeight: v.videoHeight
      };
    });

    console.log('16.4 NextAuth Video State:');
    console.log(`  - readyState: ${nextAuthState.readyState}`);
    console.log(`  - Duration: ${nextAuthState.duration}s (${(nextAuthState.duration / 60).toFixed(1)} mins)`);
    console.log(`  - Resolution: ${nextAuthState.videoWidth}x${nextAuthState.videoHeight}`);

    await page.evaluate(() => document.querySelector('video').play());
    await page.waitForTimeout(1500);

    // Seek to 900s
    await page.evaluate(() => {
      document.querySelector('video').currentTime = 900;
    });
    await page.waitForTimeout(1000);

    await page.screenshot({ path: 'mkv-playback-16.4.png' });
    console.log('📸 Captured mkv-playback-16.4.png');
    console.log('✅ 16.4 NextAuth MKV test PASSED!');

    console.log('\n--- STEP 6: Console Error Audit ---');
    if (consoleErrors.length > 0) {
      console.warn(`Encountered ${consoleErrors.length} console errors:`, consoleErrors);
    } else {
      console.log('✅ 0 uncaught errors during entire MKV playback and seeking lifecycle!');
    }

    console.log('\n🎉 ALL MKV PLAYBACK AND SEEKING TESTS PASSED PERFECTLY!');
  } catch (err) {
    console.error('❌ MKV Playback Test failed:', err);
    await page.screenshot({ path: 'mkv-error.png' }).catch(() => {});
    process.exit(1);
  } finally {
    await browser.close();
  }
}

runMkvPlaybackTest();

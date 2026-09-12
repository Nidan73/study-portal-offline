# CLAUDE.md

Local-first course player: Express + TypeScript backend (`server.ts`), React 18 +
Vite + Tailwind frontend (`src/`). No database, no API keys, no external CDNs.

## Commands

```bash
npm run dev          # server :47287 + vite :47286, concurrently
npm run build        # tsc && vite build  -> dist/
npm start            # serve the built app on :47285
npm test             # api + ui + offline  (227 checks)
npm run test:api     # 131 checks, no browser
npm run test:ui      # 89 checks, needs Playwright chromium
npm run test:offline # 7 checks, server-death recovery
npm run test:media   # ffmpeg remux path; NOT in `npm test`
```

`test:media` is excluded from `npm test` because it silently skips without
`ffmpeg`/`ffprobe` on PATH. CI sets `STUDYHUB_REQUIRE_FFMPEG=1` to make the
skip a failure instead.

If `test:ui` dies with "Executable doesn't exist", run
`./node_modules/.bin/playwright install chromium` — use the project-local
binary so the browser revision matches the pinned Playwright.

## Never commit

- `data/` — real personal notes, progress and bookmarks (219 notes). Gitignored
  except `study-hub-data.example.json`. The repo is public.
- `dist/`, `videos/`, `.php-runtime/`.

Tests never touch real data: `startServer()` in `tests/harness.mjs` gives each
server its own `STUDYHUB_DATA_DIR` scratch dir. An earlier ad-hoc script pointed
at the live instance once deleted real notes — keep new tests on the harness.

## Architecture

**`server.ts`** (~3.2k lines, single file by choice) — course discovery by
crawling sibling folders, RFC 7233 byte-range streaming, ffmpeg remux for
`.mkv`/`.avi`/`.ts`, IDE code execution, YouTube search by scraping, and a
debounced atomic JSON store.

- Binds **loopback only**. `STUDYHUB_HOST=0.0.0.0` opts into the network.
- Every servable path goes through `resolveServable()` / `isInside()`. Keep it
  that way — those are the path-traversal guard.
- Env overrides: `STUDYHUB_DATA_DIR`, `STUDYHUB_COURSES_ROOT`, `PORT`/`--port`.

**`src/store/useStore.ts`** — one Zustand store, no persist middleware;
`localStorage` is read through explicit `getInitial*()` helpers. Per-lesson data
is keyed by bucket (`dataBucketFor`), with YouTube in its own `__youtube__`
bucket.

**`src/App.tsx`** — the video workspace is deliberately **one** layout with a
swappable pane, not separate branches per mode. Separate branches meant separate
`<CinemaPlayer />` instances, so React unmounted and remounted the `<video>` on
every tab switch and restarted playback. Panes are mounted on first open and
then **hidden, never unmounted**, for the same reason.

## Conventions

**Comments explain why, not what.** The codebase documents the bug each odd
decision prevents. Match that; don't strip those comments as noise.

**Stable element ids.** UI tests drive the app through ids (`#nav-tab-player`,
`#hud-play-btn`, `#cinema-player-container`). Renaming one breaks tests. Panes
that can mount more than once take an `idPrefix`/`paneId` so ids stay unique —
there is a test asserting no duplicate ids across all three panes.

**Accessibility is tested.** Contrast is measured against the real painted
background at WCAG AA, focus rings must be visible, and dialogs must be labelled.
`focus:outline-none` without a replacement will fail the suite.

**Offline is a hard requirement.** Fonts are self-hosted in `public/fonts/` as
variable woff2. Don't add a CDN link or a runtime font fetch.

## Layout gotcha: `--player-reserve` and fullscreen

`src/App.tsx` sets `--player-reserve` / `--pane-reserve` on a layout ancestor;
`CinemaPlayer.tsx:912` consumes it as
`max-h-[calc(100vh-var(--player-reserve,220px))]`.

CSS custom properties inherit down the **DOM** tree, and the Fullscreen API does
not move the element in the DOM — it only restyles it and promotes it to the top
layer. So when `#cinema-player-container` goes fullscreen, that windowed-layout
reservation is **still inherited and still applied** to the video stage inside
it, capping the video to `100vh − reserve` and leaving a black band with the HUD
pinned to the true screen bottom.

Anything that reserves height inside a subtree that can go fullscreen needs a
`:fullscreen` escape hatch. The slides pane is fine only because its
`--pane-reserve` rule sits on an ancestor *outside* the fullscreen element, not
inside it.

Also note `CinemaPlayer` has no `fullscreenchange` listener, so it cannot react
to fullscreen state; `PptxCanvasViewer` does (`:412-424`) and is the model to
follow.

# Universal Study Hub

A local-first study app. It turns folders of lecture videos, slides and documents on your own drive into courses, and puts a video player, notes, document viewers and a code runner side by side. It needs no database, accounts or API keys, and it runs on your own machine.

## Features

- Courses discovered from folders beside the project, or found with **Scan Directory** on any drive. The scan suggests folders and adds nothing until you choose.
- Video streaming with HTTP range requests. `.mp4` and `.webm` play directly; `.mkv`, `.avi` and `.ts` are remuxed through ffmpeg when it is installed. Audio files play too.
- Timestamped notes that can carry the current slide number, searchable from the `Ctrl + K` palette and saved to disk as Markdown.
- PDF, PPTX and Word (`.docx`) viewers next to the lecture.
- Code runner for JavaScript, Python, C and C++ (using the tools on your PATH) and PHP (system PHP, or an optional WebAssembly build).
- YouTube search, playlists and watch history alongside your local courses.
- Per-lesson resume and keyboard shortcuts for playback.

## Stack

- Client: React 18, TypeScript, Vite 6, Tailwind CSS 3, Zustand, CodeMirror, docx-preview
- Server: Express 4 in TypeScript (`server.ts`, run with tsx)
- Tests: Node scripts for the API, and Playwright (Chromium) for the UI
- CI: GitHub Actions on Linux and Windows

## Run locally

Requires Node.js 18 or newer.

```bash
git clone https://github.com/Nidan73/study-portal-offline.git
cd study-portal-offline
./launch.sh        # Linux and macOS
```

On Windows, run `launch.bat` (or double-click it). The launcher installs dependencies, builds the interface, seeds a data file and opens your browser once the server is listening, by default on `http://127.0.0.1:47285`.

### Manual commands

From `package.json`:

```bash
npm install
npm run dev            # server on port 47287 and Vite on port 47286
npm run build          # tsc && vite build
npm start              # serve the built app (default port 47285)
npm test               # API, UI and offline suites
npm run test:api       # server suite only, no browser
npm run test:ui        # browser suite (needs Playwright Chromium)
npm run test:offline   # server stop and reconnect
npm run test:media     # ffmpeg pipeline (needs ffmpeg and ffprobe)
npm run php:enable     # optional WebAssembly PHP runtime, kept out of the default install
```

### Optional tools on your PATH

| Feature | Needs |
| :--- | :--- |
| Python in the code runner, PPTX slide outlines | Python 3 |
| C and C++ in the code runner | `gcc` / `g++` |
| `.mkv`, `.avi` and `.ts` playback | `ffmpeg` |
| PHP in the code runner | `php`, or `npm run php:enable` |

## Configuration

| Setting | What it does |
| :--- | :--- |
| `STUDYHUB_COURSES_ROOT` | Folder that holds your courses. By default the app looks beside the project directory. |
| `PORT` or `--port` | Server port. Default `47285`. |
| `STUDYHUB_HOST` | Bind address. The default is loopback only. Set `0.0.0.0` to reach it from another device, and only on a network you trust, because this exposes your notes. |
| `STUDYHUB_DATA_DIR` | Where notes, progress and bookmarks are stored. The test suites point it at a scratch directory. |

## How your library is organised

Any folder holding a few videos or documents becomes a course, named after the folder. Sub-folders such as `Week 1` become modules. A folder of slides and PDFs with no video becomes a reading course, and a `Presentations` folder becomes a slide library.

## Security

- The server listens on loopback unless `STUDYHUB_HOST` says otherwise.
- Requests carrying a cross-origin `Origin` header are refused, so a website open in your browser cannot call the local API.
- Every endpoint that takes a file path from the client resolves it with one helper (`resolveServable()`) and rejects anything outside the course library, using `path.relative` rather than a string prefix.
- Fonts, icons and libraries are served from disk. The YouTube features are the only part that needs a connection.

## Project structure

```
server.ts                 Express server: course discovery, streaming, scanner, code runner
src/App.tsx               app shell
src/components/           player, document viewers, notes, code runner, scanner, palette
src/store/useStore.ts     Zustand store
public/libs/              bundled client libraries (PptxViewJS, JSZip, Chart.js)
tests/                    API, UI, offline and media suites (shared harness in tests/harness.mjs)
launch.sh, launch.bat     one-step launchers
data/study-hub-data.example.json   example data file (your real data folder is gitignored)
.github/workflows/        Linux and Windows CI
```

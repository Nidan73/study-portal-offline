# 🎓 Universal Study Hub

> **A Local-First, Zero-Distraction Course Streaming Platform, YouTube Academy & Split-Screen IDE**  
> Built with Vite, React 19, TypeScript, Tailwind CSS, Lucide Icons, Web Audio API, and an RFC 7233 Streaming Engine.

---

## ⚡ Quick Start

Requires **Node.js 18 or newer**. Nothing else — no database, no API keys, no accounts.

### Linux / macOS
```bash
git clone https://github.com/Nidan73/study-portal-offline.git
cd study-portal-offline
./launch.sh
```
`launch.sh` installs dependencies, builds the interface, seeds a fresh data file and opens your browser on the port it actually bound.

### Windows
```bat
git clone https://github.com/Nidan73/study-portal-offline.git
cd study-portal-offline
launch.bat
```
Or double-click **`launch.bat`** in Explorer. It does the same as the shell
script: checks Node, installs dependencies, builds, seeds the data file and
opens your browser.

**Works out of the box:** the player and byte-range streaming, slides, notes,
bookmarks, the YouTube explorer and history, the drive scanner, and JavaScript
execution in the IDE.

**Needs a tool on your PATH:**

| Feature | Requires | Notes |
| :--- | :--- | :--- |
| Python in the IDE | Python 3 | The `py` launcher is used when present, as [python.org recommends](https://docs.python.org/3/using/windows.html); a bare `python` can otherwise open the Microsoft Store instead of running. |
| C / C++ in the IDE | `gcc` / `g++` | Install [MinGW-w64](https://www.mingw-w64.org/) or [MSYS2](https://www.msys2.org/). Bare names resolve because CreateProcess appends `.exe` and searches PATH. |
| `.mkv`, `.avi`, `.ts` playback | `ffmpeg` | Only needed for containers the browser cannot play natively; `.mp4` and `.webm` stream directly. |
| PPTX slide outlines | Python 3 | Same as above. |

Opening a deck in your desktop presentation app is routed through `cmd.exe /c
start` on Windows, because `start` is a shell builtin rather than an
executable and cannot be launched directly.

Open your browser to: **`http://localhost:47285`**

The port is deliberately unusual so it will not collide with Vite, Apache, Django, Jupyter or anything else you may be running. Override it with `--port 1234` or `PORT=1234` if you need to.

### Pointing it at your courses
By default it looks for course folders **beside** the project directory. If your
library lives elsewhere:

```bash
STUDYHUB_COURSES_ROOT="/path/to/your/courses" ./launch.sh
```

Or just press **Scan Directory** in the app and pick a drive or folder — it will
list everything that looks like course material and let you choose.

---

## 💎 Core Highlights & Architectural Features

### 1. 📺 $0.00 YouTube Explorer & Masterclass Companion
- **Zero API Quota / Zero Billing Forever:** Operates with **$0.00 API cost** using native client JSON search and oEmbed metadata. Requires **zero Google Cloud accounts** and **zero API keys**.
- **Double-Bezel Luxury UI:** Concentric border architecture (`rounded-[2rem]`), subtle micro-interactions, responsive 16:9 thumbnails, and clickable video cards with hover play badge.
- **Dedicated YouTube Masterclass Companion:** When studying YouTube lectures, the sidebar dynamically transforms into a focused companion with quick-action tiles (*Timestamped Notes*, *In-App Code Along*, *Slide Deck Viewer*, *YouTube Explorer*) and 1-click resumption of your background offline course.
- **Context-Aware Island Navbar:** Top bar displays the active YouTube lecture title and pulsing *YouTube Live* status badge, preventing confusion with offline course completion percentages.
- **Watch History & Continue Watching:** Every video you open is recorded with its title, thumbnail, duration and exact position, shown as a resumable grid in the YouTube tab. Videos you have taken notes or dropped pins on are flagged, so lecture notes stay attached to something you can find again rather than to a bare video id. Capped at the 100 most recent; clearing history never touches your notes.
- **Obsidian / Markdown Deep Linking:** Notes exported from YouTube lectures generate clickable deep links (e.g. `[[14:20]](https://youtu.be/ID?t=860s)`) that jump right to that exact second in external note-taking tools.

---

### 2. 📝 Dual-Mode Note Taking (Continuous vs. Auto-Pause)
- **⚡ 1-Click Mode Toggle:** A dedicated toggle `[⚡ Auto-pause: ON / OFF]` located directly above the note composer lets you tailor playback behavior to your study style:
  - **Continuous Playback (Default):** Typing notes never interrupts lecture playback or audio flow, perfect for passive lectures and stream-of-consciousness jotting.
  - **Auto-Pause Mode:** Focusing or typing into the note composer automatically pauses the video and locks the exact timestamp. Saving with `Ctrl + Enter` instantly resumes playback right where you left off.
- **Slide Attachment Sync:** When reading accompanying lecture slides (`.pdf`, `.pptx`, `.ppt`), your note automatically attaches the active slide page number — from either the slide viewer's pin button or the main note composer.
- **Full Note Management:** Delete any individual note, clear every note on a lecture, filter the current lecture's notes with the search box, or find notes across *all* lectures from the `Ctrl + K` palette (selecting one jumps to that lesson at that timestamp).
- **Save to Disk:** `[Save]` writes your notes out as a `.md` file on this machine, with the same YouTube deep links and slide numbers as the clipboard export.

---

### 3. 🎬 Cinema Video Player & Hardware Acceleration (Zero Double Controls)
- **Unified Glassmorphic HUD:** Suppresses YouTube's native red progress bar and conflicting overlays (`controls: 0, modestbranding: 1`). Scrubbing, volume, speed, bookmarks, and loops are driven through StudyHub's unified cinema interface.
- **RFC 7233 Byte-Range Streaming:** Instant 60fps scrubbing with 0ms buffering for local `.mp4`, `.mkv`, and `.webm` video files.
- **🔊 Web Audio Hardware Booster (+300%):** Integrated `AudioContext`, dynamic vocal compression, and `GainNode` amplifier to boost quiet lecture audio without distortion.
- **🔁 A-B Loop Repeater:** Set custom `[A]` and `[B]` sub-second repeat markers to loop complex code explanations or math proofs continuously.
- **Ambient Glow Diffusion:** Real-time dynamic canvas backdrop diffusion matching video frame tones.

---

### 4. 📄 Universal Presentation Engine (PPTX & PDF)
- **Dual Presentation Mode:**
  - **In-App Slide Outline & Bullet Extraction:** Inspect slide titles, summaries, and bullet points directly inside the split-screen viewer with `[Pin Slide #X]` attachment to your notes.
  - **1-Click Native Desktop Launch:** Launch any `.pptx`, `.ppt`, or `.pdf` file in your installed desktop presentation app (*OnlyOffice Desktop Editors*, *Microsoft PowerPoint*, *LibreOffice Impress*) with 1 click via system integration (`/api/slides/open-system`).
- **Cross-Course Slide Discovery:** Automatically indexes presentation decks across all local courses and workshop folders.
- **OLED Dark Filter:** 1-click color inverter transforms blinding white slides into eye-friendly dark mode for late-night study sessions.

---

### 5. 💻 Integrated In-Browser Code IDE
- **Floating Picture-in-Picture (PiP):** Keep watching local or YouTube lectures in a resizable floating player while writing code.
- **Multi-Language Support:** Write and test Python, JavaScript, TypeScript, and HTML.
- **Localhost Containment:** Sandboxed local execution endpoints restricted strictly to loopback interfaces (`127.0.0.1` / `::1`) with hard CPU/execution timeouts.

---

### 6. 🔎 Drive & Folder Scanner
- **One-Click Drive Scan:** `[Scan Directory]` offers every mounted drive and your home folder as a one-click target, or takes any absolute path you type.
- **Suggests, Never Auto-Adds:** The scan lists every folder holding 3 or more videos and waits for you to tick the ones you want. Nothing is added until you press Add.
- **Course vs. Media Hint:** Folders are tagged `Course` or `Media?` from their naming and whether slide decks sit alongside the videos, so lecture folders sort above your TV rips. Nothing is hidden — the tag only decides the order.
- **Rolled Up By Course:** A course that presents as twenty `Week N` folders is offered once, as the parent — matching how the crawler indexes it (weeks become modules).
- **Already-Indexed Folders Are Marked:** Anything inside a course you have already added is greyed out and cannot be double-added.
- **Bounded:** Depth-capped, deadline-capped and symlink-loop guarded, so scanning a whole drive cannot hang the server. A truncated scan says so.

---

### 7. 🧭 Bento Syllabus, Spotlight (`Ctrl + K`) & Streaks
- **Raycast-Style Spotlight Search (`Ctrl + K`):** Instantly search and jump across all weeks, lectures, and topics in your local disk library and imported YouTube courses.
- **Resizable Everywhere:** The drag handle between the video and the side panel works in every split view, not just the player, and the ratio is remembered.
- **Notes Under the Video:** A second notes dock can open beneath the lecture, so you can keep a slide deck open beside it and write at the same time.
- **21st.dev Bento Grid:** Visualizes weekly lesson progress, completion badges, and total study duration.
- **Gamified Daily Streaks:** Tracks daily consistency and cohort completion percentages stored in local-first storage. Watch time counts real elapsed playback only — seeking does not inflate it.
- **Per-Lesson Resume:** Every lesson and every YouTube video remembers its own position independently, so switching between them never loses your place.

---

## ⌨️ Keyboard Shortcuts Reference

| Key | Action |
| :--- | :--- |
| `Space` or `K` | Play / Pause |
| `J` or `←` | Rewind 10 Seconds |
| `L` or `→` | Skip Forward 10 Seconds |
| `[` / `]` | Decrease / Increase Playback Speed by 0.25x |
| `M` | Toggle Mute |
| `F` | Toggle Fullscreen |
| `Ctrl + K` | Open Spotlight Search Palette |
| `Ctrl + Enter` (in note input) | Save Note (and resume playback if Auto-pause is ON) |

---

## 🏗️ Architecture & Security

- **TypeScript End to End:** Client UI, state store, Express backend (`server.ts`) and the Playwright E2E suites in `tests/` all typecheck clean under `strict`. Request bodies on the write endpoints are still validated by hand rather than by a schema.
- **Atomic Storage:** Stored in `study-hub-data.json` using atomic temporary file swaps with automated rolling timestamped backups (`.backup-*.json`).
- **Zero Memory Leaks:** Web Audio `AudioContext` is explicitly destroyed (`audioCtx.close()`) on unmount to safeguard against Chromium hardware context exhaustion.
- **Strict Content Security:** Every endpoint that accepts a client-supplied path resolves it through a single `resolveServable()` helper and rejects anything outside the course library. Containment uses `path.relative`, not a string prefix, so a root of `/courses/react` does not accept `/courses/react-private`.
- **No Cross-Origin Access:** The server refuses requests carrying a cross-origin `Origin` header. Without this, any website open in your browser could reach the local API — including the code execution endpoint, whose "localhost only" check passes for a browser tab because a tab on your machine *is* localhost.
- **Zero External CDNs:** Fonts, icons, libraries and bundles are all served from disk — verified with every non-localhost request blocked, the app makes zero external requests. The YouTube features are the one exception and need a connection by nature.

---

## 📜 License

MIT License. Designed and engineered for frictionless, lifelong self-directed learning.

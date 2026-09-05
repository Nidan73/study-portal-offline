# 🎓 Universal Study Hub

> **A Local-First, Zero-Distraction Course Streaming Platform, YouTube Academy & Split-Screen IDE**  
> Built with Vite, React 19, TypeScript, Tailwind CSS, Lucide Icons, Web Audio API, and an RFC 7233 Streaming Engine.

---

## ⚡ Quick Start

### Linux / macOS
```bash
cd study-hub
chmod +x launch.sh
./launch.sh
```

### Windows (CMD or PowerShell) / Cross-Platform
```bash
cd study-hub
npm install
npm run build
npx tsx server.ts --port 3000
```

Open your browser to: **`http://localhost:3000`**

---

## 💎 Core Highlights & Architectural Features

### 1. 📺 $0.00 YouTube Explorer & Masterclass Companion
- **Zero API Quota / Zero Billing Forever:** Operates with **$0.00 API cost** using native client JSON search and oEmbed metadata. Requires **zero Google Cloud accounts** and **zero API keys**.
- **Double-Bezel Luxury UI:** Concentric border architecture (`rounded-[2rem]`), subtle micro-interactions, responsive 16:9 thumbnails, and clickable video cards with hover play badge.
- **Dedicated YouTube Masterclass Companion:** When studying YouTube lectures, the sidebar dynamically transforms into a focused companion with quick-action tiles (*Timestamped Notes*, *In-App Code Along*, *Slide Deck Viewer*, *YouTube Explorer*) and 1-click resumption of your background offline course.
- **Context-Aware Island Navbar:** Top bar displays the active YouTube lecture title and pulsing *YouTube Live* status badge, preventing confusion with offline course completion percentages.
- **Obsidian / Markdown Deep Linking:** Notes exported from YouTube lectures generate clickable deep links (e.g. `[[14:20]](https://youtu.be/ID?t=860s)`) that jump right to that exact second in external note-taking tools.

---

### 2. 📝 Dual-Mode Note Taking (Continuous vs. Auto-Pause)
- **⚡ 1-Click Mode Toggle:** A dedicated toggle `[⚡ Auto-pause: ON / OFF]` located directly above the note composer lets you tailor playback behavior to your study style:
  - **Continuous Playback (Default):** Typing notes never interrupts lecture playback or audio flow, perfect for passive lectures and stream-of-consciousness jotting.
  - **Auto-Pause Mode:** Focusing or typing into the note composer automatically pauses the video and locks the exact timestamp. Saving with `Ctrl + Enter` instantly resumes playback right where you left off.
- **Slide Attachment Sync:** When reading accompanying lecture slides (`.pdf`, `.pptx`, `.ppt`), your note automatically attaches the active slide page number.

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

### 6. 🧭 Bento Syllabus, Spotlight (`Ctrl + K`) & Streaks
- **Raycast-Style Spotlight Search (`Ctrl + K`):** Instantly search and jump across all weeks, lectures, and topics in your local disk library and imported YouTube courses.
- **21st.dev Bento Grid:** Visualizes weekly lesson progress, completion badges, and total study duration.
- **Gamified Daily Streaks:** Tracks daily consistency and cohort completion percentages stored in local-first storage.

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

- **100% Type-Safe TypeScript Architecture:** Complete end-to-end type safety across client UI, state store, Express backend server ([server.ts](file:///run/media/nidan73/M44L/03_Courses_and_Learning/study-hub/server.ts)), and automated Playwright E2E testing suites.
- **Atomic Storage:** Stored in `study-hub-data.json` using atomic temporary file swaps with automated rolling timestamped backups (`.backup-*.json`).
- **Zero Memory Leaks:** Web Audio `AudioContext` is explicitly destroyed (`audioCtx.close()`) on unmount to safeguard against Chromium hardware context exhaustion.
- **Strict Content Security:** All local filesystem access is strictly bounded to authorized course roots with path traversal sanitization.
- **Zero External CDNs:** All core assets, fonts, icons, and bundles are self-contained and run 100% offline.

---

## 📜 License

MIT License. Designed and engineered for frictionless, lifelong self-directed learning.

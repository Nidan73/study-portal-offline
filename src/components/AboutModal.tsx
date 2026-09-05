import React, { useEffect } from 'react';
import { useStore } from '../store/useStore';
import {
  X, Video, FileText, Code2, Youtube, Search, Radar,
  NotebookPen, ShieldCheck, Keyboard
} from 'lucide-react';

/**
 * What this app is for. Reached from the navbar rather than taking a nav slot,
 * since it is read once and then never again.
 */
const SECTIONS: { icon: typeof Video; title: string; points: string[] }[] = [
  {
    icon: Video,
    title: 'Watch lectures from your own disk',
    points: [
      'Point it at any folder of video files — it finds the weeks and lessons and builds a curriculum',
      'Instant scrubbing with no buffering, because video is streamed in byte ranges rather than downloaded',
      '.mkv, .avi and other formats the browser cannot play are converted in the background',
      'Speed control, A-B loop for replaying a tricky explanation, and an audio boost for quiet recordings'
    ]
  },
  {
    icon: NotebookPen,
    title: 'Take notes that remember the moment',
    points: [
      'Every note is stamped with the exact second of the lecture — click it to jump straight back',
      'Auto-pause mode stops the video while you type, then resumes when you save',
      'Notes attach the slide you are looking at, so the two stay connected',
      'Search within a lecture, or across every lecture with the command palette',
      'Save any lecture’s notes out as a Markdown file, or copy them to paste elsewhere',
      'Deleting is always undoable — nothing you wrote disappears without a way back'
    ]
  },
  {
    icon: FileText,
    title: 'Read slides beside the video',
    points: [
      'PDF and PowerPoint decks open in-app, next to the lecture or under it',
      'Slide decks are found automatically across every course you have added',
      'A dark filter turns blinding white slides readable for late-night study',
      'Or open the deck in PowerPoint, OnlyOffice or Impress with one click'
    ]
  },
  {
    icon: Code2,
    title: 'Write code while you watch',
    points: [
      'Run JavaScript, Python, C, C++ and HTML without leaving the page',
      'Keep the lecture playing in a floating window while you type',
      'Your code is saved per lesson, so you come back to where you left off'
    ]
  },
  {
    icon: Youtube,
    title: 'Study from YouTube without the distractions',
    points: [
      'Search and play lectures with no API key, no Google account and no cost',
      'Import a whole playlist as a course, with every video as a lesson',
      'Watch history remembers what you opened, where you stopped, and which videos you took notes on',
      'Notes and pins follow the video itself, so they are there whichever course you are in',
      'Paste a direct .mp4 or .m3u8 link and it plays with the same controls'
    ]
  },
  {
    icon: Radar,
    title: 'Find what you already have',
    points: [
      'Scan a whole drive and it lists every folder that looks like course material',
      'Course folders are told apart from downloaded media, so lectures come first',
      'Nothing is added until you tick it — it suggests, you decide'
    ]
  },
  {
    icon: ShieldCheck,
    title: 'Yours, and nobody else’s',
    points: [
      'Everything lives on your machine — no account, no sign-in, no cloud, no telemetry',
      'Works with the network unplugged; even the fonts are served from your own disk',
      'Your notes and progress are a plain JSON file you can read, back up or move',
      'The server only answers your own browser and only reads inside your course folders'
    ]
  }
];

export const AboutModal: React.FC = () => {
  const isAboutOpen = useStore(state => state.isAboutOpen);
  const setAboutOpen = useStore(state => state.setAboutOpen);
  const setShortcutHelpOpen = useStore(state => state.setShortcutHelpOpen);

  useEffect(() => {
    if (!isAboutOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setAboutOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isAboutOpen, setAboutOpen]);

  if (!isAboutOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 select-none"
      role="dialog"
      aria-modal="true"
      aria-label="What you can do here"
    >
      <div
        className="fixed inset-0 bg-black/70 backdrop-blur-md motion-safe:animate-in motion-safe:fade-in motion-safe:duration-200"
        onClick={() => setAboutOpen(false)}
      />

      <div className="relative w-full max-w-3xl p-1.5 rounded-[2rem] bg-black/[0.05] dark:bg-white/[0.05] border border-black/[0.08] dark:border-white/10 shadow-[0_25px_60px_rgba(0,0,0,0.3)] dark:shadow-[0_25px_60px_rgba(0,0,0,0.8)] z-10 motion-safe:animate-in motion-safe:fade-in motion-safe:zoom-in-95 motion-safe:duration-200">
        <div className="rounded-[calc(2rem-0.375rem)] bg-white/95 dark:bg-[#111218]/95 backdrop-blur-2xl border border-black/[0.05] dark:border-white/[0.08] overflow-hidden flex flex-col max-h-[86vh]">

          <div className="flex items-start justify-between gap-4 p-6 border-b border-black/[0.06] dark:border-white/[0.08] bg-black/[0.01] dark:bg-white/[0.02] flex-shrink-0">
            <div className="min-w-0">
              <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-zinc-600 dark:text-zinc-400">
                Universal Study Hub
              </span>
              <h2 className="text-xl sm:text-2xl font-extrabold tracking-tight text-zinc-900 dark:text-white mt-1.5">
                A quiet place to study what you already own
              </h2>
              <p className="text-[13px] text-zinc-600 dark:text-zinc-400 mt-1.5 max-w-xl leading-relaxed">
                Point it at a folder of lectures and it becomes a course: video, slides,
                timestamped notes and a code editor in one window — running entirely on
                your own machine.
              </p>
            </div>
            <button
              onClick={() => setAboutOpen(false)}
              aria-label="Close"
              className="w-8 h-8 rounded-full flex items-center justify-center text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-black/[0.05] dark:hover:bg-white/10 transition-colors flex-shrink-0"
            >
              <X className="w-4 h-4" strokeWidth={1.5} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-6 space-y-7">
            {SECTIONS.map(({ icon: Icon, title, points }) => (
              <section key={title}>
                <h3 className="flex items-center gap-2.5 text-[14px] font-bold text-zinc-900 dark:text-white tracking-tight mb-2.5">
                  <span className="w-7 h-7 rounded-full bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 flex items-center justify-center flex-shrink-0">
                    <Icon className="w-3.5 h-3.5" strokeWidth={1.75} />
                  </span>
                  {title}
                </h3>
                <ul className="space-y-1.5 pl-[2.6rem]">
                  {points.map(p => (
                    <li key={p} className="relative text-[13px] leading-relaxed text-zinc-700 dark:text-zinc-300">
                      <span className="absolute -left-4 top-[0.55rem] w-1.5 h-1.5 rounded-full bg-zinc-400 dark:bg-zinc-600" />
                      {p}
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>

          <div className="p-5 border-t border-black/[0.06] dark:border-white/[0.08] bg-black/[0.01] dark:bg-white/[0.02] flex items-center justify-between gap-3 flex-shrink-0">
            <button
              onClick={() => { setAboutOpen(false); setShortcutHelpOpen(true); }}
              className="flex items-center gap-2 px-4 py-2 rounded-full bg-black/[0.03] hover:bg-black/[0.06] dark:bg-white/[0.05] dark:hover:bg-white/10 border border-black/[0.05] dark:border-white/[0.08] text-zinc-700 dark:text-zinc-300 text-[12px] font-medium transition-colors"
            >
              <Keyboard className="w-3.5 h-3.5" strokeWidth={1.5} />
              <span>Keyboard shortcuts</span>
            </button>
            <span className="hidden sm:flex items-center gap-1.5 text-[11px] font-mono text-zinc-600 dark:text-zinc-400">
              <Search className="w-3 h-3" strokeWidth={1.5} />
              Press ⌘K to search everything
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

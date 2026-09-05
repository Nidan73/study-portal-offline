import React, { useEffect } from 'react';
import { useStore } from '../store/useStore';
import { X, Keyboard, Video, Terminal, Globe, FileText } from 'lucide-react';

export const ShortcutModal: React.FC = () => {
  const { isShortcutHelpOpen, setShortcutHelpOpen } = useStore();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isShortcutHelpOpen) {
        setShortcutHelpOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isShortcutHelpOpen, setShortcutHelpOpen]);

  if (!isShortcutHelpOpen) return null;

  const sections = [
    {
      title: 'Video & Cinema Player',
      icon: Video,
      shortcuts: [
        { keys: ['Space', 'or', 'K'], desc: 'Toggle play or pause' },
        { keys: ['J', 'or', '←'], desc: 'Rewind 10 seconds' },
        { keys: ['L', 'or', '→'], desc: 'Forward 10 seconds' },
        { keys: ['M'], desc: 'Toggle mute audio' },
        { keys: ['F'], desc: 'Toggle cinema fullscreen' },
        { keys: ['[', ']'], desc: 'Decrease / Increase playback speed' },
        { keys: ['B'], desc: 'Drop scrubber bookmark pin at current timestamp' },
        { keys: ['Shift', 'A'], desc: 'Set A-B Looper Point A' },
        { keys: ['Shift', 'B'], desc: 'Set A-B Looper Point B' },
        { keys: ['Shift', 'L'], desc: 'Toggle A-B Repeat Looper on / off' },
        { keys: ['Shift', 'R'], desc: 'Reset & clear loop points' }
      ]
    },
    {
      title: 'Notes & Interactive Study',
      icon: FileText,
      shortcuts: [
        { keys: ['Ctrl', 'Enter'], desc: 'Save timestamped note (with auto-resume)' },
        { keys: ['Ctrl', 'Shift', 'N'], desc: 'Open the general notepad (works with no lecture open)' },
        { keys: ['B'], desc: 'Quick drop bookmark / pin at exact moment' }
      ]
    },
    {
      title: 'IDE & Code Playground',
      icon: Terminal,
      shortcuts: [
        { keys: ['⌘', 'Enter'], desc: 'Compile & run active code snippet' },
        { keys: ['Ctrl', 'Enter'], desc: 'Compile & run on Linux / Windows' },
        { keys: ['Tab'], desc: 'Indent code selection' },
        { keys: ['Shift', 'Tab'], desc: 'Outdent code selection' }
      ]
    },
    {
      title: 'Navigation & Study Hub',
      icon: Globe,
      shortcuts: [
        { keys: ['⌘', 'K'], desc: 'Open command palette & search curriculum' },
        { keys: ['?'], desc: 'Toggle keyboard shortcut cheat sheet' },
        { keys: ['Esc'], desc: 'Close modals, drawers, or command palette' }
      ]
    }
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 select-none animate-in fade-in duration-200">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/60 backdrop-blur-md transition-opacity"
        onClick={() => setShortcutHelpOpen(false)} 
      />

      {/* Double-Bezel Hardware Modal */}
      <div className="relative w-full max-w-2xl p-2 rounded-[2rem] bg-black/[0.06] dark:bg-white/[0.05] border border-black/[0.08] dark:border-white/[0.1] shadow-2xl z-10">
        <div className="rounded-[calc(2rem-0.5rem)] bg-white dark:bg-[#111218] border border-black/[0.05] dark:border-white/[0.06] p-5 sm:p-6 shadow-[inset_0_1px_1px_rgba(255,255,255,0.15)] dark:shadow-[inset_0_1px_1px_rgba(255,255,255,0.06)] max-h-[85vh] flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between pb-4 border-b border-black/[0.06] dark:border-white/[0.08]">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 flex items-center justify-center border border-indigo-500/20">
                <Keyboard className="w-4 h-4" strokeWidth={1.5} />
              </div>
              <div>
                <h3 className="text-base font-bold text-zinc-900 dark:text-white tracking-tight">
                  Keyboard Shortcut Cheat Sheet
                </h3>
                <p className="text-[12px] text-zinc-500 dark:text-zinc-400">
                  Precision hotkeys for video playback, coding sandbox, and workstation flow.
                </p>
              </div>
            </div>

            <button
              onClick={() => setShortcutHelpOpen(false)}
              className="p-1.5 rounded-full text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-black/[0.05] dark:hover:bg-white/[0.08] transition-colors"
            >
              <X className="w-4 h-4" strokeWidth={1.5} />
            </button>
          </div>

          {/* Body */}
          <div className="overflow-y-auto py-4 space-y-6 pr-1 divide-y divide-black/[0.04] dark:divide-white/[0.05]">
            {sections.map((section, idx) => {
              const Icon = section.icon;
              return (
                <div key={section.title} className={idx > 0 ? 'pt-5' : ''}>
                  <div className="flex items-center gap-2 mb-3">
                    <Icon className="w-4 h-4 text-indigo-500" strokeWidth={1.5} />
                    <h4 className="text-[11px] font-mono uppercase tracking-[0.18em] font-semibold text-zinc-500 dark:text-zinc-400">
                      {section.title}
                    </h4>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {section.shortcuts.map((sc, i) => (
                      <div 
                        key={i} 
                        className="flex items-center justify-between gap-3 p-2 rounded-xl bg-black/[0.02] dark:bg-white/[0.02] border border-black/[0.04] dark:border-white/[0.05]"
                      >
                        <span className="text-[12px] text-zinc-600 dark:text-zinc-300 truncate">
                          {sc.desc}
                        </span>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          {sc.keys.map((k, ki) => (
                            k === 'or' ? (
                              <span key={ki} className="text-[10px] text-zinc-500 dark:text-zinc-400 font-mono px-0.5">/</span>
                            ) : (
                              <kbd
                                key={ki}
                                className="px-1.5 py-0.5 rounded-md bg-white dark:bg-white/10 border border-black/[0.1] dark:border-white/10 text-[10px] font-mono font-medium text-zinc-700 dark:text-zinc-300 shadow-sm"
                              >
                                {k}
                              </kbd>
                            )
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Footer */}
          <div className="pt-3 border-t border-black/[0.06] dark:border-white/[0.08] flex items-center justify-between text-[11px] text-zinc-500 dark:text-zinc-400">
            <span>Press <kbd className="px-1.5 py-0.5 rounded bg-black/[0.05] dark:bg-white/10 font-mono text-[10px] text-zinc-600 dark:text-zinc-300 border border-black/[0.05] dark:border-white/10">?</kbd> anywhere to open or close</span>
            <span>StudyHub Core</span>
          </div>
        </div>
      </div>
    </div>
  );
};

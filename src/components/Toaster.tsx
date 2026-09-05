import React from 'react';
import { useStore } from '../store/useStore';
import { Check, AlertCircle, Info, X, Undo2 } from 'lucide-react';

/**
 * In-design replacement for native alert(), plus the surface for failures that
 * previously only reached console.error — a note that failed to save used to
 * look exactly like one that saved.
 *
 * The container is an aria-live region so screen readers hear async outcomes
 * (saves, scan results, launch failures) that are otherwise silent.
 */
export const Toaster: React.FC = () => {
  const toasts = useStore(state => state.toasts);
  const dismissToast = useStore(state => state.dismissToast);

  const tone = {
    success: { Icon: Check, ring: 'border-emerald-500/30', accent: 'text-emerald-700 dark:text-emerald-400', dot: 'bg-emerald-500' },
    error: { Icon: AlertCircle, ring: 'border-rose-500/30', accent: 'text-rose-700 dark:text-rose-400', dot: 'bg-rose-500' },
    info: { Icon: Info, ring: 'border-indigo-500/30', accent: 'text-indigo-700 dark:text-indigo-400', dot: 'bg-indigo-500' }
  };

  return (
    <div
      role="status"
      aria-live="polite"
      aria-atomic="false"
      className="fixed bottom-4 left-1/2 -translate-x-1/2 sm:left-auto sm:right-5 sm:translate-x-0 z-[60] flex flex-col gap-2 w-[calc(100vw-2rem)] sm:w-auto sm:max-w-sm pointer-events-none"
    >
      {toasts.map(t => {
        const { Icon, ring, accent, dot } = tone[t.tone];
        return (
          <div
            key={t.id}
            className={`pointer-events-auto p-1 rounded-[1.25rem] bg-black/[0.06] dark:bg-white/[0.06] border ${ring} shadow-[0_12px_40px_rgba(0,0,0,0.18)] dark:shadow-[0_16px_44px_rgba(0,0,0,0.6)] motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2 motion-safe:duration-300`}
          >
            <div className="flex items-center gap-3 px-3.5 py-3 rounded-[calc(1.25rem-0.25rem)] bg-white/95 dark:bg-[#15171f]/95 backdrop-blur-2xl border border-black/[0.05] dark:border-white/[0.07]">
              <span className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 bg-black/[0.04] dark:bg-white/[0.07] ${accent}`}>
                <Icon className="w-3.5 h-3.5" strokeWidth={1.75} />
              </span>

              <p className="text-[12.5px] leading-snug text-zinc-800 dark:text-zinc-100 flex-1 min-w-0">
                {t.message}
              </p>

              {t.action && (
                <button
                  onClick={() => { t.action!.run(); dismissToast(t.id); }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-zinc-900 dark:bg-white text-white dark:text-zinc-950 text-[11px] font-semibold flex-shrink-0 transition-transform duration-200 ease-fluid active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-[#15171f]"
                >
                  <Undo2 className="w-3 h-3" strokeWidth={2} />
                  <span>{t.action.label}</span>
                </button>
              )}

              <button
                onClick={() => dismissToast(t.id)}
                aria-label="Dismiss notification"
                className="w-7 h-7 -mr-1 rounded-full flex items-center justify-center text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-black/[0.05] dark:hover:bg-white/10 transition-colors flex-shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
              >
                <X className="w-3.5 h-3.5" strokeWidth={1.75} />
              </button>
            </div>

            {/* Time-remaining hairline, so an Undo window is visible rather than guessed. */}
            <div className="h-[2px] mx-3 rounded-full overflow-hidden bg-black/[0.06] dark:bg-white/10 motion-reduce:hidden">
              <div
                className={`h-full ${dot} origin-left`}
                style={{ animation: `toast-drain ${t.durationMs}ms linear forwards` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
};

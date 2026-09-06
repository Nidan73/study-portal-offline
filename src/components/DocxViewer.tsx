import React, { useEffect, useRef, useState } from 'react';
import { Loader2, FileType2 } from 'lucide-react';

/**
 * Renders a Word document the way a document viewer does — pages, headings,
 * tables and images — rather than converting it to a web page.
 *
 * docx-preview is loaded on demand. It pulls in jszip and is only ever needed
 * by someone who opens a .docx, so keeping it out of the main bundle costs a
 * spinner on first use and saves the download for everybody else.
 */
export const DocxViewer: React.FC<{
  url: string;
  title: string;
  /** Rendered instead of the document when it cannot be displayed. */
  fallback: React.ReactNode;
}> = ({ url, title, fallback }) => {
  const hostRef = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'failed'>('loading');

  useEffect(() => {
    let cancelled = false;
    setState('loading');

    (async () => {
      try {
        const [{ renderAsync }, res] = await Promise.all([
          import('docx-preview'),
          fetch(url)
        ]);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const blob = await res.blob();
        if (cancelled) return;

        const host = hostRef.current;
        if (!host) return;
        host.innerHTML = '';
        await renderAsync(blob, host, undefined, {
          inWrapper: true,
          ignoreWidth: false,
          ignoreHeight: false,
          breakPages: true,
          experimental: true
        });
        if (!cancelled) setState('ready');
      } catch (e) {
        if (!cancelled) setState('failed');
      }
    })();

    return () => { cancelled = true; };
  }, [url]);

  if (state === 'failed') return <>{fallback}</>;

  return (
    <div className="relative h-full w-full overflow-auto bg-zinc-200 dark:bg-[#0c0d12]">
      {state === 'loading' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-zinc-600 dark:text-zinc-400">
          <div className="w-12 h-12 rounded-full bg-sky-500/10 text-sky-600 dark:text-sky-400 flex items-center justify-center">
            <FileType2 className="w-6 h-6" strokeWidth={1.5} />
          </div>
          <div className="flex items-center gap-2 text-[12px]">
            <Loader2 className="w-3.5 h-3.5 animate-spin" strokeWidth={1.5} />
            <span>Laying out {title}…</span>
          </div>
        </div>
      )}
      <div
        id="docx-render-host"
        ref={hostRef}
        className={state === 'ready' ? 'opacity-100 transition-opacity' : 'opacity-0'}
      />
    </div>
  );
};

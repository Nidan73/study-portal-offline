import React, { useState, useEffect, useRef } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { javascript } from '@codemirror/lang-javascript';
import { python } from '@codemirror/lang-python';
import { cpp } from '@codemirror/lang-cpp';
import { html } from '@codemirror/lang-html';
import { oneDark } from '@codemirror/theme-one-dark';
import { useStore } from '../store/useStore';
import { 
  Play, 
  Pause,
  RotateCcw, 
  RotateCw,
  Copy, 
  Check, 
  Terminal, 
  Code2, 
  Eye, 
  Trash2, 
  Maximize2, 
  Minimize2,
  X,
  Clock,
  AlertTriangle,
  ChevronDown,
  Video,
  Globe
} from 'lucide-react';

interface IntegratedIDEProps {
  isSplit?: boolean;
  onCloseSplit?: () => void;
}

export const IntegratedIDE: React.FC<IntegratedIDEProps> = ({ isSplit = false, onCloseSplit }) => {
  const { 
    theme, 
    activeCourseId,
    activeLesson, 
    currentTime,
    setCurrentTime,
    activeCodeLanguage, 
    setActiveCodeLanguage, 
    currentCode, 
    setCurrentCode, 
    codeOutput, 
    isExecutingCode, 
    executeCode, 
    resetCodeTemplate,
    setActiveTab,
    setSidePanelTab
  } = useStore();

  const [copied, setCopied] = useState(false);
  const [isOutputCollapsed, setIsOutputCollapsed] = useState(false);
  const [htmlViewMode, setHtmlViewMode] = useState<'editor' | 'preview' | 'split'>('editor');
  const [stdinInput, setStdinInput] = useState('');
  const [showStdin, setShowStdin] = useState(false);
  const [showFloatingPip, setShowFloatingPip] = useState(true);
  const [isPipPlaying, setIsPipPlaying] = useState(false);
  const pipVideoRef = useRef<HTMLVideoElement | null>(null);

  const formatTime = (secs: number) => {
    if (isNaN(secs)) return '00:00';
    const m = Math.floor((secs % 3600) / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  useEffect(() => {
    if (showFloatingPip && pipVideoRef.current && currentTime > 0) {
      pipVideoRef.current.currentTime = currentTime;
    }
  }, [showFloatingPip, activeLesson?.id]);

  const handlePipTogglePlay = () => {
    const v = pipVideoRef.current;
    if (!v) return;
    if (v.paused) {
      v.play().then(() => setIsPipPlaying(true)).catch(() => {});
    } else {
      v.pause();
      setIsPipPlaying(false);
    }
  };

  // Keyboard shortcut: Cmd/Ctrl + Enter to run
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault();
        executeCode();
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [executeCode]);

  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(currentCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (e) {}
  };

  const getLanguageExtension = () => {
    switch (activeCodeLanguage) {
      case 'javascript':
        return [javascript({ jsx: true, typescript: true })];
      case 'python':
        return [python()];
      case 'cpp':
      case 'c':
        return [cpp()];
      case 'html':
        return [html()];
      default:
        return [javascript()];
    }
  };

  const languages = [
    { id: 'javascript', label: 'JavaScript (Node v22)', ext: '.js' },
    { id: 'python', label: 'Python 3', ext: '.py' },
    { id: 'cpp', label: 'C++ (g++ -O2)', ext: '.cpp' },
    { id: 'c', label: 'C (gcc -O2)', ext: '.c' },
    { id: 'html', label: 'HTML / CSS / JS Sandbox', ext: '.html' }
  ] as const;

  return (
    <div className={`p-1.5 rounded-[2rem] bg-black/[0.03] dark:bg-white/[0.03] border border-black/[0.06] dark:border-white/[0.08] ${isSplit ? 'h-full min-h-[480px]' : 'h-[calc(100vh-120px)] min-h-[600px]'} flex flex-col transition-colors`}>
      <div className="flex flex-col h-full bg-white dark:bg-[#111218] border border-black/[0.05] dark:border-white/[0.06] rounded-[calc(2rem-0.375rem)] shadow-[inset_0_1px_1px_rgba(255,255,255,0.15)] dark:shadow-[inset_0_1px_1px_rgba(255,255,255,0.06)] overflow-hidden transition-colors">
        {/* IDE Header & Control Bar */}
        <div className="px-4 py-3 border-b border-black/[0.06] dark:border-white/[0.08] bg-black/[0.01] dark:bg-white/[0.02] flex flex-wrap items-center justify-between gap-3 select-none">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-7 h-7 rounded-full bg-indigo-500/10 flex items-center justify-center text-indigo-600 dark:text-indigo-400 flex-shrink-0">
              {activeCodeLanguage === 'html' ? (
                <Globe className="w-3.5 h-3.5" strokeWidth={1.5} />
              ) : (
                <Code2 className="w-3.5 h-3.5" strokeWidth={1.5} />
              )}
            </div>

            {/* Language Selector */}
            <div className="relative">
              <select
                value={activeCodeLanguage}
                onChange={(e) => setActiveCodeLanguage(e.target.value as any)}
                className="appearance-none bg-black/[0.03] dark:bg-white/[0.06] hover:bg-black/[0.06] dark:hover:bg-white/[0.09] text-zinc-900 dark:text-zinc-100 text-[12px] font-medium font-mono pl-3 pr-8 py-1.5 rounded-full border border-black/[0.06] dark:border-white/[0.08] focus:outline-none cursor-pointer transition-colors"
              >
                {languages.map(l => (
                  <option key={l.id} value={l.id} className="bg-white dark:bg-[#1a1b24] text-zinc-900 dark:text-zinc-100">
                    {l.label}
                  </option>
                ))}
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-zinc-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" strokeWidth={1.5} />
            </div>

            {activeLesson && (
              <span className="hidden xl:inline text-[11px] font-mono text-zinc-400 dark:text-zinc-500 truncate max-w-[200px]">
                {activeLesson.title}
              </span>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-1.5">
            {activeCodeLanguage === 'html' && (
              <div className="flex items-center rounded-full p-0.5 bg-black/[0.03] dark:bg-white/[0.06] border border-black/[0.05] dark:border-white/[0.08] mr-1 text-[11px] font-medium">
                <button
                  onClick={() => setHtmlViewMode('editor')}
                  className={`px-2.5 py-1 rounded-full transition-colors ${htmlViewMode === 'editor' ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white shadow-xs' : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-white'}`}
                >
                  Editor
                </button>
                <button
                  onClick={() => setHtmlViewMode('preview')}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-full transition-colors ${htmlViewMode === 'preview' ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white shadow-xs' : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-white'}`}
                >
                  <Globe className="w-3 h-3 text-indigo-500 dark:text-indigo-400" strokeWidth={1.5} />
                  <span>Web Preview</span>
                </button>
                <button
                  onClick={() => setHtmlViewMode('split')}
                  className={`hidden sm:inline px-2.5 py-1 rounded-full transition-colors ${htmlViewMode === 'split' ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white shadow-xs' : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-white'}`}
                >
                  Split
                </button>
              </div>
            )}

            <button
              onClick={handleCopyCode}
              className="p-1.5 rounded-full text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white bg-black/[0.02] hover:bg-black/[0.05] dark:bg-white/[0.04] dark:hover:bg-white/10 transition-colors"
              title="Copy Code"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" strokeWidth={1.5} /> : <Copy className="w-3.5 h-3.5" strokeWidth={1.5} />}
            </button>

            <button
              onClick={resetCodeTemplate}
              className="p-1.5 rounded-full text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white bg-black/[0.02] hover:bg-black/[0.05] dark:bg-white/[0.04] dark:hover:bg-white/10 transition-colors"
              title="Reset to Starter Template"
            >
              <RotateCcw className="w-3.5 h-3.5" strokeWidth={1.5} />
            </button>

            {/* Maximize to full page IDE or Split with Video toggle */}
            {isSplit ? (
              <button
                id="ide-expand-fullscreen-btn"
                onClick={() => setActiveTab('ide')}
                className="p-1.5 rounded-full text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white bg-black/[0.02] hover:bg-black/[0.05] dark:bg-white/[0.04] dark:hover:bg-white/10 transition-colors"
                title="Expand to Dedicated Full Page IDE (/ide)"
              >
                <Maximize2 className="w-3.5 h-3.5" strokeWidth={1.5} />
              </button>
            ) : (
              <button
                id="ide-split-with-video-btn"
                onClick={() => {
                  setActiveTab('player');
                  setSidePanelTab('code');
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-medium text-zinc-600 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white bg-black/[0.03] hover:bg-black/[0.06] dark:bg-white/[0.05] dark:hover:bg-white/10 border border-black/[0.05] dark:border-white/[0.07] transition-colors"
                title="Split Side-by-Side with Video Player"
              >
                <Minimize2 className="w-3 h-3" strokeWidth={1.5} />
                <span className="hidden sm:inline">Split with Video</span>
              </button>
            )}

            {/* Toggle Floating Mini Video (Dedicated /ide route only) */}
            {!isSplit && activeLesson && (
              <button
                id="ide-toggle-pip-btn"
                onClick={() => setShowFloatingPip(!showFloatingPip)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-medium transition-colors ${
                  showFloatingPip 
                    ? 'bg-indigo-600 text-white shadow-sm' 
                    : 'text-zinc-600 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white bg-black/[0.03] hover:bg-black/[0.06] dark:bg-white/[0.05] dark:hover:bg-white/10 border border-black/[0.05] dark:border-white/[0.07]'
                }`}
                title="Toggle Floating Mini Video in IDE"
              >
                <Video className="w-3 h-3" strokeWidth={1.5} />
                <span className="hidden sm:inline">{showFloatingPip ? 'Hide Mini Video' : 'Mini Video'}</span>
              </button>
            )}


            {/* Run Button */}
            <button
              id="ide-run-code-btn"
              onClick={executeCode}
              disabled={isExecutingCode}
              className={`flex items-center gap-1.5 px-4 py-1.5 rounded-full text-[12px] font-semibold transition-all duration-200 ease-fluid shadow-sm ${
                isExecutingCode
                  ? 'bg-zinc-400 dark:bg-zinc-700 text-white cursor-not-allowed opacity-80'
                  : 'bg-zinc-900 hover:bg-black dark:bg-white dark:hover:bg-zinc-100 text-white dark:text-zinc-950 active:scale-95'
              }`}
              title="Execute Code (⌘ + Enter)"
            >
              <Play className={`w-3 h-3 ${isExecutingCode ? 'animate-spin' : 'fill-current'}`} strokeWidth={1.5} />
              <span>{isExecutingCode ? 'Running...' : 'Run Code'}</span>
              <kbd className="hidden sm:inline text-[9px] font-mono px-1 rounded bg-white/20 dark:bg-zinc-950/20 opacity-80">
                ⌘↵
              </kbd>
            </button>

            {isSplit && onCloseSplit && (
              <button
                id="ide-close-split-btn"
                onClick={onCloseSplit}
                className="p-1.5 ml-1 rounded-full text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white bg-black/[0.02] hover:bg-black/[0.05] dark:bg-white/[0.04] dark:hover:bg-white/10 transition-colors"
                title="Close Split View"
              >
                <X className="w-3.5 h-3.5" strokeWidth={1.5} />
              </button>
            )}
          </div>
        </div>

        {/* Main Editor & Split Sandbox Body */}
        <div className="flex-1 flex flex-col min-h-0 relative overflow-hidden">
          {activeCodeLanguage === 'html' && (htmlViewMode === 'preview' || htmlViewMode === 'split') ? (
            <div className="flex-1 grid grid-cols-1 md:grid-cols-2 h-full min-h-0 divide-x divide-black/[0.06] dark:divide-white/[0.08]">
              {htmlViewMode === 'split' && (
                <div className="h-full overflow-auto">
                  <CodeMirror
                    value={currentCode}
                    height="100%"
                    theme={theme === 'dark' ? oneDark : undefined}
                    extensions={getLanguageExtension()}
                    onChange={(val) => setCurrentCode(val)}
                    className="h-full text-[13px] font-mono"
                  />
                </div>
              )}
              <div className={`${htmlViewMode === 'preview' ? 'col-span-full' : ''} h-full bg-white dark:bg-[#0c0d12] flex flex-col min-h-0`}>
                <div className="px-3 py-1.5 border-b border-black/[0.06] dark:border-white/[0.08] text-[10px] font-mono uppercase tracking-wider text-zinc-400 flex items-center justify-between">
                  <span>Live Sandbox Preview</span>
                  <Eye className="w-3 h-3 text-zinc-400" strokeWidth={1.5} />
                </div>
                <iframe
                  title="HTML Sandbox"
                  srcDoc={currentCode}
                  sandbox="allow-scripts allow-modals"
                  className="w-full flex-1 border-none bg-white dark:bg-[#0c0d12]"
                />
              </div>
            </div>
          ) : (
            <div className="flex-1 overflow-auto min-h-0">
              <CodeMirror
                value={currentCode}
                height="100%"
                theme={theme === 'dark' ? oneDark : undefined}
                extensions={getLanguageExtension()}
                onChange={(val) => setCurrentCode(val)}
                className="h-full text-[13px] font-mono"
              />
            </div>
          )}

          {/* Console Output Drawer */}
          {activeCodeLanguage !== 'html' && (
            <div className={`border-t border-black/[0.06] dark:border-white/[0.08] bg-black/[0.02] dark:bg-black/40 flex flex-col transition-all duration-200 ${isOutputCollapsed ? 'h-9' : 'h-48 sm:h-56'}`}>
              {/* Output Header */}
              <div className="px-4 py-2 flex items-center justify-between border-b border-black/[0.04] dark:border-white/[0.06] select-none text-[11px] font-mono">
                <div className="flex items-center gap-2">
                  <Terminal className="w-3.5 h-3.5 text-zinc-400 dark:text-zinc-500" strokeWidth={1.5} />
                  <span className="font-semibold text-zinc-700 dark:text-zinc-300">Terminal Output</span>

                  {codeOutput && (
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium border ${
                      codeOutput.exitCode === 0 
                        ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20' 
                        : 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20'
                    }`}>
                      {codeOutput.timedOut 
                        ? 'Timed Out' 
                        : codeOutput.compileError 
                          ? 'Compile Error' 
                          : codeOutput.exitCode === 0 
                            ? 'Exit Code 0' 
                            : `Exit Code ${codeOutput.exitCode}`}
                    </span>
                  )}

                  {codeOutput?.executionTimeMs !== undefined && (
                    <span className="text-zinc-400 text-[10px] flex items-center gap-1">
                      <Clock className="w-3 h-3" strokeWidth={1.5} />
                      {codeOutput.executionTimeMs}ms
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setIsOutputCollapsed(!isOutputCollapsed)}
                    className="text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 text-[11px] transition-colors"
                  >
                    {isOutputCollapsed ? 'Expand' : 'Collapse'}
                  </button>
                </div>
              </div>

              {/* Output Content */}
              {!isOutputCollapsed && (
                <div className="flex-1 p-3 overflow-auto font-mono text-[12px] leading-relaxed select-text space-y-2">
                  {codeOutput ? (
                    <>
                      {codeOutput.stdout && (
                        <pre className="text-zinc-800 dark:text-zinc-200 whitespace-pre-wrap">
                          {codeOutput.stdout}
                        </pre>
                      )}
                      {codeOutput.stderr && (
                        <pre className="text-rose-600 dark:text-rose-400 whitespace-pre-wrap bg-rose-500/5 p-2 rounded-lg border border-rose-500/15">
                          {codeOutput.stderr}
                        </pre>
                      )}
                      {!codeOutput.stdout && !codeOutput.stderr && (
                        <span className="text-zinc-400 italic">Program finished with no output.</span>
                      )}
                    </>
                  ) : (
                    <div className="text-zinc-400 dark:text-zinc-500 italic flex items-center gap-2 py-4">
                      <span>Press ⌘ + Enter or click "Run Code" to compile and execute.</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Floating Mini-PIP Video Player Widget (Dedicated /ide route only) */}
      {!isSplit && showFloatingPip && activeLesson && (
        <div 
          id="ide-floating-pip"
          className="fixed bottom-6 right-6 z-40 w-80 sm:w-96 p-2 rounded-2xl bg-zinc-950/95 backdrop-blur-2xl border border-white/20 shadow-[0_20px_50px_rgba(0,0,0,0.8)] animate-in slide-in-from-bottom-5 duration-200 select-none"
        >
          {/* Header */}
          <div className="flex items-center justify-between gap-2 px-2 py-1.5 mb-1.5 border-b border-white/10">
            <div className="flex items-center gap-2 min-w-0">
              <span className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
              <span className="text-[11px] font-medium text-white truncate max-w-[180px]">
                {activeLesson.title}
              </span>
            </div>

            <div className="flex items-center gap-1">
              <button
                id="ide-pip-switch-to-split-btn"
                onClick={() => {
                  setActiveTab('player');
                  setSidePanelTab('code');
                }}
                className="px-2 py-1 rounded-lg text-zinc-400 hover:text-white hover:bg-white/10 transition-colors text-[10px] flex items-center gap-1 font-medium"
                title="Switch to Split View"
              >
                <Minimize2 className="w-3 h-3" strokeWidth={1.5} />
                <span>Split</span>
              </button>
              <button
                id="ide-pip-close-btn"
                onClick={() => setShowFloatingPip(false)}
                className="p-1 rounded-lg text-zinc-400 hover:text-white hover:bg-white/10 transition-colors"
                title="Close Mini Video"
              >
                <X className="w-3.5 h-3.5" strokeWidth={1.5} />
              </button>
            </div>
          </div>

          {/* Video Container */}
          <div className="relative aspect-video rounded-xl overflow-hidden bg-black border border-white/10 group">
            {activeLesson.source === 'youtube' || activeLesson.youtubeVideoId ? (
              <iframe
                src={`https://www.youtube-nocookie.com/embed/${activeLesson.youtubeVideoId || activeLesson.relativePath}?autoplay=1&enablejsapi=1&rel=0`}
                className="w-full h-full border-0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            ) : (
              <>
                <video
                  ref={pipVideoRef}
                  src={`/api/stream/${activeCourseId}/${activeLesson.id}`}
                  className="w-full h-full object-contain cursor-pointer"
                  onClick={handlePipTogglePlay}
                  onTimeUpdate={() => {
                    if (pipVideoRef.current) {
                      setCurrentTime(pipVideoRef.current.currentTime);
                    }
                  }}
                  onPlay={() => setIsPipPlaying(true)}
                  onPause={() => setIsPipPlaying(false)}
                  playsInline
                />

                {/* Mini Overlay Controls */}
                <div className="absolute bottom-0 inset-x-0 p-2 bg-gradient-to-t from-black/90 to-transparent flex items-center justify-between text-white text-[11px] font-mono opacity-90 group-hover:opacity-100 transition-opacity">
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={handlePipTogglePlay}
                      className="w-6 h-6 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition-transform active:scale-95"
                      title={isPipPlaying ? 'Pause' : 'Play'}
                    >
                      {isPipPlaying ? (
                        <Pause className="w-3 h-3 fill-white" strokeWidth={1.5} />
                      ) : (
                        <Play className="w-3 h-3 fill-white ml-0.5" strokeWidth={1.5} />
                      )}
                    </button>
                <button
                  onClick={() => {
                    if (pipVideoRef.current) {
                      pipVideoRef.current.currentTime = Math.max(0, pipVideoRef.current.currentTime - 10);
                      setCurrentTime(pipVideoRef.current.currentTime);
                    }
                  }}
                  className="p-1 text-zinc-300 hover:text-white"
                  title="Rewind 10s"
                >
                  <RotateCcw className="w-3 h-3" strokeWidth={1.5} />
                </button>
                <button
                  onClick={() => {
                    if (pipVideoRef.current) {
                      pipVideoRef.current.currentTime = Math.min(pipVideoRef.current.duration || 0, pipVideoRef.current.currentTime + 10);
                      setCurrentTime(pipVideoRef.current.currentTime);
                    }
                  }}
                  className="p-1 text-zinc-300 hover:text-white"
                  title="Forward 10s"
                >
                  <RotateCw className="w-3 h-3" strokeWidth={1.5} />
                </button>
              </div>

              <div>
                <span>{formatTime(currentTime)}</span>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
      )}
    </div>
  );
};

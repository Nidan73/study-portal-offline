import React, { useEffect, useRef, useState, useCallback } from 'react';
import { SupplementaryFile } from '../types';
import {
  ChevronLeft,
  ChevronRight,
  BookmarkPlus,
  Check,
  Maximize2,
  Minimize2,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Monitor,
  Loader2,
  Layers,
  Sparkles,
  AlertCircle
} from 'lucide-react';

declare global {
  interface Window {
    PptxViewJS?: any;
    JSZip?: any;
    Chart?: any;
  }
}

interface PptxCanvasViewerProps {
  deck: SupplementaryFile;
  currentTime?: number;
  onPinSlide?: (slideNumber: number) => void;
  onLaunchDesktop?: (deck: SupplementaryFile) => void;
  isLaunchingDesktop?: boolean;
}

export const PptxCanvasViewer: React.FC<PptxCanvasViewerProps> = ({
  deck,
  currentTime = 0,
  onPinSlide,
  onLaunchDesktop,
  isLaunchingDesktop = false,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const viewerRef = useRef<any>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [loadingStatus, setLoadingStatus] = useState('Loading presentation engine...');
  const [error, setError] = useState<string | null>(null);
  const [slideCount, setSlideCount] = useState(0);
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
  const [zoomScale, setZoomScale] = useState(1);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showThumbnails, setShowThumbnails] = useState(false);
  const [pinSuccess, setPinSuccess] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [isFocused, setIsFocused] = useState(false);

  // Helper to ensure scripts are loaded
  const ensureScriptsLoaded = useCallback(async (): Promise<boolean> => {
    if (window.PptxViewJS && window.JSZip) return true;

    const loadScript = (src: string) =>
      new Promise<void>((resolve, reject) => {
        if (document.querySelector(`script[src="${src}"]`)) {
          resolve();
          return;
        }
        const s = document.createElement('script');
        s.src = src;
        s.async = false;
        s.onload = () => resolve();
        s.onerror = () => reject(new Error(`Failed to load ${src}`));
        document.head.appendChild(s);
      });

    try {
      if (!window.JSZip) await loadScript('/libs/jszip.min.js');
      if (!window.Chart) await loadScript('/libs/chart.umd.min.js');
      if (!window.PptxViewJS) await loadScript('/libs/PptxViewJS.min.js');
      return !!(window.PptxViewJS && window.JSZip);
    } catch (e) {
      console.error('Failed to load presentation engine scripts:', e);
      return false;
    }
  }, []);

  // Render a specific slide
  const renderSlide = useCallback(async (index: number) => {
    if (!viewerRef.current || !canvasRef.current) return;
    try {
      await viewerRef.current.render(canvasRef.current, { slideIndex: index });
      setCurrentSlideIndex(index);
    } catch (err: any) {
      console.error('Error rendering slide:', err);
    }
  }, []);

  // Jump to specific slide
  const goToSlide = useCallback((index: number) => {
    if (index >= 0 && index < slideCount) {
      renderSlide(index);
    }
  }, [slideCount, renderSlide]);

  const prevSlide = useCallback(() => {
    if (currentSlideIndex > 0) {
      goToSlide(currentSlideIndex - 1);
    }
  }, [currentSlideIndex, goToSlide]);

  const nextSlide = useCallback(() => {
    if (currentSlideIndex < slideCount - 1) {
      goToSlide(currentSlideIndex + 1);
    }
  }, [currentSlideIndex, slideCount, goToSlide]);

  // Load PPTX File into Viewer
  useEffect(() => {
    let isMounted = true;

    const initViewer = async () => {
      setIsLoading(true);
      setError(null);
      setLoadingStatus('Initializing slide engine...');

      const ready = await ensureScriptsLoaded();
      if (!ready || !isMounted) {
        if (isMounted) setError('Could not initialize PPTX presentation viewer engine.');
        setIsLoading(false);
        return;
      }

      const viewerClass = window.PptxViewJS?.PPTXViewer;
      if (!viewerClass) {
        if (isMounted) setError('PPTX viewer engine not available.');
        setIsLoading(false);
        return;
      }

      const canvas = canvasRef.current;
      if (!canvas) return;

      // Standard presentation canvas resolution (16:9 High DPI 1920x1080)
      canvas.width = 1920;
      canvas.height = 1080;

      const viewer = new viewerClass({
        canvas,
        slideSizeMode: 'fit',
        backgroundColor: '#ffffff'
      });
      viewerRef.current = viewer;

      try {
        setLoadingStatus(`Fetching ${deck.filename || 'presentation'}...`);
        let buffer: ArrayBuffer;

        if (deck.localFile) {
          buffer = await deck.localFile.arrayBuffer();
        } else if (deck.filePath) {
          const res = await fetch(`/api/slides/raw?path=${encodeURIComponent(deck.filePath)}`);
          if (!res.ok) throw new Error(`HTTP ${res.status}: Failed to download deck`);
          buffer = await res.arrayBuffer();
        } else if (deck.courseId && deck.id) {
          const res = await fetch(`/api/pdf/${deck.courseId}/${deck.id}`);
          if (!res.ok) throw new Error(`HTTP ${res.status}: Failed to fetch deck`);
          buffer = await res.arrayBuffer();
        } else {
          throw new Error('No valid presentation source available');
        }

        if (!isMounted) return;

        setLoadingStatus('Parsing presentation layouts & vector graphics...');
        await viewer.loadFile(buffer);

        if (!isMounted) return;

        const count = viewer.getSlideCount() || 0;
        setSlideCount(count);

        if (count > 0) {
          setLoadingStatus('Rendering slide 1...');
          await viewer.render(canvas, { slideIndex: 0 });
          setCurrentSlideIndex(0);
        } else {
          setError('No slides found in this presentation.');
        }
      } catch (err: any) {
        console.error('PPTX load error:', err);
        if (isMounted) {
          setError(err.message || 'Failed to render PPTX file');
        }
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    initViewer();

    return () => {
      isMounted = false;
      if (viewerRef.current) {
        try {
          viewerRef.current.destroy?.();
        } catch (_) {}
        viewerRef.current = null;
      }
    };
  }, [deck.filePath, deck.id, deck.localFile, ensureScriptsLoaded]);

  // Keyboard navigation (ArrowLeft, ArrowRight, PageUp, PageDown, Home, End, F)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeEl = document.activeElement;
      if (
        activeEl?.tagName === 'INPUT' || 
        activeEl?.tagName === 'TEXTAREA' || 
        activeEl?.tagName === 'SELECT' ||
        (activeEl as any)?.isContentEditable
      ) {
        return;
      }

      // Interaction is active on slides if:
      // 1. Mouse is hovering over the slides container
      // 2. Container or a child element is focused
      // 3. Slide viewer is in Fullscreen mode
      // 4. Cursor / target is within containerRef
      const target = e.target as HTMLElement | null;
      const isOverSlides =
        isHovered ||
        isFocused ||
        isFullscreen ||
        Boolean(containerRef.current?.contains(target)) ||
        Boolean(containerRef.current?.contains(activeEl)) ||
        Boolean(document.querySelector('#pptx-viewer-container:hover'));

      // If user is not interacting with slides, let CinemaPlayer handle ArrowLeft / ArrowRight!
      if (!isOverSlides) {
        return;
      }

      if (e.key === 'ArrowRight' || e.key === 'PageDown' || e.code === 'KeyN') {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        nextSlide();
        return;
      }

      if (e.key === 'ArrowLeft' || e.key === 'PageUp' || e.code === 'KeyP') {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        prevSlide();
        return;
      }

      if (e.key === 'Home') {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        goToSlide(0);
        return;
      }

      if (e.key === 'End') {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        goToSlide(slideCount - 1);
        return;
      }

      if (e.key === 'f' || e.key === 'F') {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        toggleFullscreen();
        return;
      }
    };

    // Use capture phase so slides intercept first when hovered/focused, without letting CinemaPlayer seek!
    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [isHovered, isFocused, isFullscreen, prevSlide, nextSlide, goToSlide, slideCount]);

  // Fullscreen toggle
  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {});
    }
  };

  useEffect(() => {
    const handleFsChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFsChange);
    return () => document.removeEventListener('fullscreenchange', handleFsChange);
  }, []);

  // Handle Pin Slide to user notes
  const handlePin = () => {
    if (onPinSlide) {
      onPinSlide(currentSlideIndex + 1);
      setPinSuccess(true);
      setTimeout(() => setPinSuccess(false), 2000);
    }
  };

  return (
    <div
      ref={containerRef}
      id="pptx-viewer-container"
      data-slide-viewer="true"
      tabIndex={0}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onFocus={() => setIsFocused(true)}
      onBlur={() => setIsFocused(false)}
      className={`relative flex flex-col h-full w-full bg-[#08090d] text-white overflow-hidden select-none transition-all duration-300 focus:outline-none ${
        isFullscreen ? 'fixed inset-0 z-50 p-4' : 'rounded-[calc(2rem-0.375rem)]'
      }`}
    >
      {/* Top Slide Meta Bar */}
      <div className="px-4 py-2.5 border-b border-white/[0.08] flex items-center justify-between gap-3 bg-white/[0.02] backdrop-blur-md">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="px-2.5 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-[10px] font-mono font-bold text-amber-400 tracking-wide uppercase shrink-0">
            Slide {slideCount > 0 ? currentSlideIndex + 1 : 0} / {slideCount}
          </span>
          <span className="text-[12px] font-medium text-zinc-300 truncate font-sans">
            {deck.title || deck.filename}
          </span>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {/* Quick Pin to Notes Button */}
          {onPinSlide && (
            <button
              id="btn-pin-pptx-slide"
              onClick={handlePin}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-full border text-[11px] font-medium transition-all active:scale-95 ${
                pinSuccess
                  ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400'
                  : 'bg-white/[0.05] hover:bg-white/[0.1] border-white/[0.1] text-zinc-200'
              }`}
              title="Pin current slide to notes at current video timestamp"
            >
              {pinSuccess ? (
                <Check className="w-3.5 h-3.5 text-emerald-400" strokeWidth={1.5} />
              ) : (
                <BookmarkPlus className="w-3.5 h-3.5 text-indigo-400" strokeWidth={1.5} />
              )}
              <span className="hidden sm:inline">{pinSuccess ? 'Pinned!' : 'Pin to Notes'}</span>
            </button>
          )}

          {/* Desktop Launcher */}
          {onLaunchDesktop && deck.filePath && (
            <button
              id="btn-open-onlyoffice-header"
              onClick={() => onLaunchDesktop(deck)}
              disabled={isLaunchingDesktop}
              className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/20 text-amber-300 text-[11px] font-semibold transition-all active:scale-95"
              title="Open full presentation in OnlyOffice / PowerPoint on PC"
            >
              {isLaunchingDesktop ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" strokeWidth={1.5} />
              ) : (
                <Monitor className="w-3.5 h-3.5" strokeWidth={1.5} />
              )}
              <span className="hidden sm:inline">Desktop App</span>
            </button>
          )}

          {/* Fullscreen Button */}
          <button
            onClick={toggleFullscreen}
            className="w-7 h-7 rounded-full flex items-center justify-center bg-white/[0.05] hover:bg-white/[0.1] border border-white/[0.08] text-zinc-300 hover:text-white transition-colors"
            title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
          >
            {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Main Slide Canvas Stage */}
      <div className="relative flex-1 w-full overflow-hidden flex items-center justify-center p-3 sm:p-6 bg-radial from-[#12131b] to-[#08090d]">
        {/* Loading Overlay */}
        {isLoading && (
          <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-[#08090d]/80 backdrop-blur-md space-y-3 p-6 text-center">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center shadow-lg animate-pulse">
              <Loader2 className="w-6 h-6 text-amber-400 animate-spin" strokeWidth={2} />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-semibold text-white tracking-tight">{loadingStatus}</p>
              <p className="text-xs text-zinc-400">Rendering authentic PowerPoint vector canvas</p>
            </div>
          </div>
        )}

        {/* Error Overlay */}
        {error && !isLoading && (
          <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-[#08090d]/90 backdrop-blur-md space-y-4 p-6 text-center max-w-md mx-auto">
            <div className="w-12 h-12 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-400">
              <AlertCircle className="w-6 h-6" strokeWidth={1.5} />
            </div>
            <div className="space-y-1.5">
              <h4 className="text-base font-bold text-white">Presentation Preview Notice</h4>
              <p className="text-xs text-zinc-400 leading-relaxed">{error}</p>
            </div>
            {deck.filePath && onLaunchDesktop && (
              <button
                onClick={() => onLaunchDesktop(deck)}
                className="px-5 py-2 rounded-full bg-amber-500 hover:bg-amber-400 text-black font-semibold text-xs flex items-center gap-2 shadow-lg active:scale-95 transition-all"
              >
                <Monitor className="w-4 h-4" strokeWidth={1.5} />
                <span>Open in Desktop OnlyOffice / PowerPoint</span>
              </button>
            )}
          </div>
        )}

        {/* The Real Canvas: High DPI Canvas Rendered directly from PPTX */}
        <div 
          className="relative max-w-full max-h-full flex items-center justify-center transition-transform duration-200 ease-out"
          style={{ transform: `scale(${zoomScale})` }}
        >
          <canvas
            id="pptx-render-canvas"
            ref={canvasRef}
            className="rounded-xl shadow-[0_20px_50px_rgba(0,0,0,0.8)] border border-white/10 max-w-full max-h-[75vh] w-auto h-auto object-contain bg-white"
            style={{ aspectRatio: '16 / 9' }}
          />
        </div>

        {/* On-Canvas Hover Navigation Arrows */}
        {slideCount > 1 && !isLoading && (
          <>
            <button
              id="pptx-hover-prev-btn"
              onClick={prevSlide}
              disabled={currentSlideIndex === 0}
              className="absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/60 hover:bg-black/90 backdrop-blur-md border border-white/15 text-white flex items-center justify-center opacity-40 hover:opacity-100 disabled:opacity-0 transition-all shadow-xl z-20"
              title="Previous Slide (←)"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>

            <button
              id="pptx-hover-next-btn"
              onClick={nextSlide}
              disabled={currentSlideIndex >= slideCount - 1}
              className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/60 hover:bg-black/90 backdrop-blur-md border border-white/15 text-white flex items-center justify-center opacity-40 hover:opacity-100 disabled:opacity-0 transition-all shadow-xl z-20"
              title="Next Slide (→)"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </>
        )}
      </div>

      {/* Thumbnails Drawer (Toggleable) */}
      {showThumbnails && slideCount > 0 && (
        <div className="border-t border-white/[0.08] bg-black/80 backdrop-blur-xl p-3 flex items-center gap-2 overflow-x-auto z-20 animate-in slide-in-from-bottom-3 duration-200">
          {Array.from({ length: slideCount }, (_, i) => {
            const isSelected = i === currentSlideIndex;
            return (
              <button
                key={i}
                onClick={() => goToSlide(i)}
                className={`shrink-0 px-3 py-2 rounded-xl text-center border transition-all ${
                  isSelected
                    ? 'bg-amber-500 text-black font-bold border-amber-400 shadow-md scale-105'
                    : 'bg-white/[0.05] hover:bg-white/[0.1] border-white/[0.08] text-zinc-300'
                }`}
              >
                <div className="text-[10px] font-mono uppercase opacity-75">Slide</div>
                <div className="text-sm font-extrabold">{i + 1}</div>
              </button>
            );
          })}
        </div>
      )}

      {/* Floating Bottom Control Bar */}
      <div className="px-4 py-3 border-t border-white/[0.08] bg-black/40 backdrop-blur-md flex flex-wrap items-center justify-between gap-3 shrink-0">
        
        {/* Stepper Navigation */}
        <div className="flex items-center gap-2">
          <button
            id="pptx-nav-prev-btn"
            onClick={prevSlide}
            disabled={currentSlideIndex === 0 || isLoading}
            className="px-3 py-1.5 rounded-full bg-white/[0.06] hover:bg-white/[0.12] border border-white/[0.08] text-xs font-semibold text-white disabled:opacity-30 disabled:cursor-not-allowed flex items-center gap-1 transition-all active:scale-95"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Prev</span>
          </button>

          {/* Quick Slide Jump Dropdown */}
          <div className="relative flex items-center">
            <select
              value={currentSlideIndex}
              onChange={(e) => goToSlide(parseInt(e.target.value, 10))}
              disabled={isLoading || slideCount === 0}
              className="appearance-none bg-white/[0.06] hover:bg-white/[0.1] border border-white/[0.08] rounded-full px-4 py-1.5 text-xs font-mono font-medium text-white cursor-pointer focus:outline-none focus:ring-1 focus:ring-amber-500/50 pr-7 transition-colors text-center"
            >
              {Array.from({ length: slideCount }, (_, idx) => (
                <option key={idx} value={idx} className="bg-[#12131b] text-white">
                  Slide {idx + 1} of {slideCount}
                </option>
              ))}
            </select>
            <span className="pointer-events-none absolute right-2.5 text-[10px] text-zinc-400">▾</span>
          </div>

          <button
            id="pptx-nav-next-btn"
            onClick={nextSlide}
            disabled={currentSlideIndex >= slideCount - 1 || isLoading}
            className="px-3 py-1.5 rounded-full bg-white/[0.06] hover:bg-white/[0.12] border border-white/[0.08] text-xs font-semibold text-white disabled:opacity-30 disabled:cursor-not-allowed flex items-center gap-1 transition-all active:scale-95"
          >
            <span className="hidden sm:inline">Next</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Center: Slide Strip / Thumbnails Toggle */}
        <button
          onClick={() => setShowThumbnails(!showThumbnails)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-medium transition-all ${
            showThumbnails
              ? 'bg-amber-500/20 border-amber-500/40 text-amber-300'
              : 'bg-white/[0.06] hover:bg-white/[0.1] border-white/[0.08] text-zinc-300'
          }`}
          title="Toggle slide selector drawer"
        >
          <Layers className="w-3.5 h-3.5" />
          <span>{showThumbnails ? 'Hide Slides' : 'All Slides'}</span>
        </button>

        {/* Right: Zoom & View Controls */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => setZoomScale(prev => Math.max(0.6, prev - 0.15))}
            className="w-7 h-7 rounded-full flex items-center justify-center bg-white/[0.06] hover:bg-white/[0.12] border border-white/[0.08] text-zinc-300 hover:text-white transition-colors"
            title="Zoom Out"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={() => setZoomScale(1)}
            className="px-2.5 py-1 rounded-full bg-white/[0.06] hover:bg-white/[0.12] border border-white/[0.08] text-[10px] font-mono text-zinc-300 hover:text-white transition-colors"
            title="Reset Zoom (100%)"
          >
            {Math.round(zoomScale * 100)}%
          </button>

          <button
            onClick={() => setZoomScale(prev => Math.min(2.0, prev + 0.15))}
            className="w-7 h-7 rounded-full flex items-center justify-center bg-white/[0.06] hover:bg-white/[0.12] border border-white/[0.08] text-zinc-300 hover:text-white transition-colors"
            title="Zoom In"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
        </div>

      </div>
    </div>
  );
};

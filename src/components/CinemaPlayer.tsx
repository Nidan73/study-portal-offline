import React, { useRef, useEffect, useState, useCallback } from 'react';
import { useStore } from '../store/useStore';
import { 
  Play, 
  Pause, 
  RotateCcw, 
  RotateCw, 
  Volume2, 
  VolumeX, 
  Maximize, 
  PictureInPicture2, 
  SkipForward, 
  SkipBack, 
  Check, 
  FileText,
  X,
  Bookmark,
  Repeat,
  Sparkles,
  HelpCircle,
  Trash2,
  Plus,
  Sliders
} from 'lucide-react';

export const CinemaPlayer: React.FC = () => {
  const { 
    activeCourseId, 
    activeLesson, 
    currentTime, 
    setCurrentTime, 
    duration, 
    setDuration, 
    isPlaying, 
    setIsPlaying, 
    playbackRate, 
    setPlaybackRate, 
    volume, 
    setVolume, 
    isMuted, 
    toggleMute,
    audioBoost,
    setAudioBoost,
    abLoop,
    setLoopA,
    setLoopB,
    toggleLoop,
    clearLoop,
    addBookmark,
    removeBookmark,
    clearAllBookmarks,
    setShortcutHelpOpen,
    syncProgressToDisk, 
    toggleLessonComplete, 
    userData, 
    goToNextLesson, 
    goToPrevLesson,
    selectPdf
  } = useStore();

  const isYouTube = Boolean(activeLesson?.source === 'youtube' || activeLesson?.youtubeVideoId);
  const ytVideoId = activeLesson?.youtubeVideoId || (isYouTube ? activeLesson?.relativePath : '');

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const scrubBarRef = useRef<HTMLDivElement | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const compressorNodeRef = useRef<DynamicsCompressorNode | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const sourceNodeRef = useRef<MediaElementAudioSourceNode | null>(null);
  const ytPlayerRef = useRef<any>(null);
  const ytMountRef = useRef<HTMLDivElement | null>(null);
  const ytTimePollRef = useRef<any>(null);
  const controlsTimeoutRef = useRef<any>(null);

  const [showControls, setShowControls] = useState(true);
  const [hoverTime, setHoverTime] = useState<number | null>(null);
  const [hoverPosition, setHoverPosition] = useState<number>(0);
  const [bufferedPercent, setBufferedPercent] = useState<number>(0);
  const [showNextOverlay, setShowNextOverlay] = useState(false);
  const [nextCountdown, setNextCountdown] = useState(5);
  const [isSpeedMenuOpen, setIsSpeedMenuOpen] = useState(false);
  const [isLoopMenuOpen, setIsLoopMenuOpen] = useState(false);
  const [isBookmarksMenuOpen, setIsBookmarksMenuOpen] = useState(false);
  const [isBoostMenuOpen, setIsBoostMenuOpen] = useState(false);

  const bookmarks = activeLesson ? (userData?.courses?.[activeCourseId]?.bookmarks?.[activeLesson.id] || []) : [];
  const isCompleted = activeLesson ? (userData?.courses?.[activeCourseId]?.completedLessonIds || []).includes(activeLesson.id) : false;

  const initAudioBooster = useCallback(() => {
    if (isYouTube) return; // Audio booster is only applicable to local media elements
    const video = videoRef.current;
    if (!video || audioCtxRef.current) {
      if (audioCtxRef.current && audioCtxRef.current.state === 'suspended') {
        audioCtxRef.current.resume().catch(() => {});
      }
      return;
    }
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      if (ctx.state === 'suspended') {
        ctx.resume().catch(() => {});
      }
      const source = ctx.createMediaElementSource(video);

      // Studio-Grade Vocal Clarity & Dynamics Compressor
      const compressor = ctx.createDynamicsCompressor();
      compressor.threshold.setValueAtTime(-20, ctx.currentTime);
      compressor.knee.setValueAtTime(15, ctx.currentTime);
      compressor.ratio.setValueAtTime(audioBoost > 1 ? 8 : 1, ctx.currentTime);
      compressor.attack.setValueAtTime(0.003, ctx.currentTime);
      compressor.release.setValueAtTime(0.25, ctx.currentTime);

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(audioBoost, ctx.currentTime);

      // Pipeline: Video Source -> Vocal Dynamics Compressor -> Power Gain -> Destination
      source.connect(compressor);
      compressor.connect(gain);
      gain.connect(ctx.destination);

      audioCtxRef.current = ctx;
      compressorNodeRef.current = compressor;
      gainNodeRef.current = gain;
      sourceNodeRef.current = source;
    } catch (e) {
      console.warn('Web Audio API notice:', e);
    }
  }, [audioBoost, isYouTube]);

  // Clean AudioContext and controlsTimeout on component unmount
  useEffect(() => {
    return () => {
      if (audioCtxRef.current && audioCtxRef.current.state !== 'closed') {
        audioCtxRef.current.close().catch(() => {});
        audioCtxRef.current = null;
      }
      if (controlsTimeoutRef.current) {
        clearTimeout(controlsTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!isYouTube && gainNodeRef.current && audioCtxRef.current) {
      if (audioCtxRef.current.state === 'suspended') {
        audioCtxRef.current.resume().catch(() => {});
      }
      gainNodeRef.current.gain.setValueAtTime(audioBoost, audioCtxRef.current.currentTime);
      if (compressorNodeRef.current) {
        compressorNodeRef.current.ratio.setValueAtTime(audioBoost > 1 ? 8 : 1, audioCtxRef.current.currentTime);
      }
    }
  }, [audioBoost, isYouTube]);

  const handleBoostChange = (newBoost: number) => {
    if (isYouTube) return;
    initAudioBooster();
    if (audioCtxRef.current && audioCtxRef.current.state === 'suspended') {
      audioCtxRef.current.resume().catch(() => {});
    }
    setAudioBoost(newBoost);
  };

  const formatTime = (secs: number) => {
    if (isNaN(secs)) return '00:00';
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = Math.floor(secs % 60);
    if (h > 0) {
      return `${h}:${m < 10 ? '0' : ''}${m}:${s < 10 ? '0' : ''}${s}`;
    }
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const videoSrc = activeLesson && !isYouTube
    ? `/api/stream/${activeCourseId}/${activeLesson.id}` 
    : '';

  const handleEnded = useCallback(() => {
    setIsPlaying(false);
    if (activeLesson) {
      toggleLessonComplete(activeLesson.id);
      syncProgressToDisk(true);
    }
    setShowNextOverlay(true);
  }, [activeLesson, toggleLessonComplete, syncProgressToDisk, setIsPlaying]);

  // YouTube IFrame Lifecycle & Polling
  useEffect(() => {
    if (!isYouTube || !ytVideoId) {
      if (ytPlayerRef.current) {
        try { ytPlayerRef.current.destroy(); } catch (e) {}
        ytPlayerRef.current = null;
      }
      if (ytTimePollRef.current) {
        clearInterval(ytTimePollRef.current);
        ytTimePollRef.current = null;
      }
      return;
    }

    let isSubscribed = true;

    const setupPlayer = () => {
      if (!isSubscribed || !(window as any).YT || !(window as any).YT.Player) return;

      if (ytPlayerRef.current) {
        try { ytPlayerRef.current.destroy(); } catch (e) {}
        ytPlayerRef.current = null;
      }

      if (ytMountRef.current) {
        // Distinct id: the outer container is React's, this inner node is the one
        // YT.Player is allowed to replace with its iframe.
        ytMountRef.current.innerHTML = '<div id="youtube-player-target" style="width:100%;height:100%;pointer-events:none;"></div>';
      }

      try {
        const player = new (window as any).YT.Player('youtube-player-target', {
          width: '100%',
          height: '100%',
          videoId: ytVideoId,
          playerVars: {
            autoplay: isPlaying ? 1 : 0,
            start: Math.floor(currentTime),
            controls: 0,
            modestbranding: 1,
            rel: 0,
            playsinline: 1,
            enablejsapi: 1,
            fs: 0,
            iv_load_policy: 3,
            disablekb: 1
          },
          events: {
            onReady: (event: any) => {
              if (!isSubscribed) return;
              ytPlayerRef.current = event.target;
              const d = event.target.getDuration();
              if (d > 0) setDuration(d);
              // Explicit seek: the `start` playerVar is applied at construction
              // and silently ignored in some load orders, which is why saved
              // YouTube positions appeared to be lost.
              const resumeAt = useStore.getState().currentTime;
              if (resumeAt > 1) event.target.seekTo(resumeAt, true);
              if (playbackRate !== 1) event.target.setPlaybackRate(playbackRate);
              if (isMuted) event.target.mute();
              else event.target.setVolume(volume * 100);
              if (isPlaying) event.target.playVideo();
            },
            onStateChange: (event: any) => {
              if (!isSubscribed) return;
              // 1 = PLAYING, 2 = PAUSED, 0 = ENDED
              if (event.data === 1) {
                setIsPlaying(true);
                if (ytTimePollRef.current) clearInterval(ytTimePollRef.current);
                ytTimePollRef.current = setInterval(() => {
                  if (ytPlayerRef.current && typeof ytPlayerRef.current.getCurrentTime === 'function') {
                    const t = ytPlayerRef.current.getCurrentTime();
                    setCurrentTime(t);
                    const d = ytPlayerRef.current.getDuration();
                    if (d && d > 0) setDuration(d);

                    const { abLoop } = useStore.getState();
                    if (abLoop.active && abLoop.a !== null && abLoop.b !== null && abLoop.b > abLoop.a) {
                      if (t >= abLoop.b) {
                        ytPlayerRef.current.seekTo(abLoop.a, true);
                        setCurrentTime(abLoop.a);
                        return;
                      }
                    }
                    useStore.getState().syncProgressToDisk(false);
                  }
                }, 250);
              } else if (event.data === 2) {
                setIsPlaying(false);
                if (ytTimePollRef.current) {
                  clearInterval(ytTimePollRef.current);
                  ytTimePollRef.current = null;
                }
                useStore.getState().syncProgressToDisk(true);
              } else if (event.data === 0) {
                setIsPlaying(false);
                if (ytTimePollRef.current) {
                  clearInterval(ytTimePollRef.current);
                  ytTimePollRef.current = null;
                }
                handleEnded();
              }
            }
          }
        });
      } catch (err) {
        console.error('Error creating YouTube player:', err);
      }
    };

    const isYTReady = () => typeof (window as any).YT !== 'undefined' && typeof (window as any).YT.Player === 'function';

    if (!isYTReady()) {
      if (!document.getElementById('youtube-iframe-api-script')) {
        const tag = document.createElement('script');
        tag.id = 'youtube-iframe-api-script';
        tag.src = 'https://www.youtube.com/iframe_api';
        document.body.appendChild(tag);
      }
      const prevCallback = (window as any).onYouTubeIframeAPIReady;
      (window as any).onYouTubeIframeAPIReady = () => {
        if (typeof prevCallback === 'function') prevCallback();
        if (isSubscribed) setupPlayer();
      };
    } else {
      setupPlayer();
    }

    return () => {
      isSubscribed = false;
      if (ytTimePollRef.current) {
        clearInterval(ytTimePollRef.current);
        ytTimePollRef.current = null;
      }
      if (ytPlayerRef.current) {
        try { ytPlayerRef.current.destroy(); } catch (e) {}
        ytPlayerRef.current = null;
      }
      if (ytMountRef.current) {
        ytMountRef.current.innerHTML = '';
      }
    };
  }, [isYouTube, ytVideoId]);

  // Local Video Lifecycle
  useEffect(() => {
    if (isYouTube) return;
    const video = videoRef.current;
    if (!video || !videoSrc) return;

    video.src = videoSrc;
    video.load();

    video.preservesPitch = true;
    (video as any).mozPreservesPitch = true;
    (video as any).webkitPreservesPitch = true;
    video.playbackRate = playbackRate;

    setShowNextOverlay(false);
    setNextCountdown(5);

    if (currentTime > 0) {
      video.currentTime = currentTime;
    }

    if (isPlaying) {
      video.play().catch(() => {});
    }
  }, [activeLesson?.id, videoSrc, isYouTube]);

  useEffect(() => {
    return () => {
      const video = videoRef.current;
      if (video) {
        try {
          video.pause();
          video.removeAttribute('src');
          video.load();
        } catch (e) {}
      }
    };
  }, []);

  useEffect(() => {
    if (isYouTube && ytPlayerRef.current && typeof ytPlayerRef.current.setPlaybackRate === 'function') {
      ytPlayerRef.current.setPlaybackRate(playbackRate);
    } else if (videoRef.current) {
      videoRef.current.playbackRate = playbackRate;
    }
  }, [playbackRate, isYouTube]);

  useEffect(() => {
    if (isYouTube && ytPlayerRef.current) {
      if (isMuted) {
        ytPlayerRef.current.mute?.();
      } else {
        ytPlayerRef.current.unMute?.();
        ytPlayerRef.current.setVolume?.(volume * 100);
      }
    } else if (videoRef.current) {
      videoRef.current.volume = isMuted ? 0 : volume;
    }
  }, [volume, isMuted, isYouTube]);

  // Drive the media element from the store's isPlaying flag.
  //
  // Without this, setIsPlaying(false) from elsewhere (the note composer's
  // auto-pause, most visibly) only flipped a boolean: the video kept playing
  // while the big centre Play overlay — which renders on !isPlaying — appeared
  // on top of it. Each branch checks the player's real state first, so this
  // cannot ping-pong with the element's own onPlay/onPause handlers.
  useEffect(() => {
    if (isYouTube) {
      const player = ytPlayerRef.current;
      if (!player || typeof player.getPlayerState !== 'function') return;
      const YT_PLAYING = 1;
      let state: number;
      try {
        state = player.getPlayerState();
      } catch (e) {
        return;
      }
      if (isPlaying && state !== YT_PLAYING) player.playVideo?.();
      else if (!isPlaying && state === YT_PLAYING) player.pauseVideo?.();
      return;
    }

    const video = videoRef.current;
    if (!video) return;
    if (isPlaying && video.paused) {
      initAudioBooster();
      video.play().catch(() => {});
    } else if (!isPlaying && !video.paused) {
      video.pause();
    }
  }, [isPlaying, isYouTube, initAudioBooster]);

  // Sync external seek (e.g. clicking notes timestamps or bookmarks)
  useEffect(() => {
    if (isYouTube) {
      if (ytPlayerRef.current && typeof ytPlayerRef.current.getCurrentTime === 'function') {
        const ytTime = ytPlayerRef.current.getCurrentTime() || 0;
        if (Math.abs(ytTime - currentTime) > 1.5) {
          ytPlayerRef.current.seekTo(currentTime, true);
        }
      }
    } else {
      if (videoRef.current) {
        if (Math.abs(videoRef.current.currentTime - currentTime) > 1.5) {
          videoRef.current.currentTime = currentTime;
        }
      }
    }
  }, [currentTime, isYouTube]);

  const togglePlay = useCallback(() => {
    if (isYouTube && ytPlayerRef.current) {
      const state = ytPlayerRef.current.getPlayerState?.();
      if (state === 1) {
        ytPlayerRef.current.pauseVideo?.();
        setIsPlaying(false);
      } else {
        ytPlayerRef.current.playVideo?.();
        setIsPlaying(true);
      }
      return;
    }

    const video = videoRef.current;
    if (!video) return;

    if (video.paused) {
      initAudioBooster();
      if (audioCtxRef.current && audioCtxRef.current.state === 'suspended') {
        audioCtxRef.current.resume().catch(() => {});
      }
      video.play().then(() => setIsPlaying(true)).catch(() => {});
    } else {
      video.pause();
      setIsPlaying(false);
      syncProgressToDisk(true);
    }
  }, [isYouTube, setIsPlaying, syncProgressToDisk, initAudioBooster]);

  const skipSeconds = useCallback((delta: number) => {
    if (isYouTube && ytPlayerRef.current) {
      const cur = ytPlayerRef.current.getCurrentTime?.() || 0;
      const maxTime = duration > 0 ? duration : Infinity;
      const target = Math.max(0, Math.min(maxTime, cur + delta));
      ytPlayerRef.current.seekTo?.(target, true);
      setCurrentTime(target);
      syncProgressToDisk(false);
      return;
    }

    const video = videoRef.current;
    if (!video) return;
    const maxTime = video.duration > 0 ? video.duration : Infinity;
    const newTime = Math.max(0, Math.min(maxTime, video.currentTime + delta));
    video.currentTime = newTime;
    setCurrentTime(newTime);
    syncProgressToDisk(false);
  }, [isYouTube, duration, setCurrentTime, syncProgressToDisk]);

  const handleMouseMove = () => {
    setShowControls(true);
    if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    controlsTimeoutRef.current = setTimeout(() => {
      if (useStore.getState().isPlaying) setShowControls(false);
    }, 2500);
  };

  const updateBuffer = () => {
    const video = videoRef.current;
    if (!video || video.buffered.length === 0) return;
    try {
      const bufferedEnd = video.buffered.end(video.buffered.length - 1);
      const total = video.duration || 1;
      setBufferedPercent(Math.min(100, (bufferedEnd / total) * 100));
    } catch (e) {}
  };

  const handleTimeUpdate = () => {
    const video = videoRef.current;
    if (!video) return;
    const time = video.currentTime;

    // A-B Looper auto-repeat logic
    if (abLoop.active && abLoop.a !== null && abLoop.b !== null && abLoop.b > abLoop.a) {
      if (time >= abLoop.b) {
        video.currentTime = abLoop.a;
        setCurrentTime(abLoop.a);
        return;
      }
    }

    setCurrentTime(time);
    updateBuffer();
    syncProgressToDisk(false);
  };

  useEffect(() => {
    if (!showNextOverlay) return;
    const interval = setInterval(() => {
      setNextCountdown(prev => {
        if (prev <= 1) {
          clearInterval(interval);
          setShowNextOverlay(false);
          goToNextLesson();
          return 5;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [showNextOverlay, goToNextLesson]);

  const handleScrub = (e: React.MouseEvent<HTMLDivElement>) => {
    const bar = scrubBarRef.current;
    if (!bar || duration <= 0) return;

    const rect = bar.getBoundingClientRect();
    const pos = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const targetTime = pos * duration;

    if (isYouTube && ytPlayerRef.current) {
      ytPlayerRef.current.seekTo?.(targetTime, true);
    } else if (videoRef.current) {
      videoRef.current.currentTime = targetTime;
    }
    setCurrentTime(targetTime);
    syncProgressToDisk(true);
  };

  const handleScrubMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const bar = scrubBarRef.current;
    if (!bar || duration <= 0) return;

    const rect = bar.getBoundingClientRect();
    const pos = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    setHoverTime(pos * duration);
    setHoverPosition(e.clientX - rect.left);
  };

  // Zero-churn ref-stabilized keyboard listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeEl = document.activeElement;
      const target = e.target as HTMLElement | null;
      if (
        activeEl?.tagName === 'INPUT' || 
        activeEl?.tagName === 'TEXTAREA' || 
        (activeEl as any)?.isContentEditable ||
        target?.closest('#pptx-viewer-container') ||
        target?.closest('[data-slide-viewer]') ||
        (activeEl as HTMLElement | null)?.closest?.('#pptx-viewer-container')
      ) {
        return;
      }

      if (e.key === '?' || (e.shiftKey && e.code === 'Slash')) {
        e.preventDefault();
        setShortcutHelpOpen(true);
        return;
      }

      const store = useStore.getState();
      const currentLesson = store.activeLesson;
      const activeIsYT = Boolean(currentLesson?.source === 'youtube' || currentLesson?.youtubeVideoId);
      const curTime = activeIsYT 
        ? (ytPlayerRef.current?.getCurrentTime?.() || store.currentTime)
        : (videoRef.current?.currentTime ?? store.currentTime);

      if (e.shiftKey) {
        if (e.code === 'KeyA') {
          e.preventDefault();
          store.setLoopA(curTime);
          return;
        }
        if (e.code === 'KeyB') {
          e.preventDefault();
          store.setLoopB(curTime);
          return;
        }
        if (e.code === 'KeyL') {
          e.preventDefault();
          store.toggleLoop();
          return;
        }
        if (e.code === 'KeyR') {
          e.preventDefault();
          store.clearLoop();
          return;
        }
      }

      switch (e.code) {
        case 'KeyB':
          e.preventDefault();
          if (currentLesson) {
            store.addBookmark(currentLesson.id, curTime);
          }
          break;
        case 'Space':
        case 'KeyK':
          e.preventDefault();
          togglePlay();
          break;
        case 'KeyJ':
          e.preventDefault();
          skipSeconds(-10);
          break;
        case 'ArrowLeft': {
          const isSlidesActive = Boolean(
            document.querySelector('#pptx-viewer-container:hover') ||
            document.querySelector('[data-slide-viewer]:hover') ||
            (document.activeElement as HTMLElement | null)?.closest?.('#pptx-viewer-container')
          );
          if (isSlidesActive) return;
          e.preventDefault();
          skipSeconds(-10);
          break;
        }
        case 'KeyL':
          e.preventDefault();
          skipSeconds(10);
          break;
        case 'ArrowRight': {
          const isSlidesActive = Boolean(
            document.querySelector('#pptx-viewer-container:hover') ||
            document.querySelector('[data-slide-viewer]:hover') ||
            (document.activeElement as HTMLElement | null)?.closest?.('#pptx-viewer-container')
          );
          if (isSlidesActive) return;
          e.preventDefault();
          skipSeconds(10);
          break;
        }
        case 'KeyF':
          e.preventDefault();
          toggleFullscreen();
          break;
        case 'KeyM':
          e.preventDefault();
          toggleMute();
          break;
        case 'BracketLeft':
          e.preventDefault();
          store.setPlaybackRate(Math.max(0.75, Number((store.playbackRate - 0.25).toFixed(2))));
          break;
        case 'BracketRight':
          e.preventDefault();
          store.setPlaybackRate(Math.min(2.5, Number((store.playbackRate + 0.25).toFixed(2))));
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [togglePlay, skipSeconds, toggleMute, setShortcutHelpOpen]);


  const togglePiP = async () => {
    const video = videoRef.current;
    if (!video) return;
    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
      } else {
        await video.requestPictureInPicture();
      }
    } catch (e) {}
  };

  const toggleFullscreen = () => {
    const container = containerRef.current;
    if (!container) return;
    if (!document.fullscreenElement) {
      container.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  };

  if (!activeLesson) {
    return (
      <div className="p-2 rounded-[2rem] bg-black/[0.03] dark:bg-white/[0.03] border border-black/[0.06] dark:border-white/[0.08]">
        <div className="flex flex-col items-center justify-center h-[460px] rounded-[calc(2rem-0.5rem)] bg-white dark:bg-[#111218] border border-black/[0.05] dark:border-white/[0.06] shadow-[inset_0_1px_1px_rgba(255,255,255,0.15)] dark:shadow-[inset_0_1px_1px_rgba(255,255,255,0.06)] p-8 text-center select-none transition-colors">
          <div className="w-14 h-14 rounded-full bg-black/[0.04] dark:bg-white/[0.06] flex items-center justify-center text-zinc-500 dark:text-zinc-400 mb-4 border border-black/[0.04] dark:border-white/[0.08]">
            <Play className="w-5 h-5 ml-0.5" strokeWidth={1.5} />
          </div>
          <span className="rounded-full px-2.5 py-0.5 text-[10px] uppercase tracking-[0.2em] font-medium font-mono bg-zinc-100 dark:bg-white/[0.06] text-zinc-500 dark:text-zinc-400 mb-2">
            Offline Player
          </span>
          <h3 className="text-[16px] font-bold text-zinc-900 dark:text-white tracking-tight">No Lecture Selected</h3>
          <p className="text-[13px] text-zinc-500 dark:text-zinc-400 max-w-sm mt-1 leading-relaxed">
            Select any lecture from the syllabus on the right or press Command+K to search.
          </p>
        </div>
      </div>
    );
  }

  const playedPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className="p-1.5 sm:p-2 rounded-[2rem] bg-black/[0.03] dark:bg-white/[0.03] border border-black/[0.06] dark:border-white/[0.08] shadow-[0_12px_40px_rgba(0,0,0,0.06)] dark:shadow-[0_20px_50px_rgba(0,0,0,0.5)]">
      <div 
        ref={containerRef}
        id="cinema-player-container"
        onMouseMove={handleMouseMove}
        className="relative group rounded-[calc(2rem-0.375rem)] sm:rounded-[calc(2rem-0.5rem)] overflow-hidden bg-black border border-black/[0.1] dark:border-white/[0.08] shadow-[inset_0_1px_1px_rgba(255,255,255,0.15)] dark:shadow-[inset_0_1px_1px_rgba(255,255,255,0.06)] select-none"
      >
        {/* HTML5 Video or YouTube IFrame Element */}
        <div className="relative aspect-video w-full max-h-[calc(100vh-220px)] bg-black flex items-center justify-center">
          {isYouTube ? (
            <>
              <div ref={ytMountRef} id="youtube-player-element" className="w-full h-full pointer-events-none" />
              {/* Clean Cinema Overlay: click to play/pause, leaves bottom 96px free for HUD controls */}
              <div 
                id="youtube-click-overlay"
                className="absolute inset-0 bottom-24 cursor-pointer z-10"
                onClick={togglePlay}
              />
            </>
          ) : (
            <video
              ref={videoRef}
              src={videoSrc}
              crossOrigin="anonymous"
              className="w-full h-full object-contain cursor-pointer"
              onClick={togglePlay}
              onTimeUpdate={handleTimeUpdate}
              onDurationChange={() => {
                if (videoRef.current) setDuration(videoRef.current.duration || 0);
              }}
              onLoadedMetadata={() => {
                if (videoRef.current) {
                  setDuration(videoRef.current.duration || 0);
                  if (currentTime > 0) videoRef.current.currentTime = currentTime;
                }
              }}
              onPlay={() => setIsPlaying(true)}
              onPause={() => {
                setIsPlaying(false);
                syncProgressToDisk(true);
              }}
              onEnded={handleEnded}
              playsInline
            />
          )}

          {/* Minimal Subtle Play Button when Paused (Unified for Local and YouTube) */}
          {!isPlaying && (
            <button
              onClick={togglePlay}
              className="absolute inset-0 m-auto w-16 h-16 rounded-full bg-black/70 hover:bg-black/85 text-white flex items-center justify-center border border-white/20 transition-all duration-300 ease-fluid active:scale-95 shadow-2xl backdrop-blur-md group z-20"
              title="Play (Space)"
            >
              <span className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center transition-transform duration-300 ease-fluid group-hover:scale-110">
                <Play className="w-5 h-5 fill-white ml-0.5" strokeWidth={1.5} />
              </span>
            </button>
          )}

        {/* Next Lesson Overlay */}
        {showNextOverlay && (
          <div className="absolute bottom-16 right-4 bg-zinc-950/95 border border-white/15 rounded-2xl p-4 shadow-2xl backdrop-blur-2xl z-30 max-w-xs animate-in fade-in">
            <div className="flex items-center justify-between gap-3 mb-2.5">
              <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-zinc-500">
                Up next in {nextCountdown}s
              </span>
              <button 
                onClick={() => setShowNextOverlay(false)}
                className="text-zinc-500 dark:text-zinc-400 hover:text-white transition-colors"
              >
                <X className="w-4 h-4" strokeWidth={1.5} />
              </button>
            </div>
            <button
              onClick={() => {
                setShowNextOverlay(false);
                goToNextLesson();
              }}
              className="w-full px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-[12px] font-medium transition-all duration-200 ease-fluid flex items-center justify-between group"
            >
              <span>Play Next Now</span>
              <span className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center transition-transform duration-300 ease-fluid group-hover:translate-x-0.5">
                <SkipForward className="w-3 h-3 text-white" strokeWidth={1.5} />
              </span>
            </button>
          </div>
        )}
      </div>

      {/* Floating HUD Controls */}
      <div 
        id="floating-hud-controls"
        onClick={(e) => e.stopPropagation()}
        className={`absolute bottom-0 inset-x-0 p-4 bg-gradient-to-t from-black/95 via-black/70 to-transparent transition-opacity duration-200 z-30 ${
          showControls || !isPlaying ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
      >
        {/* Scrub Bar */}
        <div 
          id="hud-scrub-bar"
          ref={scrubBarRef}
          onClick={handleScrub}
          onMouseMove={handleScrubMouseMove}
          onMouseLeave={() => setHoverTime(null)}
          className="relative h-1.5 hover:h-2.5 w-full bg-white/15 rounded-full cursor-pointer mb-3 transition-all duration-200 ease-fluid group/scrub"
        >
          {/* Buffered */}
          <div 
            className="absolute top-0 left-0 h-full bg-white/25 rounded-full transition-all duration-100"
            style={{ width: `${bufferedPercent}%` }}
          />

          {/* A-B Loop Range Band */}
          {abLoop.a !== null && abLoop.b !== null && duration > 0 && (
            <div 
              className={`absolute top-0 h-full pointer-events-none rounded-sm transition-opacity ${
                abLoop.active ? 'bg-indigo-500/40 border-x-2 border-indigo-300' : 'bg-white/20 border-x border-white/40'
              }`}
              style={{
                left: `${(Math.min(abLoop.a, abLoop.b) / duration) * 100}%`,
                width: `${(Math.abs(abLoop.b - abLoop.a) / duration) * 100}%`
              }}
            />
          )}

          {/* Played */}
          <div 
            className="absolute top-0 left-0 h-full bg-indigo-500 rounded-full shadow-sm"
            style={{ width: `${playedPercent}%` }}
          />

          {/* A-B Loop Markers */}
          {abLoop.a !== null && duration > 0 && (
            <div 
              className="absolute -top-1 bottom-0 w-1 bg-emerald-400 z-20 pointer-events-none rounded-full shadow"
              style={{ left: `${(abLoop.a / duration) * 100}%` }}
              title={`Loop Point A: ${formatTime(abLoop.a)}`}
            />
          )}
          {abLoop.b !== null && duration > 0 && (
            <div 
              className="absolute -top-1 bottom-0 w-1 bg-rose-400 z-20 pointer-events-none rounded-full shadow"
              style={{ left: `${(abLoop.b / duration) * 100}%` }}
              title={`Loop Point B: ${formatTime(abLoop.b)}`}
            />
          )}

          {/* Scrubber Bookmarks / Pins */}
          {bookmarks.map((bm) => {
            const pinPercent = duration > 0 ? (bm.timestampSeconds / duration) * 100 : 0;
            return (
              <div
                key={bm.id}
                onClick={(e) => {
                  e.stopPropagation();
                  if (isYouTube && ytPlayerRef.current) {
                    ytPlayerRef.current.seekTo?.(bm.timestampSeconds, true);
                  } else if (videoRef.current) {
                    videoRef.current.currentTime = bm.timestampSeconds;
                  }
                  setCurrentTime(bm.timestampSeconds);
                  syncProgressToDisk(true);
                }}
                style={{ left: `${pinPercent}%` }}
                className="absolute -top-1.5 bottom-0 w-2.5 -translate-x-1/2 flex flex-col items-center justify-start group/pin z-30 cursor-pointer"
                title={`${bm.label} (${formatTime(bm.timestampSeconds)})`}
              >
                <div className="w-1.5 h-4 bg-amber-400 dark:bg-amber-300 rounded-sm shadow transition-transform group-hover/pin:scale-125" />
                <div className="opacity-0 group-hover/pin:opacity-100 pointer-events-auto absolute -top-9 px-2 py-0.5 rounded-full bg-zinc-950/95 border border-amber-500/40 text-[10px] font-mono text-amber-300 whitespace-nowrap shadow-xl transition-opacity flex items-center gap-1.5 z-40">
                  <span>{bm.label}</span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      removeBookmark(activeLesson.id, bm.id);
                    }}
                    className="w-4 h-4 rounded-full hover:bg-rose-500/30 text-zinc-500 dark:text-zinc-400 hover:text-rose-400 flex items-center justify-center transition-colors"
                    title="Delete Pin"
                  >
                    <Trash2 className="w-2.5 h-2.5" strokeWidth={1.5} />
                  </button>
                </div>
              </div>
            );
          })}

          {/* Tooltip */}
          {hoverTime !== null && (
            <div 
              className="absolute -top-8 -translate-x-1/2 px-2.5 py-0.5 rounded-full bg-zinc-950 border border-white/20 text-[10px] font-mono text-white pointer-events-none shadow-xl z-30"
              style={{ left: `${hoverPosition}px` }}
            >
              {formatTime(hoverTime)}
            </div>
          )}
        </div>


        {/* Actions Bar */}
        <div className="flex items-center justify-between gap-2">
          {/* Left Actions */}
          <div className="flex items-center gap-1.5 sm:gap-2">
            <button
              id="hud-prev-btn"
              onClick={goToPrevLesson}
              className="p-1.5 text-white/70 hover:text-white transition-colors"
              title="Previous"
            >
              <SkipBack className="w-3.5 h-3.5" strokeWidth={1.5} />
            </button>

            <button
              id="hud-play-btn"
              onClick={togglePlay}
              className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-transform active:scale-95"
              title={isPlaying ? 'Pause' : 'Play'}
            >
              {isPlaying ? <Pause className="w-3.5 h-3.5 fill-white" strokeWidth={1.5} /> : <Play className="w-3.5 h-3.5 fill-white ml-0.5" strokeWidth={1.5} />}
            </button>

            <button
              id="hud-next-btn"
              onClick={goToNextLesson}
              className="p-1.5 text-white/70 hover:text-white transition-colors"
              title="Next"
            >
              <SkipForward className="w-3.5 h-3.5" strokeWidth={1.5} />
            </button>

            <button
              id="hud-rewind-btn"
              onClick={() => skipSeconds(-10)}
              className="hidden sm:block p-1.5 text-white/70 hover:text-white transition-colors"
              title="Rewind 10s"
            >
              <RotateCcw className="w-3.5 h-3.5" strokeWidth={1.5} />
            </button>

            <button
              id="hud-forward-btn"
              onClick={() => skipSeconds(10)}
              className="hidden sm:block p-1.5 text-white/70 hover:text-white transition-colors"
              title="Forward 10s"
            >
              <RotateCw className="w-3.5 h-3.5" strokeWidth={1.5} />
            </button>

            {/* Volume */}
            <div className="flex items-center gap-1.5 group/vol ml-1">
              <button
                id="hud-mute-btn"
                onClick={toggleMute}
                className="p-1.5 text-white/70 hover:text-white transition-colors"
                title="Mute"
              >
                {isMuted || volume === 0 ? <VolumeX className="w-3.5 h-3.5 text-white/50" strokeWidth={1.5} /> : <Volume2 className="w-3.5 h-3.5" strokeWidth={1.5} />}
              </button>
              <input
                id="hud-volume-slider"
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={isMuted ? 0 : volume}
                onChange={(e) => {
                  const val = parseFloat(e.target.value);
                  setVolume(val);
                  if (isYouTube && ytPlayerRef.current) {
                    if (val === 0) ytPlayerRef.current.mute?.();
                    else {
                      ytPlayerRef.current.unMute?.();
                      ytPlayerRef.current.setVolume?.(val * 100);
                    }
                  }
                }}
                className="w-14 h-1 bg-white/20 rounded-full appearance-none cursor-pointer accent-white hidden sm:block"
              />
            </div>

            {/* Audio Vocal Booster (Up to 300% with Vocal Compressor) */}
            <div className="relative hidden sm:block">
              <button
                id="audio-boost-btn"
                onClick={() => {
                  if (isYouTube) return;
                  const presets = [1.0, 1.5, 2.0, 3.0];
                  const idx = presets.indexOf(audioBoost);
                  const next = idx !== -1 ? presets[(idx + 1) % presets.length] : 1.5;
                  handleBoostChange(next);
                }}
                onContextMenu={(e) => {
                  e.preventDefault();
                  if (!isYouTube) setIsBoostMenuOpen(!isBoostMenuOpen);
                }}
                disabled={isYouTube}
                className={`flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-mono font-bold transition-all select-none ${
                  isYouTube
                    ? 'opacity-40 cursor-not-allowed bg-white/5 text-white/40'
                    : audioBoost > 1 
                      ? 'bg-amber-500/25 text-amber-300 border border-amber-500/50 shadow-[0_0_12px_rgba(245,158,11,0.3)]' 
                      : 'bg-white/10 hover:bg-white/15 text-white/70 border border-transparent'
                }`}
                title={isYouTube ? 'Booster for local media only' : `Vocal & Audio Booster: ${Math.round(audioBoost * 100)}% (Click to cycle 100% -> 150% -> 200% -> 300%, Right-click for slider)`}
              >
                <Sparkles className={`w-3 h-3 ${audioBoost > 1 && !isYouTube ? 'text-amber-400 fill-amber-400/20' : 'text-white/60'}`} strokeWidth={1.5} />
                <span>{isYouTube ? '100%' : `${Math.round(audioBoost * 100)}%`}</span>
              </button>

              {isBoostMenuOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setIsBoostMenuOpen(false)} />
                  <div id="audio-boost-popover" className="absolute left-0 bottom-full mb-2 w-56 rounded-2xl bg-zinc-950/95 backdrop-blur-2xl border border-white/15 shadow-2xl p-2.5 z-50 animate-in fade-in space-y-2 select-none">
                    <div className="flex items-center justify-between text-[10px] font-mono uppercase tracking-widest text-zinc-500 dark:text-zinc-400 px-1">
                      <span>Audio Booster</span>
                      <span className="text-amber-400 font-bold">{Math.round(audioBoost * 100)}%</span>
                    </div>

                    <div className="px-1">
                      <input
                        id="audio-boost-slider"
                        type="range"
                        min="1"
                        max="3"
                        step="0.1"
                        value={audioBoost}
                        onChange={(e) => handleBoostChange(parseFloat(e.target.value))}
                        className="w-full h-1.5 bg-white/20 rounded-full appearance-none cursor-pointer accent-amber-400"
                      />
                    </div>

                    <div className="grid grid-cols-4 gap-1 pt-1">
                      {[1.0, 1.5, 2.0, 3.0].map((preset) => (
                        <button
                          key={preset}
                          onClick={() => handleBoostChange(preset)}
                          className={`py-1 rounded-lg text-[10px] font-mono font-semibold transition-colors ${
                            audioBoost === preset
                              ? 'bg-amber-500 text-zinc-950 font-bold'
                              : 'bg-white/10 hover:bg-white/20 text-zinc-300'
                          }`}
                        >
                          {Math.round(preset * 100)}%
                        </button>
                      ))}
                    </div>

                    <div className="text-[9px] text-zinc-500 dark:text-zinc-400 px-1 text-center font-mono">
                      Vocal Dynamics Compressor Active
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Time */}
            <div className="text-[11px] font-mono text-white/70 ml-1.5 whitespace-nowrap flex-shrink-0 tabular-nums">
              <span className="text-white font-medium">{formatTime(currentTime)}</span>
              <span className="text-white/40 mx-1">/</span>
              <span>{formatTime(duration)}</span>
            </div>
          </div>

          {/* Right Actions */}
          <div className="flex items-center gap-1.5 sm:gap-2 min-w-0 flex-shrink">
            {/* Bookmarks Manager Control — secondary, hides first when narrow */}
            <div className="relative hidden md:block flex-shrink-0">
              <button
                id="bookmarks-menu-btn"
                onClick={() => setIsBookmarksMenuOpen(!isBookmarksMenuOpen)}
                className={`flex items-center gap-1 px-2.5 py-1.5 rounded-full text-[11px] font-medium transition-all ${
                  isBookmarksMenuOpen || bookmarks.length > 0
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-xs'
                    : 'bg-white/10 hover:bg-white/15 text-white/70 border border-transparent'
                }`}
                title="Lecture Bookmarks & Pins"
              >
                <Bookmark className="w-3.5 h-3.5" strokeWidth={1.5} />
                <span className="text-[10px] font-mono font-bold">{bookmarks.length}</span>
              </button>

              {isBookmarksMenuOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setIsBookmarksMenuOpen(false)} />
                  <div 
                    id="bookmarks-popover"
                    className="absolute right-0 bottom-full mb-2 w-72 rounded-2xl bg-zinc-950/95 backdrop-blur-2xl border border-white/15 shadow-2xl p-2.5 z-50 animate-in fade-in space-y-2 select-none"
                  >
                    <div className="flex items-center justify-between px-1">
                      <div className="flex items-center gap-1.5">
                        <Bookmark className="w-3.5 h-3.5 text-amber-400" strokeWidth={1.5} />
                        <span className="text-[11px] font-bold text-white tracking-tight">
                          Timeline Pins ({bookmarks.length})
                        </span>
                      </div>
                      <button
                        id="add-bookmark-btn"
                        onClick={() => {
                          addBookmark(activeLesson.id, currentTime);
                        }}
                        className="flex items-center gap-1 px-2 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 text-[10px] font-medium transition-colors"
                        title="Pin current video position"
                      >
                        <Plus className="w-3 h-3" strokeWidth={1.5} />
                        <span>Pin ({formatTime(currentTime)})</span>
                      </button>
                    </div>

                    {bookmarks.length === 0 ? (
                      <div className="p-3 text-center text-[11px] text-zinc-500 dark:text-zinc-400 italic">
                        No pins dropped yet. Press <kbd className="font-mono text-zinc-500">B</kbd> or click "+ Pin".
                      </div>
                    ) : (
                      <div className="max-h-52 overflow-y-auto space-y-1 pr-0.5">
                        {bookmarks
                          .slice()
                          .sort((a, b) => a.timestampSeconds - b.timestampSeconds)
                          .map((bm) => (
                            <div
                              key={bm.id}
                              onClick={() => {
                                if (isYouTube && ytPlayerRef.current) {
                                  ytPlayerRef.current.seekTo?.(bm.timestampSeconds, true);
                                } else if (videoRef.current) {
                                  videoRef.current.currentTime = bm.timestampSeconds;
                                }
                                setCurrentTime(bm.timestampSeconds);
                                syncProgressToDisk(true);
                              }}
                              className="group/item flex items-center justify-between gap-2 p-1.5 rounded-xl hover:bg-white/10 cursor-pointer transition-colors"
                            >
                              <div className="flex items-center gap-2 min-w-0">
                                <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 font-mono text-[10px] flex-shrink-0 font-bold">
                                  {formatTime(bm.timestampSeconds)}
                                </span>
                                <span className="text-[11px] text-zinc-300 truncate">
                                  {bm.label}
                                </span>
                              </div>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  removeBookmark(activeLesson.id, bm.id);
                                }}
                                className="p-1 rounded-lg hover:bg-rose-500/20 text-zinc-500 dark:text-zinc-400 hover:text-rose-400 opacity-60 group-hover/item:opacity-100 transition-all flex-shrink-0"
                                title="Delete pin"
                              >
                                <Trash2 className="w-3.5 h-3.5" strokeWidth={1.5} />
                              </button>
                            </div>
                          ))}
                      </div>
                    )}

                    {bookmarks.length > 1 && (
                      <div className="pt-1.5 border-t border-white/10 flex justify-end">
                        <button
                          onClick={() => clearAllBookmarks(activeLesson.id)}
                          className="text-[10px] text-zinc-500 dark:text-zinc-400 hover:text-rose-400 transition-colors flex items-center gap-1"
                        >
                          <Trash2 className="w-3 h-3" strokeWidth={1.5} />
                          <span>Clear All Pins</span>
                        </button>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>

            {/* A-B Looper Control — secondary, hides first when narrow */}
            <div className="relative hidden lg:block flex-shrink-0">
              <button
                id="ab-loop-btn"
                onClick={() => setIsLoopMenuOpen(!isLoopMenuOpen)}
                className={`flex items-center gap-1 px-2.5 py-1.5 rounded-full text-[11px] font-medium whitespace-nowrap transition-all ${
                  abLoop.active
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : abLoop.a !== null || abLoop.b !== null
                      ? 'bg-white/20 text-indigo-300 border border-indigo-400/30'
                      : 'bg-white/10 hover:bg-white/15 text-white/70'
                }`}
                title="A-B Loop Practice Mode"
              >
                <Repeat className="w-3 h-3" strokeWidth={1.5} />
                <span className="hidden sm:inline">
                  {abLoop.active ? 'Looping' : abLoop.a !== null ? 'A-B Set' : 'A-B'}
                </span>
              </button>

              {isLoopMenuOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setIsLoopMenuOpen(false)} />
                  <div className="absolute right-0 bottom-full mb-2 w-52 rounded-2xl bg-zinc-950/95 backdrop-blur-2xl border border-white/15 shadow-2xl p-2.5 z-50 animate-in fade-in space-y-2">
                    <div className="text-[10px] font-mono uppercase tracking-widest text-zinc-500 dark:text-zinc-400 px-1">
                      A-B Looper Practice
                    </div>
                    <div className="grid grid-cols-2 gap-1.5 text-[11px] font-mono">
                      <button
                        onClick={() => {
                          const t = videoRef.current ? videoRef.current.currentTime : currentTime;
                          setLoopA(t);
                        }}
                        className="px-2 py-1.5 rounded-xl bg-white/10 hover:bg-white/15 text-zinc-200 text-left flex items-center justify-between"
                      >
                        <span>Set A:</span>
                        <span className="text-emerald-400">{abLoop.a !== null ? formatTime(abLoop.a) : '--:--'}</span>
                      </button>
                      <button
                        onClick={() => {
                          const t = videoRef.current ? videoRef.current.currentTime : currentTime;
                          const targetB = (abLoop.a !== null && t <= abLoop.a) ? abLoop.a + 30 : (t === 0 ? 30 : t);
                          setLoopB(targetB);
                        }}
                        className="px-2 py-1.5 rounded-xl bg-white/10 hover:bg-white/15 text-zinc-200 text-left flex items-center justify-between"
                      >
                        <span>Set B:</span>
                        <span className="text-rose-400">{abLoop.b !== null ? formatTime(abLoop.b) : '--:--'}</span>
                      </button>
                    </div>

                    <div className="flex items-center gap-1.5 pt-1 border-t border-white/10">
                      <button
                        disabled={abLoop.a === null || abLoop.b === null || abLoop.b <= abLoop.a}
                        onClick={() => {
                          toggleLoop();
                          setIsLoopMenuOpen(false);
                        }}
                        className={`flex-1 py-1.5 rounded-xl text-[11px] font-medium transition-colors ${
                          abLoop.active 
                            ? 'bg-indigo-600 text-white' 
                            : 'bg-white/10 hover:bg-white/20 text-white disabled:opacity-40 disabled:pointer-events-none'
                        }`}
                      >
                        {abLoop.active ? 'Stop Loop' : 'Start Loop'}
                      </button>
                      <button
                        onClick={() => {
                          clearLoop();
                        }}
                        className="px-2 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-zinc-500 dark:text-zinc-400 hover:text-white text-[11px]"
                        title="Clear A and B markers"
                      >
                        Reset
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>

            {activeLesson.companionPdf && (
              <button
                onClick={() => selectPdf(activeLesson.companionPdf || null)}
                className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/10 hover:bg-white/20 text-white text-[11px] font-medium flex-shrink-0 transition-colors"
                title="Open Slides"
              >
                <FileText className="w-3 h-3" strokeWidth={1.5} />
                <span className="hidden sm:inline">Slides</span>
              </button>
            )}

            <button
              onClick={() => toggleLessonComplete(activeLesson.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-medium whitespace-nowrap flex-shrink-0 transition-all duration-200 ease-fluid ${
                isCompleted 
                  ? 'bg-emerald-700 text-white shadow-sm' 
                  : 'bg-white/10 text-white hover:bg-white/15'
              }`}
              title="Toggle Completed"
            >
              <Check className="w-3 h-3" strokeWidth={1.5} />
              <span className="hidden sm:inline">{isCompleted ? 'Completed' : 'Mark Done'}</span>
            </button>

            {/* Speed Selector */}
            <div className="relative">
              <button
                id="hud-speed-btn"
                onClick={() => setIsSpeedMenuOpen(!isSpeedMenuOpen)}
                className="px-2.5 py-1.5 rounded-full bg-white/10 hover:bg-white/20 text-[11px] font-mono text-white transition-colors"
                title="Playback Rate"
              >
                {playbackRate}x
              </button>

              {isSpeedMenuOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setIsSpeedMenuOpen(false)} />
                  <div className="absolute right-0 bottom-full mb-2 w-28 rounded-2xl bg-zinc-900/95 backdrop-blur-xl border border-white/15 shadow-2xl p-1.5 z-50 animate-in fade-in">
                    {[0.75, 1, 1.25, 1.5, 1.75, 2].map((rate) => (
                      <button
                        key={rate}
                        id={`hud-speed-option-${rate}`}
                        onClick={() => {
                          setPlaybackRate(rate);
                          setIsSpeedMenuOpen(false);
                        }}
                        className={`w-full text-left px-2.5 py-1 rounded-xl text-[11px] font-mono transition-colors ${
                          playbackRate === rate ? 'bg-indigo-600 text-white font-bold' : 'text-zinc-300 hover:bg-white/10'
                        }`}
                      >
                        {rate}x
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>

            {/* Keyboard Shortcuts Trigger */}
            <button
              onClick={() => setShortcutHelpOpen(true)}
              className="p-1.5 text-white/70 hover:text-white transition-colors"
              title="Keyboard Shortcuts (?)"
            >
              <HelpCircle className="w-3.5 h-3.5" strokeWidth={1.5} />
            </button>

            {!isYouTube && (
              <button
                onClick={togglePiP}
                className="p-1.5 text-white/70 hover:text-white transition-colors"
                title="Picture in Picture"
              >
                <PictureInPicture2 className="w-3.5 h-3.5" strokeWidth={1.5} />
              </button>
            )}

            <button
              id="hud-fullscreen-btn"
              onClick={toggleFullscreen}
              className="p-1.5 text-white/70 hover:text-white transition-colors"
              title="Fullscreen"
            >
              <Maximize className="w-3.5 h-3.5" strokeWidth={1.5} />
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
  );
};

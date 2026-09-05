import React, { useState, useEffect, useRef } from 'react';
import { useStore } from '../store/useStore';
import { YouTubeSearchResult } from '../types';
import { 
  Search, 
  Youtube, 
  Play, 
  Layers, 
  Clock, 
  Eye, 
  AlertCircle, 
  ArrowRight, 
  X, 
  Check, 
  Sparkles,
  Loader2,
  Film,
  DownloadCloud,
  ExternalLink
} from 'lucide-react';

const CURATED_TOPICS = [
  'System Design',
  'Rust Programming',
  'TypeScript Fullstack',
  'Machine Learning MIT',
  'Distributed Systems',
  'Data Structures & Algorithms',
  'Linux Kernel Architecture',
  'DevOps & Kubernetes'
];

export const YouTubeExplorer: React.FC = () => {
  const { 
    playYouTubeVideoImmediately, 
    saveYouTubeCourse
  } = useStore();

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<YouTubeSearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isImporting, setIsImporting] = useState<string | null>(null);
  const [importStatus, setImportStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeTopic, setActiveTopic] = useState<string | null>(null);
  const [detectedType, setDetectedType] = useState<'video' | 'playlist' | null>(null);
  const [detectedId, setDetectedId] = useState<string | null>(null);

  const searchInputRef = useRef<HTMLInputElement>(null);
  const lastSearchTimeRef = useRef<number>(0);

  // Auto-detect direct YouTube URLs
  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed) {
      setDetectedType(null);
      setDetectedId(null);
      return;
    }

    // Playlist check (e.g. list=PL... or playlist?list=...)
    const playlistMatch = trimmed.match(/[?&]list=([a-zA-Z0-9_-]+)/i);
    if (playlistMatch && playlistMatch[1]) {
      setDetectedType('playlist');
      setDetectedId(playlistMatch[1]);
      return;
    }

    // Video check (e.g. youtube.com/watch?v=..., youtu.be/...)
    const videoMatch = trimmed.match(/(?:v=|\/embed\/|youtu\.be\/|\/v\/|watch\?v=|\/watch\?.+&v=)([\w-]{11})/i);
    if (videoMatch && videoMatch[1]) {
      setDetectedType('video');
      setDetectedId(videoMatch[1]);
      return;
    }

    setDetectedType(null);
    setDetectedId(null);
  }, [query]);

  // Execute Search
  const handleSearch = async (searchTerm?: string) => {
    const targetQuery = (searchTerm !== undefined ? searchTerm : query).trim();
    if (!targetQuery) return;

    // Cooldown check (prevent spamming InnerTube API)
    const now = Date.now();
    if (now - lastSearchTimeRef.current < 1200) {
      return;
    }
    lastSearchTimeRef.current = now;

    setIsLoading(true);
    setError(null);

    try {
      // If it's a playlist URL, fetch playlist directly
      const playlistMatch = targetQuery.match(/[?&]list=([a-zA-Z0-9_-]+)/i);
      if (playlistMatch && playlistMatch[1]) {
        const playlistId = playlistMatch[1];
        const res = await fetch(`/api/youtube/playlist?id=${encodeURIComponent(playlistId)}`);
        if (!res.ok) throw new Error('Could not fetch YouTube playlist');
        const data = await res.json();
        
        // Map playlist videos to search results format
        const mappedResults: YouTubeSearchResult[] = (data.videos || []).map((v: any) => ({
          id: v.videoId || v.id,
          title: v.title,
          description: `Part of playlist: ${data.title || 'YouTube Series'}`,
          channelTitle: data.channelTitle || 'YouTube',
          thumbnail: v.thumbnail || `https://i.ytimg.com/vi/${v.videoId}/hqdefault.jpg`,
          durationText: v.durationText || 'Video',
          durationSeconds: v.durationSeconds || 0,
          viewCountText: '',
          publishedTimeText: 'Playlist Item',
          isPlaylist: false
        }));

        setResults(mappedResults);
        setIsLoading(false);
        return;
      }

      // If it's a single video URL, fetch info via oEmbed
      const videoMatch = targetQuery.match(/(?:v=|\/embed\/|youtu\.be\/|\/v\/|watch\?v=|\/watch\?.+&v=)([\w-]{11})/i);
      if (videoMatch && videoMatch[1]) {
        const videoId = videoMatch[1];
        const res = await fetch(`/api/youtube/info?id=${encodeURIComponent(videoId)}`);
        if (res.ok) {
          const info = await res.json();
          setResults([{
            id: videoId,
            title: info.title || 'YouTube Video',
            description: `Author: ${info.author_name || 'YouTube'}`,
            channelTitle: info.author_name || 'YouTube',
            thumbnail: info.thumbnail_url || `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
            durationText: 'Direct Video',
            durationSeconds: 0,
            viewCountText: '',
            publishedTimeText: 'Direct Link',
            isPlaylist: false
          }]);
          setIsLoading(false);
          return;
        }
      }

      // Standard search via InnerTube backend
      const res = await fetch('/api/youtube/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: targetQuery })
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'Failed to search YouTube');
      }

      const data = await res.json();
      const normalized: YouTubeSearchResult[] = (data.results || []).map((r: any) => ({
        id: r.id,
        title: r.title || 'Untitled Lecture',
        description: r.description || '',
        channelTitle: r.channelTitle || r.author || 'YouTube Educator',
        thumbnail: r.thumbnail || `https://i.ytimg.com/vi/${r.id}/hqdefault.jpg`,
        durationText: r.durationText || r.duration || '',
        durationSeconds: r.durationSeconds || 0,
        viewCountText: r.viewCountText || r.views || '',
        publishedTimeText: r.publishedTimeText || '',
        isPlaylist: Boolean(r.isPlaylist),
        playlistId: r.playlistId
      }));
      setResults(normalized);
    } catch (err: any) {
      console.error('YouTube search error:', err);
      setError(err.message || 'Failed to fetch YouTube results. Please check your network connection.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleTopicClick = (topic: string) => {
    setActiveTopic(topic);
    setQuery(topic);
    handleSearch(topic);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSearch();
    }
  };

  // Import a playlist as a full offline course
  const handleImportPlaylist = async (playlistId: string, titleHint?: string) => {
    try {
      setIsImporting(playlistId);
      setImportStatus('Fetching playlist metadata...');
      
      const res = await fetch(`/api/youtube/playlist?id=${encodeURIComponent(playlistId)}`);
      if (!res.ok) throw new Error('Failed to resolve playlist metadata');
      const data = await res.json();

      if (!data.videos || data.videos.length === 0) {
        throw new Error('No videos found in this playlist');
      }

      setImportStatus(`Importing ${data.videos.length} lectures into your library...`);
      const courseTitle = data.title || titleHint || 'YouTube Masterclass';
      
      const courseId = await saveYouTubeCourse(courseTitle, playlistId, data.videos);
      if (courseId) {
        setImportStatus('Done! Switching to Cinema Player...');
      } else {
        throw new Error('Failed to save course to study hub');
      }
    } catch (err: any) {
      console.error('Import error:', err);
      alert(`Import error: ${err.message}`);
    } finally {
      setIsImporting(null);
      setImportStatus(null);
    }
  };

  return (
    <div className="space-y-8 max-w-7xl mx-auto py-4 sm:py-6 pb-24 select-none transition-colors">
      
      {/* Hero & Title Area */}
      <div className="space-y-4 text-center max-w-3xl mx-auto pt-4">
        <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-red-500/10 dark:bg-red-500/15 border border-red-500/20 text-red-600 dark:text-red-400 text-[10px] font-semibold tracking-[0.2em] uppercase">
          <Youtube className="w-3.5 h-3.5" />
          <span>Zero-Distraction Academy • $0 API Cost</span>
        </div>
        
        <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight text-zinc-900 dark:text-white">
          Direct YouTube Knowledge Base
        </h1>
        
        <p className="text-sm sm:text-base text-zinc-600 dark:text-zinc-400 leading-relaxed max-w-2xl mx-auto">
          Study video masterclasses, search developer lectures, or import entire playlists directly into your private hub with timestamped notes and integrated code sandboxes.
        </p>
      </div>

      {/* Double-Bezel Search Architecture */}
      <div className="max-w-3xl mx-auto">
        <div className="p-1.5 rounded-[2rem] bg-black/[0.03] dark:bg-white/[0.04] border border-black/[0.06] dark:border-white/[0.08] shadow-sm">
          <div className="relative flex items-center rounded-[calc(2rem-0.375rem)] bg-white dark:bg-[#111218] border border-black/[0.05] dark:border-white/[0.06] shadow-[inset_0_1px_1px_rgba(255,255,255,0.15)] dark:shadow-[inset_0_1px_1px_rgba(255,255,255,0.06)] px-4 py-2">
            <Search className="w-5 h-5 text-zinc-400 dark:text-zinc-500 shrink-0 ml-1" strokeWidth={1.75} />
            
            <input
              ref={searchInputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Search topics (e.g., 'Rust Systems') or paste YouTube URL / Playlist..."
              className="w-full bg-transparent px-3 py-2 text-sm sm:text-[15px] text-zinc-900 dark:text-white placeholder-zinc-400 dark:placeholder-zinc-500 focus:outline-none font-medium"
            />

            {query && (
              <button
                onClick={() => {
                  setQuery('');
                  setDetectedType(null);
                  setDetectedId(null);
                  searchInputRef.current?.focus();
                }}
                className="p-1 rounded-full text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors mr-2"
                title="Clear input"
              >
                <X className="w-4 h-4" />
              </button>
            )}

            {/* Nested Island Button Architecture */}
            <button
              id="youtube-search-btn"
              onClick={() => handleSearch()}
              disabled={isLoading || !query.trim()}
              className="group px-5 py-2.5 rounded-full bg-zinc-900 dark:bg-white text-white dark:text-zinc-950 text-xs font-semibold flex items-center gap-2 transition-all duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] hover:opacity-95 active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Searching...</span>
                </>
              ) : (
                <>
                  <span>Search</span>
                  <span className="w-5 h-5 rounded-full bg-white/20 dark:bg-black/10 flex items-center justify-center transition-transform duration-300 group-hover:translate-x-0.5">
                    <ArrowRight className="w-3 h-3" strokeWidth={2} />
                  </span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Direct Link Detection Banner */}
        {detectedType && (
          <div className="mt-3 p-1 rounded-2xl bg-gradient-to-r from-red-500/10 via-amber-500/10 to-emerald-500/10 border border-red-500/20 animate-in fade-in slide-in-from-top-2 duration-300">
            <div className="px-4 py-3 rounded-[calc(1rem-0.25rem)] bg-white/80 dark:bg-[#151720]/90 backdrop-blur-md flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-red-500/15 flex items-center justify-center text-red-500 shrink-0">
                  {detectedType === 'playlist' ? <Layers className="w-4 h-4" /> : <Film className="w-4 h-4" />}
                </div>
                <div>
                  <p className="text-xs font-semibold text-zinc-900 dark:text-white">
                    {detectedType === 'playlist' ? 'YouTube Playlist Detected' : 'Direct Video Link Detected'}
                  </p>
                  <p className="text-[11px] font-mono text-zinc-500 dark:text-zinc-400 truncate max-w-md">
                    ID: {detectedId}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {detectedType === 'playlist' ? (
                  <button
                    onClick={() => detectedId && handleImportPlaylist(detectedId, 'Imported Playlist')}
                    disabled={isImporting !== null}
                    className="px-4 py-2 rounded-full bg-red-600 hover:bg-red-500 text-white text-xs font-semibold flex items-center gap-1.5 transition-all active:scale-[0.98]"
                  >
                    {isImporting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Layers className="w-3.5 h-3.5" />}
                    <span>Import Course</span>
                  </button>
                ) : (
                  <button
                    onClick={() => detectedId && playYouTubeVideoImmediately({ id: detectedId, title: 'YouTube Video' })}
                    className="px-4 py-2 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center gap-1.5 transition-all active:scale-[0.98]"
                  >
                    <Play className="w-3.5 h-3.5 fill-current" />
                    <span>Study Now</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Curated Topic Chips */}
        <div className="flex items-center gap-2 overflow-x-auto py-3 no-scrollbar mt-2">
          <span className="text-[11px] font-medium text-zinc-400 shrink-0 mr-1">Trending:</span>
          {CURATED_TOPICS.map((topic) => {
            const isSelected = activeTopic === topic;
            return (
              <button
                key={topic}
                onClick={() => handleTopicClick(topic)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all duration-200 ${
                  isSelected
                    ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 shadow-sm ring-1 ring-black/10 dark:ring-white/20'
                    : 'bg-black/[0.03] hover:bg-black/[0.06] dark:bg-white/[0.04] dark:hover:bg-white/[0.08] text-zinc-600 dark:text-zinc-400 border border-black/[0.04] dark:border-white/[0.06]'
                }`}
              >
                {topic}
              </button>
            );
          })}
        </div>
      </div>

      {/* Import Status Alert */}
      {importStatus && (
        <div className="max-w-2xl mx-auto p-4 rounded-2xl bg-blue-500/10 border border-blue-500/20 text-blue-600 dark:text-blue-400 flex items-center gap-3">
          <Loader2 className="w-5 h-5 animate-spin shrink-0" />
          <span className="text-xs font-medium">{importStatus}</span>
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="max-w-2xl mx-auto p-4 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <div className="text-xs font-medium leading-relaxed">
            {error}
          </div>
        </div>
      )}

      {/* Search Results Grid */}
      {results.length > 0 ? (
        <div className="space-y-4">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-sm font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
              Found {results.length} Masterclasses & Lectures
            </h2>
            <span className="text-xs text-zinc-400 font-mono">
              InnerTube Engine • Zero Quota
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {results.map((video) => {
              const isItemImporting = Boolean(isImporting === video.id || (video.playlistId && isImporting === video.playlistId));

              return (
                <div
                  key={video.id}
                  onClick={() => playYouTubeVideoImmediately({
                    id: video.id,
                    title: video.title,
                    durationSeconds: video.durationSeconds,
                    thumbnailUrl: video.thumbnail
                  })}
                  className="p-1.5 rounded-[1.75rem] bg-black/[0.02] dark:bg-white/[0.02] border border-black/[0.05] dark:border-white/[0.06] hover:border-indigo-500/40 dark:hover:border-indigo-500/40 hover:ring-2 hover:ring-indigo-500/10 transition-all duration-300 group flex flex-col justify-between cursor-pointer active:scale-[0.99]"
                >
                  <div className="rounded-[calc(1.75rem-0.375rem)] bg-white dark:bg-[#111218] border border-black/[0.04] dark:border-white/[0.06] overflow-hidden flex flex-col h-full shadow-[inset_0_1px_1px_rgba(255,255,255,0.15)] dark:shadow-[inset_0_1px_1px_rgba(255,255,255,0.06)]">
                    
                    {/* 16:9 Thumbnail Header with Hover Play Badge */}
                    <div className="relative aspect-video w-full bg-zinc-900 overflow-hidden">
                      <img
                        src={video.thumbnail}
                        alt={video.title}
                        loading="lazy"
                        className="w-full h-full object-cover transition-transform duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] group-hover:scale-105"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-60" />
                      
                      {/* Floating Play Badge Overlay on Hover */}
                      <div className="absolute inset-0 bg-black/35 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center backdrop-blur-[2px]">
                        <div className="w-12 h-12 rounded-full bg-white/95 dark:bg-white text-zinc-950 flex items-center justify-center shadow-xl transform scale-90 group-hover:scale-100 transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]">
                          <Play className="w-5 h-5 fill-zinc-950 ml-0.5" />
                        </div>
                      </div>

                      {/* Duration Pill */}
                      {video.durationText && (
                        <div className="absolute bottom-2.5 right-2.5 px-2 py-0.5 rounded-md bg-black/80 backdrop-blur-md text-[11px] font-mono font-medium text-white shadow-sm flex items-center gap-1 z-10">
                          <Clock className="w-3 h-3 text-zinc-400" />
                          <span>{video.durationText}</span>
                        </div>
                      )}

                      {/* Playlist Marker */}
                      {video.isPlaylist && (
                        <div className="absolute top-2.5 right-2.5 px-2.5 py-1 rounded-full bg-red-600/90 backdrop-blur-md text-[10px] font-semibold text-white shadow-sm flex items-center gap-1.5 z-10">
                          <Layers className="w-3 h-3" />
                          <span>Series</span>
                        </div>
                      )}
                    </div>

                    {/* Content Section */}
                    <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between text-[11px] text-zinc-500 dark:text-zinc-400 font-medium">
                          <span className="truncate max-w-[140px] text-zinc-700 dark:text-zinc-300 font-semibold">
                            {video.channelTitle}
                          </span>
                          {video.viewCountText && (
                            <span className="text-[10px] font-mono text-zinc-400 shrink-0">
                              {video.viewCountText}
                            </span>
                          )}
                        </div>

                        <h3 
                          className="text-[13px] sm:text-[14px] font-bold text-zinc-900 dark:text-white leading-snug line-clamp-2 tracking-tight group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors"
                          title={video.title}
                        >
                          {video.title}
                        </h3>

                        {video.description && (
                          <p className="text-[11px] text-zinc-500 dark:text-zinc-400 line-clamp-2 leading-relaxed">
                            {video.description}
                          </p>
                        )}
                      </div>

                      {/* Action Pill Controls */}
                      <div className="pt-3 border-t border-black/[0.04] dark:border-white/[0.06] flex items-center gap-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            playYouTubeVideoImmediately({
                              id: video.id,
                              title: video.title,
                              durationSeconds: video.durationSeconds,
                              thumbnailUrl: video.thumbnail
                            });
                          }}
                          className="flex-1 py-2 px-3 rounded-full bg-zinc-900 dark:bg-white text-white dark:text-zinc-950 text-[11px] font-semibold flex items-center justify-center gap-1.5 transition-all duration-200 hover:opacity-90 active:scale-[0.98]"
                        >
                          <Play className="w-3 h-3 fill-current" />
                          <span>Study Now</span>
                        </button>

                        {video.isPlaylist && video.playlistId && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleImportPlaylist(video.playlistId!, video.title);
                            }}
                            disabled={isItemImporting}
                            className="py-2 px-3 rounded-full bg-black/[0.04] hover:bg-black/[0.08] dark:bg-white/[0.06] dark:hover:bg-white/[0.1] border border-black/[0.05] dark:border-white/[0.08] text-zinc-700 dark:text-zinc-300 text-[11px] font-medium flex items-center gap-1 transition-all"
                            title="Import full playlist as offline curriculum"
                          >
                            {isItemImporting ? (
                              <Loader2 className="w-3 h-3 animate-spin text-red-500" />
                            ) : (
                              <DownloadCloud className="w-3 h-3" />
                            )}
                            <span className="hidden sm:inline">Import</span>
                          </button>
                        )}

                        <a
                          href={`https://www.youtube.com/watch?v=${video.id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="w-8 h-8 rounded-full flex items-center justify-center text-zinc-400 hover:text-zinc-900 dark:hover:text-white bg-black/[0.02] dark:bg-white/[0.04] hover:bg-black/[0.06] dark:hover:bg-white/[0.08] border border-black/[0.05] dark:border-white/[0.08] transition-colors"
                          title="Open on YouTube in new tab"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        /* Empty / Initial State */
        !isLoading && (
          <div className="text-center py-16 space-y-4 max-w-md mx-auto">
            <div className="w-16 h-16 rounded-3xl bg-black/[0.03] dark:bg-white/[0.04] border border-black/[0.06] dark:border-white/[0.08] flex items-center justify-center mx-auto text-zinc-400 dark:text-zinc-500">
              <Sparkles className="w-7 h-7 stroke-[1.5]" />
            </div>
            <div className="space-y-1">
              <h3 className="text-base font-bold text-zinc-900 dark:text-white tracking-tight">
                Search or Explore Any Subject
              </h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
                Click any trending topic above or paste any YouTube URL to launch a zero-distraction study session.
              </p>
            </div>
          </div>
        )
      )}

      {/* Loading Skeletons */}
      {isLoading && results.length === 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 pt-4">
          {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
            <div key={i} className="p-1.5 rounded-[1.75rem] bg-black/[0.02] dark:bg-white/[0.02] border border-black/[0.04] dark:border-white/[0.06]">
              <div className="rounded-[calc(1.75rem-0.375rem)] bg-white dark:bg-[#111218] p-3 space-y-3">
                <div className="aspect-video w-full rounded-xl bg-zinc-200 dark:bg-zinc-800/60 animate-pulse" />
                <div className="space-y-2">
                  <div className="h-3 w-1/3 rounded bg-zinc-200 dark:bg-zinc-800 animate-pulse" />
                  <div className="h-4 w-5/6 rounded bg-zinc-200 dark:bg-zinc-800 animate-pulse" />
                  <div className="h-3 w-full rounded bg-zinc-200 dark:bg-zinc-800/40 animate-pulse" />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

    </div>
  );
};

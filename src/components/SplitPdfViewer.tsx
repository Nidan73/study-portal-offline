import React, { useState, useEffect, useRef } from 'react';
import { useStore } from '../store/useStore';
import { SupplementaryFile } from '../types';
import { PptxCanvasViewer } from './PptxCanvasViewer';
import { 
  FileText, 
  ExternalLink, 
  Moon, 
  Sun, 
  X, 
  Upload, 
  Monitor, 
  Check, 
  ChevronDown, 
  Presentation,
  FolderOpen,
  Loader2
} from 'lucide-react';

export const SplitPdfViewer: React.FC = () => {
  const { 
    activeCourseId, 
    activeLesson,
    currentTime,
    activePdf, 
    selectPdf, 
    closePdf, 
    isDarkPdf, 
    toggleDarkPdf, 
    catalog,
    addNote,
    activeTab,
    setActiveTab,
    sidePanelTab,
    setSidePanelTab,
    pushToast
  } = useStore();

  const [availableDecks, setAvailableDecks] = useState<SupplementaryFile[]>([]);
  const [isDeckDropdownOpen, setIsDeckDropdownOpen] = useState(false);
  const [currentDeck, setCurrentDeck] = useState<SupplementaryFile | null>(null);
  const [localBlobUrl, setLocalBlobUrl] = useState<string | null>(null);

  const [isLaunchingDesktop, setIsLaunchingDesktop] = useState(false);
  const [desktopMessage, setDesktopMessage] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load all available slide decks across courses and presentations
  useEffect(() => {
    fetch('/api/slides/all')
      .then(res => res.json())
      .then(data => {
        if (data.decks && Array.isArray(data.decks)) {
          setAvailableDecks(data.decks);
        }
      })
      .catch(() => {});
  }, []);

  // Determine current active deck:
  // 1. If user explicitly selected activePdf, use it.
  // 2. Otherwise if activeLesson has companionPdf, use that.
  // 3. Otherwise leave currentDeck as null (Hub mode), NEVER randomly load a foreign deck!
  useEffect(() => {
    if (activePdf) {
      setCurrentDeck(activePdf);
    } else if (activeLesson?.companionPdf) {
      setCurrentDeck(activeLesson.companionPdf);
    } else {
      setCurrentDeck(null);
    }
  }, [activePdf, activeLesson?.id, activeLesson?.companionPdf]);

  // Handle Native Desktop App Launch (OnlyOffice / PowerPoint)
  const handleLaunchDesktop = async (deckToLaunch = currentDeck) => {
    if (!deckToLaunch?.filePath) return;
    setIsLaunchingDesktop(true);
    setDesktopMessage(null);
    try {
      const res = await fetch('/api/slides/open-system', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filePath: deckToLaunch.filePath })
      });
      const data = await res.json();
      if (res.ok) {
        setDesktopMessage(`Launched in desktop presentation app (${deckToLaunch.filename})`);
        setTimeout(() => setDesktopMessage(null), 4000);
      } else {
        pushToast(data.error || 'Could not open that deck in a desktop app. Check that a presentation app is installed.', 'error');
      }
    } catch (e: any) {
      pushToast(`Could not launch the desktop viewer: ${e.message}`, 'error');
    } finally {
      setIsLaunchingDesktop(false);
    }
  };

  // Handle Local File Upload / Drop
  const handleFile = (file: File) => {
    const ext = file.name.split('.').pop()?.toLowerCase() || '';
    if (ext === 'pdf') {
      const url = URL.createObjectURL(file);
      setLocalBlobUrl(url);
      const customItem: SupplementaryFile = {
        id: `local-${Date.now()}`,
        title: file.name.replace(/\.[^/.]+$/, ''),
        filename: file.name,
        relativePath: file.name,
        fileSizeBytes: file.size,
        type: 'pdf',
        isCustomLocal: true,
        localFile: file
      };
      setCurrentDeck(customItem);
      selectPdf(customItem);
    } else if (ext === 'pptx' || ext === 'ppt' || ext === 'pptm') {
      const match = availableDecks.find(d => d.filename.toLowerCase() === file.name.toLowerCase());
      if (match) {
        setCurrentDeck(match);
        selectPdf(match);
      } else {
        const customItem: SupplementaryFile = {
          id: `local-pptx-${Date.now()}`,
          title: file.name.replace(/\.[^/.]+$/, ''),
          filename: file.name,
          relativePath: file.name,
          fileSizeBytes: file.size,
          type: ext,
          isCustomLocal: true,
          localFile: file
        };
        setCurrentDeck(customItem);
        selectPdf(customItem);
      }
    } else {
      // Find if this file exists in availableDecks by filename
      const match = availableDecks.find(d => d.filename.toLowerCase() === file.name.toLowerCase());
      if (match) {
        setCurrentDeck(match);
        selectPdf(match);
      } else {
        pushToast(`Loaded "${file.name}". Browse every discovered deck from the switcher above.`, 'success');
      }
    }
  };

  // Pin current slide number to user's notes
  const handlePinSlide = (slideNum: number) => {
    const lessonId = activeLesson?.id || 'general';
    addNote(lessonId, currentTime || 0, `[Slide ${slideNum}]: `, slideNum);
  };

  // Close slides split / panel view
  const handleClose = () => {
    closePdf();
    setActiveTab('player');
    if (sidePanelTab === 'slides') {
      setSidePanelTab('curriculum');
    }
  };

  const isCurrentPptx = currentDeck && (currentDeck.type === 'pptx' || currentDeck.type === 'ppt' || currentDeck.type === 'pptm');
  const pdfUrl = localBlobUrl || (currentDeck ? `/api/pdf/${currentDeck.courseId || activeCourseId}/${currentDeck.id}` : '');

  return (
    <div 
      onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setIsDragging(false);
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
          handleFile(e.dataTransfer.files[0]);
        }
      }}
      className="p-1.5 rounded-[2rem] bg-black/[0.03] dark:bg-white/[0.03] border border-black/[0.06] dark:border-white/[0.08] h-full"
    >
      <div className="flex flex-col h-full bg-white dark:bg-[#111218] border border-black/[0.05] dark:border-white/[0.06] rounded-[calc(2rem-0.375rem)] shadow-[inset_0_1px_1px_rgba(255,255,255,0.15)] dark:shadow-[inset_0_1px_1px_rgba(255,255,255,0.06)] overflow-hidden select-none transition-colors">
        
        {/* Slide Toolbar Header */}
        <div className="px-4 py-3 border-b border-black/[0.06] dark:border-white/[0.08] flex items-center justify-between gap-2 bg-black/[0.01] dark:bg-white/[0.02]">
          
          {/* Deck Selector Dropdown */}
          <div className="relative min-w-0 flex-1">
            <button
              id="deck-selector-dropdown-btn"
              onClick={() => setIsDeckDropdownOpen(!isDeckDropdownOpen)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-black/[0.03] hover:bg-black/[0.06] dark:bg-white/[0.05] dark:hover:bg-white/[0.09] border border-black/[0.05] dark:border-white/[0.07] text-[12px] font-semibold text-zinc-900 dark:text-white transition-all w-full min-w-0 max-w-full"
            >
              {isCurrentPptx ? (
                <Presentation className="w-3.5 h-3.5 text-amber-500 shrink-0" />
              ) : (
                <FileText className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
              )}
              <span className="truncate min-w-0" title={currentDeck ? currentDeck.title : undefined}>
                {currentDeck ? currentDeck.title : 'Select Slide Deck...'}
              </span>
              <ChevronDown className="w-3 h-3 text-zinc-500 dark:text-zinc-400 shrink-0 ml-auto" />
            </button>

            {/* Dropdown Menu */}
            {isDeckDropdownOpen && (
              <>
                <div 
                  className="fixed inset-0 z-40" 
                  onClick={() => setIsDeckDropdownOpen(false)} 
                />
                <div className="absolute left-0 mt-2 w-80 sm:w-96 rounded-[1.5rem] bg-white/95 dark:bg-[#12131b]/95 backdrop-blur-2xl border border-black/[0.08] dark:border-white/10 shadow-2xl p-2 z-50 animate-in fade-in">
                  <div className="flex items-center justify-between px-3 py-1.5 text-[10px] font-mono uppercase tracking-wider text-zinc-500">
                    <span>Available Presentations ({availableDecks.length})</span>
                    <span>PDF & PPTX</span>
                  </div>

                  <div className="space-y-1 max-h-64 overflow-y-auto pr-1">
                    {availableDecks.map((deck) => {
                      const isSelected = currentDeck?.id === deck.id;
                      const isDeckPptx = deck.type === 'pptx' || deck.type === 'ppt' || deck.type === 'pptm';
                      return (
                        <button
                          key={deck.id}
                          onClick={() => {
                            setCurrentDeck(deck);
                            setLocalBlobUrl(null);
                            selectPdf(deck);
                            setIsDeckDropdownOpen(false);
                          }}
                          className={`w-full flex items-center justify-between p-2.5 rounded-xl text-left text-[12px] transition-all ${
                            isSelected
                              ? 'bg-zinc-900 dark:bg-white text-white dark:text-zinc-950 font-medium'
                              : 'text-zinc-700 dark:text-zinc-300 hover:bg-black/[0.04] dark:hover:bg-white/[0.06]'
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0 truncate pr-2">
                            {isDeckPptx ? (
                              <Presentation className={`w-3.5 h-3.5 shrink-0 ${isSelected ? 'text-white dark:text-zinc-950' : 'text-amber-500'}`} />
                            ) : (
                              <FileText className={`w-3.5 h-3.5 shrink-0 ${isSelected ? 'text-white dark:text-zinc-950' : 'text-indigo-500'}`} />
                            )}
                            <div className="truncate">
                              <div className="truncate font-semibold">{deck.title}</div>
                              <div className="text-[10px] font-mono opacity-60 truncate">
                                {deck.courseName || deck.type.toUpperCase()} • {(deck.fileSizeBytes / 1024).toFixed(0)} KB
                              </div>
                            </div>
                          </div>
                          {isSelected && <Check className="w-3.5 h-3.5 shrink-0 ml-2" />}
                        </button>
                      );
                    })}
                  </div>

                  {/* Browse Local File Action */}
                  <div className="border-t border-black/[0.06] dark:border-white/[0.08] mt-2 pt-2">
                    <button
                      onClick={() => {
                        fileInputRef.current?.click();
                        setIsDeckDropdownOpen(false);
                      }}
                      className="w-full flex items-center gap-2 p-2 rounded-xl text-[12px] text-zinc-700 dark:text-zinc-300 hover:bg-black/[0.04] dark:hover:bg-white/[0.06] transition-colors"
                    >
                      <FolderOpen className="w-3.5 h-3.5 text-indigo-500" />
                      <span>Browse Local File from PC...</span>
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>

          <input 
            ref={fileInputRef} 
            type="file" 
            accept=".pdf,.pptx,.ppt,.pptm" 
            className="hidden" 
            onChange={(e) => {
              if (e.target.files && e.target.files[0]) {
                handleFile(e.target.files[0]);
              }
            }} 
          />

          {/* Action Toolbar Controls */}
          <div className="flex items-center gap-1.5 shrink-0">
            {/* Desktop Presentation App Launch Button (For PPTX & Presentations) */}
            {currentDeck?.filePath && (
              <button
                id="btn-launch-desktop-toolbar"
                onClick={() => handleLaunchDesktop(currentDeck)}
                disabled={isLaunchingDesktop}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-500/10 hover:bg-amber-500/15 border border-amber-500/20 text-amber-700 dark:text-amber-400 text-[11px] font-semibold transition-all active:scale-95 shadow-xs"
                title="Launch this presentation in OnlyOffice / PowerPoint on your PC"
              >
                {isLaunchingDesktop ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" strokeWidth={1.5} />
                ) : (
                  <Monitor className="w-3.5 h-3.5" strokeWidth={1.5} />
                )}
                <span className="hidden sm:inline">Open in App</span>
              </button>
            )}

            {/* Smart Dark Mode Inverter for PDFs */}
            {!isCurrentPptx && (
              <button
                onClick={toggleDarkPdf}
                className={`flex items-center gap-1 px-2.5 py-1.5 rounded-full border text-[11px] font-medium transition-all ${
                  isDarkPdf 
                    ? 'bg-zinc-900 dark:bg-white text-white dark:text-zinc-950 border-black/10 dark:border-white/20' 
                    : 'bg-black/[0.03] dark:bg-white/[0.05] text-zinc-700 dark:text-zinc-300 border-black/[0.05] dark:border-white/[0.08]'
                }`}
                title="Toggle OLED Dark Mode filter"
              >
                {isDarkPdf ? <Moon className="w-3.5 h-3.5" /> : <Sun className="w-3.5 h-3.5" />}
              </button>
            )}

            {/* Open in Separate Tab / Window */}
            {!isCurrentPptx && pdfUrl && (
              <a
                href={pdfUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="w-8 h-8 rounded-full flex items-center justify-center text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white bg-black/[0.03] dark:bg-white/[0.05] border border-black/[0.05] dark:border-white/[0.08] transition-colors"
                title="Open in new window"
              >
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            )}

            {/* Close Slide View */}
            <button
              id="close-slide-view-btn"
              onClick={handleClose}
              className="w-8 h-8 rounded-full flex items-center justify-center text-zinc-500 hover:text-red-500 dark:text-zinc-400 dark:hover:text-red-400 bg-black/[0.03] hover:bg-red-500/10 dark:bg-white/[0.05] dark:hover:bg-red-500/20 border border-black/[0.05] dark:border-white/[0.08] transition-colors"
              title="Close Slides"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {desktopMessage && (
          <div className="bg-emerald-500/10 border-b border-emerald-500/20 px-4 py-1.5 text-center text-emerald-700 dark:text-emerald-400 text-[11px] font-medium animate-in fade-in">
            {desktopMessage}
          </div>
        )}

        {/* Content Viewer: Dual Engine (PDF Iframe vs Interactive PPTX Slides) */}
        <div className="relative flex-1 w-full bg-zinc-100 dark:bg-[#070709] overflow-hidden">
          
          {/* PPTX Authentic Vector/Canvas Presentation Viewer */}
          {isCurrentPptx && currentDeck ? (
            <PptxCanvasViewer
              deck={currentDeck}
              currentTime={currentTime}
              onPinSlide={handlePinSlide}
              onLaunchDesktop={handleLaunchDesktop}
              isLaunchingDesktop={isLaunchingDesktop}
            />
          ) : currentDeck ? (
            /* Standard Embedded PDF Viewer */
            <iframe
              key={currentDeck.id}
              src={pdfUrl}
              title={currentDeck.title}
              className="w-full h-full border-0"
              style={{
                filter: isDarkPdf ? 'invert(0.92) hue-rotate(180deg) contrast(1.05)' : 'none',
                backgroundColor: isDarkPdf ? '#111114' : '#ffffff'
              }}
            />
          ) : (
            /* Universal Presentation Hub / Empty State */
            <div className="h-full flex flex-col p-5 overflow-y-auto">
              {/* Header Hero */}
              <div className="text-center max-w-md mx-auto pt-2 pb-5">
                <div className="w-12 h-12 rounded-full bg-amber-500/10 dark:bg-amber-500/20 text-amber-500 flex items-center justify-center mx-auto mb-3">
                  <Presentation className="w-6 h-6" strokeWidth={1.5} />
                </div>
                <span className="rounded-full px-2.5 py-0.5 text-[10px] uppercase tracking-[0.2em] font-medium font-mono bg-amber-500/10 text-amber-700 dark:text-amber-400">
                  Slide Companion
                </span>
                <h3 className="text-base font-bold text-zinc-900 dark:text-white tracking-tight mt-2">
                  Presentation & Slide Decks
                </h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 leading-relaxed">
                  No slide deck is automatically attached to this lecture. Choose any course presentation below or drop a file from your PC to study side-by-side.
                </p>

                {/* Drop / Browse Action */}
                <div className="mt-4 flex items-center justify-center gap-2">
                  <button
                    id="btn-browse-presentation-file"
                    onClick={() => fileInputRef.current?.click()}
                    className="px-4 py-2 rounded-full bg-zinc-900 dark:bg-white text-white dark:text-zinc-950 text-xs font-semibold flex items-center gap-2 hover:opacity-90 active:scale-95 transition-all shadow-sm"
                  >
                    <Upload className="w-3.5 h-3.5" strokeWidth={1.5} />
                    <span>Browse File from PC</span>
                  </button>
                </div>
              </div>

              {/* Available Decks Grid */}
              {availableDecks.length > 0 && (
                <div className="space-y-2.5 pt-3 border-t border-black/[0.06] dark:border-white/[0.08]">
                  <div className="flex items-center justify-between text-[11px] font-mono uppercase tracking-wider text-zinc-500 dark:text-zinc-400 px-1">
                    <span>Discovered Materials ({availableDecks.length})</span>
                    <span>Ready to Study</span>
                  </div>

                  <div className="grid grid-cols-1 gap-2">
                    {availableDecks.map((deck) => {
                      const isDeckPptx = deck.type === 'pptx' || deck.type === 'ppt' || deck.type === 'pptm';
                      const sizeKb = ((deck.fileSizeBytes || (deck as any).sizeBytes || 0) / 1024).toFixed(0);
                      return (
                        <div
                          key={deck.id}
                          className="p-3 rounded-2xl bg-black/[0.02] hover:bg-black/[0.04] dark:bg-white/[0.03] dark:hover:bg-white/[0.06] border border-black/[0.05] dark:border-white/[0.07] transition-all flex items-center justify-between gap-3 group"
                        >
                          <div 
                            onClick={() => {
                              setCurrentDeck(deck);
                              selectPdf(deck);
                            }}
                            className="flex items-center gap-3 min-w-0 flex-1 cursor-pointer"
                          >
                            <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                              isDeckPptx 
                                ? 'bg-amber-500/10 text-amber-500' 
                                : 'bg-indigo-500/10 text-indigo-500'
                            }`}>
                              {isDeckPptx ? (
                                <Presentation className="w-4 h-4" strokeWidth={1.5} />
                              ) : (
                                <FileText className="w-4 h-4" strokeWidth={1.5} />
                              )}
                            </div>
                            <div className="min-w-0">
                              <h4 className="text-xs font-semibold text-zinc-900 dark:text-white truncate group-hover:text-indigo-500 dark:group-hover:text-indigo-400 transition-colors">
                                {deck.title}
                              </h4>
                              <p className="text-[10px] font-mono text-zinc-500 dark:text-zinc-400 truncate">
                                {deck.courseName || deck.type.toUpperCase()} • {sizeKb} KB
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0">
                            {isDeckPptx && (
                              <button
                                onClick={() => handleLaunchDesktop(deck)}
                                className="p-2 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 dark:text-amber-400 text-[11px] font-medium transition-colors"
                                title="Open in OnlyOffice Desktop"
                              >
                                <Monitor className="w-3.5 h-3.5" strokeWidth={1.5} />
                              </button>
                            )}
                            <button
                              id={`btn-study-deck-${deck.id}`}
                              onClick={() => {
                                setCurrentDeck(deck);
                                selectPdf(deck);
                              }}
                              className="btn-study-deck px-3 py-1.5 rounded-xl bg-black/[0.04] hover:bg-zinc-900 dark:bg-white/[0.06] dark:hover:bg-white text-zinc-700 hover:text-white dark:text-zinc-300 dark:hover:text-zinc-950 text-[11px] font-medium transition-all"
                            >
                              Study
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};


import React, { useState, useEffect, useRef } from 'react';
import { useStore } from '../store/useStore';
import { DeckBrowser } from './DeckBrowser';
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
  FolderPlus,
  LayoutGrid,
  Search,
  Loader2,
  FileType2,
  Trash2
} from 'lucide-react';

export const SplitPdfViewer: React.FC = () => {
  // Per-field selectors: a whole-store destructure re-renders this on every
  // change, including the ~4/sec currentTime tick during playback.
  const activeCourseId = useStore(state => state.activeCourseId);
  const activeLesson = useStore(state => state.activeLesson);
  const currentTime = useStore(state => state.currentTime);
  const activePdf = useStore(state => state.activePdf);
  const selectPdf = useStore(state => state.selectPdf);
  const closePdf = useStore(state => state.closePdf);
  const isDarkPdf = useStore(state => state.isDarkPdf);
  const toggleDarkPdf = useStore(state => state.toggleDarkPdf);
  const catalog = useStore(state => state.catalog);
  const addNote = useStore(state => state.addNote);
  const activeTab = useStore(state => state.activeTab);
  const setActiveTab = useStore(state => state.setActiveTab);
  const sidePanelTab = useStore(state => state.sidePanelTab);
  const setSidePanelTab = useStore(state => state.setSidePanelTab);
  const pushToast = useStore(state => state.pushToast);

  const [availableDecks, setAvailableDecks] = useState<SupplementaryFile[]>([]);
  const [isDeckDropdownOpen, setIsDeckDropdownOpen] = useState(false);
  // Past a certain size a dropdown stops being a way to find anything.
  const [isBrowserOpen, setIsBrowserOpen] = useState(false);
  // A flat list of every deck across every course is unusable once you have
  // more than a handful — filter, then group by where each deck came from.
  const [deckQuery, setDeckQuery] = useState('');

  const formatDeckSize = (deck: any) => {
    // The discovery endpoint returns sizeBytes; only locally-opened files carry
    // fileSizeBytes. Reading the wrong one rendered "NaN KB" for every deck.
    const bytes = deck.fileSizeBytes ?? deck.sizeBytes;
    if (!bytes || isNaN(bytes)) return '';
    return bytes >= 1024 * 1024
      ? ` • ${(bytes / 1024 / 1024).toFixed(1)} MB`
      : ` • ${Math.round(bytes / 1024)} KB`;
  };

  // Grouped by where the deck came from, with the course you are actually in
  // listed first — a flat list mixed every course's material together.
  // The dropdown is the switcher for the course you are in, so it lists only
  // that curriculum's material. Everything else is a click away in the browser
  // — mixing 156 decks from every folder into a quick-switch menu is what made
  // it unusable.
  const courseDecks = React.useMemo(() => {
    if (!activeCourseId) return availableDecks;
    const mine = availableDecks.filter(d => d.courseId === activeCourseId);
    return mine.length > 0 ? mine : availableDecks;
  }, [availableDecks, activeCourseId]);

  const groupedDecks = React.useMemo(() => {
    const q = deckQuery.trim().toLowerCase();
    const matches = courseDecks.filter(d =>
      !q ||
      d.title.toLowerCase().includes(q) ||
      (d.courseName || '').toLowerCase().includes(q) ||
      ((d as any).moduleName || '').toLowerCase().includes(q)
    );

    const groups = new Map<string, typeof availableDecks>();
    for (const d of matches) {
      const key = d.courseName || 'Other material';
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(d);
    }

    const activeName = catalog?.name;
    return [...groups.entries()].sort(([a], [b]) => {
      if (a === activeName) return -1;
      if (b === activeName) return 1;
      return a.localeCompare(b);
    });
  }, [courseDecks, deckQuery, catalog?.name]);
  const [currentDeck, setCurrentDeck] = useState<SupplementaryFile | null>(null);
  const [localBlobUrl, setLocalBlobUrl] = useState<string | null>(null);

  const [isLaunchingDesktop, setIsLaunchingDesktop] = useState(false);
  const [desktopMessage, setDesktopMessage] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  // Study material often lives in its own folders rather than inside a course,
  // and adding decks one file at a time is not a workflow. Registered folders
  // are indexed recursively and every deck in them joins the switcher.
  const [slideFolders, setSlideFolders] = useState<{ path: string; name: string; deckCount: number; exists: boolean }[]>([]);
  const [isAddingFolder, setIsAddingFolder] = useState(false);
  const [folderInput, setFolderInput] = useState('');
  const [folderError, setFolderError] = useState<string | null>(null);
  const [isSavingFolder, setIsSavingFolder] = useState(false);

  const loadSlideFolders = async () => {
    try {
      const res = await fetch('/api/slides/folders');
      if (res.ok) setSlideFolders((await res.json()).folders || []);
    } catch (e) {}
  };

  const reloadDecks = async () => {
    try {
      const res = await fetch('/api/slides/all');
      if (res.ok) setAvailableDecks((await res.json()).decks || []);
    } catch (e) {}
  };

  useEffect(() => { loadSlideFolders(); }, []);

  const addSlideFolder = async () => {
    const p = folderInput.trim();
    if (!p) return;
    setIsSavingFolder(true);
    setFolderError(null);
    try {
      const res = await fetch('/api/slides/folders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ folderPath: p })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not add that folder');
      setFolderInput('');
      setIsAddingFolder(false);
      await Promise.all([loadSlideFolders(), reloadDecks()]);
      pushToast(`Added ${data.added} slide${data.added === 1 ? '' : 's'} from that folder.`, 'success');
    } catch (e: any) {
      setFolderError(e.message);
    } finally {
      setIsSavingFolder(false);
    }
  };

  const removeSlideFolder = async (p: string) => {
    try {
      await fetch('/api/slides/folders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ removePath: p })
      });
      await Promise.all([loadSlideFolders(), reloadDecks()]);
      pushToast('Folder removed. The files on disk are untouched.', 'info');
    } catch (e) {
      pushToast('Could not remove that folder.', 'error');
    }
  };
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
    } else if (ext === 'pptx' || ext === 'ppt' || ext === 'pptm' || ext === 'docx' || ext === 'doc') {
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
  // No browser renders Word. Rather than drop a .docx into the PDF iframe and
  // show a blank page, hand it to the desktop app or let the user save it.
  const isCurrentWord = currentDeck && (currentDeck.type === 'docx' || currentDeck.type === 'doc');
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
              <ChevronDown className="w-3 h-3 text-zinc-600 dark:text-zinc-400 shrink-0 ml-auto" />
            </button>

            {/* Dropdown Menu */}
            {isDeckDropdownOpen && (
              <>
                <div 
                  className="fixed inset-0 z-40" 
                  onClick={() => setIsDeckDropdownOpen(false)} 
                />
                <div className="absolute left-0 mt-2 w-80 sm:w-96 rounded-[1.5rem] bg-white/95 dark:bg-[#12131b]/95 backdrop-blur-2xl border border-black/[0.08] dark:border-white/10 shadow-2xl p-2 z-50 animate-in fade-in">
                  <div className="px-2 pb-2 pt-1">
                    {(availableDecks.length > courseDecks.length || availableDecks.length > 12) && (
                      <button
                        onClick={() => { setIsDeckDropdownOpen(false); setIsBrowserOpen(true); }}
                        className="w-full flex items-center gap-2 mb-2 px-3 py-2 rounded-xl bg-zinc-900 dark:bg-white text-white dark:text-zinc-950 text-[12px] font-bold hover:opacity-90 transition-opacity"
                      >
                        <LayoutGrid className="w-3.5 h-3.5" strokeWidth={2} />
                        <span>Browse all {availableDecks.length} by folder</span>
                      </button>
                    )}
                    <div className="relative">
                      <Search className="w-3.5 h-3.5 text-zinc-500 dark:text-zinc-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" strokeWidth={1.5} />
                      <input
                        id="deck-search-input"
                        value={deckQuery}
                        onChange={(e) => setDeckQuery(e.target.value)}
                        placeholder={`Search ${courseDecks.length} in this course...`}
                        className="w-full bg-black/[0.03] dark:bg-white/[0.05] border border-black/[0.06] dark:border-white/10 rounded-lg pl-8 pr-2.5 py-1.5 text-[11.5px] text-zinc-900 dark:text-white placeholder-zinc-500 dark:placeholder-zinc-400 focus:outline-none focus:border-indigo-500 focus-visible:ring-2 focus-visible:ring-indigo-500/40"
                      />
                    </div>
                  </div>

                  <div className="space-y-3 max-h-[22rem] overflow-y-auto pr-1">
                    {groupedDecks.length === 0 && (
                      <p className="px-3 py-6 text-center text-[11.5px] text-zinc-600 dark:text-zinc-400">
                        Nothing matches &ldquo;{deckQuery}&rdquo;.
                      </p>
                    )}
                    {groupedDecks.map(([groupName, decks]) => (
                    <div key={groupName}>
                      <div className="flex items-center justify-between px-3 py-1 text-[10px] font-mono uppercase tracking-wider text-zinc-600 dark:text-zinc-400 sticky top-0 bg-white/95 dark:bg-[#12131b]/95 backdrop-blur-sm z-10">
                        <span className="truncate">{groupName}</span>
                        <span className="flex-shrink-0 ml-2">{decks.length}</span>
                      </div>
                      <div className="space-y-1">
                    {decks.map((deck) => {
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
                                {deck.moduleName || deck.type.toUpperCase()}{formatDeckSize(deck)}
                              </div>
                            </div>
                          </div>
                          {isSelected && <Check className="w-3.5 h-3.5 shrink-0 ml-2" />}
                        </button>
                      );
                    })}
                      </div>
                    </div>
                    ))}
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
                      <span>Open a single file from your PC...</span>
                    </button>

                    {/* Whole folders of material, indexed recursively */}
                    {slideFolders.map(fol => (
                      <div key={fol.path} className="w-full flex items-center gap-2 p-2 rounded-xl text-[12px] text-zinc-700 dark:text-zinc-300 group">
                        <FolderPlus className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
                        <span className="truncate flex-1 min-w-0" title={fol.path}>
                          {fol.name}
                          <span className="ml-1.5 text-[10px] font-mono text-zinc-600 dark:text-zinc-400">
                            {fol.exists ? `${fol.deckCount} decks` : 'missing'}
                          </span>
                        </span>
                        <button
                          onClick={(e) => { e.stopPropagation(); removeSlideFolder(fol.path); }}
                          aria-label={`Stop indexing ${fol.name}`}
                          className="p-1 rounded text-zinc-500 dark:text-zinc-400 hover:text-rose-500 opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-opacity flex-shrink-0"
                        >
                          <Trash2 className="w-3 h-3" strokeWidth={1.5} />
                        </button>
                      </div>
                    ))}

                    {isAddingFolder ? (
                      <div className="p-2 space-y-2">
                        <input
                          id="slide-folder-input"
                          autoFocus
                          value={folderInput}
                          onChange={(e) => setFolderInput(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') { e.preventDefault(); addSlideFolder(); }
                            if (e.key === 'Escape') { setIsAddingFolder(false); setFolderError(null); }
                          }}
                          placeholder="/path/to/your/slides"
                          className="w-full bg-black/[0.03] dark:bg-white/[0.05] border border-black/[0.06] dark:border-white/10 rounded-lg px-2.5 py-1.5 text-[11.5px] font-mono text-zinc-900 dark:text-white placeholder-zinc-500 dark:placeholder-zinc-400 focus:outline-none focus:border-indigo-500 focus-visible:ring-2 focus-visible:ring-indigo-500/40"
                        />
                        {folderError && (
                          <p className="text-[11px] text-rose-600 dark:text-rose-400">{folderError}</p>
                        )}
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => { setIsAddingFolder(false); setFolderError(null); }}
                            className="px-2.5 py-1 rounded-full text-[11px] text-zinc-700 dark:text-zinc-300 hover:bg-black/[0.05] dark:hover:bg-white/10"
                          >
                            Cancel
                          </button>
                          <button
                            id="confirm-add-slide-folder"
                            onClick={addSlideFolder}
                            disabled={!folderInput.trim() || isSavingFolder}
                            className="px-3 py-1 rounded-full bg-zinc-900 dark:bg-white disabled:opacity-30 text-white dark:text-zinc-950 text-[11px] font-semibold"
                          >
                            {isSavingFolder ? 'Scanning…' : 'Add folder'}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        id="add-slide-folder-btn"
                        onClick={() => setIsAddingFolder(true)}
                        className="w-full flex items-center gap-2 p-2 rounded-xl text-[12px] text-zinc-700 dark:text-zinc-300 hover:bg-black/[0.04] dark:hover:bg-white/[0.06] transition-colors"
                      >
                        <FolderPlus className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                        <span>Add a whole folder of slides...</span>
                      </button>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>

          <input 
            ref={fileInputRef} 
            type="file" 
            accept=".pdf,.pptx,.ppt,.pptm,.docx,.doc" 
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
            {!isCurrentPptx && !isCurrentWord && (
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
            {!isCurrentPptx && !isCurrentWord && pdfUrl && (
              <a
                href={pdfUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="w-8 h-8 rounded-full flex items-center justify-center text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white bg-black/[0.03] dark:bg-white/[0.05] border border-black/[0.05] dark:border-white/[0.08] transition-colors"
                title="Open in new window"
              >
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            )}

            {/* Close Slide View */}
            <button
              id="close-slide-view-btn"
              onClick={handleClose}
              className="w-8 h-8 rounded-full flex items-center justify-center text-zinc-600 dark:text-zinc-400 hover:text-red-500 dark:text-zinc-400 dark:hover:text-red-400 bg-black/[0.03] hover:bg-red-500/10 dark:bg-white/[0.05] dark:hover:bg-red-500/20 border border-black/[0.05] dark:border-white/[0.08] transition-colors"
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
          ) : isCurrentWord && currentDeck ? (
            /* Word: nothing to embed, so offer the two things that do work. */
            <div id="word-doc-panel" className="h-full flex flex-col items-center justify-center gap-4 p-8 text-center">
              <div className="w-14 h-14 rounded-full bg-sky-500/10 text-sky-600 dark:text-sky-400 flex items-center justify-center">
                <FileType2 className="w-7 h-7" strokeWidth={1.5} />
              </div>
              <div>
                <p className="text-[15px] font-semibold text-zinc-900 dark:text-white">{currentDeck.title}</p>
                <p className="mt-1 text-[12px] text-zinc-600 dark:text-zinc-400 max-w-xs">
                  Word documents can't be shown in the browser. Open it in your writing app, or save a copy.
                </p>
              </div>
              <div className="flex items-center gap-2">
                {currentDeck.filePath && (
                  <button
                    id="btn-open-word-desktop"
                    onClick={() => handleLaunchDesktop(currentDeck)}
                    disabled={isLaunchingDesktop}
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-sky-500/10 hover:bg-sky-500/15 border border-sky-500/20 text-sky-700 dark:text-sky-400 text-[12px] font-semibold transition-all active:scale-95"
                  >
                    {isLaunchingDesktop
                      ? <Loader2 className="w-3.5 h-3.5 animate-spin" strokeWidth={1.5} />
                      : <Monitor className="w-3.5 h-3.5" strokeWidth={1.5} />}
                    Open in App
                  </button>
                )}
                {pdfUrl && (
                  <a
                    id="btn-download-word"
                    href={pdfUrl}
                    download={currentDeck.filename}
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-black/[0.04] dark:bg-white/[0.06] border border-black/[0.06] dark:border-white/[0.08] text-zinc-800 dark:text-zinc-200 text-[12px] font-semibold transition-all active:scale-95"
                  >
                    <ExternalLink className="w-3.5 h-3.5" strokeWidth={1.5} />
                    Save a copy
                  </a>
                )}
              </div>
            </div>
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
                <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-1 leading-relaxed">
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
                  <div className="flex items-center justify-between text-[11px] font-mono uppercase tracking-wider text-zinc-600 dark:text-zinc-400 px-1">
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
                              <p className="text-[10px] font-mono text-zinc-600 dark:text-zinc-400 truncate">
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

      {isBrowserOpen && (
        <DeckBrowser
          decks={availableDecks}
          currentDeckId={currentDeck?.id}
          onSelect={(deck) => {
            setCurrentDeck(deck);
            setLocalBlobUrl(null);
            selectPdf(deck);
            setIsBrowserOpen(false);
          }}
          onClose={() => setIsBrowserOpen(false)}
        />
      )}
    </div>
  );
};


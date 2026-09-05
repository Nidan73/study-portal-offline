import React, { useState, useEffect, useRef } from 'react';
import { useStore } from '../store/useStore';
import { 
  Search, 
  Video, 
  FileText, 
  BookOpen, 
  StickyNote,
  ArrowRight
} from 'lucide-react';

export const CommandPalette: React.FC = () => {
  const { 
    isCommandPaletteOpen, 
    setCommandPalette, 
    catalog, 
    courses, 
    userData,
    activeCourseId,
    setCurrentTime,
    selectCourse, 
    selectLesson, 
    selectPdf, 
    setActiveTab 
  } = useStore();

  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setCommandPalette(!isCommandPaletteOpen);
      } else if (e.key === 'Escape' && isCommandPaletteOpen) {
        e.preventDefault();
        setCommandPalette(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isCommandPaletteOpen, setCommandPalette]);

  useEffect(() => {
    if (isCommandPaletteOpen) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isCommandPaletteOpen]);

  if (!isCommandPaletteOpen) return null;

  const items: Array<{
    id: string;
    type: 'lesson' | 'pdf' | 'course' | 'note';
    title: string;
    subtitle: string;
    action: () => void;
  }> = [];

  const q = query.toLowerCase().trim();

  if (catalog) {
    for (const mod of catalog.modules) {
      for (const lesson of mod.lessons) {
        if (!q || lesson.title.toLowerCase().includes(q) || mod.title.toLowerCase().includes(q)) {
          items.push({
            id: `lesson-${lesson.id}`,
            type: 'lesson',
            title: lesson.title,
            subtitle: mod.title,
            action: () => {
              selectLesson(lesson);
              setActiveTab('player');
              setCommandPalette(false);
            }
          });
        }
      }

      for (const pdf of mod.supplementaryFiles) {
        if (!q || pdf.title.toLowerCase().includes(q) || mod.title.toLowerCase().includes(q)) {
          items.push({
            id: `pdf-${pdf.id}`,
            type: 'pdf',
            title: pdf.title,
            subtitle: `Slide Deck • ${mod.title}`,
            action: () => {
              selectPdf(pdf);
              setActiveTab('split-slides');
              setCommandPalette(false);
            }
          });
        }
      }
    }
  }

  // Saved notes across every lecture in this course. Only surfaced once you
  // type, otherwise hundreds of notes would bury the lessons.
  if (q && catalog) {
    const courseNotes = userData?.courses?.[activeCourseId]?.notes || {};
    const lessonById = new Map<string, { title: string; lesson: any }>();
    for (const mod of catalog.modules) {
      for (const lesson of mod.lessons) lessonById.set(lesson.id, { title: lesson.title, lesson });
    }

    for (const [lessonId, lessonNotes] of Object.entries(courseNotes)) {
      for (const note of lessonNotes || []) {
        if (!note.content.toLowerCase().includes(q)) continue;
        const known = lessonById.get(lessonId);
        const mins = Math.floor(note.timestampSeconds / 60);
        const secs = Math.floor(note.timestampSeconds % 60);
        const stamp = `${mins}:${String(secs).padStart(2, '0')}`;
        items.push({
          id: `note-${note.id}`,
          type: 'note',
          title: note.content.length > 90 ? note.content.slice(0, 90) + '…' : note.content,
          subtitle: `Note @ ${stamp} • ${known ? known.title : 'Saved lecture'}`,
          action: () => {
            if (known) {
              selectLesson(known.lesson, note.timestampSeconds);
            } else {
              setCurrentTime(note.timestampSeconds);
            }
            setActiveTab('notes');
            setCommandPalette(false);
          }
        });
      }
    }
  }

  for (const course of courses) {
    if (!q || course.name.toLowerCase().includes(q) || (course.badge || '').toLowerCase().includes(q)) {
      items.push({
        id: `course-${course.id}`,
        type: 'course',
        title: `Switch to: ${course.name}`,
        subtitle: course.badge || 'Course',
        action: () => {
          selectCourse(course.id);
          setCommandPalette(false);
        }
      });
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => (prev + 1) % Math.max(1, items.length));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => (prev - 1 + items.length) % Math.max(1, items.length));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (items[selectedIndex]) {
        items[selectedIndex].action();
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 sm:pt-28 px-4 select-none">
      <div 
        className="fixed inset-0 bg-black/70 backdrop-blur-md animate-in fade-in duration-200"
        onClick={() => setCommandPalette(false)}
      />

      <div className="relative w-full max-w-xl p-1.5 rounded-[2rem] bg-black/[0.05] dark:bg-white/[0.05] border border-black/[0.08] dark:border-white/10 shadow-[0_25px_60px_rgba(0,0,0,0.3)] dark:shadow-[0_25px_60px_rgba(0,0,0,0.8)] z-10 animate-in fade-in zoom-in-95 duration-200">
        <div className="rounded-[calc(2rem-0.375rem)] bg-white/95 dark:bg-[#111218]/95 backdrop-blur-2xl border border-black/[0.05] dark:border-white/[0.08] shadow-[inset_0_1px_1px_rgba(255,255,255,0.15)] dark:shadow-[inset_0_1px_1px_rgba(255,255,255,0.06)] overflow-hidden">
          <div className="flex items-center gap-3 px-4 py-3.5 border-b border-black/[0.06] dark:border-white/[0.08] bg-black/[0.01] dark:bg-white/[0.02]">
            <Search className="w-4 h-4 text-zinc-400 dark:text-zinc-500 flex-shrink-0" strokeWidth={1.5} />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setSelectedIndex(0);
              }}
              onKeyDown={handleKeyDown}
              placeholder="Search lectures, slides, or switch courses..."
              className="w-full bg-transparent text-[13px] text-zinc-900 dark:text-white placeholder-zinc-400 dark:placeholder-zinc-500 focus:outline-none font-sans"
            />
            <kbd className="text-[9px] font-mono px-2 py-0.5 rounded-full bg-black/[0.04] dark:bg-white/10 text-zinc-500 dark:text-zinc-400 border border-black/[0.04] dark:border-white/10">
              ESC
            </kbd>
          </div>

          <div className="max-h-80 overflow-y-auto p-2 space-y-1 scrollbar-thin">
            {items.length === 0 ? (
              <div className="py-12 text-center text-zinc-400 dark:text-zinc-500 text-[12px] font-mono">
                No results found for "{query}"
              </div>
            ) : (
              items.slice(0, 30).map((item, index) => {
                const isSelected = index === selectedIndex;
                return (
                  <div
                    key={item.id}
                    onClick={item.action}
                    onMouseEnter={() => setSelectedIndex(index)}
                    className={`flex items-center justify-between p-2.5 rounded-xl cursor-pointer text-[12px] transition-all duration-150 ${
                      isSelected 
                        ? 'bg-zinc-900 dark:bg-white text-white dark:text-zinc-950 font-medium shadow-sm' 
                        : 'text-zinc-700 dark:text-zinc-300 hover:bg-black/[0.03] dark:hover:bg-white/[0.05]'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0 pr-2">
                      {item.type === 'lesson' && <Video className={`w-4 h-4 flex-shrink-0 ${isSelected ? 'text-white dark:text-zinc-950' : 'text-zinc-400'}`} strokeWidth={1.5} />}
                      {item.type === 'pdf' && <FileText className={`w-4 h-4 flex-shrink-0 ${isSelected ? 'text-white dark:text-zinc-950' : 'text-zinc-400'}`} strokeWidth={1.5} />}
                      {item.type === 'course' && <BookOpen className={`w-4 h-4 flex-shrink-0 ${isSelected ? 'text-white dark:text-zinc-950' : 'text-zinc-400'}`} strokeWidth={1.5} />}
                      {item.type === 'note' && <StickyNote className={`w-4 h-4 flex-shrink-0 ${isSelected ? 'text-white dark:text-zinc-950' : 'text-amber-500'}`} strokeWidth={1.5} />}

                      <div className="truncate">
                        <div className="truncate font-medium">{item.title}</div>
                        <div className={`text-[10px] font-mono truncate ${isSelected ? 'text-white/70 dark:text-zinc-950/70' : 'text-zinc-400 dark:text-zinc-500'}`}>
                          {item.subtitle}
                        </div>
                      </div>
                    </div>

                    <ArrowRight className={`w-3.5 h-3.5 flex-shrink-0 ${isSelected ? 'opacity-100' : 'opacity-0'}`} strokeWidth={1.5} />
                  </div>
                );
              })
            )}
          </div>

          <div className="px-4 py-2 bg-black/[0.02] dark:bg-white/[0.02] border-t border-black/[0.05] dark:border-white/[0.06] flex items-center justify-between text-[10px] font-mono text-zinc-400 dark:text-zinc-500">
            <span>{items.length} items indexed</span>
            <span>↑↓ navigate • ↵ select</span>
          </div>
        </div>
      </div>
    </div>
  );
};

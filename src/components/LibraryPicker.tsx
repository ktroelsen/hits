import { useEffect, useState } from 'react';
import { Library } from 'lucide-react';
import { currentLibraryId, fetchLibraries, LibraryInfo, switchLibrary } from '../services/library';

// Chooses the song library (one database each, see services/library.ts). Hidden when the
// server only has one. Switching reloads the page so everything is fetched anew.
export function LibraryPicker({ className = '' }: { className?: string }) {
  const [libraries, setLibraries] = useState<LibraryInfo[]>([]);
  const [current, setCurrent] = useState(currentLibraryId());

  useEffect(() => {
    fetchLibraries().then((data) => {
      if (!data) return;
      setLibraries(data.libraries);
      setCurrent(data.current);
    });
  }, []);

  if (libraries.length < 2) return null;

  return (
    <div className={`flex flex-wrap items-center gap-2 ${className}`} role="radiogroup" aria-label="Sangbibliotek">
      <Library className="w-4 h-4 text-slate-400" aria-hidden />
      {libraries.map((lib) => {
        const selected = lib.id === current;
        return (
          <button
            key={lib.id}
            role="radio"
            aria-checked={selected}
            onClick={() => !selected && switchLibrary(lib.id)}
            className={`px-3.5 py-1.5 rounded-full text-sm font-bold border transition-colors ${
              selected
                ? 'bg-cyan-500 text-slate-950 border-cyan-400'
                : 'bg-slate-900/80 text-slate-300 border-slate-700 hover:border-slate-500'
            }`}
          >
            {lib.name}
          </button>
        );
      })}
    </div>
  );
}

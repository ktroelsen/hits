import { useState } from 'react';
import { TimelineSong } from '../services/gameApi';
import { YearPicker } from '../components/YearPicker';

const MIN_YEAR = 1960;
const MAX_YEAR = 2026;

// Lets a player pick where the (unknown) playing song belongs on the shared timeline.
// The year control is the same YearPicker as the single-device game's "Gæt årstal" box,
// and setting the year auto-selects the matching slot.
export function PlacementPicker({
  timeline,
  disabled,
  onSubmit,
}: {
  timeline: TimelineSong[];
  disabled?: boolean;
  onSubmit: (insertIndex: number, guessedYear?: number) => void;
}) {
  const [year, setYear] = useState(1995);
  // Insert index for a given year = how many timeline songs are strictly older.
  const slotForYear = (y: number) => timeline.filter((s) => s.year < y).length;
  const [slot, setSlot] = useState<number>(() => slotForYear(1995));

  const setYearAndSlot = (newYear: number) => {
    const clamped = Math.max(MIN_YEAR, Math.min(MAX_YEAR, newYear));
    setYear(clamped);
    setSlot(slotForYear(clamped));
  };

  const slotLabel = (i: number): string => {
    if (timeline.length === 0) return 'Placér sangen';
    if (i === 0) return `Før ${timeline[0].year}`;
    if (i === timeline.length) return `Efter ${timeline[timeline.length - 1].year}`;
    return `Mellem ${timeline[i - 1].year} og ${timeline[i].year}`;
  };

  const slots = Array.from({ length: timeline.length + 1 }, (_, i) => i);

  return (
    <div className="space-y-4">
      <YearPicker year={year} onChange={setYearAndSlot} disabled={disabled} />

      {/* Placement — driven by the year, but can be overridden by tapping a slot */}
      <div>
        <p className="mb-2 text-sm font-semibold text-slate-300">Placering på tidslinjen</p>
        <div className="grid gap-2">
          {slots.map((i) => (
            <button
              key={i}
              disabled={disabled}
              onClick={() => setSlot(i)}
              className={`rounded-lg px-4 py-3 text-left text-sm font-medium ring-1 transition ${
                slot === i
                  ? 'bg-pink-600 text-white ring-pink-400'
                  : 'bg-slate-800 text-slate-200 ring-slate-700 hover:bg-slate-700'
              } disabled:opacity-40`}
            >
              {slotLabel(i)}
            </button>
          ))}
        </div>
      </div>

      <button
        onClick={() => onSubmit(slot, year)}
        disabled={disabled}
        className="w-full rounded-lg bg-emerald-600 px-4 py-3 font-bold text-white hover:bg-emerald-500 disabled:opacity-40"
      >
        Send svar
      </button>
    </div>
  );
}

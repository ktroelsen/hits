import { useState } from 'react';
import { Calendar, Minus, Plus } from 'lucide-react';
import { TimelineSong } from '../services/gameApi';

const MIN_YEAR = 1960;
const MAX_YEAR = 2026;

const DECADES = [
  { label: "60'erne", year: 1965 },
  { label: "70'erne", year: 1975 },
  { label: "80'erne", year: 1985 },
  { label: "90'erne", year: 1995 },
  { label: "00'erne", year: 2005 },
  { label: "10'erne", year: 2015 },
  { label: "20'erne", year: 2022 },
];

// Lets a player pick where the (unknown) playing song belongs on the shared timeline.
// The year control mirrors the single-device game's "Gæt årstal" box (quick-decade
// tags + stepper + input), and setting the year auto-selects the matching slot.
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
      {/* Gæt årstal — same controls as the single-device game */}
      <div className="rounded-2xl bg-slate-950/80 border border-slate-800 p-3 shadow-inner">
        <div className="mb-2 flex items-center gap-1.5">
          <Calendar className="h-4 w-4 text-pink-400" />
          <span className="text-xs font-bold text-slate-200">Gæt årstal:</span>
        </div>

        {/* Quick decade tags */}
        <div className="flex flex-wrap gap-1.5">
          {DECADES.map((dec) => {
            const isSelected = year >= dec.year - 5 && year <= dec.year + 4;
            return (
              <button
                key={dec.label}
                type="button"
                disabled={disabled}
                onClick={() => setYearAndSlot(dec.year)}
                className={`rounded-lg border px-2.5 py-1 font-mono text-xs font-semibold transition-all disabled:opacity-40 ${
                  isSelected
                    ? 'border-pink-500 bg-pink-600 text-white shadow-md shadow-pink-500/20'
                    : 'border-slate-800 bg-slate-900 text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                }`}
              >
                {dec.label}
              </button>
            );
          })}
        </div>

        {/* Stepper + exact year input */}
        <div className="mt-3 flex items-center justify-center gap-2">
          <button
            type="button"
            disabled={disabled}
            onClick={() => setYearAndSlot(year - 1)}
            className="rounded-xl border border-slate-700 bg-slate-800 p-1.5 text-slate-300 hover:bg-slate-700 hover:text-white disabled:opacity-40"
            title="1 år tilbage"
          >
            <Minus className="h-4 w-4" />
          </button>

          <div className="relative">
            <input
              type="number"
              min={MIN_YEAR}
              max={MAX_YEAR}
              value={year}
              disabled={disabled}
              onChange={(e) => setYearAndSlot(parseInt(e.target.value, 10) || 1990)}
              className="w-24 rounded-xl border-2 border-amber-500/40 bg-slate-900 px-2 py-1 text-center font-mono text-lg font-black text-amber-300 shadow-inner focus:border-amber-400 focus:outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none disabled:opacity-40"
            />
            <span className="absolute -top-2 right-2 rounded bg-amber-500 px-1 text-[9px] font-bold text-slate-950">
              ÅR
            </span>
          </div>

          <button
            type="button"
            disabled={disabled}
            onClick={() => setYearAndSlot(year + 1)}
            className="rounded-xl border border-slate-700 bg-slate-800 p-1.5 text-slate-300 hover:bg-slate-700 hover:text-white disabled:opacity-40"
            title="1 år frem"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>
      </div>

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

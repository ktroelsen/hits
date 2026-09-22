import { useState } from 'react';
import { TimelineSong } from '../services/gameApi';

// Lets a player pick where the (unknown) playing song belongs on the shared
// timeline, plus guess its year. insertIndex is 0..timeline.length.
export function PlacementPicker({
  timeline,
  disabled,
  onSubmit,
}: {
  timeline: TimelineSong[];
  disabled?: boolean;
  onSubmit: (insertIndex: number, guessedYear?: number) => void;
}) {
  const [slot, setSlot] = useState<number | null>(null);
  const [year, setYear] = useState('');

  const slotLabel = (i: number): string => {
    if (timeline.length === 0) return 'Placér sangen';
    if (i === 0) return `Før ${timeline[0].year}`;
    if (i === timeline.length) return `Efter ${timeline[timeline.length - 1].year}`;
    return `Mellem ${timeline[i - 1].year} og ${timeline[i].year}`;
  };

  const slots = Array.from({ length: timeline.length + 1 }, (_, i) => i);

  // Typing a year auto-selects the matching slot (before/after/between), like the
  // single-device game — the insert index is how many timeline songs are older.
  const onYearChange = (v: string) => {
    setYear(v);
    const y = parseInt(v.trim(), 10);
    if (Number.isFinite(y)) setSlot(timeline.filter((s) => s.year < y).length);
  };

  const submit = () => {
    if (slot === null) return;
    const y = parseInt(year.trim(), 10);
    onSubmit(slot, Number.isFinite(y) ? y : undefined);
  };

  return (
    <div className="space-y-4">
      <div>
        <p className="mb-2 text-sm font-semibold text-slate-300">Hvor hører sangen til?</p>
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

      <label className="block">
        <span className="text-xs uppercase tracking-wide text-slate-400">Gæt årstal (bonus)</span>
        <input
          type="number"
          inputMode="numeric"
          value={year}
          disabled={disabled}
          onChange={(e) => onYearChange(e.target.value)}
          placeholder="fx 1994"
          className="mt-1 w-full rounded-lg bg-slate-800 px-3 py-2 text-slate-100 outline-none ring-1 ring-slate-700 focus:ring-pink-500 disabled:opacity-40"
        />
      </label>

      <button
        onClick={submit}
        disabled={disabled || slot === null}
        className="w-full rounded-lg bg-emerald-600 px-4 py-3 font-bold text-white hover:bg-emerald-500 disabled:opacity-40"
      >
        Send svar
      </button>
    </div>
  );
}

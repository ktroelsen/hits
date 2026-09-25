import { Calendar, Minus, Plus } from 'lucide-react';
import { Decade } from '../types';
import { DECADE_COLORS } from './HitsterCard';

const MIN_YEAR = 1950;
const MAX_YEAR = 2026;

export const DECADE_CARDS: { id: Decade; label: string; year: number }[] = [
  { id: '50s', label: "50'erne", year: 1955 },
  { id: '60s', label: "60'erne", year: 1965 },
  { id: '70s', label: "70'erne", year: 1975 },
  { id: '80s', label: "80'erne", year: 1985 },
  { id: '90s', label: "90'erne", year: 1995 },
  { id: '00s', label: "00'erne", year: 2005 },
  { id: '10s', label: "10'erne", year: 2015 },
  { id: '20s', label: "20'erne", year: 2022 },
];

interface YearPickerProps {
  year: number;
  onChange: (year: number) => void;
  disabled?: boolean;
  // 'large' is used on the online game's phone screen, where this is the main
  // control on the page and benefits from bigger touch targets.
  size?: 'default' | 'large';
}

// Shared "Gæt årstal" control — decade cards (styled like the song cards on the
// board) plus a stepper/input for the exact year. Used by both the single-device
// game (TimelineView) and the online game (PlacementPicker) so they can't drift apart.
export function YearPicker({ year, onChange, disabled, size = 'default' }: YearPickerProps) {
  const setClampedYear = (newYear: number) => onChange(Math.max(MIN_YEAR, Math.min(MAX_YEAR, newYear)));
  const large = size === 'large';

  return (
    <div className={`rounded-2xl bg-slate-950/80 border border-slate-800 shadow-inner ${large ? 'p-4' : 'p-3'}`}>
      <div className={`flex items-center gap-1.5 ${large ? 'mb-3' : 'mb-2'}`}>
        <Calendar className={`text-pink-400 ${large ? 'h-5 w-5' : 'h-4 w-4'}`} />
        <span className={`font-bold text-slate-200 ${large ? 'text-sm' : 'text-xs'}`}>Gæt årstal:</span>
      </div>

      {/* Decade cards */}
      <div className={`grid grid-cols-4 sm:grid-cols-8 ${large ? 'gap-2' : 'gap-1.5'}`}>
        {DECADE_CARDS.map((dec) => {
          const isSelected = year >= dec.year - 5 && year <= dec.year + 4;
          const colors = DECADE_COLORS[dec.id];
          return (
            <button
              key={dec.id}
              type="button"
              disabled={disabled}
              onClick={() => setClampedYear(dec.year)}
              className={`flex flex-col items-center justify-center gap-0.5 rounded-xl border-2 transition-all disabled:opacity-40 ${
                large ? 'py-2 px-1.5' : 'py-2 px-1'
              } ${
                isSelected
                  ? `${colors.border} bg-gradient-to-b ${colors.bg} ring-2 ring-white/30 shadow-md scale-[1.03]`
                  : 'border-slate-800 bg-slate-900 hover:bg-slate-800'
              }`}
            >
              <span
                className={`font-bold uppercase tracking-wider px-1 rounded ${large ? 'text-[11px]' : 'text-[9px]'} ${
                  isSelected ? colors.badge : 'text-slate-500'
                }`}
              >
                {dec.id}
              </span>
              <span className={`font-black font-mono ${large ? 'text-sm' : 'text-xs'} ${isSelected ? 'text-white' : 'text-slate-400'}`}>
                {dec.label}
              </span>
            </button>
          );
        })}
      </div>

      {/* Stepper + exact year input */}
      <div className={`flex items-center justify-center gap-2 ${large ? 'mt-4' : 'mt-3'}`}>
        <button
          type="button"
          disabled={disabled}
          onClick={() => setClampedYear(year - 1)}
          className={`rounded-xl border border-slate-700 bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white disabled:opacity-40 ${
            large ? 'p-2.5' : 'p-1.5'
          }`}
          title="1 år tilbage"
        >
          <Minus className={large ? 'h-5 w-5' : 'h-4 w-4'} />
        </button>

        <div className="relative">
          <input
            type="number"
            min={MIN_YEAR}
            max={MAX_YEAR}
            value={year}
            disabled={disabled}
            onChange={(e) => setClampedYear(parseInt(e.target.value, 10) || 1990)}
            className={`rounded-xl border-2 border-amber-500/40 bg-slate-900 text-center font-mono font-black text-amber-300 shadow-inner focus:border-amber-400 focus:outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none disabled:opacity-40 ${
              large ? 'w-32 px-3 py-2 text-2xl' : 'w-24 px-2 py-1 text-lg'
            }`}
          />
          <span className="absolute -top-2 right-2 rounded bg-amber-500 px-1 text-[9px] font-bold text-slate-950">
            ÅR
          </span>
        </div>

        <button
          type="button"
          disabled={disabled}
          onClick={() => setClampedYear(year + 1)}
          className={`rounded-xl border border-slate-700 bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white disabled:opacity-40 ${
            large ? 'p-2.5' : 'p-1.5'
          }`}
          title="1 år frem"
        >
          <Plus className={large ? 'h-5 w-5' : 'h-4 w-4'} />
        </button>
      </div>
    </div>
  );
}

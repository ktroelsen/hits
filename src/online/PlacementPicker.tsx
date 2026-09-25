import { useState } from 'react';
import { TimelineSong } from '../services/gameApi';
import { YearPicker } from '../components/YearPicker';
import { HitsterCard, decadeForYear } from '../components/HitsterCard';
import { TimelineSlot } from '../components/TimelineSlot';

const MIN_YEAR = 1960;
const MAX_YEAR = 2026;

// Lets a player pick where the (unknown) playing song belongs on the shared timeline.
// The board mirrors the single-device game's "Spilleplade": small cards showing
// artist/title/year with drop-zone slots between them, instead of a plain list of
// buttons. The year control is the same YearPicker as the single-device game's
// "Gæt årstal" box (just bigger here), and setting the year auto-selects the
// matching slot.
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

  // Mirrors the single-device game's handleSlotClick: tapping a slot on the board
  // also updates the year guess (and thus the decade highlight), instead of only
  // moving the selection marker.
  const suggestedYearForSlot = (i: number): number => {
    if (timeline.length === 0) return 1995;
    if (i === 0) return Math.max(MIN_YEAR, timeline[0].year - 5);
    if (i === timeline.length) return Math.min(MAX_YEAR, timeline[timeline.length - 1].year + 4);
    return Math.round((timeline[i - 1].year + timeline[i].year) / 2);
  };

  const setSlotAndYear = (i: number) => {
    setSlot(i);
    setYear(suggestedYearForSlot(i));
  };

  const slotLabel = (i: number): string => {
    if (timeline.length === 0) return 'Placér sangen';
    if (i === 0) return `Før ${timeline[0].year}`;
    if (i === timeline.length) return `Efter ${timeline[timeline.length - 1].year}`;
    return `Mellem ${timeline[i - 1].year} og ${timeline[i].year}`;
  };

  return (
    <div className="space-y-4">
      <YearPicker year={year} onChange={setYearAndSlot} disabled={disabled} size="large" />

      {/* Placement board — driven by the year, but can be overridden by tapping a slot */}
      <div>
        <p className="mb-2 text-sm font-semibold text-slate-300">Placering på tidslinjen</p>
        <div className="w-full rounded-2xl bg-slate-900/70 border border-slate-800 p-2.5 flex flex-wrap items-start justify-center content-start gap-y-2 gap-x-1">
          <TimelineSlot
            index={0}
            label={slotLabel(0)}
            isPlacing={!disabled}
            isSelected={slot === 0}
            onClick={() => setSlotAndYear(0)}
          />
          {timeline.map((song, idx) => (
            <div key={song.id} className="flex items-center gap-1 shrink-0">
              <HitsterCard
                song={{
                  id: song.id,
                  title: song.title,
                  artist: song.artist,
                  year: song.year,
                  decade: decadeForYear(song.year),
                  artworkUrl: song.artworkUrl ?? undefined,
                }}
                isRevealed
                status="neutral"
              />
              <TimelineSlot
                index={idx + 1}
                label={slotLabel(idx + 1)}
                isPlacing={!disabled}
                isSelected={slot === idx + 1}
                onClick={() => setSlotAndYear(idx + 1)}
              />
            </div>
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

import { ReactNode, useState } from 'react';
import { formatGameValue, GameRank, TimelineSong } from '../services/gameApi';
import { YearPicker } from '../components/YearPicker';
import { HitsterCard, decadeForYear } from '../components/HitsterCard';
import { TimelineSlot } from '../components/TimelineSlot';

const MIN_YEAR = 1950;
const MAX_YEAR = 2026;

// Lets a player pick where the (unknown) playing song belongs on the shared timeline.
// The board mirrors the single-device game's "Spilleplade": small cards showing
// artist/title/year with drop-zone slots between them, instead of a plain list of
// buttons. The year control is the same YearPicker as the single-device game's
// "Gæt årstal" box (just bigger here), and setting the year auto-selects the
// matching slot. In a placement game (`rank`) the board and the guess use the songs'
// numbers instead of years.
export function PlacementPicker({
  timeline,
  rank,
  disabled,
  onSubmit,
  audioControl,
}: {
  timeline: TimelineSong[];
  rank?: GameRank | null;
  disabled?: boolean;
  onSubmit: (insertIndex: number, guessedYear?: number) => void;
  /** Play button (individual playback mode), shown next to "Send svar" at the top. */
  audioControl?: ReactNode;
}) {
  const min = rank ? rank.values[0] ?? 1 : MIN_YEAR;
  const max = rank ? rank.values[rank.values.length - 1] ?? 100 : MAX_YEAR;
  const start = rank ? rank.values[Math.floor(rank.values.length / 2)] ?? min : 1995;
  const label = (s: TimelineSong) => formatGameValue(rank, s);

  const [year, setYear] = useState(start);
  // Insert index for a given value = how many timeline songs have a strictly lower one.
  const slotForYear = (y: number) => timeline.filter((s) => s.value < y).length;
  const [slot, setSlot] = useState<number>(() => slotForYear(start));

  const setYearAndSlot = (newYear: number) => {
    const clamped = Math.max(min, Math.min(max, newYear));
    setYear(clamped);
    setSlot(slotForYear(clamped));
  };

  // Mirrors the single-device game's handleSlotClick: tapping a slot on the board
  // also updates the year guess (and thus the decade highlight), instead of only
  // moving the selection marker.
  const suggestedYearForSlot = (i: number): number => {
    if (rank) {
      // A number of the deck that fits the slot (the middle one), if any.
      const lo = i === 0 ? -Infinity : timeline[i - 1].value;
      const hi = i === timeline.length ? Infinity : timeline[i].value;
      const fits = timeline.length === 0 ? rank.values : rank.values.filter((v) => v > lo && v < hi);
      return fits[Math.floor(fits.length / 2)] ?? year;
    }
    if (timeline.length === 0) return 1995;
    if (i === 0) return Math.max(MIN_YEAR, timeline[0].value - 5);
    if (i === timeline.length) return Math.min(MAX_YEAR, timeline[timeline.length - 1].value + 4);
    return Math.round((timeline[i - 1].value + timeline[i].value) / 2);
  };

  const setSlotAndYear = (i: number) => {
    setSlot(i);
    setYear(suggestedYearForSlot(i));
  };

  const slotLabel = (i: number): string => {
    if (timeline.length === 0) return 'Placér sangen';
    if (i === 0) return `Før ${label(timeline[0])}`;
    if (i === timeline.length) return `Efter ${label(timeline[timeline.length - 1])}`;
    return `Mellem ${label(timeline[i - 1])} og ${label(timeline[i])}`;
  };

  return (
    <div className="space-y-4">
      {/* Top row: play + send side by side, so answering doesn't need a scroll */}
      <div className="flex items-stretch gap-3">
        {audioControl}
        <button
          onClick={() => onSubmit(slot, year)}
          disabled={disabled}
          className="flex-1 rounded-full bg-pink-600 px-4 py-4 text-lg font-bold text-white hover:bg-pink-500 disabled:opacity-40"
        >
          Send svar
        </button>
      </div>

      <YearPicker
        year={year}
        onChange={setYearAndSlot}
        disabled={disabled}
        size="large"
        valueRange={rank ? { min, max, label: rank.valuePrefix === '#' ? 'placering' : 'tal', badge: 'TAL' } : undefined}
      />

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
                valueLabel={rank ? label(song) : undefined}
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
    </div>
  );
}

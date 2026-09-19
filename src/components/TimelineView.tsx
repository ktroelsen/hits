import { useEffect } from 'react';
import {
  Check,
  X,
  ArrowRight,
  Coins,
  Calendar,
  Minus,
  Plus,
} from 'lucide-react';
import { Song, Player, GameSettings, TurnPhase, TimelineEntry } from '../types';
import { HitsterCard } from './HitsterCard';
import { TimelineSlot } from './TimelineSlot';

interface TimelineViewProps {
  timeline: TimelineEntry[];
  activePlayer: Player;
  players: Player[];
  mysterySong: Song | null;
  phase: TurnPhase;
  settings: GameSettings;
  selectedIndex: number | null;
  onSelectSlot: (index: number) => void;
  onConfirmPlacement: () => void;
  onNextTurn: () => void;
  onPlaySong: (song: Song) => void;
  yearGuessInput: string;
  onYearGuessChange: (val: string) => void;
  lastPlacementResult: {
    isCorrect: boolean;
    correctIndex: number;
    chosenIndex: number;
    yearBonus: boolean;
  } | null;
}

export function TimelineView({
  timeline,
  activePlayer,
  players,
  mysterySong,
  phase,
  settings,
  selectedIndex,
  onSelectSlot,
  onConfirmPlacement,
  onNextTurn,
  onPlaySong,
  yearGuessInput,
  onYearGuessChange,
  lastPlacementResult,
}: TimelineViewProps) {
  // Active numeric year state for the stepper / tags
  const currentNumericYear = parseInt(yearGuessInput, 10) || 1995;

  // Auto-select corresponding slot if none is selected yet
  useEffect(() => {
    if (selectedIndex === null && (phase === 'listening' || phase === 'placed' || phase === 'draw')) {
      const initialSlot = getSlotFromYear(currentNumericYear);
      onSelectSlot(initialSlot);
    }
  }, [selectedIndex, phase, currentNumericYear]);

  const isPlacingPhase = phase === 'listening' || phase === 'placed' || phase === 'draw';
  const isRevealedPhase = phase === 'revealed';

  // Compute slots for the shared timeline
  const slots: { index: number; label: string; minYear: number; maxYear: number }[] = [];
  const timelineLength = timeline.length;

  for (let i = 0; i <= timelineLength; i++) {
    let label = '';
    let minYear = 1960;
    let maxYear = 2026;

    if (i === 0) {
      const firstYear = timeline.length > 0 ? timeline[0].song.year : 2000;
      label = timeline.length > 0 ? `Før ${firstYear}` : 'Første sang';
      minYear = 1960;
      maxYear = firstYear;
    } else if (i === timelineLength) {
      const lastYear = timeline[timelineLength - 1].song.year;
      label = `Efter ${lastYear}`;
      minYear = lastYear;
      maxYear = 2026;
    } else {
      const prevYear = timeline[i - 1].song.year;
      const nextYear = timeline[i].song.year;
      label = `${prevYear} – ${nextYear}`;
      minYear = prevYear;
      maxYear = nextYear;
    }
    slots.push({ index: i, label, minYear, maxYear });
  }

  // Determine slot index from a numeric year on the shared timeline
  const getSlotFromYear = (year: number): number => {
    if (timeline.length === 0) return 0;
    if (year < timeline[0].song.year) return 0;
    if (year > timeline[timeline.length - 1].song.year) return timeline.length;

    for (let i = 0; i < timeline.length - 1; i++) {
      if (year >= timeline[i].song.year && year <= timeline[i + 1].song.year) {
        return i + 1;
      }
    }
    return timeline.length;
  };

  // When user updates the slider or stepper
  const handleYearChange = (newYear: number) => {
    const clampedYear = Math.max(1960, Math.min(2026, newYear));
    onYearGuessChange(clampedYear.toString());

    // Auto-select the corresponding slot on the timeline
    const targetSlot = getSlotFromYear(clampedYear);
    onSelectSlot(targetSlot);
  };

  // When user clicks a slot on the timeline
  const handleSlotClick = (slotIdx: number) => {
    onSelectSlot(slotIdx);
    const slot = slots[slotIdx];
    if (slot) {
      let suggestedYear = 1995;
      if (slotIdx === 0) {
        suggestedYear = timeline.length > 0 ? Math.max(1960, timeline[0].song.year - 5) : 1990;
      } else if (slotIdx === timelineLength) {
        suggestedYear = Math.min(2024, timeline[timelineLength - 1].song.year + 4);
      } else {
        suggestedYear = Math.round((slot.minYear + slot.maxYear) / 2);
      }
      onYearGuessChange(suggestedYear.toString());
    }
  };

  const DECADES = [
    { label: "60'erne", year: 1965 },
    { label: "70'erne", year: 1975 },
    { label: "80'erne", year: 1985 },
    { label: "90'erne", year: 1995 },
    { label: "00'erne", year: 2005 },
    { label: "10'erne", year: 2015 },
    { label: "20'erne", year: 2022 },
  ];

  return (
    <div
      id="timeline-view"
      className="w-full md:h-full md:min-h-0 bg-slate-900/70 border border-slate-800 rounded-2xl p-2.5 sm:p-3 backdrop-blur-md shadow-xl flex flex-col gap-2"
    >
      {/* Slim header: board title + whose turn it is */}
      <div className="flex items-center gap-2.5 border-b border-slate-800 pb-2 shrink-0">
        <div
          className="w-3 h-3 rounded-full ring-4 ring-pink-500/20 shrink-0"
          style={{ backgroundColor: activePlayer.color }}
        />
        <h3 className="text-base sm:text-lg font-bold text-white font-display flex items-center gap-2">
          <span>Spilleplade</span>
          <span
            className="text-xs font-bold px-2.5 py-0.5 rounded-full border shadow-xs"
            style={{
              backgroundColor: `${activePlayer.color}25`,
              borderColor: `${activePlayer.color}70`,
              color: '#ffffff',
            }}
          >
            {activePlayer.name}'s tur
          </span>
        </h3>
      </div>

      {/* THE GAME BOARD — cards flow onto multiple rows, no scrollbar (hero) */}
      <div
        className="w-full md:flex-1 md:min-h-0 md:overflow-y-auto no-scrollbar py-1 px-1 flex flex-wrap items-center justify-center content-center gap-2"
      >
        {/* Slot 0 (Before first card) */}
        <TimelineSlot
          index={0}
          label={slots[0]?.label || 'Første'}
          isPlacing={isPlacingPhase}
          isSelected={selectedIndex === 0}
          isCorrect={isRevealedPhase && lastPlacementResult?.isCorrect && lastPlacementResult.chosenIndex === 0}
          isWrongChoice={isRevealedPhase && !lastPlacementResult?.isCorrect && lastPlacementResult?.chosenIndex === 0}
          showAsTarget={isRevealedPhase && !lastPlacementResult?.isCorrect && lastPlacementResult?.correctIndex === 0}
          onClick={() => handleSlotClick(0)}
        />

        {/* Existing Cards & subsequent slots on shared timeline */}
        {timeline.map((entry, idx) => (
          <div key={`${entry.song.id}-${idx}`} className="flex items-center gap-2 shrink-0">
            {/* Song Card on Timeline - plays preview natively on the card */}
            <HitsterCard
              song={entry.song}
              isRevealed={true}
              status="neutral"
              claimedBy={entry.claimedBy}
            />

            {/* Slot right after this card */}
            <TimelineSlot
              index={idx + 1}
              label={slots[idx + 1]?.label || ''}
              isPlacing={isPlacingPhase}
              isSelected={selectedIndex === idx + 1}
              isCorrect={
                isRevealedPhase &&
                lastPlacementResult?.isCorrect &&
                lastPlacementResult.chosenIndex === idx + 1
              }
              isWrongChoice={
                isRevealedPhase &&
                !lastPlacementResult?.isCorrect &&
                lastPlacementResult?.chosenIndex === idx + 1
              }
              showAsTarget={
                isRevealedPhase &&
                !lastPlacementResult?.isCorrect &&
                lastPlacementResult?.correctIndex === idx + 1
              }
              onClick={() => handleSlotClick(idx + 1)}
            />
          </div>
        ))}
      </div>

      {/* Guess controls (year tags + input) + confirm — below the board */}
      {isPlacingPhase && (
        <div className="shrink-0 flex flex-col gap-2">
          <div className="p-2.5 rounded-2xl bg-slate-950/80 border border-slate-800 flex flex-wrap items-center gap-x-2 gap-y-1.5 shadow-inner">
            <div className="flex items-center gap-1.5 mr-1">
              <Calendar className="w-4 h-4 text-pink-400" />
              <span className="text-xs font-bold text-slate-200">Gæt årstal:</span>
            </div>

            {/* Quick Decade tags */}
            {DECADES.map((dec) => {
              const isSelected =
                currentNumericYear >= dec.year - 5 && currentNumericYear <= dec.year + 4;
              return (
                <button
                  key={dec.label}
                  type="button"
                  onClick={() => handleYearChange(dec.year)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold font-mono border transition-all ${
                    isSelected
                      ? 'bg-pink-600 border-pink-500 text-white shadow-md shadow-pink-500/20'
                      : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                  }`}
                >
                  {dec.label}
                </button>
              );
            })}

            {/* Stepper + exact year input */}
            <div className="flex items-center gap-2 ml-auto">
              <button
                type="button"
                onClick={() => handleYearChange(currentNumericYear - 1)}
                className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition-colors"
                title="1 år tilbage"
              >
                <Minus className="w-4 h-4" />
              </button>

              <div className="relative">
                <input
                  type="number"
                  min="1960"
                  max="2026"
                  value={yearGuessInput || currentNumericYear.toString()}
                  onChange={(e) => handleYearChange(parseInt(e.target.value, 10) || 1990)}
                  className="w-24 text-center text-lg font-black font-mono text-amber-300 bg-slate-900 border-2 border-amber-500/40 focus:border-amber-400 rounded-xl py-1 px-2 shadow-inner focus:outline-none"
                />
                <span className="absolute -top-2 right-2 px-1 text-[9px] font-bold bg-amber-500 text-slate-950 rounded">
                  ÅR
                </span>
              </div>

              <button
                type="button"
                onClick={() => handleYearChange(currentNumericYear + 1)}
                className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition-colors"
                title="1 år frem"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Decision confirmation bar */}
          <div className="p-2.5 rounded-2xl bg-slate-950 border border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-2 animate-in fade-in">
            <div className="flex items-center gap-3 w-full sm:w-auto">
              <span className="text-xs font-bold text-slate-300">
                {selectedIndex !== null ? (
                  <span className="flex items-center gap-1.5 text-pink-400">
                    <Check className="w-4 h-4" />
                    Valgt placering:{' '}
                    <strong className="text-white font-mono bg-slate-800 px-2 py-0.5 rounded border border-slate-700">
                      {slots[selectedIndex]?.label}
                    </strong>
                  </span>
                ) : (
                  <span className="text-slate-400">
                    Vælg et årstal eller klik på et felt på spillepladen...
                  </span>
                )}
              </span>
            </div>

            <button
              id="confirm-placement-btn"
              onClick={onConfirmPlacement}
              disabled={selectedIndex === null}
              className="w-full sm:w-auto px-6 py-2 rounded-xl bg-gradient-to-r from-pink-500 via-purple-600 to-indigo-600 hover:from-pink-600 hover:to-indigo-700 text-white font-bold text-xs tracking-wider uppercase disabled:opacity-40 disabled:pointer-events-none shadow-lg shadow-pink-500/20 transition-all flex items-center justify-center gap-2"
            >
              <span>Afslør & Tjek Placering</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Result feedback bar (After reveal) */}
      {isRevealedPhase && lastPlacementResult && (
        <div
          className={`p-2.5 rounded-2xl border flex flex-col sm:flex-row items-center justify-between gap-2 animate-in fade-in ${
            lastPlacementResult.isCorrect
              ? 'bg-emerald-950/70 border-emerald-500/80 text-emerald-100'
              : 'bg-rose-950/70 border-rose-500/80 text-rose-100'
          }`}
        >
          <div className="flex items-center gap-3">
            <div
              className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 font-bold ${
                lastPlacementResult.isCorrect ? 'bg-emerald-500 text-slate-950' : 'bg-rose-500 text-white'
              }`}
            >
              {lastPlacementResult.isCorrect ? <Check className="w-5 h-5" /> : <X className="w-5 h-5" />}
            </div>

            <div>
              <h4 className="text-sm font-bold flex items-center gap-2">
                {lastPlacementResult.isCorrect ? 'Rigtig placering!' : 'Øv, forkert placering!'}
                {lastPlacementResult.yearBonus && (
                  <span className="text-[11px] bg-amber-400 text-slate-950 px-2 py-0.5 rounded-full font-bold flex items-center gap-1">
                    <Coins className="w-3 h-3" /> +1 Hitster Token for præcist årstal ({mysterySong?.year})!
                  </span>
                )}
              </h4>
              <p className="text-xs opacity-90 mt-0.5">
                {lastPlacementResult.isCorrect
                  ? `${mysterySong?.title} (${mysterySong?.year}) er nu gemt på din tidslinje.`
                  : `${mysterySong?.title} udkom i ${mysterySong?.year} og hørte til ved: "${slots[lastPlacementResult.correctIndex]?.label}". Kortet kasseres.`}
              </p>
            </div>
          </div>

          <button
            id="next-turn-btn"
            onClick={onNextTurn}
            className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs tracking-wider uppercase border border-slate-700 transition-all flex items-center justify-center gap-2 shrink-0 shadow"
          >
            <span>Næste Tur</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}

import { useEffect, useState } from 'react';
import {
  Check,
  X,
  ArrowRight,
  Coins,
  Calendar,
  Minus,
  Plus,
  ZoomIn,
  ZoomOut,
  Play,
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
  nextTurnLabel?: string;
  onPlaySong: (song: Song) => void;
  songStarted: boolean;
  onStartSong: () => void;
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
  nextTurnLabel,
  onPlaySong,
  songStarted,
  onStartSong,
  yearGuessInput,
  onYearGuessChange,
  lastPlacementResult,
}: TimelineViewProps) {
  // Active numeric year state for the stepper / tags
  const currentNumericYear = parseInt(yearGuessInput, 10) || 1995;

  // Board zoom — lets players scale the cards up/down when many are on the board.
  const [boardZoom, setBoardZoom] = useState<number>(() => {
    try {
      const v = parseFloat(localStorage.getItem('hitster-board-zoom') || '');
      return v >= 0.5 && v <= 1.5 ? v : 1;
    } catch {
      return 1;
    }
  });

  const changeZoom = (delta: number) => {
    setBoardZoom((z) => {
      const next = Math.min(1.5, Math.max(0.5, Math.round((z + delta) * 10) / 10));
      try {
        localStorage.setItem('hitster-board-zoom', String(next));
      } catch {
        /* ignore */
      }
      return next;
    });
  };

  // Auto-select corresponding slot if none is selected yet
  useEffect(() => {
    if (selectedIndex === null && (phase === 'listening' || phase === 'placed' || phase === 'draw')) {
      const initialSlot = getSlotFromYear(currentNumericYear);
      if (!isDeadSlot(initialSlot)) onSelectSlot(initialSlot);
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

  // A slot is "dead" when no unused year can ever land in it — e.g. between two
  // cards whose years are consecutive (2015 & 2016), since card years are unique.
  const isDeadSlot = (i: number): boolean => {
    const s = slots[i];
    if (!s || timeline.length === 0) return false;
    if (i === 0) return s.maxYear <= 1960; // no year below the first card
    if (i === timelineLength) return s.minYear >= 2026; // no year above the last card
    return s.maxYear - s.minYear < 2; // no integer strictly between the neighbours
  };

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

    // Auto-select the corresponding slot, unless it's an impossible (dead) slot
    const targetSlot = getSlotFromYear(clampedYear);
    if (!isDeadSlot(targetSlot)) onSelectSlot(targetSlot);
  };

  // When user clicks a slot on the timeline
  const handleSlotClick = (slotIdx: number) => {
    if (isDeadSlot(slotIdx)) return; // impossible slot — not selectable
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

        {/* Board zoom controls */}
        <div className="ml-auto flex items-center gap-1">
          <button
            onClick={() => changeZoom(-0.1)}
            disabled={boardZoom <= 0.5}
            title="Zoom ud"
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 disabled:opacity-40 disabled:pointer-events-none transition-colors"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <span className="text-[11px] font-mono font-semibold text-slate-400 w-9 text-center tabular-nums">
            {Math.round(boardZoom * 100)}%
          </span>
          <button
            onClick={() => changeZoom(0.1)}
            disabled={boardZoom >= 1.5}
            title="Zoom ind"
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 disabled:opacity-40 disabled:pointer-events-none transition-colors"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* THE GAME BOARD — cards flow onto multiple rows, no scrollbar (hero) */}
      <div className="w-full md:flex-1 md:min-h-0 md:overflow-y-auto no-scrollbar">
      <div
        style={{ zoom: boardZoom }}
        className="w-full py-1 px-1 flex flex-wrap items-start justify-center content-start gap-y-2 gap-x-1"
      >
        {/* Slot 0 (Before first card) */}
        <TimelineSlot
          index={0}
          label={slots[0]?.label || 'Første'}
          isPlacing={isPlacingPhase}
          isImpossible={isDeadSlot(0)}
          isSelected={selectedIndex === 0}
          isCorrect={isRevealedPhase && lastPlacementResult?.isCorrect && lastPlacementResult.chosenIndex === 0}
          isWrongChoice={isRevealedPhase && !lastPlacementResult?.isCorrect && lastPlacementResult?.chosenIndex === 0}
          showAsTarget={isRevealedPhase && !lastPlacementResult?.isCorrect && lastPlacementResult?.correctIndex === 0}
          onClick={() => handleSlotClick(0)}
        />

        {/* Existing Cards & subsequent slots on shared timeline */}
        {timeline.map((entry, idx) => (
          <div key={`${entry.song.id}-${idx}`} className="flex items-center gap-1 shrink-0">
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
              isImpossible={isDeadSlot(idx + 1)}
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
      </div>

      {/* Guess controls (year tags + input) + confirm — all on one bar below the board */}
      {isPlacingPhase && (
        <div className="shrink-0 p-2.5 rounded-2xl bg-slate-950/80 border border-slate-800 flex flex-wrap items-center gap-x-2 gap-y-1.5 shadow-inner">
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
          <div className="flex items-center gap-2">
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
                className="w-20 text-center text-lg font-black font-mono text-amber-300 bg-slate-900 border-2 border-amber-500/40 focus:border-amber-400 rounded-xl py-1 px-2 shadow-inner focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
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

          {/* First press starts the song; afterwards it reveals & checks the placement */}
          {songStarted ? (
            <button
              id="confirm-placement-btn"
              onClick={onConfirmPlacement}
              disabled={selectedIndex === null || isDeadSlot(selectedIndex)}
              className="ml-auto px-5 py-2 rounded-xl bg-gradient-to-r from-pink-500 via-purple-600 to-indigo-600 hover:from-pink-600 hover:to-indigo-700 text-white font-bold text-xs tracking-wider uppercase disabled:opacity-40 disabled:pointer-events-none shadow-lg shadow-pink-500/20 transition-all flex items-center justify-center gap-2"
            >
              <span>Afslør &amp; Tjek Placering</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              id="start-song-btn"
              onClick={onStartSong}
              className="ml-auto px-5 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-600 hover:from-emerald-600 hover:to-cyan-700 text-white font-bold text-xs tracking-wider uppercase shadow-lg shadow-emerald-500/20 transition-all flex items-center justify-center gap-2"
            >
              <Play className="w-4 h-4 fill-current" />
              <span>Start spillet</span>
            </button>
          )}
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
                    <Coins className="w-3 h-3" /> +1 HITS Token for præcist årstal ({mysterySong?.year})!
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
            <span>{nextTurnLabel ?? 'Næste Tur'}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}

import { useState, useEffect, useMemo, useCallback } from 'react';
import { TurntablePlayer } from './components/TurntablePlayer';
import { TimelineView } from './components/TimelineView';
import { PlayerBar } from './components/PlayerBar';
import { StartScreen } from './components/StartScreen';
import { DJCompanionMode } from './components/DJCompanionMode';
import { GameSetupModal } from './components/Modals/GameSetupModal';
import { RulesModal } from './components/Modals/RulesModal';
import { VictoryModal } from './components/Modals/VictoryModal';
import { GameOverModal } from './components/Modals/GameOverModal';
import { SongCatalogModal } from './components/Modals/SongCatalogModal';
import { getActiveSongs, loadCatalog } from './services/songsService';
import { markRemoved } from './services/removalStore';
import { getHighscore, submitScore } from './services/highscoreStore';
import { Song, Player, GameSettings, TurnPhase, TimelineEntry } from './types';
import { sfx } from './services/audioService';

const DEFAULT_SETTINGS: GameSettings = {
  mode: 'timeline',
  targetCards: 10,
  winCondition: 'cards',
  timeLimitMinutes: 10,
  categoryFilter: 'all',
  decades: ['60s', '70s', '80s', '90s', '00s', '10s', '20s'],
  autoPlayAudio: true,
  enableSoundEffects: true,
  expertTolerance: 0,
  uniqueYearsOnly: true,
};

const DEFAULT_PLAYERS: Player[] = [
  {
    id: 'player-1',
    name: 'Hold 1',
    color: '#ec4899',
    tokens: 2,
    timeline: [],
    score: 0,
  },
  {
    id: 'player-2',
    name: 'Hold 2',
    color: '#3b82f6',
    tokens: 2,
    timeline: [],
    score: 0,
  },
];

// Single-player (solo) mode: start with this many lives. An exact year guess on a
// correct placement earns a life; a wrong placement costs one, and a wrong
// placement with no lives left ends the game.
const SOLO_STARTING_LIVES = 0;

const SOLO_PLAYER: Player = {
  id: 'solo',
  name: 'Dig',
  color: '#ec4899',
  tokens: 0,
  timeline: [],
  score: 0,
};

// Draw a mystery song whose year is NOT already on the timeline, so no two cards
// ever share a year. Pops colliding songs off the deck; if the deck runs dry it
// rebuilds from `pool` (excluding already-used ids and taken years). Only if no
// unique-year song exists at all does it fall back to any unused song.
function pickMysterySong(
  deck: Song[],
  takenYears: Set<number>,
  pool: Song[],
  usedIds: Set<string>,
): { song: Song | null; deck: Song[] } {
  const d = [...deck];
  while (d.length) {
    const s = d.pop()!;
    if (!takenYears.has(s.year)) return { song: s, deck: d };
  }
  const fresh = pool
    .filter((s) => !usedIds.has(s.id) && !takenYears.has(s.year))
    .sort(() => Math.random() - 0.5);
  if (fresh.length) {
    const s = fresh.pop()!;
    return { song: s, deck: fresh };
  }
  const any = pool.filter((s) => !usedIds.has(s.id)).sort(() => Math.random() - 0.5);
  const s = any.pop() ?? null;
  return { song: s, deck: any };
}

export default function App() {
  const [settings, setSettings] = useState<GameSettings>(DEFAULT_SETTINGS);
  const [players, setPlayers] = useState<Player[]>(DEFAULT_PLAYERS);
  const [activePlayerIndex, setActivePlayerIndex] = useState(0);

  // Whether the player has left the start screen and is in an active game
  const [gameStarted, setGameStarted] = useState(false);

  // Auto-play stays disarmed for the very first mystery song after starting a
  // game, so nothing plays until the player chooses to — leaving room to listen
  // to the start card first. It arms on the first user-driven song change.
  const [autoPlayArmed, setAutoPlayArmed] = useState(false);

  // Shared Timeline played jointly by Hold 1 and Hold 2
  const [sharedTimeline, setSharedTimeline] = useState<TimelineEntry[]>([]);

  // Deck & Draw State
  const [availableDeck, setAvailableDeck] = useState<Song[]>([]);
  const [currentSong, setCurrentSong] = useState<Song | null>(null);
  const [phase, setPhase] = useState<TurnPhase>('listening');
  const [selectedSlotIndex, setSelectedSlotIndex] = useState<number | null>(null);
  const [yearGuessInput, setYearGuessInput] = useState<string>('');

  // Result of the last placement
  const [lastPlacementResult, setLastPlacementResult] = useState<{
    isCorrect: boolean;
    correctIndex: number;
    chosenIndex: number;
    yearBonus: boolean;
  } | null>(null);

  // Modals
  const [isSetupOpen, setIsSetupOpen] = useState(false);
  const [isRulesOpen, setIsRulesOpen] = useState(false);
  const [isVictoryOpen, setIsVictoryOpen] = useState(false);
  const [isCatalogOpen, setIsCatalogOpen] = useState(false);
  const [winner, setWinner] = useState<Player | null>(null);

  // Solo mode state
  const [lives, setLives] = useState(SOLO_STARTING_LIVES);

  // Timed team games: when the game ends (ms timestamp) and the live seconds left
  const [gameEndsAt, setGameEndsAt] = useState<number | null>(null);
  const [remainingSeconds, setRemainingSeconds] = useState<number | null>(null);
  const [highscore, setHighscore] = useState(() => getHighscore());
  const [isGameOverOpen, setIsGameOverOpen] = useState(false);
  const [isNewRecord, setIsNewRecord] = useState(false);
  const [soloGameOverPending, setSoloGameOverPending] = useState(false);

  // Bumped whenever a song is marked "missing music" so song lists recompute.
  const [removedTick, setRemovedTick] = useState(0);

  // Load the catalog from the backend (issue 10) once at startup. On success we bump
  // removedTick so any song list already computed from the bundled fallback recomputes.
  useEffect(() => {
    loadCatalog().then((ok) => {
      if (ok) setRemovedTick((t) => t + 1);
    });
  }, []);

  // Filter available songs according to settings (excluding removed songs)
  const eligibleSongs = useMemo(() => {
    return getActiveSongs().filter((s) => {
      const matchCat =
        settings.categoryFilter === 'all' || s.category === settings.categoryFilter;
      const matchDec = settings.decades.includes(s.decade);
      return matchCat && matchDec;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings.categoryFilter, settings.decades, removedTick]);

  // Start / Reset a fresh game
  const initializeGame = useCallback(
    (newSettings?: GameSettings, newPlayers?: Player[]) => {
      const activeSettings = newSettings || settings;
      const isSolo = activeSettings.mode === 'solo';
      // Solo always plays with one player; team modes never keep the solo player.
      const teamPlayers = (newPlayers || players).filter((p) => p.id !== SOLO_PLAYER.id);
      const configuredPlayers = isSolo
        ? [SOLO_PLAYER]
        : teamPlayers.length
        ? teamPlayers
        : DEFAULT_PLAYERS;

      // Filter and shuffle
      const filtered = getActiveSongs().filter((s) => {
        const matchCat =
          activeSettings.categoryFilter === 'all' || s.category === activeSettings.categoryFilter;
        const matchDec = activeSettings.decades.includes(s.decade);
        return matchCat && matchDec;
      });

      const shuffled = [...filtered].sort(() => Math.random() - 0.5);

      // Start with 1 revealed starter song in the common shared timeline
      const starterSong = shuffled.pop();
      const initialSharedTimeline: TimelineEntry[] = starterSong
        ? [
            {
              song: starterSong,
              claimedBy: {
                id: 'starter',
                name: 'Startkort',
                color: '#f59e0b',
              },
            },
          ]
        : [];

      // Reset team scores, tokens, and personal claimed lists
      const updatedPlayers: Player[] = configuredPlayers.map((p) => ({
        ...p,
        tokens: isSolo ? 0 : 2,
        score: 0,
        timeline: [],
      }));

      // Draw first mystery song for active player (year must differ from starter,
      // unless the setting allows duplicate years on the timeline)
      const takenYears = activeSettings.uniqueYearsOnly
        ? new Set(initialSharedTimeline.map((e) => e.song.year))
        : new Set<number>();
      const usedIds = new Set(initialSharedTimeline.map((e) => e.song.id));
      const { song: firstMystery, deck: deckAfterDraw } = pickMysterySong(
        shuffled,
        takenYears,
        filtered,
        usedIds,
      );

      setSettings(activeSettings);
      setPlayers(updatedPlayers);
      setSharedTimeline(initialSharedTimeline);
      setAvailableDeck(deckAfterDraw);
      setCurrentSong(firstMystery);
      setActivePlayerIndex(0);
      setPhase('listening');
      setSelectedSlotIndex(null);
      setYearGuessInput('');
      setLastPlacementResult(null);
      setWinner(null);
      setIsVictoryOpen(false);
      setLives(SOLO_STARTING_LIVES);
      setIsGameOverOpen(false);
      setIsNewRecord(false);
      setSoloGameOverPending(false);
      setAutoPlayArmed(false); // First mystery song does not auto-play

      if (!isSolo && activeSettings.winCondition === 'time') {
        setGameEndsAt(Date.now() + activeSettings.timeLimitMinutes * 60 * 1000);
        setRemainingSeconds(activeSettings.timeLimitMinutes * 60);
      } else {
        setGameEndsAt(null);
        setRemainingSeconds(null);
      }

      sfx.playFlip();
    },
    [settings, players]
  );

  // Begin a fresh game from the start screen and reveal the game board
  const startGame = useCallback(() => {
    initializeGame(settings.mode === 'solo' ? { ...settings, mode: 'timeline' } : undefined);
    setGameStarted(true);
  }, [initializeGame, settings]);

  // Leave the current game and return to the start screen (choose what to play)
  const exitToStart = useCallback(() => {
    setIsVictoryOpen(false);
    setIsGameOverOpen(false);
    setGameStarted(false);
    setGameEndsAt(null);
    setRemainingSeconds(null);
  }, []);

  // Countdown for timed games. Stops at 0; the current turn is then played out and
  // the winner is announced on the next "Næste tur" (see handleNextTurn).
  useEffect(() => {
    if (gameEndsAt === null) return;
    const tick = () => {
      const left = Math.max(0, Math.ceil((gameEndsAt - Date.now()) / 1000));
      setRemainingSeconds(left);
      if (left === 0) window.clearInterval(interval);
    };
    const interval = window.setInterval(tick, 1000);
    tick();
    return () => window.clearInterval(interval);
  }, [gameEndsAt]);

  const activePlayer = players[activePlayerIndex] || players[0];
  const isSolo = settings.mode === 'solo';
  const isTimed = gameEndsAt !== null;
  const timeUp = isTimed && remainingSeconds === 0;

  // End a timed game: the team with the most cards wins (tokens break ties)
  const endTimedGame = () => {
    const [top] = [...players].sort(
      (a, b) => b.timeline.length - a.timeline.length || b.tokens - a.tokens,
    );
    setGameEndsAt(null);
    setPhase('game_over');
    sfx.playVictory();
    setWinner(top ?? null);
    setIsVictoryOpen(true);
  };

  // End a solo game: save the score as highscore if it is a new record. The
  // revealed card stays on screen so the player can see the correct year; the
  // game over modal opens when they press "Se resultat" (see handleNextTurn).
  const endSoloGame = (finalScore: number) => {
    const record = submitScore(finalScore);
    setIsNewRecord(record);
    setHighscore(getHighscore());
    setSoloGameOverPending(true);
  };

  const showSoloGameOver = () => {
    setPhase('game_over');
    if (isNewRecord) sfx.playVictory();
    setIsGameOverOpen(true);
  };

  // Calculate the correct slot index for mystery song relative to the shared timeline
  const computeCorrectSlotIndex = (song: Song, timeline: TimelineEntry[]): number => {
    if (timeline.length === 0) return 0;
    if (song.year < timeline[0].song.year) return 0;
    if (song.year > timeline[timeline.length - 1].song.year) return timeline.length;

    for (let i = 0; i < timeline.length - 1; i++) {
      if (song.year >= timeline[i].song.year && song.year <= timeline[i + 1].song.year) {
        return i + 1;
      }
    }
    return timeline.length;
  };

  // Check if chosen slot is valid on the shared timeline
  const checkPlacementCorrectness = (
    chosenIndex: number,
    song: Song,
    timeline: TimelineEntry[]
  ): boolean => {
    if (timeline.length === 0) return true;

    // Slot 0: before first song
    if (chosenIndex === 0) {
      return song.year <= timeline[0].song.year;
    }

    // Slot N: after last song
    if (chosenIndex === timeline.length) {
      return song.year >= timeline[timeline.length - 1].song.year;
    }

    // Between index - 1 and index
    const prevSong = timeline[chosenIndex - 1].song;
    const nextSong = timeline[chosenIndex].song;
    return song.year >= prevSong.year && song.year <= nextSong.year;
  };

  // Confirm placement & reveal card
  const handleConfirmPlacement = () => {
    if (selectedSlotIndex === null || !currentSong) return;

    const isCorrect = checkPlacementCorrectness(
      selectedSlotIndex,
      currentSong,
      sharedTimeline
    );
    const correctIndex = computeCorrectSlotIndex(currentSong, sharedTimeline);

    // Check year bonus in expert mode or exact guess
    const guessedYear = parseInt(yearGuessInput.trim(), 10);
    const yearBonus = !isNaN(guessedYear) && guessedYear === currentSong.year;

    setLastPlacementResult({
      isCorrect,
      correctIndex,
      chosenIndex: selectedSlotIndex,
      yearBonus,
    });

    setPhase('revealed');

    if (isCorrect) {
      sfx.playSuccess();

      // Insert song into the SHARED timeline with active team's claimedBy badge
      const newEntry: TimelineEntry = {
        song: currentSong,
        claimedBy: {
          id: activePlayer.id,
          name: activePlayer.name,
          color: activePlayer.color,
        },
      };

      const newSharedTimeline = [...sharedTimeline, newEntry].sort(
        (a, b) => a.song.year - b.song.year
      );
      setSharedTimeline(newSharedTimeline);

      // Solo: an exact year earns a life instead of a token
      const bonusTokens = yearBonus && !isSolo ? 1 : 0;
      if (yearBonus) {
        setTimeout(() => sfx.playToken(), 600);
      }

      // Add to active team's personal hits
      const newPersonalTimeline = [...activePlayer.timeline, currentSong].sort(
        (a, b) => a.year - b.year
      );

      const updatedPlayers = players.map((p, idx) => {
        if (idx === activePlayerIndex) {
          return {
            ...p,
            timeline: newPersonalTimeline,
            tokens: p.tokens + bonusTokens,
            score: p.score + 1,
          };
        }
        return p;
      });

      setPlayers(updatedPlayers);

      if (isSolo) {
        if (yearBonus) setLives((l) => l + 1);
      } else if (!isTimed && newPersonalTimeline.length >= settings.targetCards) {
        // Victory condition (first team to collect targetCards)
        setTimeout(() => {
          sfx.playVictory();
          setWinner(updatedPlayers[activePlayerIndex]);
          setIsVictoryOpen(true);
        }, 1200);
      }
    } else {
      sfx.playError();
      if (isSolo) {
        if (lives <= 0) {
          endSoloGame(activePlayer.score);
        } else {
          setLives(lives - 1);
        }
      }
    }
  };

  // Move to next turn
  const handleNextTurn = () => {
    // Solo: the player has seen the correct year — now show the result
    if (soloGameOverPending) {
      showSoloGameOver();
      return;
    }

    // Timed game: time ran out during this turn — announce the winner
    if (timeUp) {
      endTimedGame();
      return;
    }

    // Draw next song whose year is not already on the timeline (unless duplicates are allowed)
    const takenYears = settings.uniqueYearsOnly
      ? new Set(sharedTimeline.map((e) => e.song.year))
      : new Set<number>();
    const usedIds = new Set(sharedTimeline.map((e) => e.song.id));
    if (currentSong) usedIds.add(currentSong.id);
    const { song: nextMystery, deck: nextDeck } = pickMysterySong(
      availableDeck,
      takenYears,
      eligibleSongs,
      usedIds,
    );
    const nextPlayerIndex = (activePlayerIndex + 1) % players.length;

    // Solo: running out of songs ends the game
    if (isSolo && !nextMystery) {
      const record = submitScore(activePlayer.score);
      setIsNewRecord(record);
      setHighscore(getHighscore());
      setPhase('game_over');
      if (record) sfx.playVictory();
      setIsGameOverOpen(true);
      return;
    }

    setAvailableDeck(nextDeck);
    setCurrentSong(nextMystery);
    setActivePlayerIndex(nextPlayerIndex);
    setPhase('listening');
    setSelectedSlotIndex(null);
    setYearGuessInput('');
    setLastPlacementResult(null);
    setAutoPlayArmed(true); // Subsequent turns follow the auto-play setting

    sfx.playFlip();
  };

  // Use Hitster token
  const handleUseToken = (action: 'skip' | 'hint') => {
    if (activePlayer.tokens <= 0) return;

    if (action === 'skip') {
      sfx.playToken();
      const takenYears = settings.uniqueYearsOnly
        ? new Set(sharedTimeline.map((e) => e.song.year))
        : new Set<number>();
      const usedIds = new Set(sharedTimeline.map((e) => e.song.id));
      if (currentSong) usedIds.add(currentSong.id);
      const { song: newMystery, deck: nextDeck } = pickMysterySong(
        availableDeck,
        takenYears,
        eligibleSongs,
        usedIds,
      );

      // Deduct 1 token
      setPlayers((prev) =>
        prev.map((p, idx) =>
          idx === activePlayerIndex ? { ...p, tokens: p.tokens - 1 } : p
        )
      );

      setAvailableDeck(nextDeck);
      setCurrentSong(newMystery);
      setSelectedSlotIndex(null);
      setYearGuessInput('');
      setAutoPlayArmed(true);
    }
  };

  // Draw a new random song for current turn (unique year vs the timeline, unless disabled)
  const handleDrawRandomSong = () => {
    const takenYears = settings.uniqueYearsOnly
      ? new Set(sharedTimeline.map((e) => e.song.year))
      : new Set<number>();
    const usedIds = new Set(sharedTimeline.map((e) => e.song.id));
    if (currentSong) usedIds.add(currentSong.id);
    const { song: newMystery, deck: nextDeck } = pickMysterySong(
      availableDeck,
      takenYears,
      eligibleSongs,
      usedIds,
    );
    setAvailableDeck(nextDeck);
    setCurrentSong(newMystery);
    setPhase('listening');
    setSelectedSlotIndex(null);
    setYearGuessInput('');
    setLastPlacementResult(null);
    setAutoPlayArmed(true);
    sfx.playFlip();
  };

  // Mark a song as "missing music" — hide it from play now and across reloads.
  // Permanent deletion from songs.ts is done later via `npm run prune-songs`.
  const handleMarkMissingMusic = (song: Song) => {
    markRemoved(song.id);
    setRemovedTick((t) => t + 1);
    sfx.playError();

    // If the removed song is the current mystery, draw a fresh one.
    if (currentSong && currentSong.id === song.id) {
      const pool = getActiveSongs().filter((s) => {
        const matchCat =
          settings.categoryFilter === 'all' || s.category === settings.categoryFilter;
        return matchCat && settings.decades.includes(s.decade);
      });
      const takenYears = settings.uniqueYearsOnly
        ? new Set(sharedTimeline.map((e) => e.song.year))
        : new Set<number>();
      const usedIds = new Set<string>(sharedTimeline.map((e) => e.song.id));
      usedIds.add(song.id);
      const { song: fresh, deck: freshDeck } = pickMysterySong([], takenYears, pool, usedIds);
      setAvailableDeck(freshDeck);
      setCurrentSong(fresh);
      setPhase('listening');
      setSelectedSlotIndex(null);
      setYearGuessInput('');
      setLastPlacementResult(null);
    }
  };

  // Direct play from catalog on Turntable
  const handlePlaySongInTurntable = (song: Song) => {
    setCurrentSong(song);
    setPhase('listening');
    setSelectedSlotIndex(null);
    setLastPlacementResult(null);
    setAutoPlayArmed(true);
    sfx.playNeedleDrop();
  };

  // Start screen: shown before a game begins
  if (!gameStarted) {
    return (
      <div className="min-h-dvh bg-slate-950 text-slate-100 selection:bg-pink-500 selection:text-white">
        <StartScreen
          settings={settings}
          highscore={highscore}
          onStart={startGame}
          onStartSolo={() => {
            initializeGame({ ...settings, mode: 'solo' });
            setGameStarted(true);
          }}
          onOpenSettings={() => setIsSetupOpen(true)}
          onOpenRules={() => setIsRulesOpen(true)}
          onOpenCatalog={() => setIsCatalogOpen(true)}
        />

        <GameSetupModal
          isOpen={isSetupOpen}
          onClose={() => setIsSetupOpen(false)}
          currentSettings={settings}
          currentPlayers={players}
          onStartGame={(newSettings, newPlayers) => {
            initializeGame(newSettings, newPlayers);
            setGameStarted(true);
          }}
        />
        <RulesModal isOpen={isRulesOpen} onClose={() => setIsRulesOpen(false)} />
        <SongCatalogModal
          isOpen={isCatalogOpen}
          onClose={() => setIsCatalogOpen(false)}
          onMarkMissingMusic={(s) => handleMarkMissingMusic(s)}
          removedTick={removedTick}
        />
      </div>
    );
  }

  return (
    <div className="min-h-dvh md:h-dvh bg-slate-950 text-slate-100 flex flex-col md:overflow-hidden selection:bg-pink-500 selection:text-white">
      {/* Main Content Area */}
      <main className="md:flex-1 md:min-h-0 max-w-7xl w-full mx-auto px-3 sm:px-4 py-2 flex flex-col gap-2">
        {settings.mode === 'dj' ? (
          // Standalone DJ Companion & Physical Boardgame Scanner Mode
          <DJCompanionMode
            songs={eligibleSongs}
            settings={settings}
            onExitDJMode={() => setSettings({ ...settings, mode: 'timeline' })}
          />
        ) : (
          // Main Hitster Timeline Game
          <>
            {/* Player Bar & Tokens — standings, prominent at top */}
            <PlayerBar
              players={players}
              activePlayerIndex={activePlayerIndex}
              settings={settings}
              lives={lives}
              remainingSeconds={remainingSeconds}
              highscore={highscore}
              onExitGame={exitToStart}
            />

            {/* Timeline View (the game board / spilleplade) — hero directly below standings */}
            <div className="md:flex-1 md:min-h-0 flex">
            <TimelineView
              timeline={sharedTimeline}
              activePlayer={activePlayer}
              players={players}
              mysterySong={currentSong}
              phase={phase}
              settings={settings}
              selectedIndex={selectedSlotIndex}
              onSelectSlot={(idx) => setSelectedSlotIndex(idx)}
              onConfirmPlacement={handleConfirmPlacement}
              onNextTurn={handleNextTurn}
              nextTurnLabel={soloGameOverPending ? 'Se resultat' : timeUp ? 'Se vinderen' : undefined}
              onPlaySong={handlePlaySongInTurntable}
              songStarted={autoPlayArmed}
              onStartSong={() => setAutoPlayArmed(true)}
              yearGuessInput={yearGuessInput}
              onYearGuessChange={setYearGuessInput}
              lastPlacementResult={lastPlacementResult}
            />
            </div>

            {/* Turntable Vinyl Player (DJ Deck) — compact controls at the bottom */}
            <TurntablePlayer
              currentSong={currentSong}
              isRevealed={phase === 'revealed'}
              autoPlay={settings.autoPlayAudio && autoPlayArmed}
              onOpenSongPicker={isSolo ? undefined : () => setIsCatalogOpen(true)}
              onDrawRandomSong={isSolo ? undefined : handleDrawRandomSong}
              onMarkMissingMusic={currentSong ? () => handleMarkMissingMusic(currentSong) : undefined}
            />
          </>
        )}
      </main>

      {/* Modals */}
      <GameSetupModal
        isOpen={isSetupOpen}
        onClose={() => setIsSetupOpen(false)}
        currentSettings={settings}
        currentPlayers={players}
        onStartGame={(newSettings, newPlayers) => {
          initializeGame(newSettings, newPlayers);
        }}
      />

      <RulesModal
        isOpen={isRulesOpen}
        onClose={() => setIsRulesOpen(false)}
      />

      <VictoryModal
        isOpen={isVictoryOpen}
        winner={winner}
        onRestart={() => initializeGame()}
        onExit={exitToStart}
        onPlaySong={handlePlaySongInTurntable}
      />

      <GameOverModal
        isOpen={isGameOverOpen}
        score={activePlayer.score}
        highscore={highscore}
        isNewRecord={isNewRecord}
        onRestart={() => initializeGame()}
        onExit={exitToStart}
      />

      <SongCatalogModal
        isOpen={isCatalogOpen}
        onClose={() => setIsCatalogOpen(false)}
        onMarkMissingMusic={(s) => handleMarkMissingMusic(s)}
        removedTick={removedTick}
      />
    </div>
  );
}

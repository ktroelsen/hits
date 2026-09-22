import { useState, useEffect, useMemo, useCallback } from 'react';
import { Navbar } from './components/Navbar';
import { TurntablePlayer } from './components/TurntablePlayer';
import { TimelineView } from './components/TimelineView';
import { PlayerBar } from './components/PlayerBar';
import { DJCompanionMode } from './components/DJCompanionMode';
import { GameSetupModal } from './components/Modals/GameSetupModal';
import { RulesModal } from './components/Modals/RulesModal';
import { VictoryModal } from './components/Modals/VictoryModal';
import { SongCatalogModal } from './components/Modals/SongCatalogModal';
import { getActiveSongs, loadCatalog } from './services/songsService';
import { markRemoved } from './services/removalStore';
import { Song, Player, GameSettings, TurnPhase, TimelineEntry } from './types';
import { sfx } from './services/audioService';

const DEFAULT_SETTINGS: GameSettings = {
  mode: 'timeline',
  targetCards: 10,
  categoryFilter: 'all',
  decades: ['60s', '70s', '80s', '90s', '00s', '10s', '20s'],
  autoPlayAudio: true,
  enableSoundEffects: true,
  expertTolerance: 0,
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

export default function App() {
  const [settings, setSettings] = useState<GameSettings>(DEFAULT_SETTINGS);
  const [players, setPlayers] = useState<Player[]>(DEFAULT_PLAYERS);
  const [activePlayerIndex, setActivePlayerIndex] = useState(0);

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
      const configuredPlayers = newPlayers || players;

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
        tokens: 2,
        score: 0,
        timeline: [],
      }));

      // Draw first mystery song for active player
      const firstMystery = shuffled.pop() || null;

      setSettings(activeSettings);
      setPlayers(updatedPlayers);
      setSharedTimeline(initialSharedTimeline);
      setAvailableDeck(shuffled);
      setCurrentSong(firstMystery);
      setActivePlayerIndex(0);
      setPhase('listening');
      setSelectedSlotIndex(null);
      setYearGuessInput('');
      setLastPlacementResult(null);
      setWinner(null);
      setIsVictoryOpen(false);

      sfx.playFlip();
    },
    [settings, players]
  );

  // Initial mount: start game
  useEffect(() => {
    initializeGame();
  }, []);

  const activePlayer = players[activePlayerIndex] || players[0];

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

      const bonusTokens = yearBonus ? 1 : 0;
      if (bonusTokens > 0) {
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

      // Check victory condition (first team to collect targetCards)
      if (newPersonalTimeline.length >= settings.targetCards) {
        setTimeout(() => {
          sfx.playVictory();
          setWinner(updatedPlayers[activePlayerIndex]);
          setIsVictoryOpen(true);
        }, 1200);
      }
    } else {
      sfx.playError();
    }
  };

  // Move to next turn
  const handleNextTurn = () => {
    // Draw next song
    let nextDeck = [...availableDeck];
    if (nextDeck.length === 0) {
      // Reshuffle all songs that aren't currently on the shared timeline
      const usedIds = new Set<string>();
      sharedTimeline.forEach((entry) => usedIds.add(entry.song.id));
      if (currentSong) usedIds.add(currentSong.id);

      const remaining = eligibleSongs.filter((s) => !usedIds.has(s.id));
      nextDeck = [...remaining].sort(() => Math.random() - 0.5);
    }

    const nextMystery = nextDeck.pop() || null;
    const nextPlayerIndex = (activePlayerIndex + 1) % players.length;

    setAvailableDeck(nextDeck);
    setCurrentSong(nextMystery);
    setActivePlayerIndex(nextPlayerIndex);
    setPhase('listening');
    setSelectedSlotIndex(null);
    setYearGuessInput('');
    setLastPlacementResult(null);

    sfx.playFlip();
  };

  // Use Hitster token
  const handleUseToken = (action: 'skip' | 'hint') => {
    if (activePlayer.tokens <= 0) return;

    if (action === 'skip') {
      sfx.playToken();
      let nextDeck = [...availableDeck];
      if (nextDeck.length === 0) {
        nextDeck = [...eligibleSongs].sort(() => Math.random() - 0.5);
      }
      const newMystery = nextDeck.pop() || null;

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
    }
  };

  // Draw a new random song for current turn
  const handleDrawRandomSong = () => {
    let nextDeck = [...availableDeck];
    if (nextDeck.length === 0) {
      nextDeck = [...eligibleSongs].sort(() => Math.random() - 0.5);
    }
    const newMystery = nextDeck.pop() || null;
    setAvailableDeck(nextDeck);
    setCurrentSong(newMystery);
    setPhase('listening');
    setSelectedSlotIndex(null);
    setYearGuessInput('');
    setLastPlacementResult(null);
    sfx.playFlip();
  };

  // Select a specific song from the song library as the active quiz challenge
  const handleSelectQuizSong = (song: Song) => {
    setCurrentSong(song);
    setPhase('listening');
    setSelectedSlotIndex(null);
    setYearGuessInput('');
    setLastPlacementResult(null);
    setIsCatalogOpen(false);
    sfx.playNeedleDrop();
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
      const usedIds = new Set<string>(sharedTimeline.map((e) => e.song.id));
      const remaining = pool.filter((s) => !usedIds.has(s.id) && s.id !== song.id);
      const shuffled = [...remaining].sort(() => Math.random() - 0.5);
      setAvailableDeck(shuffled);
      setCurrentSong(shuffled.pop() || null);
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
    sfx.playNeedleDrop();
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col selection:bg-pink-500 selection:text-white pb-16">
      {/* Top Navigation */}
      <Navbar
        settings={settings}
        onOpenSettings={() => setIsSetupOpen(true)}
        onOpenRules={() => setIsRulesOpen(true)}
        onOpenSongCatalog={() => setIsCatalogOpen(true)}
        onRestartCurrentGame={() => initializeGame()}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">
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
            {/* Player Bar & Tokens */}
            <PlayerBar
              players={players}
              activePlayerIndex={activePlayerIndex}
              settings={settings}
              canUseTokens={phase === 'listening'}
              onUseToken={handleUseToken}
            />

            {/* Turntable Vinyl Player (DJ Deck) */}
            <TurntablePlayer
              currentSong={currentSong}
              isRevealed={phase === 'revealed'}
              autoPlay={settings.autoPlayAudio}
              onOpenSongPicker={() => setIsCatalogOpen(true)}
              onDrawRandomSong={handleDrawRandomSong}
              onMarkMissingMusic={currentSong ? () => handleMarkMissingMusic(currentSong) : undefined}
            />

            {/* Timeline View (Cards & Interactive Slots on the Shared Timeline) */}
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
              onPlaySong={handlePlaySongInTurntable}
              yearGuessInput={yearGuessInput}
              onYearGuessChange={setYearGuessInput}
              lastPlacementResult={lastPlacementResult}
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
        onPlaySong={handlePlaySongInTurntable}
      />

      <SongCatalogModal
        isOpen={isCatalogOpen}
        onClose={() => setIsCatalogOpen(false)}
        onPlaySong={(s) => {
          setIsCatalogOpen(false);
          handlePlaySongInTurntable(s);
        }}
        onSelectAsQuizSong={(s) => {
          handleSelectQuizSong(s);
        }}
        onMarkMissingMusic={(s) => handleMarkMissingMusic(s)}
        removedTick={removedTick}
      />
    </div>
  );
}

export type SongCategory = 'danish' | 'international';

export type Decade = '50s' | '60s' | '70s' | '80s' | '90s' | '00s' | '10s' | '20s';

export interface Song {
  id: string;
  title: string;
  artist: string;
  year: number;
  category: SongCategory;
  decade: Decade;
  genre?: string;
  funFact?: string;
  customPreviewUrl?: string;
  // Pre-baked from the iTunes Search API by scripts/check-previews.ts (npm run bake-songs).
  // When present, the app plays these directly and never calls Apple at runtime.
  previewUrl?: string;
  artworkUrl?: string;
  // Toggled in /admin; only active songs are played. Missing (bundled fallback) = active.
  active?: boolean;
  // Normalised labels (e.g. "dance", "melodi grand prix") set in /admin or via scripts/songs.ps1.
  tags?: string[];
}

export type GameMode = 'timeline' | 'expert' | 'party' | 'quick' | 'dj' | 'solo';

export interface TimelineEntry {
  song: Song;
  claimedBy?: {
    id: string;
    name: string;
    color: string;
  } | null;
}

export interface Player {
  id: string;
  name: string;
  color: string;
  tokens: number;
  timeline: Song[]; // Player's collection of won songs
  score: number;
}

export type WinCondition = 'cards' | 'time';

export interface GameSettings {
  mode: GameMode;
  targetCards: number;
  winCondition: WinCondition; // team modes: first to targetCards, or most cards when time runs out
  timeLimitMinutes: number; // used when winCondition is 'time'
  categoryFilter: 'all' | 'danish' | 'international';
  decades: Decade[];
  tags: string[]; // empty = all songs; otherwise songs with at least one of these tags
  autoPlayAudio: boolean;
  enableSoundEffects: boolean;
  expertTolerance: number; // 0 = exact year, 1 = +/- 1 year
  uniqueYearsOnly: boolean; // false allows multiple songs from the same year on the timeline
}

export type TurnPhase = 
  | 'draw'            // Waiting to play/listen
  | 'listening'       // Song is playing, player choosing placement
  | 'placed'          // Player chose placement, ready to reveal
  | 'revealed'        // Card revealed, feedback shown (correct or wrong)
  | 'turn_transition' // Brief pause before next player
  | 'game_over';      // Winner reached target cards

export interface PlacementChoice {
  insertIndex: number;
  isCorrect: boolean;
  correctIndex: number;
  yearGuessed?: number;
}

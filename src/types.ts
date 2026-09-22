export type SongCategory = 'danish' | 'international';

export type Decade = '60s' | '70s' | '80s' | '90s' | '00s' | '10s' | '20s';

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

export interface GameSettings {
  mode: GameMode;
  targetCards: number;
  categoryFilter: 'all' | 'danish' | 'international';
  decades: Decade[];
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

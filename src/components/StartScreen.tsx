import { useState } from 'react';
import { Heart, Play, Settings, HelpCircle, ListMusic, Users, Plus, LogIn, ArrowLeft, Download, Share } from 'lucide-react';
import { BrandLogo } from './BrandLogo';
import { GameSettings } from '../types';
import { effectiveTags } from '../services/songsService';
import type { BestScores } from '../services/highscoreStore';
import { useInstallOption } from '../services/installPrompt';
import { findGameLibrary, withLibrary } from '../services/library';

interface StartScreenProps {
  settings: GameSettings;
  highscores: BestScores;
  // Tags with numbers that can be played as a placement game (with their song counts).
  // noun: what the numbers are, e.g. "placering" or "uger" (see rankNoun).
  rankChoices: { tag: string; count: number; noun: string }[];
  // Songs the current settings deal from.
  songCount: number;
  onSelectRankTag: (rankTag: string | undefined) => void;
  onStart: () => void;
  onStartSolo: () => void;
  onOpenSettings: () => void;
  onOpenRules: () => void;
  onOpenCatalog: () => void;
}

export function StartScreen({
  settings,
  highscores,
  rankChoices,
  songCount,
  onSelectRankTag,
  onStart,
  onStartSolo,
  onOpenSettings,
  onOpenRules,
  onOpenCatalog,
}: StartScreenProps) {
  // Online button expands into "create" / "join"; join asks for the 4-digit code.
  const [onlineMode, setOnlineMode] = useState<'closed' | 'choose' | 'join'>('closed');
  const [joinCode, setJoinCode] = useState('');
  const installOption = useInstallOption();
  const codeValid = /^\d{4}$/.test(joinCode);
  // Placement game on a tag with numbers, or the normal year game.
  const rank = rankChoices.find((c) => c.tag === settings.rankTag);
  const rankTag = rank?.tag;
  // "Gæt placeringen", "Gæt antal uger", "Gæt tallet"
  const guessWhat = !rank
    ? 'årstal'
    : rank.noun === 'placering'
    ? 'placeringen'
    : rank.noun === 'tal'
    ? 'tallet'
    : `antal ${rank.noun}`;
  // A team race to N cards can't be won when the collection has N songs or fewer
  // (the start card is one of them).
  const tooFewSongs = settings.winCondition === 'cards' && songCount <= settings.targetCards;
  const tags = effectiveTags(settings.tags);

  // The code may belong to another song library (database) than the one this device uses.
  const joinGame = async () => {
    if (!codeValid) return;
    const library = await findGameLibrary(joinCode);
    window.location.href = library ? withLibrary(`/game/${joinCode}`, library) : `/game/${joinCode}`;
  };

  return (
    <div className="min-h-dvh flex flex-col items-center justify-center px-4 py-10 relative overflow-hidden">
      {/* Ambient neon glows */}
      <div className="absolute -top-32 -left-32 w-96 h-96 bg-pink-500/15 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-32 -right-32 w-96 h-96 bg-cyan-500/15 rounded-full blur-3xl pointer-events-none" />

      <div className="relative z-10 flex flex-col items-center text-center max-w-lg w-full">
        {/* Brand logo */}
        <BrandLogo className="w-20 h-20 rounded-3xl shadow-xl shadow-pink-500/20 mb-6" />

        <h1 className="text-5xl sm:text-6xl font-black text-transparent bg-clip-text bg-gradient-to-r from-pink-400 via-purple-300 to-cyan-400 font-display tracking-wider">
          HITS
        </h1>
        <p className="mt-3 text-slate-300 text-base sm:text-lg font-medium">
          Gæt {guessWhat} & byg jeres fælles {rank ? 'liste' : 'tidslinje'}
        </p>

        {/* Game type: the year game, or a placement game per tag with numbers */}
        {rankChoices.length > 0 && (
          <div className="mt-4 flex flex-wrap justify-center gap-2" role="radiogroup" aria-label="Spiltype">
            {[{ tag: undefined as string | undefined, label: '📅 Årstal' }, ...rankChoices.map((c) => ({ tag: c.tag, label: `🏆 ${c.tag}` }))].map(
              (opt) => {
                const selected = opt.tag === rankTag;
                return (
                  <button
                    key={opt.tag ?? 'year'}
                    role="radio"
                    aria-checked={selected}
                    onClick={() => onSelectRankTag(opt.tag)}
                    className={`px-3.5 py-1.5 rounded-full text-sm font-bold border transition-colors ${
                      selected
                        ? 'bg-amber-500 text-slate-950 border-amber-400'
                        : 'bg-slate-900/80 text-slate-300 border-slate-700 hover:border-slate-500'
                    }`}
                  >
                    {opt.label}
                  </button>
                );
              },
            )}
          </div>
        )}

        <p className="mt-3 text-slate-500 text-sm">
          {rankTag ? (
            <>
              {rankTag} · sorteres efter {rank?.noun === 'tal' ? 'tal' : rank?.noun === 'placering' ? 'placering' : `antal ${rank?.noun}`}
            </>
          ) : (
            <>
              {settings.categoryFilter === 'all'
                ? '🇩🇰 + 🌍 Blandet'
                : settings.categoryFilter === 'danish'
                ? '🇩🇰 Kun danske'
                : '🌍 Kun internationale'}
              {tags.length > 0 && <> · {tags.join(', ')}</>}
            </>
          )}{' '}
          · {songCount} sange • Mål:{' '}
          {settings.winCondition === 'time'
            ? `flest kort på ${settings.timeLimitMinutes} min`
            : `${settings.targetCards} sange`}
        </p>
        {tooFewSongs && (
          <p className="mt-1 text-xs text-amber-400">
            Kun {songCount} sange — målet på {settings.targetCards} kort kan ikke nås i holdspil. Vælg et lavere mål
            under Indstillinger.
          </p>
        )}

        {/* Primary start button — classic, single-device HITS */}
        <button
          id="start-game-btn"
          onClick={onStart}
          className="mt-8 w-full sm:w-auto flex items-center justify-center gap-3 px-10 py-4 rounded-2xl bg-gradient-to-r from-pink-500 via-purple-600 to-indigo-600 hover:from-pink-600 hover:to-indigo-700 text-white font-black text-lg tracking-wide uppercase shadow-lg shadow-pink-500/25 hover:scale-[1.02] transition-all"
        >
          <Play className="w-6 h-6 fill-current" />
          Start spil
        </button>
        <p className="mt-2 text-slate-400 text-sm">
          Klassisk HITS · alle spiller på denne enhed
        </p>

        {/* Single player — lives + highscore */}
        <button
          id="start-solo-btn"
          onClick={onStartSolo}
          className="mt-5 w-full sm:w-auto flex items-center justify-center gap-3 px-10 py-4 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white font-black text-lg tracking-wide uppercase border border-rose-500/50 hover:border-rose-400 shadow-lg shadow-rose-500/10 hover:scale-[1.02] transition-all"
        >
          <Heart className="w-6 h-6 text-rose-400 fill-rose-400" />
          Single player
        </button>
        <p className="mt-2 text-slate-400 text-sm">
          Spil alene · én fejl og du er ude
          {rankTag && <> · placeringsspil tæller ikke i highscoren</>}
          {!rankTag && highscores.weekly && (
            <>
              {' '}· <span className="text-amber-300 font-bold">Ugens highscore: {highscores.weekly.score} ({highscores.weekly.name})</span>
            </>
          )}
          {!rankTag && highscores.allTime && (
            <>
              {' '}· <span className="text-amber-300 font-bold">Highscore: {highscores.allTime.score} ({highscores.allTime.name})</span>
            </>
          )}
        </p>

        {/* Online multiplayer — each player on their own phone */}
        {onlineMode === 'closed' && (
          <button
            onClick={() => setOnlineMode('choose')}
            className="mt-5 w-full sm:w-auto flex items-center justify-center gap-3 px-10 py-4 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white font-black text-lg tracking-wide uppercase border border-cyan-500/50 hover:border-cyan-400 shadow-lg shadow-cyan-500/10 hover:scale-[1.02] transition-all"
          >
            <Users className="w-6 h-6 text-cyan-400" />
            Online spil
          </button>
        )}
        {onlineMode === 'choose' && (
          <div className="mt-5 w-full sm:w-auto flex flex-col sm:flex-row gap-3">
            <button
              onClick={() => {
                window.location.href = '/game';
              }}
              className="flex-1 flex items-center justify-center gap-2 px-6 py-4 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white font-black tracking-wide uppercase border border-cyan-500/50 hover:border-cyan-400 shadow-lg shadow-cyan-500/10 transition-all"
            >
              <Plus className="w-5 h-5 text-cyan-400" />
              Opret spil
            </button>
            <button
              onClick={() => setOnlineMode('join')}
              className="flex-1 flex items-center justify-center gap-2 px-6 py-4 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white font-black tracking-wide uppercase border border-cyan-500/50 hover:border-cyan-400 shadow-lg shadow-cyan-500/10 transition-all"
            >
              <LogIn className="w-5 h-5 text-cyan-400" />
              Join spil
            </button>
          </div>
        )}
        {onlineMode === 'join' && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              joinGame();
            }}
            className="mt-5 w-full sm:w-auto flex gap-2"
          >
            <input
              autoFocus
              inputMode="numeric"
              placeholder="Kode"
              aria-label="4-cifret spilkode"
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.replace(/\D/g, '').slice(0, 4))}
              className="w-40 flex-1 sm:flex-none px-4 py-4 rounded-2xl bg-slate-900 border border-cyan-500/50 focus:border-cyan-400 outline-none text-white text-center text-2xl font-black tracking-[0.4em] placeholder:tracking-normal placeholder:text-base placeholder:font-bold placeholder:text-slate-500"
            />
            <button
              type="submit"
              disabled={!codeValid}
              className="flex items-center justify-center gap-2 px-6 py-4 rounded-2xl bg-cyan-600 hover:bg-cyan-500 disabled:bg-slate-800 disabled:text-slate-500 text-white font-black tracking-wide uppercase transition-all"
            >
              <LogIn className="w-5 h-5" />
              Join
            </button>
          </form>
        )}
        <p className="mt-2 text-slate-400 text-sm">
          {onlineMode === 'join'
            ? 'Indtast den 4-cifrede kode fra værtens skærm'
            : 'Spil sammen på hver jeres telefon med en kode'}
          {onlineMode !== 'closed' && (
            <>
              {' '}·{' '}
              <button
                onClick={() => {
                  setOnlineMode(onlineMode === 'join' ? 'choose' : 'closed');
                  setJoinCode('');
                }}
                className="inline-flex items-center gap-1 text-cyan-300 hover:text-cyan-200 font-bold"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                Tilbage
              </button>
            </>
          )}
        </p>

        {/* Secondary actions */}
        <div className="mt-6 flex flex-wrap items-center justify-center gap-2.5">
          <button
            onClick={onOpenSettings}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-700/80 hover:border-slate-600 transition-colors text-sm font-bold"
          >
            <Settings className="w-4 h-4 text-pink-400" />
            Indstillinger
          </button>
          <button
            onClick={onOpenRules}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-800 transition-colors text-sm font-bold"
          >
            <HelpCircle className="w-4 h-4 text-cyan-400" />
            Regler
          </button>
          <button
            onClick={onOpenCatalog}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-800 transition-colors text-sm font-bold"
          >
            <ListMusic className="w-4 h-4 text-purple-400" />
            Se sange
          </button>
        </div>

        {/* Install as app (PWA): button where the browser supports it, hint on iPhone */}
        {installOption.kind === 'prompt' && (
          <button
            onClick={installOption.install}
            className="mt-6 flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold text-cyan-300 hover:text-cyan-200 bg-cyan-950/30 hover:bg-cyan-950/60 border border-cyan-800/50 transition-colors"
          >
            <Download className="w-4 h-4" />
            Installer som app
          </button>
        )}
        {installOption.kind === 'ios' && (
          <p className="mt-6 flex flex-wrap items-center justify-center gap-1 text-xs text-slate-400">
            📲 Få HITS som app: tryk
            <Share className="w-3.5 h-3.5 text-cyan-400" aria-label="Del" />
            og vælg <span className="font-semibold text-slate-300">Føj til hjemmeskærm</span>
          </p>
        )}
      </div>
    </div>
  );
}

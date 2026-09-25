import { useEffect, useState, type FormEvent } from 'react';
import { HeartCrack, Trophy, RotateCcw, LogOut, Save } from 'lucide-react';
import { getSavedName, MAX_NAME_LENGTH, type HighscoreEntry } from '../../services/highscoreStore';

interface GameOverModalProps {
  isOpen: boolean;
  score: number;
  highscore: HighscoreEntry | null;
  isNewRecord: boolean;
  onSubmitName: (name: string) => Promise<void>;
  onRestart: () => void;
  onExit: () => void;
}

// Shown when a solo game ends (wrong placement with no lives left). On a new
// record the player enters their name so it is saved to the shared highscore.
export function GameOverModal({
  isOpen,
  score,
  highscore,
  isNewRecord,
  onSubmitName,
  onRestart,
  onExit,
}: GameOverModalProps) {
  const [name, setName] = useState('');
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  // Fresh form each time the modal opens, prefilled with the last used name.
  useEffect(() => {
    if (isOpen) {
      setName(getSavedName());
      setStatus('idle');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed || status === 'saving') return;
    setStatus('saving');
    try {
      await onSubmitName(trimmed);
      setStatus('saved');
    } catch (err) {
      console.error('Kunne ikke gemme highscore', err);
      setStatus('error');
    }
  };

  const showNameForm = isNewRecord && status !== 'saved';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-charcoal-950/85 backdrop-blur-md animate-in fade-in duration-300">
      <div className="relative w-full max-w-md bg-charcoal-900 border-2 border-rose-500/50 rounded-3xl p-6 sm:p-8 shadow-2xl overflow-hidden text-center">
        <div className="absolute -top-24 -left-24 w-60 h-60 bg-rose-500/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -right-24 w-60 h-60 bg-amber-500/15 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10">
          <div
            className={`inline-flex p-3 sm:p-4 rounded-3xl shadow-xl mb-3 ${
              isNewRecord
                ? 'bg-gradient-to-tr from-amber-500 to-yellow-300 text-charcoal-950 shadow-amber-500/30 animate-bounce'
                : 'bg-gradient-to-tr from-rose-600 to-coral-500 text-white shadow-rose-500/30'
            }`}
          >
            {isNewRecord ? (
              <Trophy className="w-8 h-8 sm:w-10 sm:h-10" />
            ) : (
              <HeartCrack className="w-8 h-8 sm:w-10 sm:h-10" />
            )}
          </div>

          <h2 className="text-3xl sm:text-4xl font-black text-white tracking-tight font-display">
            {isNewRecord ? 'Ny rekord!' : 'Game over'}
          </h2>
          <p className="text-sm text-charcoal-400 mt-1">Du har ikke flere liv tilbage.</p>

          <div className="mt-6 grid grid-cols-2 gap-3">
            <div className="p-4 rounded-2xl bg-charcoal-950/60 border border-charcoal-800">
              <div className="text-xs font-bold uppercase tracking-wider text-charcoal-400">Score</div>
              <div className="text-4xl font-black text-white font-mono mt-1">{score}</div>
            </div>
            <div className="p-4 rounded-2xl bg-charcoal-950/60 border border-amber-500/30">
              <div className="text-xs font-bold uppercase tracking-wider text-amber-300">Highscore</div>
              <div className="text-4xl font-black text-amber-400 font-mono mt-1">{highscore?.score ?? 0}</div>
              {highscore && (
                <div className="text-xs font-bold text-amber-300/80 mt-1 truncate">{highscore.name}</div>
              )}
            </div>
          </div>

          {showNameForm && (
            <form onSubmit={handleSubmit} className="mt-5 text-left">
              <label htmlFor="highscore-name" className="block text-xs font-bold uppercase tracking-wider text-amber-300 mb-1">
                Skriv dit navn til highscoren
              </label>
              <div className="flex gap-2">
                <input
                  id="highscore-name"
                  autoFocus
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  maxLength={MAX_NAME_LENGTH}
                  placeholder="Dit navn"
                  className="flex-1 min-w-0 px-4 py-3 rounded-2xl bg-charcoal-950/60 border border-amber-500/40 text-white font-bold focus:outline-none focus:border-amber-400"
                />
                <button
                  type="submit"
                  disabled={!name.trim() || status === 'saving'}
                  className="flex items-center gap-2 px-4 py-3 rounded-2xl bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-charcoal-950 font-bold text-sm transition-colors"
                >
                  <Save className="w-4 h-4" />
                  <span>{status === 'saving' ? 'Gemmer…' : 'Gem'}</span>
                </button>
              </div>
              {status === 'error' && (
                <p className="text-xs text-rose-300 mt-2">Kunne ikke gemme highscoren. Prøv igen.</p>
              )}
            </form>
          )}
          {isNewRecord && status === 'saved' && (
            <p className="mt-4 text-sm font-bold text-amber-300">Din highscore er gemt!</p>
          )}
        </div>

        <div className="relative z-10 mt-6 pt-4 border-t border-charcoal-800 flex items-center justify-center gap-2 flex-wrap">
          <button
            onClick={onExit}
            className="flex items-center gap-2 px-4 py-3 rounded-2xl bg-charcoal-800 hover:bg-charcoal-700 text-charcoal-200 font-bold text-sm tracking-wide border border-charcoal-700 transition-colors"
          >
            <LogOut className="w-4 h-4" />
            <span>Til forsiden</span>
          </button>
          <button
            onClick={onRestart}
            className="flex items-center gap-2 px-6 py-3 rounded-2xl bg-lemon-400 hover:bg-lemon-300 hover:scale-105 text-charcoal-950 font-bold text-sm tracking-wide shadow-lg shadow-lemon-400/20 transition-all"
          >
            <RotateCcw className="w-4 h-4" />
            <span>Spil igen</span>
          </button>
        </div>
      </div>
    </div>
  );
}

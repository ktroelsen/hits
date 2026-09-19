import { useState } from 'react';
import { X, Play, Disc, Check, Plus, Trash2, Trophy, Clock } from 'lucide-react';
import { GameMode, GameSettings, Player, Decade, WinCondition } from '../../types';

interface GameSetupModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentSettings: GameSettings;
  currentPlayers: Player[];
  onStartGame: (settings: GameSettings, players: Player[]) => void;
}

const ALL_DECADES: { id: Decade; label: string }[] = [
  { id: '60s', label: "60'erne" },
  { id: '70s', label: "70'erne" },
  { id: '80s', label: "80'erne" },
  { id: '90s', label: "90'erne" },
  { id: '00s', label: "00'erne" },
  { id: '10s', label: "10'erne" },
  { id: '20s', label: "20'erne" },
];

const PRESET_COLORS = [
  '#ec4899', // Pink
  '#3b82f6', // Blue
  '#10b981', // Emerald
  '#f59e0b', // Amber
  '#8b5cf6', // Purple
  '#ef4444', // Red
];

export function GameSetupModal({
  isOpen,
  onClose,
  currentSettings,
  currentPlayers,
  onStartGame,
}: GameSetupModalProps) {
  const [mode, setMode] = useState<GameMode>(currentSettings.mode);
  const [winCondition, setWinCondition] = useState<WinCondition>(currentSettings.winCondition);
  const [targetCards, setTargetCards] = useState<number>(currentSettings.targetCards);
  const [timeLimitMinutes, setTimeLimitMinutes] = useState<number>(currentSettings.timeLimitMinutes);
  const [categoryFilter, setCategoryFilter] = useState<'all' | 'danish' | 'international'>(currentSettings.categoryFilter);
  const [decades, setDecades] = useState<Decade[]>(currentSettings.decades);
  const [players, setPlayers] = useState<Player[]>(currentPlayers);
  const [newPlayerName, setNewPlayerName] = useState('');

  if (!isOpen) return null;

  const toggleDecade = (dec: Decade) => {
    if (decades.includes(dec)) {
      if (decades.length > 1) {
        setDecades(decades.filter((d) => d !== dec));
      }
    } else {
      setDecades([...decades, dec]);
    }
  };

  const handleAddPlayer = () => {
    if (!newPlayerName.trim()) return;
    const nextColor = PRESET_COLORS[players.length % PRESET_COLORS.length];
    const newPlayer: Player = {
      id: `p-${Date.now()}`,
      name: newPlayerName.trim(),
      color: nextColor,
      tokens: 2,
      timeline: [],
      score: 0,
    };
    setPlayers([...players, newPlayer]);
    setNewPlayerName('');
  };

  const handleRemovePlayer = (id: string) => {
    if (players.length <= 1) return;
    setPlayers(players.filter((p) => p.id !== id));
  };

  // Quickly set how many teams participate (adds default teams or trims from the end)
  const setTeamCount = (count: number) => {
    setPlayers((prev) => {
      if (count === prev.length) return prev;
      if (count < prev.length) {
        return prev.slice(0, count);
      }
      const next = [...prev];
      while (next.length < count) {
        const idx = next.length;
        next.push({
          id: `p-${Date.now()}-${idx}`,
          name: `Hold ${idx + 1}`,
          color: PRESET_COLORS[idx % PRESET_COLORS.length],
          tokens: 2,
          timeline: [],
          score: 0,
        });
      }
      return next;
    });
  };

  const handleSaveAndStart = () => {
    const updatedSettings: GameSettings = {
      ...currentSettings,
      mode,
      winCondition,
      targetCards,
      timeLimitMinutes,
      categoryFilter,
      decades,
    };
    onStartGame(updatedSettings, players);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-7 shadow-2xl overflow-hidden max-h-[90vh] overflow-y-auto">
        {/* Glow accent */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-80 h-32 bg-pink-500/10 rounded-full blur-3xl pointer-events-none" />

        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-gradient-to-tr from-pink-500 to-purple-600 text-white shadow-md">
              <Disc className="w-5 h-5 animate-spin" style={{ animationDuration: '6s' }} />
            </div>
            <div>
              <h3 className="text-xl font-black text-white font-display">
                Hitster Spilindstillinger
              </h3>
              <p className="text-xs text-slate-400">
                Vælg spiltype, hold og sangkategorier
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <div className="mt-5 space-y-6">
          {/* 1. Spiltilstand (Game Mode) */}
          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-slate-400 block mb-2.5">
              1. Vælg Spiltype
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setMode('timeline')}
                className={`p-3.5 rounded-2xl border text-left transition-all flex flex-col justify-between ${
                  mode === 'timeline'
                    ? 'bg-pink-950/40 border-pink-500 ring-2 ring-pink-500/20'
                    : 'bg-slate-950/50 border-slate-800 hover:border-slate-700 text-slate-300'
                }`}
              >
                <div className="flex items-center justify-between w-full">
                  <span className="font-bold text-sm text-white">🏆 Klassisk Hitster</span>
                  {mode === 'timeline' && <Check className="w-4 h-4 text-pink-400" />}
                </div>
                <p className="text-xs text-slate-400 mt-1">
                  Holdene dyster på samme fælles tidslinje! Placér sangene kronologisk. Første hold til {targetCards} hits vinder!
                </p>
              </button>

              <button
                type="button"
                onClick={() => setMode('expert')}
                className={`p-3.5 rounded-2xl border text-left transition-all flex flex-col justify-between ${
                  mode === 'expert'
                    ? 'bg-purple-950/40 border-purple-500 ring-2 ring-purple-500/20'
                    : 'bg-slate-950/50 border-slate-800 hover:border-slate-700 text-slate-300'
                }`}
              >
                <div className="flex items-center justify-between w-full">
                  <span className="font-bold text-sm text-white">🎯 Ekspert Mode</span>
                  {mode === 'expert' && <Check className="w-4 h-4 text-purple-400" />}
                </div>
                <p className="text-xs text-slate-400 mt-1">
                  Gæt både korrekt tidslinje og prøv at ramme det præcise udgivelsesår for bonusmønter.
                </p>
              </button>

              <button
                type="button"
                onClick={() => setMode('party')}
                className={`p-3.5 rounded-2xl border text-left transition-all flex flex-col justify-between ${
                  mode === 'party'
                    ? 'bg-amber-950/40 border-amber-500 ring-2 ring-amber-500/20'
                    : 'bg-slate-950/50 border-slate-800 hover:border-slate-700 text-slate-300'
                }`}
              >
                <div className="flex items-center justify-between w-full">
                  <span className="font-bold text-sm text-white">🥳 Fest / Holdkamp</span>
                  {mode === 'party' && <Check className="w-4 h-4 text-amber-400" />}
                </div>
                <p className="text-xs text-slate-400 mt-1">
                  Pass-and-play for 2+ hold. Skift tur ved DJ-pulten og stjæl kort fra modstanderne!
                </p>
              </button>

              <button
                type="button"
                onClick={() => setMode('dj')}
                className={`p-3.5 rounded-2xl border text-left transition-all flex flex-col justify-between ${
                  mode === 'dj'
                    ? 'bg-cyan-950/40 border-cyan-500 ring-2 ring-cyan-500/20'
                    : 'bg-slate-950/50 border-slate-800 hover:border-slate-700 text-slate-300'
                }`}
              >
                <div className="flex items-center justify-between w-full">
                  <span className="font-bold text-sm text-white">🎧 Digital DJ Hjælper</span>
                  {mode === 'dj' && <Check className="w-4 h-4 text-cyan-400" />}
                </div>
                <p className="text-xs text-slate-400 mt-1">
                  Brug appen som DJ til jeres fysiske Hitster brætspilskort eller fri musikquiz!
                </p>
              </button>
            </div>
          </div>

          {/* 2. Sangvalg & Kategori */}
          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-slate-400 block mb-2.5">
              2. Sangkategori (Danske & Internationale)
            </label>
            <div className="grid grid-cols-3 gap-2.5">
              <button
                type="button"
                onClick={() => setCategoryFilter('all')}
                className={`p-3 rounded-xl border text-center transition-all ${
                  categoryFilter === 'all'
                    ? 'bg-pink-600 text-white border-pink-500 font-bold shadow-md'
                    : 'bg-slate-950/50 border-slate-800 text-slate-300 hover:bg-slate-800'
                }`}
              >
                <span className="text-xs sm:text-sm block">🇩🇰 + 🌍 Blandet</span>
                <span className="text-[10px] opacity-80 block mt-0.5">Både DK & Int.</span>
              </button>

              <button
                type="button"
                onClick={() => setCategoryFilter('danish')}
                className={`p-3 rounded-xl border text-center transition-all ${
                  categoryFilter === 'danish'
                    ? 'bg-red-600 text-white border-red-500 font-bold shadow-md'
                    : 'bg-slate-950/50 border-slate-800 text-slate-300 hover:bg-slate-800'
                }`}
              >
                <span className="text-xs sm:text-sm block">🇩🇰 Kun Danske</span>
                <span className="text-[10px] opacity-80 block mt-0.5">Kim Larsen, Aqua mfl.</span>
              </button>

              <button
                type="button"
                onClick={() => setCategoryFilter('international')}
                className={`p-3 rounded-xl border text-center transition-all ${
                  categoryFilter === 'international'
                    ? 'bg-blue-600 text-white border-blue-500 font-bold shadow-md'
                    : 'bg-slate-950/50 border-slate-800 text-slate-300 hover:bg-slate-800'
                }`}
              >
                <span className="text-xs sm:text-sm block">🌍 Kun Internationale</span>
                <span className="text-[10px] opacity-80 block mt-0.5">Queen, ABBA mfl.</span>
              </button>
            </div>
          </div>

          {/* 3. Årtier */}
          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-slate-400 block mb-2.5">
              3. Vælg Årtier ({decades.length} valgt)
            </label>
            <div className="flex flex-wrap gap-2">
              {ALL_DECADES.map((dec) => {
                const isSelected = decades.includes(dec.id);
                return (
                  <button
                    key={dec.id}
                    type="button"
                    onClick={() => toggleDecade(dec.id)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all ${
                      isSelected
                        ? 'bg-purple-600 text-white border-purple-500 shadow-sm'
                        : 'bg-slate-950/50 text-slate-400 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    {dec.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 4. Vinderbetingelse: Point eller Tid */}
          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-slate-400 block mb-2.5">
              4. Vinderbetingelse
            </label>
            <div className="grid grid-cols-2 gap-3 mb-3">
              <button
                type="button"
                onClick={() => setWinCondition('points')}
                className={`p-3.5 rounded-2xl border text-left transition-all ${
                  winCondition === 'points'
                    ? 'bg-amber-950/40 border-amber-500 ring-2 ring-amber-500/20'
                    : 'bg-slate-950/50 border-slate-800 hover:border-slate-700 text-slate-300'
                }`}
              >
                <div className="flex items-center justify-between w-full">
                  <span className="font-bold text-sm text-white flex items-center gap-1.5">
                    <Trophy className="w-4 h-4 text-amber-400" /> Antal point
                  </span>
                  {winCondition === 'points' && <Check className="w-4 h-4 text-amber-400" />}
                </div>
                <p className="text-xs text-slate-400 mt-1">
                  Første hold til et bestemt antal kort vinder.
                </p>
              </button>

              <button
                type="button"
                onClick={() => setWinCondition('time')}
                className={`p-3.5 rounded-2xl border text-left transition-all ${
                  winCondition === 'time'
                    ? 'bg-cyan-950/40 border-cyan-500 ring-2 ring-cyan-500/20'
                    : 'bg-slate-950/50 border-slate-800 hover:border-slate-700 text-slate-300'
                }`}
              >
                <div className="flex items-center justify-between w-full">
                  <span className="font-bold text-sm text-white flex items-center gap-1.5">
                    <Clock className="w-4 h-4 text-cyan-400" /> På tid
                  </span>
                  {winCondition === 'time' && <Check className="w-4 h-4 text-cyan-400" />}
                </div>
                <p className="text-xs text-slate-400 mt-1">
                  Flest kort når tiden løber ud vinder.
                </p>
              </button>
            </div>

            {winCondition === 'points' ? (
              <div className="grid grid-cols-3 gap-2.5">
                {[
                  { count: 5, label: '5 kort', sub: 'Hurtigt spil (10-15 min)' },
                  { count: 10, label: '10 kort', sub: 'Klassisk Hitster (20-30 min)' },
                  { count: 15, label: '15 kort', sub: 'Maraton (45+ min)' },
                ].map((opt) => (
                  <button
                    key={opt.count}
                    type="button"
                    onClick={() => setTargetCards(opt.count)}
                    className={`p-3 rounded-xl border text-center transition-all ${
                      targetCards === opt.count
                        ? 'bg-amber-500 text-slate-950 border-amber-400 font-bold shadow-md'
                        : 'bg-slate-950/50 border-slate-800 text-slate-300 hover:bg-slate-800'
                    }`}
                  >
                    <span className="text-sm block">{opt.label}</span>
                    <span className="text-[10px] opacity-75 block mt-0.5">{opt.sub}</span>
                  </button>
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-2.5">
                {[
                  { min: 5, label: '5 min', sub: 'Lynrunde' },
                  { min: 10, label: '10 min', sub: 'Kort spil' },
                  { min: 15, label: '15 min', sub: 'Klassisk' },
                ].map((opt) => (
                  <button
                    key={opt.min}
                    type="button"
                    onClick={() => setTimeLimitMinutes(opt.min)}
                    className={`p-3 rounded-xl border text-center transition-all ${
                      timeLimitMinutes === opt.min
                        ? 'bg-cyan-500 text-slate-950 border-cyan-400 font-bold shadow-md'
                        : 'bg-slate-950/50 border-slate-800 text-slate-300 hover:bg-slate-800'
                    }`}
                  >
                    <span className="text-sm block">{opt.label}</span>
                    <span className="text-[10px] opacity-75 block mt-0.5">{opt.sub}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* 5. Spillere / Hold */}
          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-slate-400 block mb-2.5">
              5. Antal hold ({players.length})
            </label>

            {/* Quick team-count selector */}
            <div className="flex flex-wrap gap-2 mb-3">
              {[2, 3, 4, 5, 6].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setTeamCount(n)}
                  className={`w-10 h-10 rounded-xl text-sm font-bold border transition-all ${
                    players.length === n
                      ? 'bg-pink-600 text-white border-pink-500 shadow-md'
                      : 'bg-slate-950/50 text-slate-300 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>

            <div className="space-y-2 mb-3">
              {players.map((p, idx) => (
                <div
                  key={p.id}
                  className="flex items-center justify-between p-2.5 rounded-xl bg-slate-950/60 border border-slate-800"
                >
                  <div className="flex items-center gap-2.5">
                    <div
                      className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[10px] font-black"
                      style={{ backgroundColor: p.color }}
                    >
                      {idx + 1}
                    </div>
                    <span className="text-sm font-semibold text-slate-200">
                      {p.name}
                    </span>
                  </div>

                  {players.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleRemovePlayer(p.id)}
                      className="p-1.5 text-slate-500 hover:text-rose-400 rounded-lg hover:bg-slate-800 transition-colors"
                      title="Fjern spiller"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>

            {/* Add Player Input */}
            <div className="flex gap-2">
              <input
                type="text"
                value={newPlayerName}
                onChange={(e) => setNewPlayerName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddPlayer()}
                placeholder="Tilføj nyt hold eller spillernavn..."
                className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-pink-500"
              />
              <button
                type="button"
                onClick={handleAddPlayer}
                disabled={!newPlayerName.trim()}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 disabled:opacity-40 flex items-center gap-1 text-sm font-bold border border-slate-700 transition-colors"
              >
                <Plus className="w-4 h-4" />
                <span>Tilføj</span>
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-7 pt-4 border-t border-slate-800 flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-bold text-slate-400 hover:text-white transition-colors"
          >
            Annuller
          </button>

          <button
            type="button"
            onClick={handleSaveAndStart}
            className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-600 hover:to-purple-700 text-white font-bold text-xs tracking-wider uppercase transition-all shadow-md hover:scale-105"
          >
            <Play className="w-4 h-4 fill-current" />
            <span>Start Spil</span>
          </button>
        </div>
      </div>
    </div>
  );
}

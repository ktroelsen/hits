import { X, HelpCircle, Music, Clock, CheckCircle, Coins, Award } from 'lucide-react';

interface RulesModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function RulesModal({ isOpen, onClose }: RulesModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-xl bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-7 shadow-2xl overflow-hidden max-h-[90vh] overflow-y-auto">
        {/* Glow accent */}
        <div className="absolute top-0 right-0 w-48 h-48 bg-pink-500/10 rounded-full blur-3xl pointer-events-none" />

        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-pink-500/20 text-pink-400 border border-pink-500/30">
              <HelpCircle className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-xl font-black text-white font-display">
                Sådan spiller du Hitster
              </h3>
              <p className="text-xs text-slate-400">
                Det ultimative musik- og tidslinjespil
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

        {/* Rules Steps */}
        <div className="mt-5 space-y-4">
          <div className="flex gap-3.5 p-3.5 rounded-2xl bg-slate-950/50 border border-slate-800/80">
            <div className="w-8 h-8 rounded-xl bg-pink-500/20 text-pink-400 border border-pink-500/30 flex items-center justify-center shrink-0 font-black text-sm">
              1
            </div>
            <div>
              <h4 className="text-sm font-bold text-slate-200 flex items-center gap-1.5">
                <Music className="w-4 h-4 text-pink-400" />
                Lyt til sangen
              </h4>
              <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                Tryk på "Afspil sang" og lyt til et 30-sekunders musikklip. Hverken kunstner, titel eller årstal vises før du har gættet!
              </p>
            </div>
          </div>

          <div className="flex gap-3.5 p-3.5 rounded-2xl bg-slate-950/50 border border-slate-800/80">
            <div className="w-8 h-8 rounded-xl bg-purple-500/20 text-purple-400 border border-purple-500/30 flex items-center justify-center shrink-0 font-black text-sm">
              2
            </div>
            <div>
              <h4 className="text-sm font-bold text-slate-200 flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-purple-400" />
                Placér på den fælles tidslinje
              </h4>
              <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                Holdene spiller på samme tidslinje! Hvor passer sangen ind i forhold til de eksisterende kort på den fælles tidslinje? Før den første, mellem to sange eller efter den nyeste? Klik på boksen på tidslinjen eller brug årstals-slideren.
              </p>
            </div>
          </div>

          <div className="flex gap-3.5 p-3.5 rounded-2xl bg-slate-950/50 border border-slate-800/80">
            <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center shrink-0 font-black text-sm">
              3
            </div>
            <div>
              <h4 className="text-sm font-bold text-slate-200 flex items-center gap-1.5">
                <CheckCircle className="w-4 h-4 text-emerald-400" />
                Vend kortet og tjek
              </h4>
              <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                Tryk på <strong>Afslør sang</strong>. Hvis sangen er placeret i korrekt kronologisk rækkefølge, beholder du kortet på din tidslinje!
              </p>
            </div>
          </div>

          <div className="flex gap-3.5 p-3.5 rounded-2xl bg-slate-950/50 border border-slate-800/80">
            <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center shrink-0 font-black text-sm">
              4
            </div>
            <div>
              <h4 className="text-sm font-bold text-slate-200 flex items-center gap-1.5">
                <Coins className="w-4 h-4 text-amber-400" />
                Hitster-tokens (Mønter)
              </h4>
              <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                Du starter med 2 Hitster-tokens. Du kan bruge 1 token til at <strong>skifte sang</strong> hvis du er helt på bar bund. Gætter du det nøjagtige årstal i Ekspert-mode, vinder du en ekstra token!
              </p>
            </div>
          </div>

          <div className="flex gap-3.5 p-3.5 rounded-2xl bg-slate-950/50 border border-slate-800/80">
            <div className="w-8 h-8 rounded-xl bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 flex items-center justify-center shrink-0 font-black text-sm">
              5
            </div>
            <div>
              <h4 className="text-sm font-bold text-slate-200 flex items-center gap-1.5">
                <Award className="w-4 h-4 text-cyan-400" />
                Sådan vinder du!
              </h4>
              <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                Den første spiller eller hold, der samler <strong>10 korrekte sange</strong> i kronologisk rækkefølge på deres tidslinje, vinder spillet!
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-6 pt-4 border-t border-slate-800 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-600 hover:to-purple-700 text-white font-bold text-xs tracking-wider uppercase transition-all shadow-md"
          >
            Forstået – Lad os spille!
          </button>
        </div>
      </div>
    </div>
  );
}

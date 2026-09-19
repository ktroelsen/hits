import { Plus, Check, ArrowDown, HelpCircle } from 'lucide-react';

interface TimelineSlotProps {
  index: number;
  label: string;
  isPlacing: boolean;
  isSelected: boolean;
  isCorrect?: boolean;
  isWrongChoice?: boolean;
  showAsTarget?: boolean; // When player guessed wrong, show where it actually belonged
  onClick: () => void;
}

export function TimelineSlot({
  index,
  label,
  isPlacing,
  isSelected,
  isCorrect,
  isWrongChoice,
  showAsTarget,
  onClick,
}: TimelineSlotProps) {
  return (
    <div className="flex flex-col items-center justify-center my-auto px-1 shrink-0">
      <button
        id={`timeline-slot-${index}`}
        onClick={onClick}
        disabled={!isPlacing}
        className={`group relative flex flex-col items-center justify-center transition-all duration-200 rounded-2xl p-1.5 sm:p-2 ${
          isPlacing
            ? isSelected
              ? 'bg-pink-600 text-white ring-4 ring-pink-500/40 scale-105 shadow-lg shadow-pink-500/30'
              : 'bg-slate-900/90 hover:bg-pink-950/60 text-slate-300 hover:text-pink-300 border-2 border-dashed border-slate-700 hover:border-pink-500 cursor-pointer scale-100 hover:scale-105'
            : isCorrect
            ? 'bg-emerald-950/80 text-emerald-300 border-2 border-emerald-500 ring-4 ring-emerald-500/30'
            : isWrongChoice
            ? 'bg-rose-950/80 text-rose-300 border-2 border-rose-500 ring-4 ring-rose-500/30'
            : showAsTarget
            ? 'bg-amber-950/80 text-amber-300 border-2 border-dashed border-amber-400 animate-bounce'
            : 'bg-slate-900/40 text-slate-600 border border-slate-800 pointer-events-none'
        }`}
        style={{ minWidth: '66px', height: '118px' }}
      >
        {/* Top visual indicator icon */}
        <div className="mb-1.5">
          {isSelected ? (
            <Check className="w-4 h-4 text-white animate-pulse" />
          ) : showAsTarget ? (
            <ArrowDown className="w-4 h-4 text-amber-400" />
          ) : isPlacing ? (
            <Plus className="w-4 h-4 group-hover:scale-125 transition-transform text-pink-400" />
          ) : (
            <div className="w-2 h-2 rounded-full bg-slate-700" />
          )}
        </div>

        {/* Action text */}
        <div className="text-center flex flex-col items-center justify-center space-y-1">
          <span className="text-[10px] font-bold uppercase tracking-wider block leading-tight">
            {isSelected ? 'Valgt her' : showAsTarget ? 'Hørte til her' : isPlacing ? 'Placér her' : ''}
          </span>
          <span className="text-[9px] font-mono px-1 py-0.5 rounded bg-slate-950/60 text-slate-400 max-w-[62px] break-words">
            {label}
          </span>
        </div>
      </button>
    </div>
  );
}

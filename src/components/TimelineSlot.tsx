import { Plus, Check, ArrowDown } from 'lucide-react';

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
  // Only these states get the wider slot that shows its label inline; a normal
  // placing slot is a thin drop-zone that reveals its label on hover.
  const expanded = isSelected || isCorrect || isWrongChoice || showAsTarget;

  return (
    <div className="flex flex-col items-center justify-center shrink-0">
      <button
        id={`timeline-slot-${index}`}
        onClick={onClick}
        disabled={!isPlacing}
        title={label}
        className={`group/slot relative flex flex-col items-center justify-center transition-all duration-200 rounded-xl ${
          isPlacing
            ? isSelected
              ? 'bg-pink-600 text-white ring-4 ring-pink-500/40 shadow-lg shadow-pink-500/30'
              : 'bg-slate-900/70 hover:bg-pink-950/60 text-slate-500 hover:text-pink-300 border-2 border-dashed border-slate-700 hover:border-pink-500 cursor-pointer'
            : isCorrect
            ? 'bg-emerald-950/80 text-emerald-300 border-2 border-emerald-500 ring-4 ring-emerald-500/30'
            : isWrongChoice
            ? 'bg-rose-950/80 text-rose-300 border-2 border-rose-500 ring-4 ring-rose-500/30'
            : showAsTarget
            ? 'bg-amber-950/80 text-amber-300 border-2 border-dashed border-amber-400 animate-bounce'
            : 'bg-slate-900/30 text-slate-700 border border-slate-800 pointer-events-none'
        }`}
        style={{ width: expanded ? '68px' : '30px', height: '128px' }}
      >
        {/* Indicator icon */}
        {isSelected ? (
          <Check className="w-4 h-4 text-white animate-pulse" />
        ) : showAsTarget ? (
          <ArrowDown className="w-4 h-4 text-amber-400" />
        ) : isPlacing ? (
          <Plus className="w-4 h-4 group-hover/slot:scale-125 transition-transform text-pink-400/70 group-hover/slot:text-pink-300" />
        ) : (
          <div className="w-1.5 h-1.5 rounded-full bg-slate-700" />
        )}

        {/* Inline label for the expanded states */}
        {expanded && (
          <div className="mt-1 flex flex-col items-center gap-0.5">
            <span className="text-[9px] font-bold uppercase tracking-wide leading-none">
              {isSelected ? 'Valgt' : showAsTarget ? 'Her!' : ''}
            </span>
            <span className="text-[9px] font-mono px-1 py-0.5 rounded bg-slate-950/60 text-slate-300 max-w-[60px] text-center break-words leading-tight">
              {label}
            </span>
          </div>
        )}

        {/* Hover tooltip label for thin placing slots (no layout shift) */}
        {isPlacing && !isSelected && (
          <span className="pointer-events-none absolute -top-6 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-md bg-slate-950 px-1.5 py-0.5 text-[10px] font-mono font-semibold text-pink-200 border border-pink-500/40 opacity-0 group-hover/slot:opacity-100 transition-opacity z-20 shadow-lg">
            {label}
          </span>
        )}
      </button>
    </div>
  );
}

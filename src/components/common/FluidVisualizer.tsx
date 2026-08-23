import React from 'react';
import { motion } from 'motion/react';
import { Droplets, RefreshCw } from 'lucide-react';

interface FluidVisualizerProps {
  currentMl: number;
  maxCapacity?: number;
  onDrink?: (amountMl: number) => void;
  onRefill?: () => void;
}

export const FluidVisualizer: React.FC<FluidVisualizerProps> = ({
  currentMl,
  maxCapacity = 750,
  onDrink,
  onRefill,
}) => {
  const percentage = Math.min(100, Math.max(0, Math.round((currentMl / maxCapacity) * 100)));

  return (
    <div className="p-3 xs:p-3.5 sm:p-4 rounded-[20px] sm:rounded-[24px] bg-[#12161C] border border-white/5 shadow-md relative overflow-hidden flex flex-col justify-between gap-2.5">
      {/* Top Header: Label + Stats + Refill */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-6 h-6 rounded-lg bg-[#00D1FF]/10 border border-[#00D1FF]/20 flex items-center justify-center text-[#00D1FF] shrink-0">
            <Droplets className="w-3.5 h-3.5" />
          </div>
          <div className="min-w-0">
            <span className="text-[10px] sm:text-xs uppercase tracking-wider text-neutral-400 font-semibold truncate block">
              Bottle Fluid Depth
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <span className="text-[10px] sm:text-xs font-semibold text-[#00D1FF] bg-[#00D1FF]/10 px-2 py-0.5 rounded-full border border-[#00D1FF]/20 font-mono">
            {percentage}% ({currentMl} / {maxCapacity} ml)
          </span>

          {onRefill && (
            <button
              onClick={onRefill}
              title="Refill Bottle"
              className="flex items-center gap-1 text-[11px] font-medium text-neutral-400 hover:text-[#00D1FF] transition-colors px-2.5 py-1 rounded-lg bg-white/[0.04] border border-white/10 hover:border-[#00D1FF]/30 active:scale-95 touch-target sm:min-h-0 sm:min-w-0"
            >
              <RefreshCw className="w-3 h-3" />
              <span>Refill</span>
            </button>
          )}
        </div>
      </div>

      {/* Sleek horizontal level bar */}
      <div className="w-full h-2.5 sm:h-3 rounded-full bg-[#090B0E] border border-white/10 overflow-hidden p-0.5 relative">
        <motion.div
          className="h-full rounded-full bg-gradient-to-r from-[#0077FF] via-[#00B4D8] to-[#00D1FF] shadow-sm shadow-[#00D1FF]/30"
          initial={{ width: 0 }}
          animate={{ width: `${percentage}%` }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        />
      </div>

      {/* Bottom row: Quick Sip presets + Ultrasonic sensor accuracy footnote */}
      <div className="flex items-center justify-between gap-2 text-[10px] sm:text-[11px] text-neutral-400">
        <span className="text-neutral-500 hidden xs:inline font-mono">
          Ultrasonic Depth • ±5 ml
        </span>

        {onDrink && (
          <div className="flex items-center gap-1.5 ml-auto">
            <span className="text-neutral-500 text-[10px] mr-0.5">Quick Sip:</span>
            <button
              onClick={() => onDrink(150)}
              className="px-2.5 py-1 text-[11px] font-medium rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-white border border-white/10 hover:border-[#00D1FF]/40 active:scale-95 transition-all touch-target sm:min-h-0 sm:min-w-0"
            >
              +150 ml
            </button>
            <button
              onClick={() => onDrink(250)}
              className="px-2.5 py-1 text-[11px] font-medium rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-white border border-white/10 hover:border-[#00D1FF]/40 active:scale-95 transition-all touch-target sm:min-h-0 sm:min-w-0"
            >
              +250 ml
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

import React from 'react';
import { motion } from 'motion/react';
import { Droplet, RefreshCw, Plus } from 'lucide-react';

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
    <div className="flex flex-col justify-between p-4 xs:p-5 sm:p-6 lg:p-7 rounded-[28px] sm:rounded-[32px] bg-[#12161C] border border-white/5 relative overflow-hidden h-full shadow-2xl transition-all">
      {/* Top Header */}
      <div className="flex items-center justify-between z-10">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-[#00D1FF]/10 border border-[#00D1FF]/20 flex items-center justify-center">
            <Droplet className="w-4 h-4 text-[#00D1FF]" />
          </div>
          <div>
            <span className="text-[10px] sm:text-xs uppercase tracking-wider text-neutral-400 font-medium block">
              Bottle Fluid Depth
            </span>
            <span className="text-[10px] sm:text-xs text-neutral-500">Cap sensor calibrated</span>
          </div>
        </div>

        {onRefill && (
          <button
            onClick={onRefill}
            title="Refill Bottle"
            className="flex items-center gap-1.5 text-xs font-medium text-neutral-400 hover:text-[#00D1FF] transition-colors px-3 py-1.5 rounded-xl bg-white/[0.04] border border-white/10 hover:border-[#00D1FF]/30 active:scale-95 touch-target sm:min-h-0 sm:min-w-0"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Refill</span>
          </button>
        )}
      </div>

      {/* Main Fluid Display Area */}
      <div className="my-4 sm:my-6 flex items-center gap-4 sm:gap-6 z-10">
        {/* Animated Bottle Tube Silhouette */}
        <div className="relative w-14 sm:w-16 h-32 sm:h-36 rounded-2xl bg-[#090B0E] border-2 border-white/10 overflow-hidden flex flex-col justify-end p-0.5 shadow-inner shrink-0">
          {/* Subtle measurement tick marks */}
          <div className="absolute inset-y-0 right-1.5 flex flex-col justify-between py-2 text-[8px] font-mono text-neutral-500 pointer-events-none z-20">
            <span>750</span>
            <span>500</span>
            <span>250</span>
          </div>

          {/* Animated Water Fill */}
          <motion.div
            className="w-full rounded-xl relative overflow-hidden bg-gradient-to-t from-[#0077FF] via-[#00B4D8] to-[#00D1FF]"
            initial={{ height: '0%' }}
            animate={{ height: `${percentage}%` }}
            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          >
            {/* Subtle light shimmer */}
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/25 to-transparent animate-pulse" />
          </motion.div>
        </div>

        {/* Big Numerals & Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline">
            <span className="text-3xl xs:text-4xl lg:text-5xl font-light tracking-tight text-white font-sans">
              {currentMl}
            </span>
            <span className="text-xs sm:text-sm font-normal text-neutral-400 ml-1.5">ml</span>
          </div>

          <div className="mt-1 flex flex-wrap items-center gap-1.5 sm:gap-2">
            <span className="text-[10px] sm:text-xs font-semibold text-[#00D1FF] bg-[#00D1FF]/10 px-2 py-0.5 rounded-full border border-[#00D1FF]/20">
              {percentage}% Volume
            </span>
            <span className="text-[10px] sm:text-xs text-neutral-400">/ {maxCapacity} ml max</span>
          </div>

          {/* Quick Drink Presets */}
          {onDrink && (
            <div className="mt-3.5 flex flex-wrap items-center gap-2">
              <span className="text-[11px] text-neutral-400 mr-0.5 hidden xs:inline">Quick Sip:</span>
              <button
                onClick={() => onDrink(150)}
                className="px-3 py-1.5 text-xs font-medium rounded-xl bg-white/[0.04] hover:bg-white/[0.08] text-white border border-white/10 hover:border-[#00D1FF]/40 active:scale-95 transition-all touch-target sm:min-h-0 sm:min-w-0"
              >
                +150 ml
              </button>
              <button
                onClick={() => onDrink(250)}
                className="px-3 py-1.5 text-xs font-medium rounded-xl bg-white/[0.04] hover:bg-white/[0.08] text-white border border-white/10 hover:border-[#00D1FF]/40 active:scale-95 transition-all touch-target sm:min-h-0 sm:min-w-0"
              >
                +250 ml
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Footer metadata */}
      <div className="text-[10px] sm:text-[11px] text-neutral-500 z-10 flex items-center justify-between border-t border-white/5 pt-2.5 sm:pt-3">
        <span>Ultrasonic Depth Gauge</span>
        <span>±5 ml accuracy</span>
      </div>
    </div>
  );
};


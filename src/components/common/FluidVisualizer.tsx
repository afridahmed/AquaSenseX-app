import React from 'react';
import { motion } from 'motion/react';
import { Droplet, Plus, RefreshCw } from 'lucide-react';

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
    <div className="flex flex-col justify-between p-6 rounded-[32px] bg-[#141414] border border-[#222222] relative overflow-hidden h-full shadow-2xl">
      {/* Top Header */}
      <div className="flex items-center justify-between z-10">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-[#00D1FF]/10 border border-[#00D1FF]/20 flex items-center justify-center">
            <Droplet className="w-4 h-4 text-[#00D1FF]" />
          </div>
          <div>
            <span className="text-xs uppercase tracking-wider text-[#888888] font-medium block">
              Bottle Volume
            </span>
            <span className="text-xs text-[#555555]">Cap sensor active</span>
          </div>
        </div>

        {onRefill && (
          <button
            onClick={onRefill}
            title="Refill Bottle"
            className="flex items-center gap-1.5 text-xs font-medium text-[#888888] hover:text-[#00D1FF] transition-colors px-2.5 py-1 rounded-xl bg-[#1E1E1E] border border-white/5 hover:border-[#00D1FF]/30"
          >
            <RefreshCw className="w-3 h-3" />
            <span>Refill</span>
          </button>
        )}
      </div>

      {/* Main Fluid Display Area */}
      <div className="my-6 flex items-center gap-6 z-10">
        {/* Animated Bottle Tube Silhouette */}
        <div className="relative w-16 h-36 rounded-2xl bg-[#0A0A0A] border-2 border-[#2A2A2A] overflow-hidden flex flex-col justify-end p-0.5 shadow-inner">
          {/* Subtle measurement tick marks */}
          <div className="absolute inset-y-0 right-1.5 flex flex-col justify-between py-2 text-[8px] font-mono text-[#555555] pointer-events-none z-20">
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

        {/* Big Numerals */}
        <div className="flex-1">
          <div className="flex items-baseline">
            <span className="text-4xl lg:text-5xl font-light tracking-tight text-[#F5F5F5] font-sans">
              {currentMl}
            </span>
            <span className="text-sm font-normal text-[#888888] ml-1.5">ml</span>
          </div>

          <div className="mt-1 flex items-center gap-2">
            <span className="text-xs font-medium text-[#00D1FF] bg-[#00D1FF]/10 px-2 py-0.5 rounded-full border border-[#00D1FF]/20">
              {percentage}% Remaining
            </span>
            <span className="text-xs text-[#555555]">/ {maxCapacity} ml max</span>
          </div>

          {/* Quick Drink Presets */}
          {onDrink && (
            <div className="mt-4 flex items-center gap-2">
              <span className="text-[11px] text-[#888888] mr-0.5">Quick Sip:</span>
              <button
                onClick={() => onDrink(150)}
                className="px-2.5 py-1 text-xs rounded-xl bg-[#1E1E1E] hover:bg-[#252525] text-[#F5F5F5] border border-white/5 hover:border-[#00D1FF]/40 transition-all"
              >
                150 ml
              </button>
              <button
                onClick={() => onDrink(250)}
                className="px-2.5 py-1 text-xs rounded-xl bg-[#1E1E1E] hover:bg-[#252525] text-[#F5F5F5] border border-white/5 hover:border-[#00D1FF]/40 transition-all"
              >
                250 ml
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Footer metadata */}
      <div className="text-[11px] text-[#555555] z-10 flex items-center justify-between border-t border-[#1E1E1E] pt-3">
        <span>Ultrasonic Fluid Depth Sensor</span>
        <span>±5 ml precision</span>
      </div>
    </div>
  );
};

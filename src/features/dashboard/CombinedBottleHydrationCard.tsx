import React from 'react';
import { motion } from 'motion/react';
import { Droplets, Plus, RefreshCw, Sparkles, CheckCircle2 } from 'lucide-react';

interface CombinedBottleHydrationCardProps {
  waterLevel: number;
  maxCapacity: number;
  todayConsumed: number;
  hydrationGoal: number;
  hydrationPercent: number;
  remainingMl: number;
  onRecordIntake: (amountMl: number, source?: any) => Promise<void>;
  onOpenCustomDrink: () => void;
  onRefill?: () => void;
}

export const CombinedBottleHydrationCard: React.FC<CombinedBottleHydrationCardProps> = ({
  waterLevel,
  maxCapacity = 750,
  todayConsumed,
  hydrationGoal,
  hydrationPercent,
  remainingMl,
  onRecordIntake,
  onOpenCustomDrink,
  onRefill,
}) => {
  // Bottle Level Math
  const bottlePercent = Math.min(100, Math.max(0, Math.round((waterLevel / maxCapacity) * 100)));
  const bottleLiters = (waterLevel / 1000).toFixed(2);
  const maxCapacityLiters = (maxCapacity / 1000).toFixed(2);

  // Hydration Math
  const consumedLiters = (todayConsumed / 1000).toFixed(2);
  const goalLiters = (hydrationGoal / 1000).toFixed(1);
  const remainingLiters = (Math.max(0, remainingMl) / 1000).toFixed(2);
  const isGoalAchieved = todayConsumed >= hydrationGoal;

  return (
    <div className="p-4 xs:p-5 sm:p-6 lg:p-7 rounded-[26px] sm:rounded-[32px] bg-[#12161C] border border-white/5 shadow-2xl relative overflow-hidden">
      {/* Subtle ambient lighting */}
      <div className="absolute top-0 right-1/3 w-80 h-36 bg-[#00D1FF]/5 rounded-full blur-3xl pointer-events-none" />

      {/* Main Grid: Bottle on Left / Top, Hydration Tracker on Right / Bottom */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-5 sm:gap-6 items-center">
        
        {/* ================= PHYSICAL BOTTLE VISUALIZATION ================= */}
        <div className="md:col-span-5 lg:col-span-5 flex items-center gap-4 sm:gap-5 p-3.5 sm:p-4 rounded-2xl bg-[#0B0E13] border border-white/5 relative">
          
          {/* Smart Bottle Silhouette Graphic */}
          <div className="relative w-16 xs:w-18 sm:w-20 h-36 xs:h-40 sm:h-44 shrink-0 flex flex-col items-center select-none">
            {/* Bottle Lid / Cap */}
            <div className="w-7 sm:w-8 h-3 sm:h-3.5 rounded-t-md bg-gradient-to-r from-neutral-600 via-neutral-400 to-neutral-700 border-t border-x border-white/20 relative shadow-sm">
              <div className="absolute top-0.5 left-1/2 -translate-x-1/2 w-4 h-1 bg-[#00D1FF]/40 rounded-full" />
            </div>

            {/* Bottle Neck Ring */}
            <div className="w-5 sm:w-6 h-1.5 bg-neutral-800 border-x border-white/10" />

            {/* Bottle Glass / Insulated Body */}
            <div className="relative w-full flex-1 rounded-b-2xl rounded-t-md bg-gradient-to-b from-[#141A22] to-[#0A0D12] border border-white/15 overflow-hidden shadow-inner flex flex-col justify-end p-0.5">
              
              {/* Glass Reflection Highlight Stripe (Left Edge) */}
              <div className="absolute inset-y-1 left-1.5 w-1 bg-gradient-to-b from-white/25 via-white/10 to-transparent rounded-full z-20 pointer-events-none" />

              {/* Water Liquid Column */}
              <motion.div
                className="w-full relative overflow-hidden rounded-b-[14px]"
                initial={{ height: 0 }}
                animate={{ height: `${bottlePercent}%` }}
                transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
              >
                {/* Animated Liquid Wave / Surface Meniscus */}
                <div className="absolute top-0 inset-x-0 h-2 bg-gradient-to-r from-[#00D1FF] via-[#38bdf8] to-[#00A3FF] opacity-90 shadow-sm shadow-[#00D1FF]/50 z-10" />
                
                {/* Liquid Body Gradient */}
                <div className="w-full h-full bg-gradient-to-t from-[#0055FF] via-[#0088FF] to-[#00D1FF]/80 opacity-80" />
              </motion.div>

              {/* Empty state water guideline marks */}
              <div className="absolute inset-y-2 right-1.5 flex flex-col justify-between items-end pointer-events-none opacity-20">
                <span className="w-1.5 h-0.5 bg-white rounded-full" />
                <span className="w-2.5 h-0.5 bg-white rounded-full" />
                <span className="w-1.5 h-0.5 bg-white rounded-full" />
                <span className="w-2.5 h-0.5 bg-white rounded-full" />
              </div>
            </div>
          </div>

          {/* Bottle Telemetry Text Info */}
          <div className="min-w-0 flex-1 flex flex-col justify-between py-1">
            <div>
              <div className="flex items-center gap-1.5 mb-1">
                <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-neutral-400">
                  Smart Bottle
                </span>
                <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-[#00D1FF]/10 text-[#00D1FF] border border-[#00D1FF]/20">
                  {bottlePercent}%
                </span>
              </div>

              <div className="flex items-baseline gap-1">
                <span className="text-xl xs:text-2xl sm:text-3xl font-light text-white tracking-tight">
                  {bottleLiters}
                </span>
                <span className="text-xs text-neutral-400 font-normal">
                  / {maxCapacityLiters} L
                </span>
              </div>
              <span className="text-[11px] text-neutral-500 font-mono block mt-0.5">
                {waterLevel} ml in flask
              </span>
            </div>

            {/* Quick Bottle Refill Action */}
            {onRefill && (
              <div className="mt-3 pt-2 border-t border-white/5">
                <button
                  onClick={onRefill}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] active:bg-white/[0.12] text-neutral-300 hover:text-white border border-white/10 hover:border-[#00D1FF]/40 text-[11px] font-medium transition-all cursor-pointer active:scale-95 touch-target sm:min-h-0 sm:min-w-0"
                >
                  <RefreshCw className="w-3 h-3 text-[#00D1FF]" />
                  <span>Refill Flask (750ml)</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* ================= DAILY HYDRATION TRACKER ================= */}
        <div className="md:col-span-7 lg:col-span-7 flex flex-col justify-between min-w-0">
          
          {/* Header Row: Label + Goal Badge */}
          <div className="flex items-center justify-between gap-2 mb-2">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-lg bg-[#00D1FF]/15 border border-[#00D1FF]/25 flex items-center justify-center text-[#00D1FF]">
                <Droplets className="w-3.5 h-3.5" />
              </div>
              <span className="text-xs sm:text-sm font-semibold tracking-wide text-white uppercase">
                Today's Hydration
              </span>
            </div>

            <span
              className={`text-[10px] sm:text-xs font-semibold px-2.5 py-0.5 rounded-full border ${
                isGoalAchieved
                  ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                  : 'bg-[#00D1FF]/10 text-[#00D1FF] border-[#00D1FF]/20'
              }`}
            >
              {isGoalAchieved ? '✓ Target Reached' : `${hydrationPercent}% of Goal`}
            </span>
          </div>

          {/* Primary Numbers: Consumed vs Daily Target */}
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-3xl sm:text-4xl font-light text-white font-sans tracking-tight">
              {consumedLiters}
            </span>
            <span className="text-sm sm:text-base font-normal text-neutral-400">
              / {goalLiters} L Target
            </span>
            <span className="text-xs text-neutral-500 font-mono hidden xs:inline ml-1">
              ({todayConsumed.toLocaleString()} ml)
            </span>
          </div>

          {/* Progress Bar & Status */}
          <div className="mt-3">
            <div className="w-full h-2.5 sm:h-3 rounded-full bg-[#090B0E] border border-white/10 overflow-hidden p-0.5 relative">
              <motion.div
                className={`h-full rounded-full ${
                  isGoalAchieved
                    ? 'bg-gradient-to-r from-emerald-400 to-[#00D1FF] shadow-sm shadow-emerald-400/30'
                    : 'bg-gradient-to-r from-[#00D1FF] via-[#00A3FF] to-[#0077FF] shadow-sm shadow-[#00D1FF]/30'
                }`}
                initial={{ width: 0 }}
                animate={{ width: `${Math.min(100, hydrationPercent)}%` }}
                transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
              />
            </div>

            <div className="flex items-center justify-between text-[11px] sm:text-xs text-neutral-400 mt-1.5 font-medium">
              <span className={isGoalAchieved ? 'text-emerald-400 font-semibold' : 'text-neutral-300'}>
                {isGoalAchieved
                  ? 'Daily hydration completed!'
                  : `${remainingLiters} L remaining (${remainingMl.toLocaleString()} ml)`}
              </span>
              <span className="text-neutral-500 font-mono">
                Goal: {goalLiters} L
              </span>
            </div>
          </div>

          {/* Quick Hydration Intake Log Buttons */}
          <div className="mt-4 pt-3 border-t border-white/5">
            <div className="flex items-center justify-between gap-1.5 mb-2">
              <span className="text-[10px] uppercase font-semibold text-neutral-400 tracking-wider">
                Quick Log Intake
              </span>
              <span className="text-[10px] text-neutral-500 font-mono hidden sm:inline">
                Auto-syncs to cloud
              </span>
            </div>

            <div className="grid grid-cols-4 gap-1.5 xs:gap-2">
              <button
                onClick={() => onRecordIntake(250, 'quick_preset')}
                className="flex items-center justify-center gap-1 px-2 py-2.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] active:bg-white/[0.12] text-white border border-white/10 hover:border-[#00D1FF]/40 text-xs font-semibold active:scale-95 transition-all touch-target sm:min-h-0 sm:min-w-0 cursor-pointer"
                title="Add 250 ml"
              >
                <Plus className="w-3 h-3 text-[#00D1FF] shrink-0" />
                <span className="whitespace-nowrap">250 ml</span>
              </button>

              <button
                onClick={() => onRecordIntake(500, 'quick_preset')}
                className="flex items-center justify-center gap-1 px-2 py-2.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] active:bg-white/[0.12] text-white border border-white/10 hover:border-[#00D1FF]/40 text-xs font-semibold active:scale-95 transition-all touch-target sm:min-h-0 sm:min-w-0 cursor-pointer"
                title="Add 500 ml"
              >
                <Plus className="w-3 h-3 text-[#00D1FF] shrink-0" />
                <span className="whitespace-nowrap">500 ml</span>
              </button>

              <button
                onClick={() => onRecordIntake(750, 'quick_preset')}
                className="flex items-center justify-center gap-1 px-2 py-2.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] active:bg-white/[0.12] text-white border border-white/10 hover:border-[#00D1FF]/40 text-xs font-semibold active:scale-95 transition-all touch-target sm:min-h-0 sm:min-w-0 cursor-pointer"
                title="Add 750 ml"
              >
                <Plus className="w-3 h-3 text-[#00D1FF] shrink-0" />
                <span className="whitespace-nowrap">750 ml</span>
              </button>

              <button
                onClick={onOpenCustomDrink}
                className="flex items-center justify-center px-2 py-2.5 rounded-xl bg-[#00D1FF]/10 hover:bg-[#00D1FF]/20 active:bg-[#00D1FF]/30 text-[#00D1FF] border border-[#00D1FF]/30 text-xs font-semibold active:scale-95 transition-all touch-target sm:min-h-0 sm:min-w-0 cursor-pointer"
                title="Enter custom intake amount"
              >
                <span className="whitespace-nowrap">Custom</span>
              </button>
            </div>
          </div>

        </div>

      </div>
    </div>
  );
};

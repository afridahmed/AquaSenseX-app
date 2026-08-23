import React from 'react';
import { Droplets, Plus, Sparkles, CheckCircle2, ChevronRight } from 'lucide-react';
import { motion } from 'motion/react';

interface HydrationTrackerCardProps {
  todayConsumed: number;
  hydrationGoal: number;
  hydrationPercent: number;
  remainingMl: number;
  onRecordIntake: (amountMl: number, source?: any) => Promise<void>;
  onOpenCustomDrink: () => void;
}

export const HydrationTrackerCard: React.FC<HydrationTrackerCardProps> = ({
  todayConsumed,
  hydrationGoal,
  hydrationPercent,
  remainingMl,
  onRecordIntake,
  onOpenCustomDrink,
}) => {
  // Format ml to Liters cleanly with 1 decimal place
  const formatToLiters = (ml: number) => (ml / 1000).toFixed(1);

  const consumedLiters = formatToLiters(todayConsumed);
  const goalLiters = formatToLiters(hydrationGoal);
  const remainingLiters = formatToLiters(Math.max(0, remainingMl));
  const isGoalAchieved = todayConsumed >= hydrationGoal;

  return (
    <div className="p-4 xs:p-5 sm:p-6 lg:p-7 rounded-[24px] sm:rounded-[32px] bg-[#12161C] border border-white/5 shadow-2xl relative overflow-hidden">
      {/* Subtle background ambient tint */}
      <div className="absolute top-0 right-1/4 w-72 h-32 bg-[#00D1FF]/5 rounded-full blur-3xl pointer-events-none" />

      {/* Desktop / Tablet / Mobile Responsive Layout */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 sm:gap-6">
        {/* Left / Top Section: Title & Primary Metric Display */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between sm:justify-start gap-2 mb-1.5">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-lg bg-[#00D1FF]/15 border border-[#00D1FF]/25 flex items-center justify-center text-[#00D1FF]">
                <Droplets className="w-3.5 h-3.5" />
              </div>
              <span className="text-xs sm:text-sm font-semibold tracking-wide text-white uppercase">
                Hydration Tracker
              </span>
            </div>

            <span
              className={`text-[10px] sm:text-xs font-semibold px-2.5 py-0.5 rounded-full border ${
                isGoalAchieved
                  ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                  : 'bg-[#00D1FF]/10 text-[#00D1FF] border-[#00D1FF]/20'
              }`}
            >
              {isGoalAchieved ? '✓ Target Achieved' : `${hydrationPercent}% of Goal`}
            </span>
          </div>

          {/* Primary Numbers Cluster: e.g. 1.4 / 2.5 L */}
          <div className="flex items-baseline gap-2 mt-2">
            <span className="text-3xl sm:text-4xl font-light text-white font-sans tracking-tight">
              {consumedLiters}
            </span>
            <span className="text-sm sm:text-base font-normal text-neutral-400">
              / {goalLiters} L
            </span>
            <span className="text-xs text-neutral-500 font-mono hidden xs:inline ml-1">
              ({todayConsumed.toLocaleString()} ml)
            </span>
          </div>

          {/* Progress Bar & Subtitle */}
          <div className="mt-3.5 max-w-xl">
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
                {isGoalAchieved ? 'Daily hydration goal completed!' : `${remainingLiters} L remaining (${remainingMl.toLocaleString()} ml)`}
              </span>
              <span className="text-neutral-500 font-mono">
                Target: {goalLiters} L
              </span>
            </div>
          </div>
        </div>

        {/* Right / Bottom Section: Quick Hydration Action Pills */}
        <div className="pt-2 sm:pt-0 lg:border-l lg:border-white/5 lg:pl-6 shrink-0 flex flex-col justify-center">
          <span className="text-[10px] uppercase font-semibold text-neutral-400 mb-2 block tracking-wider">
            Quick Add Intake
          </span>

          {/* 4 compact, touch-friendly, aligned buttons: 250ml, 500ml, 750ml, Custom */}
          <div className="grid grid-cols-4 sm:flex sm:flex-wrap items-center gap-1.5 xs:gap-2">
            <button
              onClick={() => onRecordIntake(250, 'quick_preset')}
              className="flex items-center justify-center gap-1 px-2.5 sm:px-3.5 py-2.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] active:bg-white/[0.12] text-white border border-white/10 hover:border-[#00D1FF]/40 text-xs font-semibold active:scale-95 transition-all touch-target sm:min-h-0 sm:min-w-0"
              title="Add 250 ml (standard glass)"
            >
              <Plus className="w-3 h-3 text-[#00D1FF] shrink-0" />
              <span className="whitespace-nowrap">250 ml</span>
            </button>

            <button
              onClick={() => onRecordIntake(500, 'quick_preset')}
              className="flex items-center justify-center gap-1 px-2.5 sm:px-3.5 py-2.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] active:bg-white/[0.12] text-white border border-white/10 hover:border-[#00D1FF]/40 text-xs font-semibold active:scale-95 transition-all touch-target sm:min-h-0 sm:min-w-0"
              title="Add 500 ml (bottle half)"
            >
              <Plus className="w-3 h-3 text-[#00D1FF] shrink-0" />
              <span className="whitespace-nowrap">500 ml</span>
            </button>

            <button
              onClick={() => onRecordIntake(750, 'quick_preset')}
              className="flex items-center justify-center gap-1 px-2.5 sm:px-3.5 py-2.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] active:bg-white/[0.12] text-white border border-white/10 hover:border-[#00D1FF]/40 text-xs font-semibold active:scale-95 transition-all touch-target sm:min-h-0 sm:min-w-0"
              title="Add 750 ml (full bottle)"
            >
              <Plus className="w-3 h-3 text-[#00D1FF] shrink-0" />
              <span className="whitespace-nowrap">750 ml</span>
            </button>

            <button
              onClick={onOpenCustomDrink}
              className="flex items-center justify-center px-2.5 sm:px-3.5 py-2.5 rounded-xl bg-[#00D1FF]/10 hover:bg-[#00D1FF]/20 active:bg-[#00D1FF]/30 text-[#00D1FF] border border-[#00D1FF]/30 text-xs font-semibold active:scale-95 transition-all touch-target sm:min-h-0 sm:min-w-0"
              title="Enter custom intake amount"
            >
              <span className="whitespace-nowrap">Custom</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

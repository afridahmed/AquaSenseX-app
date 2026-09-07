import React from 'react';
import { motion } from 'motion/react';
import { RefreshCw } from 'lucide-react';
import { TrackingMode } from '../../types';
import { HydrationTrackerCard } from './HydrationTrackerCard';

export interface CombinedBottleHydrationCardProps {
  waterLevel: number | null;
  maxCapacity?: number;
  todayConsumed: number;
  hardwareConsumed?: number;
  manualConsumed?: number;
  hydrationGoal: number;
  hydrationPercent: number;
  remainingMl: number;
  online?: boolean;
  onRecordIntake: (amountMl: number, source?: any, note?: string) => Promise<void>;
  onOpenCustomDrink: () => void;
  onRefill?: () => void;
  trackingMode?: TrackingMode;
  onToggleTrackingMode?: (mode: TrackingMode) => void;
}

export const CombinedBottleHydrationCard: React.FC<CombinedBottleHydrationCardProps> = ({
  waterLevel,
  maxCapacity = 2000,
  todayConsumed,
  hardwareConsumed,
  manualConsumed,
  hydrationGoal,
  hydrationPercent,
  remainingMl,
  online = true,
  onRecordIntake,
  onOpenCustomDrink,
  onRefill,
  trackingMode,
  onToggleTrackingMode,
}) => {
  const isLevelOffline = !online || waterLevel === null || waterLevel === undefined;

  // Normalize water level: handle both 0-100% or volume in ml
  const bottlePercent = isLevelOffline
    ? null
    : waterLevel <= 100
    ? Math.min(100, Math.max(0, Math.round(waterLevel)))
    : Math.min(100, Math.max(0, Math.round((waterLevel / maxCapacity) * 100)));

  const bottleVolumeMl = isLevelOffline
    ? null
    : waterLevel <= 100
    ? Math.round((waterLevel / 100) * maxCapacity)
    : Math.round(waterLevel);

  const bottleLiters = isLevelOffline ? null : ((bottleVolumeMl ?? 0) / 1000).toFixed(2);
  const maxCapacityLiters = (maxCapacity / 1000).toFixed(2);

  return (
    <div className="p-3.5 xs:p-4 sm:p-5 lg:p-6 rounded-[24px] sm:rounded-[28px] bg-[#10141D] border border-white/10 shadow-2xl relative overflow-hidden backdrop-blur-xl">
      {/* Subtle background ambient tint */}
      <div className="absolute top-0 right-1/4 w-80 h-36 bg-[#00D1FF]/5 rounded-full blur-3xl pointer-events-none" />

      {/* Main Responsive Grid: Bottle Visualization + Hybrid Hydration */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-4 sm:gap-5 items-center">
        {/* ================= 1. PHYSICAL BOTTLE TOF SENSOR DISPLAY ================= */}
        <div className="md:col-span-5 lg:col-span-5 flex items-center gap-3 sm:gap-4 p-3 sm:p-3.5 rounded-2xl bg-[#090C12] border border-white/5 relative shadow-inner">
          {/* Smart Bottle Silhouette Graphic */}
          <div className="relative w-14 xs:w-16 sm:w-18 h-32 xs:h-36 sm:h-40 shrink-0 flex flex-col items-center select-none">
            {/* Bottle Lid / Cap */}
            <div className="w-6 sm:w-7 h-3 rounded-t-md bg-gradient-to-r from-neutral-600 via-neutral-400 to-neutral-700 border-t border-x border-white/20 relative shadow-sm">
              <div className="absolute top-0.5 left-1/2 -translate-x-1/2 w-3.5 h-1 bg-[#00D1FF]/50 rounded-full" />
            </div>

            {/* Bottle Neck Ring */}
            <div className="w-4 sm:w-5 h-1 bg-neutral-800 border-x border-white/10" />

            {/* Bottle Glass Body with Liquid Column */}
            <div className="relative w-full flex-1 rounded-b-2xl rounded-t-md bg-gradient-to-b from-[#141A22] to-[#0A0D12] border border-white/15 overflow-hidden shadow-inner flex flex-col justify-end p-0.5">
              {/* Glass Reflection Highlight */}
              <div className="absolute inset-y-1 left-1 w-0.5 bg-gradient-to-b from-white/30 via-white/10 to-transparent rounded-full z-20 pointer-events-none" />

              {/* Water Liquid Column */}
              <motion.div
                className="w-full relative overflow-hidden rounded-b-[14px]"
                initial={{ height: 0 }}
                animate={{ height: isLevelOffline ? '0%' : `${bottlePercent}%` }}
                transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
              >
                {/* Surface Meniscus */}
                <div className="absolute top-0 inset-x-0 h-1.5 bg-gradient-to-r from-[#00D1FF] via-[#38bdf8] to-[#00A3FF] opacity-90 shadow-sm shadow-[#00D1FF]/50 z-10" />
                {/* Liquid Body Gradient */}
                <div className="w-full h-full bg-gradient-to-t from-[#0055FF] via-[#0088FF] to-[#00D1FF]/80 opacity-80" />
              </motion.div>

              {/* Empty state measurement guidelines */}
              <div className="absolute inset-y-2 right-1 flex flex-col justify-between items-end pointer-events-none opacity-25">
                <span className="w-1.5 h-0.5 bg-white rounded-full" />
                <span className="w-2.5 h-0.5 bg-white rounded-full" />
                <span className="w-1.5 h-0.5 bg-white rounded-full" />
                <span className="w-2.5 h-0.5 bg-white rounded-full" />
              </div>
            </div>
          </div>

          {/* Bottle Telemetry Text Info */}
          <div className="min-w-0 flex-1 flex flex-col justify-between py-0.5">
            <div>
              <div className="flex items-center gap-1.5 mb-1">
                <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-neutral-400">
                  Smart Bottle
                </span>
                <span
                  className={`text-[9px] font-mono px-1.5 py-0.2 rounded border ${
                    isLevelOffline
                      ? 'bg-neutral-800 text-neutral-400 border-neutral-700/60'
                      : 'bg-[#00D1FF]/10 text-[#00D1FF] border-[#00D1FF]/25'
                  }`}
                >
                  {isLevelOffline ? 'Offline' : `${bottlePercent}%`}
                </span>
              </div>

              <div className="flex items-baseline gap-1">
                <span
                  className={`text-xl xs:text-2xl sm:text-3xl font-light tracking-tight ${
                    isLevelOffline ? 'text-neutral-500' : 'text-white'
                  }`}
                >
                  {isLevelOffline ? '--' : bottleLiters}
                </span>
                {!isLevelOffline && (
                  <span className="text-xs text-neutral-400 font-normal">
                    / {maxCapacityLiters} L
                  </span>
                )}
              </div>
              <span className="text-[11px] text-neutral-400 font-mono block mt-0.5">
                {isLevelOffline
                  ? 'Time-of-Flight sensor offline'
                  : `${bottleVolumeMl} ml in flask (ToF synced)`}
              </span>
            </div>

            {/* Quick Bottle Refill Action */}
            {onRefill && (
              <div className="mt-2.5 pt-2 border-t border-white/5">
                <button
                  type="button"
                  onClick={onRefill}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] active:bg-white/[0.12] text-neutral-300 hover:text-white border border-white/10 hover:border-[#00D1FF]/40 text-[10px] sm:text-[11px] font-medium transition-all cursor-pointer active:scale-95"
                >
                  <RefreshCw className="w-3 h-3 text-[#00D1FF]" />
                  <span>Refill Flask ({maxCapacity}ml)</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* ================= 2. HYBRID DAILY HYDRATION TRACKER ================= */}
        <div className="md:col-span-7 lg:col-span-7 flex flex-col justify-between min-w-0">
          <HydrationTrackerCard
            compact={true}
            todayConsumed={todayConsumed}
            hydrationGoal={hydrationGoal}
            hydrationPercent={hydrationPercent}
            remainingMl={remainingMl}
            hardwareConsumed={hardwareConsumed}
            manualConsumed={manualConsumed}
            trackingMode={trackingMode}
            onToggleTrackingMode={onToggleTrackingMode}
            onRecordIntake={onRecordIntake}
            onOpenCustomDrink={onOpenCustomDrink}
          />
        </div>
      </div>
    </div>
  );
};

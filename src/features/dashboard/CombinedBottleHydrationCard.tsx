import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'motion/react';
import {
  Droplets,
  Plus,
  Minus,
  RefreshCw,
  Sparkles,
  Zap,
  Sliders,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

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
}

export const CombinedBottleHydrationCard: React.FC<CombinedBottleHydrationCardProps> = ({
  waterLevel,
  maxCapacity = 2000,
  todayConsumed,
  hardwareConsumed: propHardwareConsumed,
  manualConsumed: propManualConsumed,
  hydrationGoal,
  hydrationPercent,
  remainingMl,
  online = true,
  onRecordIntake,
  onOpenCustomDrink,
  onRefill,
}) => {
  const isLevelOffline = !online || waterLevel === null || waterLevel === undefined;

  // Local state for quick manual adjustment stepper value
  const [adjustStep, setAdjustStep] = useState<number>(50);
  const [isAdjusting, setIsAdjusting] = useState<boolean>(false);
  const [showManualMenu, setShowManualMenu] = useState<boolean>(false);

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

  // Fallback calculations for hardware vs manual breakdown
  const hardwareConsumed =
    propHardwareConsumed !== undefined
      ? propHardwareConsumed
      : Math.max(0, Math.round(todayConsumed * 0.6));
  const manualConsumed =
    propManualConsumed !== undefined
      ? propManualConsumed
      : Math.max(0, todayConsumed - hardwareConsumed);

  // Progress Bar Segments (Normalized to Goal)
  const hardwarePercent = Math.min(100, Math.round((hardwareConsumed / hydrationGoal) * 100));
  const manualPercent = Math.min(
    100 - hardwarePercent,
    Math.round((manualConsumed / hydrationGoal) * 100)
  );

  // Formatted Liters
  const consumedLiters = (todayConsumed / 1000).toFixed(2);
  const goalLiters = (hydrationGoal / 1000).toFixed(1);
  const remainingLiters = (Math.max(0, remainingMl) / 1000).toFixed(2);
  const isGoalAchieved = todayConsumed >= hydrationGoal;

  // Manual Adjustment Handlers (+ / -)
  const handleQuickAdd = async (amount: number, note?: string) => {
    setIsAdjusting(true);
    try {
      await onRecordIntake(amount, 'quick_preset', note || `Manual quick add ${amount}ml`);
    } finally {
      setIsAdjusting(false);
    }
  };

  const handleAdjustStep = async (direction: 'plus' | 'minus') => {
    setIsAdjusting(true);
    const amount = direction === 'plus' ? adjustStep : -adjustStep;
    try {
      await onRecordIntake(
        amount,
        'manual_add',
        `Manual adjustment (${direction === 'plus' ? '+' : '-'}${adjustStep}ml)`
      );
    } finally {
      setIsAdjusting(false);
    }
  };

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
        <div className="md:col-span-7 lg:col-span-7 flex flex-col justify-between min-w-0 space-y-3">
          {/* Header Row: Label + Target Badge */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-lg bg-[#00D1FF]/15 border border-[#00D1FF]/25 flex items-center justify-center text-[#00D1FF]">
                <Droplets className="w-3.5 h-3.5" />
              </div>
              <span className="text-xs sm:text-sm font-semibold tracking-wide text-white uppercase">
                Daily Hydration Progress
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

          {/* Primary Numbers: Consumed vs Target */}
          <div className="flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-light text-white font-sans tracking-tight">
              {consumedLiters}
            </span>
            <span className="text-xs sm:text-sm font-normal text-neutral-400">
              / {goalLiters} L Goal
            </span>
            <span className="text-xs text-neutral-500 font-mono hidden xs:inline ml-1">
              ({todayConsumed.toLocaleString()} ml)
            </span>
          </div>

          {/* Merged Dual-Segment Progress Bar (Hardware Synced + Manually Added) */}
          <div className="space-y-1.5">
            <div className="w-full h-3 rounded-full bg-[#080B10] border border-white/10 overflow-hidden p-0.5 flex relative">
              {/* Segment 1: Hardware-synced volume (ToF Sensor) in Cyan */}
              <motion.div
                className="h-full bg-gradient-to-r from-[#00D1FF] to-[#00A3FF] rounded-l-full shadow-sm shadow-[#00D1FF]/30"
                style={{ width: `${hardwarePercent}%` }}
                initial={{ width: 0 }}
                animate={{ width: `${hardwarePercent}%` }}
                transition={{ duration: 0.8, ease: 'easeOut' }}
              />
              {/* Segment 2: Manually added volume in Electric Indigo */}
              <motion.div
                className="h-full bg-gradient-to-r from-[#818CF8] to-[#A78BFA] shadow-sm shadow-[#818CF8]/30"
                style={{ width: `${manualPercent}%` }}
                initial={{ width: 0 }}
                animate={{ width: `${manualPercent}%` }}
                transition={{ duration: 0.8, ease: 'easeOut' }}
              />
            </div>

            {/* Breakdown Legend: Hardware vs Manual Sources */}
            <div className="flex flex-wrap items-center justify-between gap-2 text-[10px] sm:text-[11px] font-mono">
              <div className="flex items-center gap-3">
                {/* Hardware Volume Pill */}
                <div className="flex items-center gap-1.5 text-[#00D1FF]">
                  <span className="w-2 h-2 rounded-full bg-[#00D1FF] shadow-sm shadow-[#00D1FF]" />
                  <span>Hardware (ToF):</span>
                  <span className="font-bold text-white">{hardwareConsumed.toLocaleString()} ml</span>
                </div>

                {/* Manual Volume Pill */}
                <div className="flex items-center gap-1.5 text-[#818CF8]">
                  <span className="w-2 h-2 rounded-full bg-[#818CF8] shadow-sm shadow-[#818CF8]" />
                  <span>Manual:</span>
                  <span className="font-bold text-white">{manualConsumed.toLocaleString()} ml</span>
                </div>
              </div>

              <span className="text-neutral-400">
                {isGoalAchieved ? (
                  <span className="text-emerald-400 font-semibold">Goal Completed!</span>
                ) : (
                  `${remainingLiters} L remaining`
                )}
              </span>
            </div>
          </div>

          {/* ================= 3. MANUAL ADJUSTMENT CONTROLS ================= */}
          <div className="pt-2 border-t border-white/5 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase font-semibold text-neutral-400 tracking-wider flex items-center gap-1">
                <Sliders className="w-3 h-3 text-[#00D1FF]" />
                <span>Manual Intake Adjustments</span>
              </span>

              {/* Step Size Selector (50ml / 100ml / 250ml) */}
              <div className="flex items-center gap-1">
                {[50, 100, 250].map((step) => (
                  <button
                    key={step}
                    type="button"
                    onClick={() => setAdjustStep(step)}
                    className={`px-1.5 py-0.5 rounded text-[10px] font-mono transition-colors ${
                      adjustStep === step
                        ? 'bg-[#00D1FF]/20 text-[#00D1FF] border border-[#00D1FF]/40'
                        : 'text-neutral-400 hover:text-white'
                    }`}
                  >
                    ±{step}
                  </button>
                ))}
              </div>
            </div>

            {/* Stepper Controls & Quick Presets Bar */}
            <div className="grid grid-cols-6 gap-1.5">
              {/* Minus Stepper Button */}
              <button
                type="button"
                onClick={() => handleAdjustStep('minus')}
                disabled={isAdjusting || todayConsumed <= 0}
                className="col-span-1 flex items-center justify-center gap-1 py-2 rounded-xl bg-white/[0.04] hover:bg-rose-500/10 active:bg-rose-500/20 text-neutral-300 hover:text-rose-400 border border-white/10 hover:border-rose-500/30 text-xs font-semibold active:scale-95 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                title={`Subtract ${adjustStep} ml`}
              >
                <Minus className="w-3 h-3" />
                <span className="text-[10px] hidden xs:inline">{adjustStep}</span>
              </button>

              {/* Plus Stepper Button */}
              <button
                type="button"
                onClick={() => handleAdjustStep('plus')}
                disabled={isAdjusting}
                className="col-span-1 flex items-center justify-center gap-1 py-2 rounded-xl bg-[#00D1FF]/10 hover:bg-[#00D1FF]/20 active:bg-[#00D1FF]/30 text-[#00D1FF] border border-[#00D1FF]/30 text-xs font-semibold active:scale-95 transition-all cursor-pointer"
                title={`Add ${adjustStep} ml`}
              >
                <Plus className="w-3 h-3" />
                <span className="text-[10px] hidden xs:inline">{adjustStep}</span>
              </button>

              {/* Quick Preset: 250ml (Glass) */}
              <button
                type="button"
                onClick={() => handleQuickAdd(250, 'Glass (250ml)')}
                disabled={isAdjusting}
                className="col-span-1 flex items-center justify-center py-2 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] active:bg-white/[0.12] text-white border border-white/10 hover:border-[#00D1FF]/40 text-[11px] font-semibold active:scale-95 transition-all cursor-pointer"
                title="Add 250 ml standard glass"
              >
                +250
              </button>

              {/* Quick Preset: 500ml */}
              <button
                type="button"
                onClick={() => handleQuickAdd(500, 'Bottle (500ml)')}
                disabled={isAdjusting}
                className="col-span-1 flex items-center justify-center py-2 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] active:bg-white/[0.12] text-white border border-white/10 hover:border-[#00D1FF]/40 text-[11px] font-semibold active:scale-95 transition-all cursor-pointer"
                title="Add 500 ml bottle"
              >
                +500
              </button>

              {/* Quick Preset: 750ml */}
              <button
                type="button"
                onClick={() => handleQuickAdd(750, 'Flask (750ml)')}
                disabled={isAdjusting}
                className="col-span-1 flex items-center justify-center py-2 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] active:bg-white/[0.12] text-white border border-white/10 hover:border-[#00D1FF]/40 text-[11px] font-semibold active:scale-95 transition-all cursor-pointer"
                title="Add 750 ml full flask"
              >
                +750
              </button>

              {/* Custom Fluid Input Trigger */}
              <button
                type="button"
                onClick={onOpenCustomDrink}
                className="col-span-1 flex items-center justify-center py-2 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] active:bg-white/[0.12] text-[#00D1FF] border border-white/10 hover:border-[#00D1FF]/40 text-[11px] font-semibold active:scale-95 transition-all cursor-pointer"
                title="Enter custom intake amount"
              >
                Custom
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

import React, { useState, useId } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Droplets,
  Zap,
  Sliders,
  Plus,
  Minus,
  CheckCircle2,
  Sparkles,
  ArrowRight,
  Wifi,
  Activity,
} from 'lucide-react';
import { useBottle } from '../../context/BottleContext';
import { TrackingMode } from '../../types';

export interface HydrationTrackerCardProps {
  todayConsumed?: number;
  hydrationGoal?: number;
  hydrationPercent?: number;
  remainingMl?: number;
  hardwareConsumed?: number;
  manualConsumed?: number;
  trackingMode?: TrackingMode;
  onToggleTrackingMode?: (mode: TrackingMode) => void;
  onRecordIntake?: (amountMl: number, source?: any, note?: string) => Promise<void>;
  onOpenCustomDrink?: () => void;
  compact?: boolean;
  className?: string;
}

export const HydrationTrackerCard: React.FC<HydrationTrackerCardProps> = ({
  todayConsumed: propTodayConsumed,
  hydrationGoal: propHydrationGoal,
  hydrationPercent: propHydrationPercent,
  remainingMl: propRemainingMl,
  hardwareConsumed: propHardwareConsumed,
  manualConsumed: propManualConsumed,
  trackingMode: propTrackingMode,
  onToggleTrackingMode,
  onRecordIntake,
  onOpenCustomDrink,
  compact = false,
  className = '',
}) => {
  const bottleContext = useBottle();

  // Fallback to BottleContext values if not provided as props
  const trackingMode = propTrackingMode ?? bottleContext.trackingMode ?? 'smart_sync';
  const setTrackingMode = onToggleTrackingMode ?? bottleContext.setTrackingMode;
  const todayConsumed = propTodayConsumed ?? bottleContext.todayConsumed ?? 0;
  const hydrationGoal = propHydrationGoal ?? bottleContext.hydrationGoal ?? 2000;
  const hydrationPercent = propHydrationPercent ?? bottleContext.hydrationPercent ?? 0;
  const remainingMl = propRemainingMl ?? bottleContext.remainingMl ?? Math.max(0, hydrationGoal - todayConsumed);
  const hardwareConsumed = propHardwareConsumed ?? bottleContext.hardwareConsumed ?? 0;
  const manualConsumed = propManualConsumed ?? bottleContext.manualConsumed ?? 0;
  const recordIntake = onRecordIntake ?? bottleContext.recordIntake;

  // Local state for inline manual adjustments
  const [inlineAmount, setInlineAmount] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [adjustStep, setAdjustStep] = useState<number>(50);
  const [showInlineCustom, setShowInlineCustom] = useState<boolean>(false);

  // Liters formatting
  const consumedLiters = (todayConsumed / 1000).toFixed(2);
  const goalLiters = (hydrationGoal / 1000).toFixed(1);
  const remainingLiters = (Math.max(0, remainingMl) / 1000).toFixed(2);
  const isGoalAchieved = todayConsumed >= hydrationGoal;

  // Segments for dual progress bar (Hardware vs Manual)
  const hardwarePercent = Math.min(100, Math.round((hardwareConsumed / hydrationGoal) * 100));
  const manualPercent = Math.min(
    100 - hardwarePercent,
    Math.round((manualConsumed / hydrationGoal) * 100)
  );

  // SVG Progress Ring calculations
  const ringSize = compact ? 76 : 88;
  const strokeWidth = compact ? 6.5 : 7.5;
  const radius = (ringSize - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (Math.min(100, Math.max(0, hydrationPercent)) / 100) * circumference;
  const ringId = useId();

  // Mode toggle handler
  const handleModeChange = (mode: TrackingMode) => {
    if (mode !== trackingMode) {
      setTrackingMode(mode);
    }
  };

  // Quick Preset Add
  const handleQuickAdd = async (amount: number, label: string) => {
    setIsSubmitting(true);
    try {
      await recordIntake(amount, 'quick_preset', `Manual Quick Add: +${amount}ml (${label})`);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Stepper Add/Subtract
  const handleStepper = async (direction: 'plus' | 'minus') => {
    setIsSubmitting(true);
    const amount = direction === 'plus' ? adjustStep : -adjustStep;
    try {
      await recordIntake(
        amount,
        'manual_add',
        `Manual Stepper (${direction === 'plus' ? '+' : '-'}${adjustStep}ml)`
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  // Inline Custom Input Submit
  const handleInlineSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const val = parseInt(inlineAmount, 10);
    if (!isNaN(val) && val > 0) {
      setIsSubmitting(true);
      try {
        await recordIntake(val, 'manual_add', `Custom manual entry: +${val}ml`);
        setInlineAmount('');
        setShowInlineCustom(false);
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  return (
    <div
      className={`relative overflow-hidden transition-all duration-300 ${
        compact
          ? 'w-full'
          : 'p-4 xs:p-5 sm:p-6 lg:p-7 rounded-[24px] sm:rounded-[32px] bg-[#10141D] border border-white/10 shadow-2xl backdrop-blur-xl'
      } ${className}`}
    >
      {/* Subtle ambient cyan glow */}
      {!compact && (
        <div className="absolute top-0 right-1/4 w-80 h-36 bg-[#00D1FF]/5 rounded-full blur-3xl pointer-events-none" />
      )}

      <div className="flex flex-col space-y-4">
        {/* ================= 1. HEADER & GLASSMORPHIC MODE TOGGLE ================= */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-3">
          {/* Section Title + Status Badge */}
          <div className="flex items-center justify-between sm:justify-start gap-2 min-w-0">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-lg bg-[#00D1FF]/15 border border-[#00D1FF]/25 flex items-center justify-center text-[#00D1FF] shrink-0">
                <Droplets className="w-3.5 h-3.5" />
              </div>
              <span className="text-xs sm:text-sm font-semibold tracking-wide text-white uppercase truncate">
                Daily Hydration Tracker
              </span>
            </div>

            <span
              className={`text-[10px] sm:text-xs font-semibold px-2 py-0.5 rounded-full border shrink-0 ${
                isGoalAchieved
                  ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                  : 'bg-[#00D1FF]/10 text-[#00D1FF] border-[#00D1FF]/20'
              }`}
            >
              {isGoalAchieved ? '✓ Target Achieved' : `${hydrationPercent}% of Goal`}
            </span>
          </div>

          {/* Glassmorphic Auto/Manual Tracking Mode Toggle Switch */}
          <div
            className="inline-flex items-center p-1 rounded-2xl bg-[#090C12]/90 border border-white/10 shadow-inner backdrop-blur-xl self-start sm:self-auto shrink-0 w-full sm:w-auto"
            role="group"
            aria-label="Tracking Mode Toggle"
          >
            {/* Smart Sync (Auto) Option */}
            <button
              type="button"
              onClick={() => handleModeChange('smart_sync')}
              className={`flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-semibold transition-all duration-200 cursor-pointer select-none relative ${
                trackingMode === 'smart_sync'
                  ? 'bg-gradient-to-r from-[#00D1FF]/20 to-[#00A3FF]/15 text-[#00D1FF] border border-[#00D1FF]/40 shadow-sm shadow-[#00D1FF]/25 font-bold'
                  : 'text-neutral-400 hover:text-white border border-transparent'
              }`}
              title="Auto Mode: Consumed volume increments automatically from physical bottle drops"
            >
              <Zap
                className={`w-3.5 h-3.5 ${
                  trackingMode === 'smart_sync' ? 'text-[#00D1FF] animate-pulse' : 'text-neutral-500'
                }`}
              />
              <span>Smart Sync</span>
              {trackingMode === 'smart_sync' && (
                <span className="w-1.5 h-1.5 rounded-full bg-[#00D1FF] shadow-xs shadow-[#00D1FF]" />
              )}
            </button>

            {/* Manual Track Option */}
            <button
              type="button"
              onClick={() => handleModeChange('manual')}
              className={`flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-semibold transition-all duration-200 cursor-pointer select-none relative ${
                trackingMode === 'manual'
                  ? 'bg-gradient-to-r from-[#818CF8]/25 to-[#A78BFA]/20 text-[#A78BFA] border border-[#818CF8]/40 shadow-sm shadow-[#818CF8]/25 font-bold'
                  : 'text-neutral-400 hover:text-white border border-transparent'
              }`}
              title="Manual Mode: Disconnect hardware delta-tracking and log water intake manually"
            >
              <Sliders
                className={`w-3.5 h-3.5 ${
                  trackingMode === 'manual' ? 'text-[#A78BFA]' : 'text-neutral-500'
                }`}
              />
              <span>Manual Track</span>
              {trackingMode === 'manual' && (
                <span className="w-1.5 h-1.5 rounded-full bg-[#A78BFA] shadow-xs shadow-[#A78BFA]" />
              )}
            </button>
          </div>
        </div>

        {/* ================= 2. PRIMARY HYDRATION METRIC & PROGRESS RING ================= */}
        <div className="flex items-center gap-4 sm:gap-5 p-3 sm:p-3.5 rounded-2xl bg-[#090C12]/70 border border-white/5 shadow-inner">
          {/* Sleek SVG Progress Ring (Distinct from rectangular physical bottle gauge) */}
          <div className="relative shrink-0 flex items-center justify-center">
            <svg width={ringSize} height={ringSize} className="-rotate-90">
              <defs>
                <linearGradient id={`grad-${ringId}`} x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#00D1FF" />
                  <stop offset="50%" stopColor="#00A3FF" />
                  <stop offset="100%" stopColor={isGoalAchieved ? '#10B981' : '#0077FF'} />
                </linearGradient>
              </defs>
              {/* Background Track Circle */}
              <circle
                cx={ringSize / 2}
                cy={ringSize / 2}
                r={radius}
                fill="transparent"
                stroke="rgba(255, 255, 255, 0.08)"
                strokeWidth={strokeWidth}
              />
              {/* Animated Glowing Progress Arc */}
              <motion.circle
                cx={ringSize / 2}
                cy={ringSize / 2}
                r={radius}
                fill="transparent"
                stroke={`url(#grad-${ringId})`}
                strokeWidth={strokeWidth}
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
                strokeLinecap="round"
                initial={{ strokeDashoffset: circumference }}
                animate={{ strokeDashoffset }}
                transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
              />
            </svg>

            {/* Inner Ring Percentage Label */}
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center select-none pointer-events-none">
              <span className="text-xs sm:text-sm font-bold text-white tracking-tight">
                {hydrationPercent}%
              </span>
              <span className="text-[9px] text-neutral-400 font-medium tracking-tight uppercase">
                Goal
              </span>
            </div>
          </div>

          {/* Liters & Progress Summary Cluster */}
          <div className="flex-1 min-w-0">
            <div className="flex items-baseline gap-1.5 sm:gap-2">
              <span className="text-2xl sm:text-3xl font-light text-white font-sans tracking-tight">
                {consumedLiters}
              </span>
              <span className="text-xs sm:text-sm font-normal text-neutral-400">
                / {goalLiters} L Goal
              </span>
              <span className="text-[11px] text-neutral-500 font-mono hidden xs:inline ml-1">
                ({todayConsumed.toLocaleString()} ml)
              </span>
            </div>

            {/* Linear Dual-Segment Progress Bar */}
            <div className="mt-2 space-y-1">
              <div className="w-full h-2.5 sm:h-3 rounded-full bg-[#080B10] border border-white/10 overflow-hidden p-0.5 flex relative">
                {/* Segment 1: Hardware ToF Synced volume in Cyan */}
                <motion.div
                  className="h-full bg-gradient-to-r from-[#00D1FF] to-[#00A3FF] rounded-l-full shadow-xs shadow-[#00D1FF]/40"
                  style={{ width: `${hardwarePercent}%` }}
                  initial={{ width: 0 }}
                  animate={{ width: `${hardwarePercent}%` }}
                  transition={{ duration: 0.8, ease: 'easeOut' }}
                />
                {/* Segment 2: Manually added volume in Electric Indigo */}
                <motion.div
                  className="h-full bg-gradient-to-r from-[#818CF8] to-[#A78BFA] shadow-xs shadow-[#818CF8]/40"
                  style={{ width: `${manualPercent}%` }}
                  initial={{ width: 0 }}
                  animate={{ width: `${manualPercent}%` }}
                  transition={{ duration: 0.8, ease: 'easeOut' }}
                />
              </div>

              {/* Sub-label showing remaining and breakdown */}
              <div className="flex items-center justify-between text-[10px] sm:text-[11px] text-neutral-400 font-mono">
                <span className={isGoalAchieved ? 'text-emerald-400 font-semibold' : 'text-neutral-300'}>
                  {isGoalAchieved ? 'Daily goal completed!' : `${remainingLiters} L remaining`}
                </span>
                <span className="text-neutral-500">
                  Target: {goalLiters}L
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* ================= 3. MODE-DEPENDENT DYNAMIC CONTROL SECTION ================= */}
        <AnimatePresence mode="wait">
          {trackingMode === 'smart_sync' ? (
            /* ─────────────────────────────────────────────────────────────
               AUTO MODE (SMART SYNC) ACTIVE
               - Shows delta-tracking live telemetry status
               - Informs user that fluid consumption automatically registers
               ───────────────────────────────────────────────────────────── */
            <motion.div
              key="auto-mode-info"
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.2 }}
              className="p-2.5 sm:p-3 rounded-xl bg-gradient-to-r from-[#00D1FF]/10 via-[#00A3FF]/5 to-transparent border border-[#00D1FF]/20 flex flex-col xs:flex-row xs:items-center justify-between gap-2 text-xs"
            >
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-2 h-2 rounded-full bg-[#00D1FF] shadow-sm shadow-[#00D1FF] shrink-0 animate-ping" />
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="font-semibold text-white text-[11px] sm:text-xs">
                      Smart Sync Active
                    </span>
                    <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-[#00D1FF]/15 text-[#00D1FF] border border-[#00D1FF]/30">
                      Delta ToF Engaged
                    </span>
                  </div>
                  <p className="text-[10px] sm:text-[11px] text-neutral-400 truncate">
                    Consumption registers automatically as water level drops in your smart flask.
                  </p>
                </div>
              </div>

              {/* Breakdown metrics pill */}
              <div className="flex items-center gap-2 shrink-0 text-[10px] font-mono self-end xs:self-auto">
                <span className="text-[#00D1FF]">
                  ToF: <b className="text-white">{hardwareConsumed}ml</b>
                </span>
                <span className="text-neutral-600">•</span>
                <span className="text-[#818CF8]">
                  Manual: <b className="text-white">{manualConsumed}ml</b>
                </span>
              </div>
            </motion.div>
          ) : (
            /* ─────────────────────────────────────────────────────────────
               MANUAL MODE ACTIVE
               - Delta tracking disconnected from daily total
               - Compact manual controls: +200ml, +400ml, +600ml, custom input
               ───────────────────────────────────────────────────────────── */
            <motion.div
              key="manual-mode-controls"
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.2 }}
              className="space-y-2.5"
            >
              {/* Mode Status Header */}
              <div className="flex items-center justify-between px-0.5">
                <div className="flex items-center gap-1.5 text-[10px] sm:text-[11px] font-semibold uppercase tracking-wider text-[#A78BFA]">
                  <Sliders className="w-3 h-3" />
                  <span>Manual Intake Controls</span>
                  <span className="text-[9px] font-mono text-neutral-400 lowercase font-normal hidden xs:inline">
                    (delta-sync paused)
                  </span>
                </div>

                {/* Step Size Selector (±50 / ±100 / ±250) */}
                <div className="flex items-center gap-1">
                  {[50, 100, 250].map((step) => (
                    <button
                      key={step}
                      type="button"
                      onClick={() => setAdjustStep(step)}
                      className={`px-1.5 py-0.5 rounded text-[9px] sm:text-[10px] font-mono transition-colors cursor-pointer ${
                        adjustStep === step
                          ? 'bg-[#818CF8]/25 text-[#A78BFA] border border-[#818CF8]/40'
                          : 'text-neutral-400 hover:text-white'
                      }`}
                    >
                      ±{step}
                    </button>
                  ))}
                </div>
              </div>

              {/* Compact Quick-Add & Stepper Grid */}
              <div className="grid grid-cols-6 gap-1.5">
                {/* Stepper Minus */}
                <button
                  type="button"
                  onClick={() => handleStepper('minus')}
                  disabled={isSubmitting || todayConsumed <= 0}
                  className="col-span-1 flex items-center justify-center gap-1 py-2 rounded-xl bg-white/[0.04] hover:bg-rose-500/10 active:bg-rose-500/20 text-neutral-300 hover:text-rose-400 border border-white/10 hover:border-rose-500/30 text-xs font-semibold active:scale-95 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                  title={`Subtract ${adjustStep}ml`}
                >
                  <Minus className="w-3 h-3" />
                  <span className="text-[10px] hidden xs:inline">{adjustStep}</span>
                </button>

                {/* Stepper Plus */}
                <button
                  type="button"
                  onClick={() => handleStepper('plus')}
                  disabled={isSubmitting}
                  className="col-span-1 flex items-center justify-center gap-1 py-2 rounded-xl bg-[#818CF8]/10 hover:bg-[#818CF8]/20 active:bg-[#818CF8]/30 text-[#A78BFA] border border-[#818CF8]/30 text-xs font-semibold active:scale-95 transition-all cursor-pointer"
                  title={`Add ${adjustStep}ml`}
                >
                  <Plus className="w-3 h-3" />
                  <span className="text-[10px] hidden xs:inline">{adjustStep}</span>
                </button>

                {/* Quick Add: + 200ml (Requirement: "+ 200ml") */}
                <button
                  type="button"
                  onClick={() => handleQuickAdd(200, 'Cup')}
                  disabled={isSubmitting}
                  className="col-span-1 flex items-center justify-center py-2 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] active:bg-white/[0.12] text-white border border-white/10 hover:border-[#00D1FF]/40 text-[11px] font-semibold active:scale-95 transition-all cursor-pointer"
                  title="Add 200 ml standard cup"
                >
                  +200
                </button>

                {/* Quick Add: + 400ml (Requirement: "+ 400ml") */}
                <button
                  type="button"
                  onClick={() => handleQuickAdd(400, 'Mug')}
                  disabled={isSubmitting}
                  className="col-span-1 flex items-center justify-center py-2 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] active:bg-white/[0.12] text-white border border-white/10 hover:border-[#00D1FF]/40 text-[11px] font-semibold active:scale-95 transition-all cursor-pointer"
                  title="Add 400 ml mug"
                >
                  +400
                </button>

                {/* Quick Add: + 600ml */}
                <button
                  type="button"
                  onClick={() => handleQuickAdd(600, 'Flask')}
                  disabled={isSubmitting}
                  className="col-span-1 flex items-center justify-center py-2 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] active:bg-white/[0.12] text-white border border-white/10 hover:border-[#00D1FF]/40 text-[11px] font-semibold active:scale-95 transition-all cursor-pointer"
                  title="Add 600 ml sports bottle"
                >
                  +600
                </button>

                {/* Custom Input Toggle Button */}
                <button
                  type="button"
                  onClick={() => setShowInlineCustom((prev) => !prev)}
                  className={`col-span-1 flex items-center justify-center py-2 rounded-xl border text-[11px] font-semibold active:scale-95 transition-all cursor-pointer ${
                    showInlineCustom
                      ? 'bg-[#00D1FF]/20 text-[#00D1FF] border-[#00D1FF]/50'
                      : 'bg-white/[0.04] hover:bg-white/[0.08] text-[#00D1FF] border-white/10 hover:border-[#00D1FF]/40'
                  }`}
                  title="Type custom ml amount"
                >
                  Custom
                </button>
              </div>

              {/* Inline Custom Amount Input Form (Revealed when Custom is clicked) */}
              <AnimatePresence>
                {showInlineCustom && (
                  <motion.form
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.2 }}
                    onSubmit={handleInlineSubmit}
                    className="flex items-center gap-2 pt-1"
                  >
                    <div className="relative flex-1">
                      <input
                        type="number"
                        min="10"
                        max="3000"
                        step="10"
                        value={inlineAmount}
                        onChange={(e) => setInlineAmount(e.target.value)}
                        placeholder="Amount in ml (e.g. 350)"
                        className="w-full px-3 py-1.5 rounded-xl bg-[#090C12] border border-white/15 text-white placeholder-neutral-500 text-xs font-mono focus:outline-none focus:border-[#00D1FF] focus:ring-1 focus:ring-[#00D1FF]"
                        autoFocus
                      />
                      <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] text-neutral-500 font-mono">
                        ml
                      </span>
                    </div>

                    <button
                      type="submit"
                      disabled={isSubmitting || !inlineAmount || parseInt(inlineAmount, 10) <= 0}
                      className="px-3.5 py-1.5 rounded-xl bg-[#00D1FF] hover:bg-[#00D1FF]/90 active:bg-[#00A3FF] text-[#090B0E] text-xs font-bold transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed shadow-sm shadow-[#00D1FF]/30 active:scale-95 shrink-0"
                    >
                      Add
                    </button>

                    {onOpenCustomDrink && (
                      <button
                        type="button"
                        onClick={onOpenCustomDrink}
                        className="px-2.5 py-1.5 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] text-neutral-400 hover:text-white text-xs transition-colors cursor-pointer shrink-0"
                        title="Open detailed intake logger"
                      >
                        Modal
                      </button>
                    )}
                  </motion.form>
                )}
              </AnimatePresence>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

import React, { useState } from 'react';
import { useBottle } from '../../context/BottleContext';
import { useAuth } from '../../context/AuthContext';
import { Header } from '../../components/common/Header';
import { WaterStatusCircle } from '../../components/common/WaterStatusCircle';
import { FluidVisualizer } from '../../components/common/FluidVisualizer';
import { SensorMetricCard } from '../../components/common/SensorMetricCard';
import {
  Sparkles,
  Plus,
  BookmarkPlus,
  Share2,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  TrendingUp,
  MapPin,
  X,
  Bot,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { NavTab } from '../../types';

interface DashboardScreenProps {
  onNavigateToTab?: (tab: NavTab) => void;
  onPublishToCommunity?: (readingData: any) => void;
}

export const DashboardScreen: React.FC<DashboardScreenProps> = ({
  onNavigateToTab,
  onPublishToCommunity,
}) => {
  const {
    bottle,
    qualityEval,
    todayConsumed,
    hydrationGoal,
    hydrationPercent,
    remainingMl,
    aiTip,
    recordIntake,
    recordSensorReading,
    simulateRefill,
    refreshAiTip,
  } = useBottle();

  const { user } = useAuth();

  const [isRecordModalOpen, setIsRecordModalOpen] = useState<boolean>(false);
  const [recordNotes, setRecordNotes] = useState<string>('');
  const [publishToMap, setPublishToMap] = useState<boolean>(false);
  const [sourceName, setSourceName] = useState<string>('Home Filtration Station');
  const [isSavingRecord, setIsSavingRecord] = useState<boolean>(false);
  const [recordSuccess, setRecordSuccess] = useState<boolean>(false);

  // Custom drink log modal
  const [isCustomDrinkOpen, setIsCustomDrinkOpen] = useState<boolean>(false);
  const [customAmount, setCustomAmount] = useState<number>(300);

  const handleSaveReading = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingRecord(true);
    try {
      const reading = await recordSensorReading(recordNotes);

      if (publishToMap && onPublishToCommunity) {
        onPublishToCommunity({
          sourceName,
          qualityScore: qualityEval.score,
          temperature: bottle?.temperature || 21,
          tds: bottle?.tds || 180,
          turbidity: bottle?.turbidity || 0.4,
          ph: bottle?.ph || 7.2,
          notes: recordNotes,
        });
      }

      setRecordSuccess(true);
      setTimeout(() => {
        setRecordSuccess(false);
        setIsRecordModalOpen(false);
        setRecordNotes('');
      }, 1200);
    } catch (err) {
      console.error('Error recording reading:', err);
    } finally {
      setIsSavingRecord(false);
    }
  };

  const handleLogCustomDrink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (customAmount > 0) {
      await recordIntake(customAmount, 'manual_add', 'Logged via custom intake');
      setIsCustomDrinkOpen(false);
    }
  };

  return (
    <div className="min-h-full bg-[#090B0E] text-[#F8FAFC] flex flex-col transition-colors duration-200">
      <Header
        title="AquaSense X"
        subtitle={`Live monitoring • ${bottle?.bottleId || 'ASX-9821-4402'}`}
      />

      <div className="p-3.5 xs:p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full space-y-4 sm:space-y-6">
        {/* Top Hero Status Grid - Bento Style */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 sm:gap-6 items-stretch">
          {/* Main Water Quality Gauge Column (7 cols on md+) */}
          <div className="md:col-span-6 lg:col-span-7 flex flex-col">
            <WaterStatusCircle evaluation={qualityEval} online={bottle?.online} />
          </div>

          {/* Fluid Visualizer & Quick Hydration Progress (5 cols on md+) */}
          <div className="md:col-span-6 lg:col-span-5 flex flex-col">
            <FluidVisualizer
              currentMl={bottle?.waterLevel ?? 640}
              maxCapacity={bottle?.maxCapacity ?? 750}
              onDrink={(amt) => recordIntake(amt, 'bottle_auto')}
              onRefill={simulateRefill}
            />
          </div>
        </div>

        {/* AI Personalized Hydration Insight Banner */}
        <div className="p-4 sm:p-5 lg:p-6 rounded-[24px] sm:rounded-[28px] bg-gradient-to-r from-[#00D1FF]/10 via-[#12161C] to-[#0077FF]/10 border border-[#00D1FF]/25 relative overflow-hidden flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3.5 sm:gap-4 shadow-xl">
          <div className="flex items-start gap-3 sm:gap-3.5 min-w-0">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-2xl bg-[#00D1FF]/15 border border-[#00D1FF]/30 flex items-center justify-center shrink-0 shadow-sm shadow-[#00D1FF]/10">
              <Sparkles className="w-4 h-4 sm:w-5 sm:h-5 text-[#00D1FF]" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-[#00D1FF]">
                  AI Sensor Synthesis
                </span>
                <span className="text-[9px] sm:text-[10px] text-neutral-400 font-mono">Live Telemetry</span>
              </div>
              <p className="text-xs sm:text-sm text-neutral-200 mt-0.5 leading-relaxed">
                {aiTip}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto shrink-0 justify-end pt-1 sm:pt-0">
            <button
              onClick={() => refreshAiTip()}
              title="Refresh AI tip"
              className="p-2.5 rounded-xl bg-white/[0.05] border border-white/10 hover:bg-white/[0.1] text-neutral-400 hover:text-white transition-colors touch-target sm:min-h-0 sm:min-w-0 flex items-center justify-center"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
            {onNavigateToTab && (
              <button
                onClick={() => onNavigateToTab('coach')}
                className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#00D1FF]/15 hover:bg-[#00D1FF]/25 border border-[#00D1FF]/30 text-xs font-semibold text-[#00D1FF] transition-all touch-target sm:min-h-0 sm:min-w-0"
              >
                <Bot className="w-4 h-4" />
                <span>Ask Coach</span>
              </button>
            )}
          </div>
        </div>

        {/* Live Sensor Metrics Grid (4 Core Sensors) */}
        <div>
          <div className="flex items-center justify-between mb-2.5 sm:mb-3 px-1">
            <h2 className="text-[11px] sm:text-xs font-semibold tracking-wider text-neutral-400 uppercase">
              Live Sensor Telemetry
            </h2>
            <span className="text-[11px] sm:text-xs text-neutral-400">
              {bottle?.online ? 'Synchronized live' : 'Cached offline data'}
            </span>
          </div>

          {/* 1 col on xs/mobile, 2 col on tablet, 4 col on desktop */}
          <div className="grid grid-cols-1 xs:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            <SensorMetricCard
              type="ph"
              detail={qualityEval.parameters.ph}
              online={bottle?.online}
            />
            <SensorMetricCard
              type="tds"
              detail={qualityEval.parameters.tds}
              online={bottle?.online}
            />
            <SensorMetricCard
              type="turbidity"
              detail={qualityEval.parameters.turbidity}
              online={bottle?.online}
            />
            <SensorMetricCard
              type="temperature"
              detail={qualityEval.parameters.temperature}
              online={bottle?.online}
            />
          </div>
        </div>

        {/* Hydration Tracking & Actions Card */}
        <div className="p-4 xs:p-5 sm:p-7 rounded-[24px] sm:rounded-[32px] bg-[#12161C] border border-white/5 shadow-2xl">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 sm:pb-5 border-b border-white/5">
            <div>
              <span className="text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-neutral-400 block mb-1">
                Daily Hydration Tracker
              </span>
              <div className="flex flex-wrap items-baseline gap-2">
                <span className="text-2xl sm:text-3xl font-light text-white font-sans">
                  {todayConsumed.toLocaleString()}
                </span>
                <span className="text-xs sm:text-sm text-neutral-400">/ {hydrationGoal.toLocaleString()} ml</span>
                <span className="text-[10px] sm:text-xs font-semibold text-[#00D1FF] px-2.5 py-0.5 rounded-full bg-[#00D1FF]/10 border border-[#00D1FF]/20">
                  {hydrationPercent}% Goal
                </span>
              </div>
            </div>

            {/* Touch-Friendly Action Buttons */}
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => recordIntake(250, 'quick_preset')}
                className="flex-1 xs:flex-none flex items-center justify-center gap-1 px-3.5 py-2.5 rounded-2xl bg-white/[0.04] hover:bg-white/[0.08] text-white border border-white/10 text-xs font-medium active:scale-95 transition-all touch-target sm:min-h-0 sm:min-w-0"
              >
                <Plus className="w-3.5 h-3.5 text-[#00D1FF]" />
                <span>+250 ml</span>
              </button>
              <button
                onClick={() => recordIntake(500, 'quick_preset')}
                className="flex-1 xs:flex-none flex items-center justify-center gap-1 px-3.5 py-2.5 rounded-2xl bg-white/[0.04] hover:bg-white/[0.08] text-white border border-white/10 text-xs font-medium active:scale-95 transition-all touch-target sm:min-h-0 sm:min-w-0"
              >
                <Plus className="w-3.5 h-3.5 text-[#00D1FF]" />
                <span>+500 ml</span>
              </button>
              <button
                onClick={() => setIsCustomDrinkOpen(true)}
                className="px-3.5 py-2.5 rounded-2xl bg-white/[0.04] hover:bg-white/[0.08] text-neutral-300 hover:text-white border border-white/10 text-xs font-medium active:scale-95 transition-all touch-target sm:min-h-0 sm:min-w-0"
              >
                Custom
              </button>
              <button
                onClick={() => setIsRecordModalOpen(true)}
                className="w-full sm:w-auto flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-2xl bg-[#00D1FF] hover:bg-[#00B4D8] text-[#090B0E] text-xs font-semibold shadow-lg shadow-[#00D1FF]/20 active:scale-95 transition-all touch-target sm:min-h-0 sm:min-w-0"
              >
                <BookmarkPlus className="w-4 h-4" />
                <span>Record Reading</span>
              </button>
            </div>
          </div>

          {/* Progress Track Bar */}
          <div className="mt-4 sm:mt-5">
            <div className="w-full h-3 rounded-full bg-[#090B0E] border border-white/10 overflow-hidden p-0.5">
              <motion.div
                className="h-full rounded-full bg-gradient-to-r from-[#00D1FF] to-[#0077FF] shadow-sm shadow-[#00D1FF]/30"
                initial={{ width: 0 }}
                animate={{ width: `${Math.min(100, hydrationPercent)}%` }}
                transition={{ duration: 0.8, ease: 'easeOut' }}
              />
            </div>
            <div className="flex justify-between text-[11px] sm:text-xs text-neutral-400 mt-2">
              <span>{remainingMl > 0 ? `${remainingMl} ml remaining` : 'Daily Goal Achieved! 🎉'}</span>
              <span>Target: {hydrationGoal} ml</span>
            </div>
          </div>
        </div>
      </div>

      {/* Record Reading Modal / Responsive Bottom Sheet */}
      <AnimatePresence>
        {isRecordModalOpen && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/80 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              className="w-full sm:max-w-lg bg-[#12161C] border-t sm:border border-white/10 rounded-t-[28px] sm:rounded-[32px] p-5 sm:p-7 shadow-2xl relative max-h-[90vh] overflow-y-auto safe-area-pb"
            >
              <div className="flex items-center justify-between pb-3.5 border-b border-white/10">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-[#00D1FF]/10 border border-[#00D1FF]/20 flex items-center justify-center">
                    <BookmarkPlus className="w-4 h-4 text-[#00D1FF]" />
                  </div>
                  <h3 className="text-sm sm:text-base font-semibold text-white">Record Sensor Reading</h3>
                </div>
                <button
                  onClick={() => setIsRecordModalOpen(false)}
                  className="p-1.5 rounded-xl text-neutral-400 hover:text-white hover:bg-white/5"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {recordSuccess ? (
                <div className="py-8 text-center">
                  <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto mb-2" />
                  <p className="text-base font-medium text-white">Reading Recorded Successfully!</p>
                  <p className="text-xs text-neutral-400 mt-1">Saved to your AquaSense bottle history.</p>
                </div>
              ) : (
                <form onSubmit={handleSaveReading} className="mt-4 space-y-4">
                  {/* Current Snapshot preview */}
                  <div className="p-3.5 rounded-2xl bg-[#090B0E] border border-white/5 grid grid-cols-4 gap-2 text-center text-xs">
                    <div>
                      <span className="text-neutral-500 block text-[9px]">SCORE</span>
                      <span className="font-semibold text-[#00D1FF]">{qualityEval.score}/100</span>
                    </div>
                    <div>
                      <span className="text-neutral-500 block text-[9px]">pH</span>
                      <span className="font-semibold text-white">{bottle?.ph}</span>
                    </div>
                    <div>
                      <span className="text-neutral-500 block text-[9px]">TDS</span>
                      <span className="font-semibold text-white">{bottle?.tds} ppm</span>
                    </div>
                    <div>
                      <span className="text-neutral-500 block text-[9px]">TURBIDITY</span>
                      <span className="font-semibold text-white">{bottle?.turbidity} NTU</span>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs text-neutral-300 font-medium mb-1.5">
                      Water Source Description (Optional)
                    </label>
                    <input
                      type="text"
                      value={sourceName}
                      onChange={(e) => setSourceName(e.target.value)}
                      placeholder="e.g. Office Kitchen RO Filter"
                      className="w-full bg-[#090B0E] border border-white/10 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-[#00D1FF]/50"
                    />
                  </div>

                  <div>
                    <label className="block text-xs text-neutral-300 font-medium mb-1.5">
                      Personal Tasting / Filtration Notes
                    </label>
                    <textarea
                      value={recordNotes}
                      onChange={(e) => setRecordNotes(e.target.value)}
                      placeholder="e.g., Ice cold, crisp mineral profile, no chlorine odor."
                      rows={3}
                      className="w-full bg-[#090B0E] border border-white/10 rounded-xl p-3 text-xs sm:text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-[#00D1FF]/50 resize-none"
                    />
                  </div>

                  {/* Publish to community map checkbox */}
                  <label className="flex items-center gap-3 p-3 rounded-2xl bg-white/[0.02] border border-white/5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={publishToMap}
                      onChange={(e) => setPublishToMap(e.target.checked)}
                      className="rounded accent-[#00D1FF] w-4 h-4"
                    />
                    <span className="text-xs text-neutral-300">
                      Share this verified reading anonymously with the AquaSense Community Map
                    </span>
                  </label>

                  <div className="flex gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setIsRecordModalOpen(false)}
                      className="flex-1 py-3 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] text-xs font-medium text-neutral-300"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={isSavingRecord}
                      className="flex-1 py-3 rounded-xl bg-[#00D1FF] hover:bg-[#00B4D8] text-[#090B0E] text-xs font-semibold disabled:opacity-50 transition-colors"
                    >
                      {isSavingRecord ? 'Saving...' : 'Save Reading'}
                    </button>
                  </div>
                </form>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Custom Drink Log Modal / Bottom Sheet */}
      <AnimatePresence>
        {isCustomDrinkOpen && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/80 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              className="w-full sm:max-w-md bg-[#12161C] border-t sm:border border-white/10 rounded-t-[28px] sm:rounded-[32px] p-5 sm:p-6 shadow-2xl relative safe-area-pb"
            >
              <div className="flex items-center justify-between pb-3 border-b border-white/10">
                <h3 className="text-sm sm:text-base font-semibold text-white">Log Custom Intake</h3>
                <button
                  onClick={() => setIsCustomDrinkOpen(false)}
                  className="p-1 rounded-lg text-neutral-400 hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleLogCustomDrink} className="mt-4 space-y-4">
                <div>
                  <label className="block text-xs text-neutral-400 mb-1">Fluid Intake Amount (ml)</label>
                  <div className="flex items-center gap-3">
                    <input
                      type="number"
                      min={50}
                      max={2000}
                      step={25}
                      value={customAmount}
                      onChange={(e) => setCustomAmount(parseInt(e.target.value) || 0)}
                      className="flex-1 bg-[#090B0E] border border-white/10 rounded-xl px-4 py-3 text-lg font-light text-white focus:outline-none focus:border-[#00D1FF]"
                    />
                    <span className="text-sm font-medium text-neutral-400">ml</span>
                  </div>
                </div>

                <div className="grid grid-cols-4 gap-2">
                  {[100, 200, 350, 600].map((val) => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => setCustomAmount(val)}
                      className={`py-2 rounded-xl text-xs font-medium border transition-colors ${
                        customAmount === val
                          ? 'bg-[#00D1FF]/20 border-[#00D1FF] text-[#00D1FF]'
                          : 'bg-white/[0.04] border-white/10 text-neutral-300'
                      }`}
                    >
                      {val} ml
                    </button>
                  ))}
                </div>

                <button
                  type="submit"
                  className="w-full py-3 rounded-xl bg-[#00D1FF] hover:bg-[#00B4D8] text-[#090B0E] font-semibold text-xs transition-colors"
                >
                  Log {customAmount} ml Intake
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

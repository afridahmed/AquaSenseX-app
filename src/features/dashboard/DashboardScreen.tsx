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
    <div className="min-h-full bg-[#0A0A0A] text-[#F5F5F5] flex flex-col">
      <Header
        title="AquaSense X"
        subtitle={`Live monitoring for ${bottle?.bottleId || 'ASX-9821-4402'}`}
      />

      <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full space-y-6">
        {/* Top Hero Status Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
          {/* Main Water Quality Gauge Column (7 cols on lg) */}
          <div className="lg:col-span-7 flex flex-col justify-between">
            <WaterStatusCircle evaluation={qualityEval} online={bottle?.online} />
          </div>

          {/* Fluid Visualizer & Quick Hydration Progress (5 cols on lg) */}
          <div className="lg:col-span-5 flex flex-col gap-6">
            <FluidVisualizer
              currentMl={bottle?.waterLevel ?? 640}
              maxCapacity={bottle?.maxCapacity ?? 750}
              onDrink={(amt) => recordIntake(amt, 'bottle_auto')}
              onRefill={simulateRefill}
            />
          </div>
        </div>

        {/* AI Personalized Hydration Insight Banner */}
        <div className="p-5 rounded-[28px] bg-gradient-to-r from-[#00D1FF]/10 via-[#141414] to-[#0077FF]/10 border border-[#00D1FF]/30 relative overflow-hidden flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-xl">
          <div className="flex items-start sm:items-center gap-3.5">
            <div className="w-10 h-10 rounded-2xl bg-[#00D1FF]/10 border border-[#00D1FF]/30 flex items-center justify-center shrink-0 shadow-sm shadow-[#00D1FF]/10">
              <Sparkles className="w-5 h-5 text-[#00D1FF]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-[#00D1FF]">
                  AI Hydration Guidance
                </span>
                <span className="text-[10px] text-[#888888] font-mono">Live Telemetry</span>
              </div>
              <p className="text-xs sm:text-sm text-[#F5F5F5] mt-0.5 leading-relaxed max-w-2xl">
                {aiTip}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto shrink-0 justify-end">
            <button
              onClick={() => refreshAiTip()}
              title="Refresh AI tip"
              className="p-2.5 rounded-xl bg-[#1E1E1E] border border-white/10 hover:bg-[#252525] text-[#888888] hover:text-white transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
            {onNavigateToTab && (
              <button
                onClick={() => onNavigateToTab('coach')}
                className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#00D1FF]/15 hover:bg-[#00D1FF]/25 border border-[#00D1FF]/30 text-xs font-semibold text-[#00D1FF] transition-all"
              >
                <Bot className="w-4 h-4" />
                <span>Ask Coach</span>
              </button>
            )}
          </div>
        </div>

        {/* Live Sensor Metrics Grid (4 Core Sensors) */}
        <div>
          <div className="flex items-center justify-between mb-3 px-1">
            <h2 className="text-xs font-semibold tracking-wider text-[#888888] uppercase">
              Live Sensor Telemetry
            </h2>
            <span className="text-xs text-[#888888]">
              {bottle?.online ? 'Updated just now' : 'Offline (Stored Data)'}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
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
        <div className="p-6 sm:p-7 rounded-[32px] bg-[#141414] border border-[#222222] shadow-2xl">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-[#1E1E1E]">
            <div>
              <span className="text-xs font-semibold uppercase tracking-wider text-[#888888] block mb-1">
                Daily Hydration Progress
              </span>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-light text-[#F5F5F5] font-sans">
                  {todayConsumed.toLocaleString()}
                </span>
                <span className="text-sm text-[#888888]">/ {hydrationGoal.toLocaleString()} ml</span>
                <span className="text-xs font-semibold text-[#00D1FF] ml-2 px-2.5 py-0.5 rounded-full bg-[#00D1FF]/10 border border-[#00D1FF]/20">
                  {hydrationPercent}% Complete
                </span>
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => recordIntake(250, 'quick_preset')}
                className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-2xl bg-[#1E1E1E] hover:bg-[#252525] text-[#F5F5F5] border border-white/5 text-xs font-medium transition-all"
              >
                <Plus className="w-3.5 h-3.5 text-[#00D1FF]" />
                <span>+250 ml</span>
              </button>
              <button
                onClick={() => recordIntake(500, 'quick_preset')}
                className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-2xl bg-[#1E1E1E] hover:bg-[#252525] text-[#F5F5F5] border border-white/5 text-xs font-medium transition-all"
              >
                <Plus className="w-3.5 h-3.5 text-[#00D1FF]" />
                <span>+500 ml</span>
              </button>
              <button
                onClick={() => setIsCustomDrinkOpen(true)}
                className="px-3.5 py-2.5 rounded-2xl bg-[#1E1E1E] hover:bg-[#252525] text-[#888888] hover:text-white border border-white/5 text-xs font-medium transition-all"
              >
                Custom
              </button>
              <button
                onClick={() => setIsRecordModalOpen(true)}
                className="flex items-center gap-1.5 px-4 py-2.5 rounded-2xl bg-[#00D1FF] hover:bg-[#00B4D8] text-[#0A0A0A] text-xs font-semibold shadow-lg shadow-[#00D1FF]/20 transition-all"
              >
                <BookmarkPlus className="w-4 h-4" />
                <span>Record Reading</span>
              </button>
            </div>
          </div>

          {/* Progress Track Bar */}
          <div className="mt-5">
            <div className="w-full h-3 rounded-full bg-[#0A0A0A] border border-[#222222] overflow-hidden p-0.5">
              <motion.div
                className="h-full rounded-full bg-gradient-to-r from-[#00D1FF] to-[#0077FF] shadow-sm shadow-[#00D1FF]/30"
                initial={{ width: 0 }}
                animate={{ width: `${Math.min(100, hydrationPercent)}%` }}
                transition={{ duration: 0.8, ease: 'easeOut' }}
              />
            </div>
            <div className="flex justify-between text-xs text-[#888888] mt-2">
              <span>{remainingMl > 0 ? `${remainingMl} ml remaining` : 'Daily Goal Achieved! 🎉'}</span>
              <span>Target: {hydrationGoal} ml</span>
            </div>
          </div>
        </div>
      </div>

      {/* Record Reading Modal */}
      <AnimatePresence>
        {isRecordModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-lg bg-[#141414] border border-[#222222] rounded-[32px] p-6 sm:p-7 shadow-2xl relative"
            >
              <div className="flex items-center justify-between pb-4 border-b border-[#1E1E1E]">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-[#00D1FF]/10 border border-[#00D1FF]/20 flex items-center justify-center">
                    <BookmarkPlus className="w-4 h-4 text-[#00D1FF]" />
                  </div>
                  <h3 className="text-base font-semibold text-white">Record Sensor Reading</h3>
                </div>
                <button
                  onClick={() => setIsRecordModalOpen(false)}
                  className="p-1.5 rounded-xl text-[#888888] hover:text-white hover:bg-[#1E1E1E]"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {recordSuccess ? (
                <div className="py-8 text-center">
                  <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto mb-2" />
                  <p className="text-base font-medium text-white">Reading Recorded Successfully!</p>
                  <p className="text-xs text-[#888888] mt-1">Saved to your AquaSense bottle history.</p>
                </div>
              ) : (
                <form onSubmit={handleSaveReading} className="mt-4 space-y-4">
                  {/* Current Snapshot preview */}
                  <div className="p-4 rounded-2xl bg-[#0A0A0A] border border-[#222222] grid grid-cols-4 gap-2 text-center text-xs">
                    <div>
                      <span className="text-[#555555] block text-[10px]">SCORE</span>
                      <span className="font-semibold text-[#00D1FF]">{qualityEval.score}/100</span>
                    </div>
                    <div>
                      <span className="text-[#555555] block text-[10px]">pH</span>
                      <span className="font-semibold text-white">{bottle?.ph}</span>
                    </div>
                    <div>
                      <span className="text-[#555555] block text-[10px]">TDS</span>
                      <span className="font-semibold text-white">{bottle?.tds} ppm</span>
                    </div>
                    <div>
                      <span className="text-[#555555] block text-[10px]">TURBIDITY</span>
                      <span className="font-semibold text-white">{bottle?.turbidity} NTU</span>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-neutral-300 mb-1.5">
                      Optional Notes (e.g. Kitchen Tap, Mountain Stream, Gym Fountain)
                    </label>
                    <input
                      type="text"
                      value={recordNotes}
                      onChange={(e) => setRecordNotes(e.target.value)}
                      placeholder="e.g. Filtered tap water after filter replacement"
                      className="w-full bg-[#0A0A0A] border border-[#222222] rounded-2xl px-4 py-2.5 text-sm text-white placeholder-[#555555] focus:outline-none focus:border-[#00D1FF]/50"
                    />
                  </div>

                  {/* Publish to Community Map Toggle */}
                  <div className="p-3.5 rounded-2xl bg-[#0A0A0A] border border-[#222222] space-y-2">
                    <label className="flex items-center justify-between cursor-pointer">
                      <div className="flex items-center gap-2">
                        <MapPin className="w-4 h-4 text-[#00D1FF]" />
                        <span className="text-xs font-medium text-[#F5F5F5]">
                          Publish to Community Water Map
                        </span>
                      </div>
                      <input
                        type="checkbox"
                        checked={publishToMap}
                        onChange={(e) => setPublishToMap(e.target.checked)}
                        className="w-4 h-4 accent-[#00D1FF] rounded"
                      />
                    </label>

                    {publishToMap && (
                      <div className="pt-2 border-t border-[#1E1E1E]">
                        <label className="block text-[11px] text-[#888888] mb-1">
                          Source / Station Name
                        </label>
                        <input
                          type="text"
                          value={sourceName}
                          onChange={(e) => setSourceName(e.target.value)}
                          placeholder="e.g. Central Park Refill Fountain"
                          className="w-full bg-[#141414] border border-[#222222] rounded-xl px-3 py-2 text-xs text-white placeholder-[#555555] focus:outline-none focus:border-[#00D1FF]/50"
                        />
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-end gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => setIsRecordModalOpen(false)}
                      className="px-4 py-2 text-xs font-medium text-[#888888] hover:text-white"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={isSavingRecord}
                      className="px-5 py-2.5 rounded-xl bg-[#00D1FF] hover:bg-[#00B4D8] text-[#0A0A0A] font-semibold text-xs transition-colors"
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

      {/* Custom Drink Log Modal */}
      <AnimatePresence>
        {isCustomDrinkOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-sm bg-[#141414] border border-[#222222] rounded-[32px] p-6 shadow-2xl relative"
            >
              <div className="flex items-center justify-between pb-3 border-b border-[#1E1E1E]">
                <h3 className="text-sm font-semibold text-white">Log Custom Water Intake</h3>
                <button
                  onClick={() => setIsCustomDrinkOpen(false)}
                  className="p-1.5 rounded-xl text-[#888888] hover:text-white hover:bg-[#1E1E1E]"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleLogCustomDrink} className="mt-4 space-y-4">
                <div>
                  <label className="block text-xs font-medium text-neutral-300 mb-1">
                    Amount (ml)
                  </label>
                  <input
                    type="number"
                    min="50"
                    max="2000"
                    step="50"
                    value={customAmount}
                    onChange={(e) => setCustomAmount(parseInt(e.target.value) || 0)}
                    className="w-full bg-[#0A0A0A] border border-[#222222] rounded-2xl px-4 py-2.5 text-base font-semibold text-white focus:outline-none focus:border-[#00D1FF]/50 text-center"
                  />
                </div>

                <div className="grid grid-cols-4 gap-1.5">
                  {[150, 250, 350, 500].map((val) => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => setCustomAmount(val)}
                      className={`py-1.5 text-xs rounded-xl border ${
                        customAmount === val
                          ? 'bg-[#00D1FF]/20 text-[#00D1FF] border-[#00D1FF]/40'
                          : 'bg-[#0A0A0A] text-[#888888] border-white/5 hover:bg-[#1E1E1E]'
                      }`}
                    >
                      {val} ml
                    </button>
                  ))}
                </div>

                <button
                  type="submit"
                  className="w-full py-2.5 rounded-xl bg-[#00D1FF] hover:bg-[#00B4D8] text-[#0A0A0A] font-semibold text-xs transition-colors"
                >
                  Confirm Intake
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

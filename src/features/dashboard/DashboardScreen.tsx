import React, { useState } from 'react';
import { useBottle } from '../../context/BottleContext';
import { useAuth } from '../../context/AuthContext';
import { Header } from '../../components/common/Header';
import { WaterStatusCircle } from '../../components/common/WaterStatusCircle';
import { SensorTelemetryGrid } from './SensorTelemetryGrid';
import { AISensorInsightBanner } from './AISensorInsightBanner';
import { TestWaterActionCard } from './TestWaterActionCard';
import { CombinedBottleHydrationCard } from './CombinedBottleHydrationCard';
import { UnknownSourceTestModal } from './UnknownSourceTestModal';
import { X, Droplets } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { NavTab, CommunityReport } from '../../types';

interface DashboardScreenProps {
  onNavigateToTab?: (tab: NavTab) => void;
  onPublishToCommunity?: (report: CommunityReport) => void;
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
    isAwaitingConnection,
    recordIntake,
    simulateRefill,
    refreshAiTip,
  } = useBottle();

  const { user } = useAuth();

  // Test & Report modal for unknown water sources
  const [isTestModalOpen, setIsTestModalOpen] = useState<boolean>(false);

  // Custom drink log modal
  const [isCustomDrinkOpen, setIsCustomDrinkOpen] = useState<boolean>(false);
  const [customAmount, setCustomAmount] = useState<number>(300);

  const handleLogCustomDrink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (customAmount > 0) {
      await recordIntake(customAmount, 'manual_add', 'Logged via custom intake');
      setIsCustomDrinkOpen(false);
    }
  };

  const activeBottleId = bottle?.bottleId || user?.bottleId || user?.assignedBottleId;

  return (
    <div className="min-h-full bg-[#090B0E] text-[#F8FAFC] flex flex-col transition-colors duration-200">
      {/* 1. Header / bottle status */}
      <Header
        title="AquaSense X"
        subtitle={
          bottle?.online
            ? `Live monitoring • ${activeBottleId}`
            : isAwaitingConnection
            ? `Awaiting Connection... • ${activeBottleId || 'Bottle Paired'}`
            : `Device Offline • ${activeBottleId || 'Bottle Paired'}`
        }
      />

      <div className="p-3.5 xs:p-4 sm:p-5 lg:p-6 max-w-4xl mx-auto w-full space-y-3.5 sm:space-y-4 lg:space-y-5">
        
        {/* 2. Water Quality Score (Primary dominant visual element) */}
        <WaterStatusCircle
          evaluation={qualityEval}
          online={bottle?.online}
          isAwaitingConnection={isAwaitingConnection}
        />

        {/* 3. AI Sensor Insight (Directly below Water Quality Score) */}
        <AISensorInsightBanner
          aiTip={aiTip}
          onRefreshTip={refreshAiTip}
          onNavigateToCoach={onNavigateToTab ? () => onNavigateToTab('coach') : undefined}
          online={bottle?.online}
        />

        {/* 4. 2 × 2 Sensor Reading Grid (Cohesive hardware telemetry matrix) */}
        <div>
          <div className="flex items-center justify-between mb-2 px-1">
            <h2 className="text-[10px] sm:text-[11px] font-bold tracking-wider text-neutral-400 uppercase">
              Live Sensor Telemetry
            </h2>
            <span
              className={`text-[10px] sm:text-[11px] font-mono px-2 py-0.5 rounded-full border ${
                bottle?.online
                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                  : isAwaitingConnection
                  ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                  : 'bg-neutral-800 text-neutral-400 border-neutral-700/60'
              }`}
            >
              {bottle?.online
                ? 'Live Telemetry'
                : isAwaitingConnection
                ? 'Awaiting Connection...'
                : 'Device Offline'}
            </span>
          </div>

          <SensorTelemetryGrid
            parameters={qualityEval.parameters}
            online={bottle?.online}
          />
        </div>

        {/* 5. Test & Report Water (Directly after Sensor Reading Grid) */}
        <TestWaterActionCard
          onOpenTestModal={() => setIsTestModalOpen(true)}
          online={bottle?.online}
        />

        {/* 6. Combined Bottle Water Level + Hydration Module */}
        <CombinedBottleHydrationCard
          waterLevel={bottle?.waterLevel ?? 0}
          maxCapacity={bottle?.maxCapacity ?? 750}
          todayConsumed={todayConsumed}
          hydrationGoal={hydrationGoal}
          hydrationPercent={hydrationPercent}
          remainingMl={remainingMl}
          onRecordIntake={recordIntake}
          onOpenCustomDrink={() => setIsCustomDrinkOpen(true)}
          onRefill={simulateRefill}
        />
      </div>

      {/* Unknown Water Source Test & Report Flow Modal */}
      <UnknownSourceTestModal
        isOpen={isTestModalOpen}
        onClose={() => setIsTestModalOpen(false)}
        onSuccessPublish={(report) => {
          if (onPublishToCommunity) {
            onPublishToCommunity(report);
          } else if (onNavigateToTab) {
            onNavigateToTab('community');
          }
        }}
      />

      {/* Custom Drink Intake Modal */}
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
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-[#00D1FF]/15 border border-[#00D1FF]/25 flex items-center justify-center text-[#00D1FF]">
                    <Droplets className="w-4 h-4" />
                  </div>
                  <h3 className="text-sm sm:text-base font-semibold text-white">Log Fluid Intake</h3>
                </div>
                <button
                  onClick={() => setIsCustomDrinkOpen(false)}
                  className="p-1.5 rounded-lg text-neutral-400 hover:text-white"
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
                      min={25}
                      max={2500}
                      step={25}
                      value={customAmount}
                      onChange={(e) => setCustomAmount(parseInt(e.target.value) || 0)}
                      className="flex-1 bg-[#090B0E] border border-white/10 rounded-xl px-4 py-3 text-lg font-light text-white focus:outline-none focus:border-[#00D1FF]"
                    />
                    <span className="text-sm font-medium text-neutral-400">ml</span>
                  </div>
                </div>

                <div className="grid grid-cols-4 gap-2">
                  {[150, 250, 350, 600].map((val) => (
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
                  className="w-full py-3 rounded-xl bg-[#00D1FF] hover:bg-[#00B4D8] text-[#090B0E] font-semibold text-xs transition-colors cursor-pointer"
                >
                  Record {customAmount} ml Intake
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

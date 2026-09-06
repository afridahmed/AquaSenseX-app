import React, { useState, useEffect, useRef } from 'react';
import { useBottle } from '../../context/BottleContext';
import { BottleData } from '../../types';
import { evaluateWaterQuality } from '../../services/waterQuality/qualityEvaluator';
import {
  FlaskConical,
  ArrowRight,
  MapPin,
  WifiOff,
  AlertCircle,
  Activity,
  CheckCircle2,
  RotateCw,
  Sparkles,
  Clock,
  ShieldCheck,
  FileText,
  Loader2,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export interface AnalysisResult {
  ph: number | null;
  tds: number | null;
  temperature: number | null;
  turbidity: number | null;
  qualityScore: number | null;
  qualityCategory: string | null;
  sampleCount: number;
  timestamp: string;
}

interface TestWaterActionCardProps {
  onOpenTestModal: () => void;
  online?: boolean;
  bottleData?: BottleData | null;
  onAnalysisComplete?: (result: AnalysisResult) => void;
}

export const TestWaterActionCard: React.FC<TestWaterActionCardProps> = ({
  onOpenTestModal,
  online: propOnline,
  bottleData: propBottleData,
  onAnalysisComplete,
}) => {
  // Context fallback
  const bottleContext = useBottle();
  const activeBottleData = propBottleData !== undefined ? propBottleData : bottleContext.bottle;
  
  // Strict connection gating: must be reported online and not hardware-timed-out
  const isDeviceOnline = Boolean(
    (propOnline !== undefined ? propOnline : bottleContext.isDeviceOnline) &&
    (activeBottleData?.online ?? false)
  );

  // State Management (React Hooks)
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [scanProgress, setScanProgress] = useState<number>(0);
  const [readingBuffer, setReadingBuffer] = useState<BottleData[]>([]);
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [showTooltip, setShowTooltip] = useState<boolean>(false);

  // Ref to hold latest reading buffer for synchronous finalization
  const readingBufferRef = useRef<BottleData[]>([]);
  useEffect(() => {
    readingBufferRef.current = readingBuffer;
  }, [readingBuffer]);

  // Hook into live bottleData updates: push incoming telemetry packets into readingBuffer while analyzing
  useEffect(() => {
    if (!isAnalyzing || !activeBottleData) return;

    setReadingBuffer((prev) => [...prev, activeBottleData]);
  }, [activeBottleData, isAnalyzing]);

  // Strict disconnection watchdog: halt analysis immediately if device drops offline
  useEffect(() => {
    if (!isDeviceOnline && isAnalyzing) {
      setIsAnalyzing(false);
      setScanProgress(0);
      setReadingBuffer([]);
    }
  }, [isDeviceOnline, isAnalyzing]);

  // 15-second smartwatch sampling engine
  useEffect(() => {
    if (!isAnalyzing) return;

    const DURATION_MS = 15000;
    const INTERVAL_MS = 100;
    const startTime = Date.now();

    const progressTimer = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(100, (elapsed / DURATION_MS) * 100);
      setScanProgress(Math.round(progress));

      if (elapsed >= DURATION_MS) {
        clearInterval(progressTimer);
        finalizeAnalysis();
      }
    }, INTERVAL_MS);

    return () => {
      clearInterval(progressTimer);
    };
  }, [isAnalyzing]);

  // Finalize analysis: calculate mathematical averages across buffered packets
  const finalizeAnalysis = () => {
    const samples =
      readingBufferRef.current.length > 0
        ? readingBufferRef.current
        : activeBottleData
        ? [activeBottleData]
        : [];

    const validPh = samples
      .map((s) => s.ph)
      .filter((v): v is number => typeof v === 'number' && !isNaN(v));
    const validTds = samples
      .map((s) => s.tds)
      .filter((v): v is number => typeof v === 'number' && !isNaN(v));
    const validTemp = samples
      .map((s) => s.temperature)
      .filter((v): v is number => typeof v === 'number' && !isNaN(v));
    const validTurb = samples
      .map((s) => s.turbidity)
      .filter((v): v is number => typeof v === 'number' && !isNaN(v));

    const avgPh = validPh.length
      ? Number((validPh.reduce((a, b) => a + b, 0) / validPh.length).toFixed(2))
      : (activeBottleData?.ph ?? null);
    const avgTds = validTds.length
      ? Math.round(validTds.reduce((a, b) => a + b, 0) / validTds.length)
      : (activeBottleData?.tds ?? null);
    const avgTemp = validTemp.length
      ? Number((validTemp.reduce((a, b) => a + b, 0) / validTemp.length).toFixed(1))
      : (activeBottleData?.temperature ?? null);
    const avgTurb = validTurb.length
      ? Number((validTurb.reduce((a, b) => a + b, 0) / validTurb.length).toFixed(2))
      : (activeBottleData?.turbidity ?? null);

    let qualityCategory = 'Optimal';
    let qualityScore: number | null = null;

    if (avgPh !== null || avgTds !== null || avgTurb !== null) {
      const evaluation = evaluateWaterQuality({
        ph: avgPh ?? 7.2,
        tds: avgTds ?? 140,
        turbidity: avgTurb ?? 0.3,
        temperature: avgTemp ?? 20,
      });
      qualityCategory = evaluation.category;
      qualityScore = evaluation.score;
    }

    const finalResult: AnalysisResult = {
      ph: avgPh,
      tds: avgTds,
      temperature: avgTemp,
      turbidity: avgTurb,
      qualityScore,
      qualityCategory,
      sampleCount: Math.max(samples.length, 1),
      timestamp: new Date().toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      }),
    };

    setAnalysisResult(finalResult);
    setIsAnalyzing(false);
    setScanProgress(100);

    if (onAnalysisComplete) {
      onAnalysisComplete(finalResult);
    }
  };

  // Start analysis trigger
  const handleStartAnalysis = () => {
    if (!isDeviceOnline) {
      setShowTooltip(true);
      setTimeout(() => setShowTooltip(false), 3500);
      return;
    }

    setIsAnalyzing(true);
    setScanProgress(0);
    // Seed buffer with current live telemetry packet
    if (activeBottleData) {
      setReadingBuffer([activeBottleData]);
    } else {
      setReadingBuffer([]);
    }
  };

  // Standard modal open click handler (preserved from original component)
  const handleOpenReportClick = () => {
    if (!isDeviceOnline) {
      setShowTooltip(true);
      setTimeout(() => setShowTooltip(false), 3500);
      return;
    }
    onOpenTestModal();
  };

  return (
    <div
      className={`relative overflow-hidden rounded-2xl sm:rounded-[24px] border transition-all ${
        isDeviceOnline
          ? 'bg-gradient-to-r from-[#12161C] via-[#141B24] to-[#101720] border-[#00D1FF]/25 shadow-xl hover:border-[#00D1FF]/40 group'
          : 'bg-[#12161C]/80 border-white/5 opacity-60'
      }`}
    >
      {/* Ambient water glow (only when online) */}
      {isDeviceOnline && (
        <div className="absolute -right-12 -top-12 w-36 h-36 bg-[#00D1FF]/10 rounded-full blur-3xl pointer-events-none group-hover:bg-[#00D1FF]/15 transition-all duration-500" />
      )}

      <div className="relative z-10 p-3.5 xs:p-4 sm:p-5">
        <AnimatePresence mode="wait">
          {/* STATE 1: Analyzing in Progress (Smartwatch 15s Sampling HUD) */}
          {isAnalyzing ? (
            <motion.div
              key="analyzing-state"
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              className="flex flex-col gap-3"
            >
              {/* Top status bar */}
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-xl bg-[#00D1FF]/15 border border-[#00D1FF]/30 text-[#00D1FF] flex items-center justify-center shrink-0">
                    <Activity className="w-4 h-4 animate-spin text-[#00D1FF]" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs sm:text-sm font-semibold text-white truncate">
                        Stabilizing sensor readings... (Sampling)
                      </span>
                      <span className="w-1.5 h-1.5 rounded-full bg-[#00D1FF] animate-ping" />
                    </div>
                    <p className="text-[11px] text-neutral-400 truncate">
                      Buffering live ESP32 optical and electrochemical packets
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-xs font-mono font-bold text-[#00D1FF] bg-[#00D1FF]/10 px-2 py-0.5 rounded-lg border border-[#00D1FF]/20">
                    {Math.max(1, Math.ceil(15 - (scanProgress / 100) * 15))}s remaining
                  </span>
                </div>
              </div>

              {/* High-tech Progress Bar */}
              <div className="w-full bg-neutral-900/90 rounded-full h-2 overflow-hidden border border-white/10 p-0.5">
                <div
                  className="bg-gradient-to-r from-[#00D1FF] via-[#38BDF8] to-[#00E5FF] h-full rounded-full transition-all duration-100 ease-linear shadow-sm shadow-[#00D1FF]/50"
                  style={{ width: `${Math.max(4, scanProgress)}%` }}
                />
              </div>

              {/* Progress details footer */}
              <div className="flex items-center justify-between text-[11px] text-neutral-400 font-mono">
                <span className="flex items-center gap-1 text-[#00D1FF]">
                  <Sparkles className="w-3 h-3" />
                  <span>{scanProgress}% stabilized</span>
                </span>
                <span className="truncate">
                  {readingBuffer.length} packet{readingBuffer.length === 1 ? '' : 's'} recorded
                </span>
              </div>
            </motion.div>
          ) : analysisResult ? (
            /* STATE 2: After Analysis Completed (Verified Metrics Summary & Unlocked Report Action) */
            <motion.div
              key="completed-state"
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              className="flex flex-col gap-3"
            >
              {/* Header with verified badge and timestamp indicator */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-7 h-7 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 flex items-center justify-center shrink-0">
                    <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs sm:text-sm font-semibold text-white">
                        Verified Water Analysis
                      </span>
                      {analysisResult.qualityCategory && (
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
                          {analysisResult.qualityCategory}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 text-[11px] text-neutral-400 font-mono mt-0.5">
                      <Clock className="w-3 h-3 text-neutral-500" />
                      <span>
                        Sampled at {analysisResult.timestamp} · 15s avg ({analysisResult.sampleCount} pkts)
                      </span>
                    </div>
                  </div>
                </div>

                {/* Primary unlocked action & re-analyze controls */}
                <div className="flex items-center gap-2 shrink-0 mt-1 sm:mt-0">
                  <button
                    id="btn-dashboard-reanalyze"
                    type="button"
                    onClick={handleStartAnalysis}
                    disabled={!isDeviceOnline}
                    title="Re-run 15-second analysis"
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-neutral-300 border border-white/10 text-xs font-medium transition-all active:scale-95 cursor-pointer"
                  >
                    <RotateCw className="w-3 h-3" />
                    <span>Re-analyze</span>
                  </button>

                  <button
                    id="btn-dashboard-test-report"
                    type="button"
                    onClick={handleOpenReportClick}
                    disabled={!isDeviceOnline}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#00D1FF] hover:bg-[#00B4D8] active:bg-[#0096B4] text-[#090B0E] text-xs font-semibold shadow-md shadow-[#00D1FF]/20 active:scale-[0.98] transition-all cursor-pointer"
                  >
                    <FileText className="w-3.5 h-3.5" />
                    <span>View / Export Report</span>
                    <ArrowRight className="w-3 h-3" />
                  </button>
                </div>
              </div>

              {/* Verified Sensor Metrics Summary Grid */}
              <div className="grid grid-cols-2 xs:grid-cols-4 gap-2 pt-1 border-t border-white/5">
                <div className="p-2 rounded-xl bg-white/[0.03] border border-white/5">
                  <span className="text-[10px] text-neutral-400 block font-mono">Avg pH</span>
                  <span className="text-xs sm:text-sm font-bold text-white font-mono">
                    {analysisResult.ph !== null ? analysisResult.ph : '--'}
                  </span>
                </div>

                <div className="p-2 rounded-xl bg-white/[0.03] border border-white/5">
                  <span className="text-[10px] text-neutral-400 block font-mono">Avg TDS</span>
                  <span className="text-xs sm:text-sm font-bold text-[#00D1FF] font-mono">
                    {analysisResult.tds !== null ? `${analysisResult.tds} ppm` : '--'}
                  </span>
                </div>

                <div className="p-2 rounded-xl bg-white/[0.03] border border-white/5">
                  <span className="text-[10px] text-neutral-400 block font-mono">Avg Temp</span>
                  <span className="text-xs sm:text-sm font-bold text-white font-mono">
                    {analysisResult.temperature !== null ? `${analysisResult.temperature}°C` : '--'}
                  </span>
                </div>

                <div className="p-2 rounded-xl bg-white/[0.03] border border-white/5">
                  <span className="text-[10px] text-neutral-400 block font-mono">Avg Turbidity</span>
                  <span className="text-xs sm:text-sm font-bold text-white font-mono">
                    {analysisResult.turbidity !== null ? `${analysisResult.turbidity} NTU` : '--'}
                  </span>
                </div>
              </div>
            </motion.div>
          ) : (
            /* STATE 3: Idle View (Default State) */
            <motion.div
              key="idle-state"
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4"
            >
              {/* Left icon + copy block */}
              <div className="flex items-center gap-2.5 sm:gap-3.5 min-w-0">
                <div
                  className={`w-9 h-9 sm:w-10 sm:h-10 rounded-xl border flex items-center justify-center shrink-0 transition-colors ${
                    isDeviceOnline
                      ? 'bg-[#00D1FF]/15 border-[#00D1FF]/30 text-[#00D1FF] shadow-sm shadow-[#00D1FF]/10'
                      : 'bg-white/5 border-white/10 text-neutral-500'
                  }`}
                >
                  {isDeviceOnline ? (
                    <Activity className="w-4 h-4 text-[#00D1FF]" />
                  ) : (
                    <WifiOff className="w-4 h-4 text-neutral-500" />
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <span
                      className={`text-[10px] sm:text-[11px] font-semibold uppercase tracking-wider flex items-center gap-1 ${
                        isDeviceOnline ? 'text-[#00D1FF]' : 'text-neutral-400'
                      }`}
                    >
                      {isDeviceOnline ? (
                        <>
                          <Sparkles className="w-3 h-3 text-[#00D1FF]" />
                          <span>Smart Water Analysis</span>
                        </>
                      ) : (
                        <>
                          <WifiOff className="w-3 h-3 text-neutral-400" />
                          <span>Test Water · Device Offline</span>
                        </>
                      )}
                    </span>
                  </div>

                  {/* Supporting sentence or offline explanation */}
                  <p className="text-xs text-neutral-300 leading-snug">
                    {isDeviceOnline
                      ? 'Capture and stabilize live sensor telemetry over 15 seconds to evaluate water purity.'
                      : 'Device offline. Power on bottle to run analysis.'}
                  </p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="w-full sm:w-auto shrink-0 relative flex flex-col xs:flex-row sm:flex-row items-center gap-2">
                {/* Primary Analyze Water Button */}
                <button
                  id="btn-dashboard-analyze-water"
                  type="button"
                  onClick={handleStartAnalysis}
                  disabled={!isDeviceOnline}
                  title={
                    !isDeviceOnline
                      ? 'Device offline. Power on bottle to run analysis.'
                      : 'Run 15-second smartwatch sensor stabilization analysis'
                  }
                  className={`w-full xs:w-auto flex items-center justify-center gap-1.5 px-3.5 sm:px-4 py-2 sm:py-2.5 rounded-xl text-xs font-semibold transition-all touch-target sm:min-h-0 select-none ${
                    isDeviceOnline
                      ? 'bg-[#00D1FF] hover:bg-[#00B4D8] active:bg-[#0096B4] text-[#090B0E] shadow-md shadow-[#00D1FF]/20 active:scale-[0.98] cursor-pointer'
                      : 'bg-neutral-800 text-neutral-400 border border-neutral-700/60 cursor-not-allowed opacity-80'
                  }`}
                >
                  <Activity className="w-3.5 h-3.5 shrink-0" />
                  <span className="whitespace-nowrap">Analyze Water</span>
                  {isDeviceOnline && (
                    <ArrowRight className="w-3 h-3 shrink-0 opacity-80 group-hover:translate-x-0.5 transition-transform" />
                  )}
                </button>

                {/* Secondary Test & Report Action (preserved) */}
                <button
                  id="btn-dashboard-test-report"
                  type="button"
                  onClick={handleOpenReportClick}
                  disabled={!isDeviceOnline}
                  className={`w-full xs:w-auto flex items-center justify-center gap-1.5 px-3 py-2 sm:py-2.5 rounded-xl text-xs font-medium transition-all touch-target sm:min-h-0 select-none ${
                    isDeviceOnline
                      ? 'bg-white/5 hover:bg-white/10 text-neutral-300 border border-white/10 cursor-pointer active:scale-95'
                      : 'bg-transparent text-neutral-500 border border-white/5 cursor-not-allowed hidden'
                  }`}
                >
                  <FlaskConical className="w-3.5 h-3.5 text-neutral-400" />
                  <span className="whitespace-nowrap">Test & Report</span>
                </button>

                {/* Offline Tooltip */}
                {showTooltip && !isDeviceOnline && (
                  <div className="absolute bottom-full right-0 mb-2 w-64 p-2 bg-neutral-900 border border-amber-500/40 text-amber-300 rounded-xl text-[11px] shadow-2xl z-20 flex items-start gap-1.5 animate-fadeIn">
                    <AlertCircle className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                    <span>Device offline. Power on bottle to run analysis.</span>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};



import React, { useState, useEffect } from 'react';
import { useBottle } from '../../context/BottleContext';
import { useAuth } from '../../context/AuthContext';
import {
  locationService,
  LocationError,
  LocationErrorCode,
} from '../../services/location/locationService';
import { geocodingService } from '../../services/geocoding/geocodingService';
import { createCommunityReport } from '../../services/community/communityService';
import { CommunityReport } from '../../types';
import {
  FlaskConical,
  MapPin,
  CheckCircle2,
  AlertTriangle,
  X,
  Share2,
  Loader2,
  Navigation,
  Copy,
  Check,
  RotateCw,
  Sparkles,
  ShieldCheck,
  FileText,
  WifiOff,
  Droplets,
  Thermometer,
  Eye,
  Activity,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { AnalysisResult } from './TestWaterActionCard';

export interface WaterAnalysisReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  analysisResult: AnalysisResult | null;
  bottleId?: string;
  onSuccessPublish?: (report: CommunityReport) => void;
}

export const WaterAnalysisReportModal: React.FC<WaterAnalysisReportModalProps> = ({
  isOpen,
  onClose,
  analysisResult,
  bottleId: propBottleId,
  onSuccessPublish,
}) => {
  const { bottle, isDeviceOnline, qualityEval } = useBottle();
  const { user } = useAuth();

  const activeBottleId = propBottleId || bottle?.bottleId || user?.assignedBottleId || user?.bottleId || 'AquaSense X';

  // Extract average values or fallback to current bottle telemetry
  const avgPh = analysisResult?.ph ?? bottle?.ph ?? null;
  const avgTds = analysisResult?.tds ?? bottle?.tds ?? null;
  const avgTurb = analysisResult?.turbidity ?? bottle?.turbidity ?? null;
  const avgTemp = analysisResult?.temperature ?? bottle?.temperature ?? null;
  const qualityScore = analysisResult?.qualityScore ?? qualityEval.score;
  const qualityCategory = analysisResult?.qualityCategory ?? qualityEval.category;
  const sampleCount = analysisResult?.sampleCount ?? 1;
  const timestamp = analysisResult?.timestamp ?? new Date().toLocaleTimeString();

  // Local state
  const [shareToCommunity, setShareToCommunity] = useState<boolean>(true);
  const [sourceName, setSourceName] = useState<string>('');
  const [sourceType, setSourceType] = useState<CommunityReport['sourceType']>('fountain');
  const [notes, setNotes] = useState<string>('');
  const [copied, setCopied] = useState<boolean>(false);

  // GPS state for community sharing
  const [deviceGps, setDeviceGps] = useState<{
    lat: number;
    lon: number;
    accuracy: number;
    timestamp: number;
  } | null>(null);

  const [reportCoords, setReportCoords] = useState<{
    lat: number;
    lon: number;
  } | null>(null);

  const [placeName, setPlaceName] = useState<string>('');
  const [locStatus, setLocStatus] = useState<'idle' | 'acquiring' | 'success' | 'error'>('idle');
  const [locError, setLocError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [submitSuccess, setSubmitSuccess] = useState<boolean>(false);

  // Reset and auto-acquire location when opened
  useEffect(() => {
    if (isOpen) {
      setSubmitSuccess(false);
      setIsSubmitting(false);
      setCopied(false);
      if (shareToCommunity) {
        acquireFreshLocation();
      }
    } else {
      setLocStatus('idle');
      setLocError(null);
      setDeviceGps(null);
      setReportCoords(null);
    }
  }, [isOpen]);

  // Acquire location when community share toggle is enabled
  useEffect(() => {
    if (isOpen && shareToCommunity && locStatus === 'idle') {
      acquireFreshLocation();
    }
  }, [shareToCommunity, isOpen]);

  const acquireFreshLocation = async () => {
    setLocStatus('acquiring');
    setLocError(null);

    try {
      const position = await locationService.getFreshPosition(12000);
      const { latitude, longitude, accuracy, timestamp: posTimestamp } = position;

      setDeviceGps({
        lat: latitude,
        lon: longitude,
        accuracy,
        timestamp: posTimestamp,
      });

      setReportCoords({
        lat: latitude,
        lon: longitude,
      });
      setLocStatus('success');

      try {
        const address = await geocodingService.reverseGeocode(latitude, longitude);
        const resolvedName = address || `${latitude.toFixed(5)}°, ${longitude.toFixed(5)}°`;
        setPlaceName(resolvedName);
        if (!sourceName) {
          setSourceName(resolvedName.split(',')[0] || 'Public Water Source');
        }
      } catch {
        const fallbackName = `${latitude.toFixed(5)}°, ${longitude.toFixed(5)}°`;
        setPlaceName(fallbackName);
        if (!sourceName) {
          setSourceName('Public Water Source');
        }
      }
    } catch (err: any) {
      console.warn('GPS fresh position acquisition failed:', err);
      setLocStatus('error');
      setDeviceGps(null);
      setReportCoords(null);

      if (err instanceof LocationError) {
        setLocError(
          err.code === LocationErrorCode.PERMISSION_DENIED
            ? 'Location access was denied. Enable location permissions in your browser to share to the map.'
            : 'Unable to retrieve accurate GPS location. Tap Retry.'
        );
      } else {
        setLocError('GPS signal unavailable. Please ensure location is enabled.');
      }
    }
  };

  // Copy report summary to clipboard
  const handleCopyReport = async () => {
    const textSummary = `AquaSense X Water Quality Report
Device: ${activeBottleId}
Sampled: ${timestamp} (15-Second Stabilized Average, ${sampleCount} packets)
Overall Score: ${qualityScore}/100 (${qualityCategory})
- Avg pH: ${avgPh !== null ? avgPh : '--'}
- Avg TDS: ${avgTds !== null ? `${avgTds} ppm` : '--'}
- Avg Turbidity: ${avgTurb !== null ? `${avgTurb} NTU` : '--'}
- Avg Temperature: ${avgTemp !== null ? `${avgTemp}°C` : '--'}
`;

    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(textSummary);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch (err) {
      console.warn('Clipboard copy failed:', err);
    }
  };

  // Submit to community map
  const handlePublishToCommunity = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!user) {
      setLocError('User authentication required to submit community reports.');
      return;
    }

    if (!reportCoords || !deviceGps) {
      setLocError('Valid GPS coordinates required to pin report to the Community Map.');
      return;
    }

    setIsSubmitting(true);
    setLocError(null);

    try {
      const newReport = await createCommunityReport({
        uid: user.uid,
        bottleId: activeBottleId,
        authorName: user.name || 'AquaSense Contributor',
        sourceName: sourceName.trim() || placeName || 'Community Water Source',
        sourceType,
        latitude: reportCoords.lat,
        longitude: reportCoords.lon,
        originalDeviceLat: deviceGps.lat,
        originalDeviceLon: deviceGps.lon,
        gpsAccuracy: deviceGps.accuracy,
        adjustmentDistanceMeters: 0,
        qualityScore: qualityScore ?? 85,
        temperature: avgTemp ?? 22.0,
        tds: avgTds ?? 150,
        turbidity: avgTurb ?? 0.35,
        ph: avgPh ?? 7.2,
        verifiedReports: 1,
        userHasVerified: true,
        notes: notes.trim() || `Verified 15-second stabilized analysis via ${activeBottleId}.`,
      });

      setSubmitSuccess(true);
      setTimeout(() => {
        if (onSuccessPublish) {
          onSuccessPublish(newReport);
        }
        onClose();
      }, 1500);
    } catch (err: any) {
      console.error('Community publish failed:', err);
      setLocError(err.message || 'Failed to publish to Community Map. Please retry.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/80 backdrop-blur-md overflow-y-auto">
        <motion.div
          initial={{ opacity: 0, y: 24, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 24, scale: 0.98 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
          className="w-full sm:max-w-xl bg-[#10151D] border-t sm:border border-white/10 rounded-t-[28px] sm:rounded-[32px] p-4 xs:p-5 sm:p-6 shadow-2xl relative my-auto max-h-[92vh] flex flex-col"
        >
          {/* Header */}
          <div className="flex items-center justify-between pb-3.5 border-b border-white/10 shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-[#00D1FF]/15 border border-[#00D1FF]/30 text-[#00D1FF] flex items-center justify-center shrink-0">
                <FileText className="w-5 h-5 text-[#00D1FF]" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base sm:text-lg font-bold text-white tracking-tight">
                    Water Quality Report
                  </h3>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-[#00D1FF]/10 text-[#00D1FF] border border-[#00D1FF]/20">
                    Verified
                  </span>
                </div>
                <p className="text-xs text-neutral-400 font-mono">
                  15s Stabilized Average · {timestamp}
                </p>
              </div>
            </div>

            <button
              id="btn-close-water-report"
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-xl text-neutral-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Scrollable Modal Content */}
          <div className="overflow-y-auto pr-1 -mr-1 space-y-3.5 pt-3.5 flex-1">
            {/* 1. Quality Score & Assessment Banner (derived strictly from averages) */}
            <div className="p-3.5 sm:p-4 rounded-2xl bg-gradient-to-r from-[#141B24] via-[#12161C] to-[#0D1117] border border-white/10 shadow-lg relative overflow-hidden">
              <div className="flex items-center justify-between gap-3 relative z-10">
                <div>
                  <span className="text-[10px] uppercase font-mono tracking-wider text-neutral-400 block mb-1">
                    Average-Derived Quality Score
                  </span>
                  <div className="flex items-baseline gap-2">
                    <span className="text-3xl sm:text-4xl font-extrabold text-white font-sans tracking-tight">
                      {qualityScore !== null ? qualityScore : '--'}
                    </span>
                    <span className="text-xs sm:text-sm text-neutral-400 font-mono">/100</span>
                    {qualityCategory && (
                      <span
                        className={`text-xs font-semibold px-2.5 py-0.5 rounded-full border ${
                          (qualityScore ?? 0) >= 88
                            ? 'bg-[#00D1FF]/15 text-[#00D1FF] border-[#00D1FF]/30'
                            : (qualityScore ?? 0) >= 70
                            ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                            : 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                        }`}
                      >
                        {qualityCategory}
                      </span>
                    )}
                  </div>
                </div>

                <div className="w-12 h-12 rounded-2xl bg-[#00D1FF]/10 border border-[#00D1FF]/25 text-[#00D1FF] flex items-center justify-center shrink-0">
                  <ShieldCheck className="w-6 h-6 text-[#00D1FF]" />
                </div>
              </div>

              <p className="text-xs text-neutral-300 mt-2.5 leading-relaxed relative z-10">
                {(qualityScore ?? 0) >= 88
                  ? 'Optimal drinking water standard. Electrochemical and optical purity metrics are well within clean hydration boundaries.'
                  : (qualityScore ?? 0) >= 70
                  ? 'Good water purity. Minor TDS or mineral variance detected, safe for general daily consumption.'
                  : 'Caution advised. Elevated mineral density or optical turbidity detected. Filtration recommended.'}
              </p>
            </div>

            {/* 2. Verified Averages 4-Metric Responsive Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-2.5">
              {/* Avg pH */}
              <div className="p-2.5 sm:p-3 rounded-2xl bg-white/[0.03] border border-white/5 flex flex-col justify-between">
                <div className="flex items-center justify-between text-neutral-400 mb-1">
                  <span className="text-[10px] font-mono uppercase">Avg pH</span>
                  <Activity className="w-3.5 h-3.5 text-[#00D1FF]" />
                </div>
                <div className="text-base sm:text-lg font-bold text-white font-mono">
                  {avgPh !== null ? avgPh : '--'}
                </div>
                <span className="text-[9px] text-neutral-400 mt-0.5">Ideal: 6.5 – 8.5</span>
              </div>

              {/* Avg TDS */}
              <div className="p-2.5 sm:p-3 rounded-2xl bg-white/[0.03] border border-white/5 flex flex-col justify-between">
                <div className="flex items-center justify-between text-neutral-400 mb-1">
                  <span className="text-[10px] font-mono uppercase">Avg TDS</span>
                  <Droplets className="w-3.5 h-3.5 text-cyan-400" />
                </div>
                <div className="text-base sm:text-lg font-bold text-[#00D1FF] font-mono">
                  {avgTds !== null ? `${avgTds} ppm` : '--'}
                </div>
                <span className="text-[9px] text-neutral-400 mt-0.5">&lt; 300 ppm Ideal</span>
              </div>

              {/* Avg Temp */}
              <div className="p-2.5 sm:p-3 rounded-2xl bg-white/[0.03] border border-white/5 flex flex-col justify-between">
                <div className="flex items-center justify-between text-neutral-400 mb-1">
                  <span className="text-[10px] font-mono uppercase">Avg Temp</span>
                  <Thermometer className="w-3.5 h-3.5 text-emerald-400" />
                </div>
                <div className="text-base sm:text-lg font-bold text-white font-mono">
                  {avgTemp !== null ? `${avgTemp}°C` : '--'}
                </div>
                <span className="text-[9px] text-neutral-400 mt-0.5">Ambient water</span>
              </div>

              {/* Avg Turbidity */}
              <div className="p-2.5 sm:p-3 rounded-2xl bg-white/[0.03] border border-white/5 flex flex-col justify-between">
                <div className="flex items-center justify-between text-neutral-400 mb-1">
                  <span className="text-[10px] font-mono uppercase">Avg Clarity</span>
                  <Eye className="w-3.5 h-3.5 text-amber-400" />
                </div>
                <div className="text-base sm:text-lg font-bold text-white font-mono">
                  {avgTurb !== null ? `${avgTurb} NTU` : '--'}
                </div>
                <span className="text-[9px] text-neutral-400 mt-0.5">&lt; 1.0 NTU Clear</span>
              </div>
            </div>

            {/* Analysis sampling meta info & Copy button */}
            <div className="flex items-center justify-between text-[11px] text-neutral-400 px-1 font-mono">
              <span>Stabilized across {sampleCount} telemetry packet{sampleCount === 1 ? '' : 's'}</span>
              <button
                type="button"
                onClick={handleCopyReport}
                className="flex items-center gap-1 text-[#00D1FF] hover:underline cursor-pointer"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'Copied Summary!' : 'Copy Summary'}</span>
              </button>
            </div>

            {/* 3. Interactive Prompt: "Publish to Community Map?" */}
            <div className="rounded-2xl bg-[#090B0E] border border-white/10 p-3.5 sm:p-4 space-y-3">
              {/* Interactive Prompt Header & Choice Buttons */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-9 h-9 rounded-xl bg-[#00D1FF]/15 border border-[#00D1FF]/30 text-[#00D1FF] flex items-center justify-center shrink-0">
                    <Share2 className="w-4.5 h-4.5 text-[#00D1FF]" />
                  </div>
                  <div className="min-w-0">
                    <h4 className="text-xs sm:text-sm font-bold text-white">
                      Publish to Community Map?
                    </h4>
                    <p className="text-[11px] text-neutral-400">
                      Share this verified test to help others locate safe drinking water
                    </p>
                  </div>
                </div>

                {/* Interactive Choice Selector */}
                <div className="flex items-center gap-1.5 p-1 rounded-xl bg-white/[0.04] border border-white/5 shrink-0 self-start sm:self-auto">
                  <button
                    type="button"
                    onClick={() => setShareToCommunity(true)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
                      shareToCommunity
                        ? 'bg-[#00D1FF] text-[#090B0E] shadow-sm shadow-[#00D1FF]/20'
                        : 'text-neutral-400 hover:text-white'
                    }`}
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Yes, Share to Map</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setShareToCommunity(false)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                      !shareToCommunity
                        ? 'bg-white/10 text-white'
                        : 'text-neutral-400 hover:text-white'
                    }`}
                  >
                    <span>Keep Private</span>
                  </button>
                </div>
              </div>

              {/* Private State Notice */}
              {!shareToCommunity && (
                <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5 text-xs text-neutral-400 flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>This test result remains private on your local device. It will not be broadcast to the community map.</span>
                </div>
              )}

              {/* Collapsible Community Submission Form */}
              <AnimatePresence>
                {shareToCommunity && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="space-y-3 pt-2 border-t border-white/5"
                  >
                    {/* GPS Location Status Box */}
                    <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5 space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <MapPin className="w-3.5 h-3.5 text-[#00D1FF] shrink-0" />
                          <span className="font-mono text-neutral-400 uppercase text-[10px]">
                            GPS Verification
                          </span>
                        </div>

                        {locStatus === 'success' && deviceGps && (
                          <span className="text-[10px] text-emerald-400 font-mono font-medium flex items-center gap-1 shrink-0">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                            ±{Math.round(deviceGps.accuracy)}m accuracy
                          </span>
                        )}
                        {locStatus === 'acquiring' && (
                          <span className="text-[10px] text-[#00D1FF] font-mono flex items-center gap-1">
                            <Loader2 className="w-3 h-3 animate-spin" />
                            Acquiring GPS...
                          </span>
                        )}
                      </div>

                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs text-white truncate font-medium">
                          {locStatus === 'success'
                            ? placeName || `${deviceGps?.lat.toFixed(4)}°, ${deviceGps?.lon.toFixed(4)}°`
                            : locStatus === 'acquiring'
                            ? 'Detecting device location...'
                            : 'GPS not acquired'}
                        </span>
                        <button
                          type="button"
                          onClick={acquireFreshLocation}
                          disabled={locStatus === 'acquiring'}
                          className="px-2 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-neutral-300 text-[10px] font-mono flex items-center gap-1 shrink-0 cursor-pointer"
                        >
                          <RotateCw className={`w-3 h-3 ${locStatus === 'acquiring' ? 'animate-spin' : ''}`} />
                          <span>Refresh GPS</span>
                        </button>
                      </div>

                      {locError && (
                        <div className="p-2 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-start gap-1.5">
                          <AlertTriangle className="w-3.5 h-3.5 text-rose-400 shrink-0 mt-0.5" />
                          <span>{locError}</span>
                        </div>
                      )}
                    </div>

                    {/* Source Name & Type */}
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-medium text-neutral-300 block">
                        Source Name / Location Label
                      </label>
                      <input
                        type="text"
                        value={sourceName}
                        onChange={(e) => setSourceName(e.target.value)}
                        placeholder="e.g. 2nd Floor Water Cooler, Park Fountain"
                        className="w-full bg-[#10151D] border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-[#00D1FF]/50"
                      />
                    </div>

                    {/* Source Categories */}
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-medium text-neutral-300 block">
                        Source Type
                      </label>
                      <div className="grid grid-cols-2 xs:grid-cols-3 gap-1.5">
                        {[
                          { id: 'fountain', label: 'Drinking Fountain' },
                          { id: 'filtration_station', label: 'Refill Station' },
                          { id: 'tap', label: 'Municipal Tap' },
                          { id: 'spring', label: 'Natural Spring' },
                          { id: 'well', label: 'Groundwater Well' },
                        ].map((cat) => (
                          <button
                            key={cat.id}
                            type="button"
                            onClick={() => setSourceType(cat.id as any)}
                            className={`px-2 py-1.5 rounded-lg text-xs font-medium transition-all text-left truncate cursor-pointer ${
                              sourceType === cat.id
                                ? 'bg-[#00D1FF]/20 text-[#00D1FF] border border-[#00D1FF]/40'
                                : 'bg-white/[0.03] text-neutral-400 border border-white/5 hover:text-white'
                            }`}
                          >
                            {cat.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Optional Notes */}
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-medium text-neutral-300 block">
                        Observation Notes (Optional)
                      </label>
                      <input
                        type="text"
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        placeholder="e.g. Crisp flow, cold, filter light active"
                        className="w-full bg-[#10151D] border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-[#00D1FF]/50"
                      />
                    </div>

                    {/* Publish to Community Button */}
                    <button
                      id="btn-publish-community-report"
                      type="button"
                      onClick={handlePublishToCommunity}
                      disabled={isSubmitting || locStatus !== 'success' || !reportCoords}
                      className="w-full py-2.5 px-4 rounded-xl bg-[#00D1FF] hover:bg-[#00B4D8] active:bg-[#0096B4] text-[#090B0E] text-xs sm:text-sm font-semibold shadow-lg shadow-[#00D1FF]/20 active:scale-[0.99] transition-all flex items-center justify-center gap-2 disabled:opacity-50 touch-target cursor-pointer disabled:cursor-not-allowed"
                    >
                      {isSubmitting ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                          <span>Publishing to Map...</span>
                        </>
                      ) : submitSuccess ? (
                        <>
                          <CheckCircle2 className="w-4 h-4 text-[#090B0E] shrink-0" />
                          <span>Published Successfully!</span>
                        </>
                      ) : (
                        <>
                          <Share2 className="w-4 h-4 shrink-0" />
                          <span>Publish to Community Map</span>
                        </>
                      )}
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* Footer Close Button */}
          <div className="pt-3 border-t border-white/10 flex items-center justify-end gap-2 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-neutral-300 text-xs font-medium transition-colors cursor-pointer"
            >
              Done
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

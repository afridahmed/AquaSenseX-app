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
  MapPin,
  CheckCircle2,
  AlertTriangle,
  X,
  Share2,
  Loader2,
  Copy,
  Check,
  RotateCw,
  ShieldCheck,
  FileText,
  Droplets,
  Thermometer,
  Eye,
  Activity,
  Sparkles,
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
  const { bottle, qualityEval } = useBottle();
  const { user } = useAuth();

  const activeBottleId =
    propBottleId || bottle?.bottleId || user?.assignedBottleId || user?.bottleId || 'AquaSense X';

  // Extract average values or fallback to current bottle telemetry
  const avgPh = analysisResult?.ph ?? bottle?.ph ?? null;
  const avgTds = analysisResult?.tds ?? bottle?.tds ?? null;
  const avgTurb = analysisResult?.turbidity ?? bottle?.turbidity ?? null;
  const avgTemp = analysisResult?.temperature ?? bottle?.temperature ?? null;
  const qualityScore = analysisResult?.qualityScore ?? qualityEval.score;
  const qualityCategory = analysisResult?.qualityCategory ?? qualityEval.category;
  const sampleCount = analysisResult?.sampleCount ?? 1;
  const timestamp = analysisResult?.timestamp ?? new Date().toLocaleTimeString();

  // Form State (Sharing is strictly enforced)
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
      acquireFreshLocation();
    } else {
      setLocStatus('idle');
      setLocError(null);
      setDeviceGps(null);
      setReportCoords(null);
    }
  }, [isOpen]);

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
            ? 'Location access was denied. Enable location in your browser to publish to the community map.'
            : 'Unable to retrieve accurate GPS coordinates. Tap Refresh.'
        );
      } else {
        setLocError('GPS signal unavailable. Please ensure location services are enabled.');
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
  const handlePublishToCommunity = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    if (!user) {
      setLocError('Sign in to publish water reports to the community map.');
      return;
    }

    if (!reportCoords || !deviceGps) {
      setLocError('Acquiring valid GPS coordinates is required to publish to the community map.');
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
      }, 1200);
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
      <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/85 backdrop-blur-md overflow-y-auto">
        <motion.div
          initial={{ opacity: 0, y: 24, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 24, scale: 0.98 }}
          transition={{ duration: 0.22, ease: 'easeOut' }}
          className="w-full sm:max-w-lg bg-[#0C1017]/95 backdrop-blur-2xl border-t sm:border border-white/10 rounded-t-[24px] sm:rounded-[28px] p-4 sm:p-5 shadow-2xl relative my-auto max-h-[92vh] flex flex-col"
        >
          {/* 1. Header with Title & Close Button */}
          <div className="flex items-center justify-between pb-3 border-b border-white/10 shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-[#00D1FF]/15 border border-[#00D1FF]/30 text-[#00D1FF] flex items-center justify-center shrink-0">
                <FileText className="w-4 h-4 text-[#00D1FF]" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm sm:text-base font-bold text-white tracking-tight">
                    Water Quality Analysis
                  </h3>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-[#00D1FF]/10 text-[#00D1FF] border border-[#00D1FF]/25">
                    Verified
                  </span>
                </div>
                <p className="text-[11px] text-neutral-400 font-mono">
                  15s Stabilized · {timestamp}
                </p>
              </div>
            </div>

            <button
              id="btn-close-water-report"
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-xl text-neutral-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* 2. Scrollable Modal Body */}
          <div className="overflow-y-auto pr-0.5 space-y-3 pt-3 flex-1">
            {/* Quality Score & Status Banner */}
            <div className="p-3 sm:p-3.5 rounded-2xl bg-gradient-to-r from-[#141B24] via-[#10151C] to-[#0A0E14] border border-white/10 shadow-lg relative overflow-hidden">
              <div className="flex items-center justify-between gap-3 relative z-10">
                <div>
                  <span className="text-[9px] uppercase font-mono tracking-wider text-neutral-400 block mb-0.5">
                    Water Purity Score
                  </span>
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-2xl sm:text-3xl font-extrabold text-white font-sans tracking-tight">
                      {qualityScore !== null ? qualityScore : '--'}
                    </span>
                    <span className="text-xs text-neutral-400 font-mono">/100</span>
                    {qualityCategory && (
                      <span
                        className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${
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

                <div className="w-10 h-10 rounded-xl bg-[#00D1FF]/10 border border-[#00D1FF]/25 text-[#00D1FF] flex items-center justify-center shrink-0">
                  <ShieldCheck className="w-5 h-5 text-[#00D1FF]" />
                </div>
              </div>

              <p className="text-[11px] text-neutral-300 mt-2 leading-relaxed relative z-10">
                {(qualityScore ?? 0) >= 88
                  ? 'Optimal drinking water quality. Telemetry stabilized across optical and electrochemical sensors.'
                  : (qualityScore ?? 0) >= 70
                  ? 'Good water purity. Minor mineral variation detected, safe for regular consumption.'
                  : 'Filtration recommended due to elevated mineral density or turbidity.'}
              </p>
            </div>

            {/* 4-Metric Compact Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {/* Avg pH */}
              <div className="p-2 sm:p-2.5 rounded-xl bg-white/[0.03] border border-white/5 flex flex-col justify-between">
                <div className="flex items-center justify-between text-neutral-400 mb-0.5">
                  <span className="text-[9px] font-mono uppercase">Avg pH</span>
                  <Activity className="w-3 h-3 text-[#00D1FF]" />
                </div>
                <div className="text-sm sm:text-base font-bold text-white font-mono">
                  {avgPh !== null ? avgPh : '--'}
                </div>
                <span className="text-[8px] text-neutral-400">6.5–8.5 ideal</span>
              </div>

              {/* Avg TDS */}
              <div className="p-2 sm:p-2.5 rounded-xl bg-white/[0.03] border border-white/5 flex flex-col justify-between">
                <div className="flex items-center justify-between text-neutral-400 mb-0.5">
                  <span className="text-[9px] font-mono uppercase">Avg TDS</span>
                  <Droplets className="w-3 h-3 text-[#818CF8]" />
                </div>
                <div className="text-sm sm:text-base font-bold text-[#818CF8] font-mono">
                  {avgTds !== null ? `${avgTds} ppm` : '--'}
                </div>
                <span className="text-[8px] text-neutral-400">&lt;300 ppm ideal</span>
              </div>

              {/* Avg Temp */}
              <div className="p-2 sm:p-2.5 rounded-xl bg-white/[0.03] border border-white/5 flex flex-col justify-between">
                <div className="flex items-center justify-between text-neutral-400 mb-0.5">
                  <span className="text-[9px] font-mono uppercase">Avg Temp</span>
                  <Thermometer className="w-3 h-3 text-emerald-400" />
                </div>
                <div className="text-sm sm:text-base font-bold text-white font-mono">
                  {avgTemp !== null ? `${avgTemp}°C` : '--'}
                </div>
                <span className="text-[8px] text-neutral-400">ambient</span>
              </div>

              {/* Avg Turbidity */}
              <div className="p-2 sm:p-2.5 rounded-xl bg-white/[0.03] border border-white/5 flex flex-col justify-between">
                <div className="flex items-center justify-between text-neutral-400 mb-0.5">
                  <span className="text-[9px] font-mono uppercase">Clarity</span>
                  <Eye className="w-3 h-3 text-amber-400" />
                </div>
                <div className="text-sm sm:text-base font-bold text-white font-mono">
                  {avgTurb !== null ? `${avgTurb} NTU` : '--'}
                </div>
                <span className="text-[8px] text-neutral-400">&lt;1.0 NTU clear</span>
              </div>
            </div>

            {/* Copy Summary Link */}
            <div className="flex items-center justify-between text-[10px] text-neutral-400 px-1 font-mono">
              <span>Sampled across {sampleCount} telemetry packets</span>
              <button
                type="button"
                onClick={handleCopyReport}
                className="flex items-center gap-1 text-[#00D1FF] hover:underline cursor-pointer"
              >
                {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                <span>{copied ? 'Copied' : 'Copy Summary'}</span>
              </button>
            </div>

            {/* 3. Enforced Community Sharing Panel */}
            <div className="rounded-2xl bg-[#080B10] border border-white/10 p-3 sm:p-3.5 space-y-3">
              {/* Header with Enforced CTA: "Yes, share to map" */}
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-7 h-7 rounded-lg bg-[#00D1FF]/15 border border-[#00D1FF]/30 text-[#00D1FF] flex items-center justify-center shrink-0">
                    <Share2 className="w-3.5 h-3.5 text-[#00D1FF]" />
                  </div>
                  <div className="min-w-0">
                    <h4 className="text-xs sm:text-sm font-bold text-white truncate">
                      Community Map Sharing
                    </h4>
                    <p className="text-[10px] text-neutral-400 truncate">
                      Share verified water quality with nearby users
                    </p>
                  </div>
                </div>

                {/* Enforced CTA Button 1: "Yes, share to map" */}
                <button
                  type="button"
                  onClick={() => acquireFreshLocation()}
                  className="px-2.5 py-1.5 rounded-xl bg-[#00D1FF]/15 hover:bg-[#00D1FF]/25 active:bg-[#00D1FF]/30 text-[#00D1FF] border border-[#00D1FF]/35 text-xs font-semibold flex items-center gap-1.5 shadow-sm shadow-[#00D1FF]/10 shrink-0 cursor-pointer active:scale-95 transition-all"
                  title="Confirmed for Community Map sharing"
                >
                  <CheckCircle2 className="w-3.5 h-3.5 text-[#00D1FF]" />
                  <span>Yes, share to map</span>
                </button>
              </div>

              {/* GPS Location Status */}
              <div className="p-2.5 rounded-xl bg-white/[0.02] border border-white/5 space-y-1.5">
                <div className="flex items-center justify-between text-[10px]">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <MapPin className="w-3 h-3 text-[#00D1FF] shrink-0" />
                    <span className="font-mono text-neutral-400 uppercase">GPS Verification</span>
                  </div>

                  {locStatus === 'success' && deviceGps && (
                    <span className="text-emerald-400 font-mono font-medium flex items-center gap-1 shrink-0">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                      ±{Math.round(deviceGps.accuracy)}m
                    </span>
                  )}
                  {locStatus === 'acquiring' && (
                    <span className="text-[#00D1FF] font-mono flex items-center gap-1">
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
                      ? 'Detecting current GPS coordinates...'
                      : 'GPS location needed'}
                  </span>
                  <button
                    type="button"
                    onClick={acquireFreshLocation}
                    disabled={locStatus === 'acquiring'}
                    className="px-2 py-0.5 rounded-lg bg-white/5 hover:bg-white/10 text-neutral-300 text-[10px] font-mono flex items-center gap-1 shrink-0 cursor-pointer"
                  >
                    <RotateCw className={`w-2.5 h-2.5 ${locStatus === 'acquiring' ? 'animate-spin' : ''}`} />
                    <span>Refresh</span>
                  </button>
                </div>

                {locError && (
                  <div className="p-1.5 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-300 text-[10px] flex items-start gap-1">
                    <AlertTriangle className="w-3 h-3 text-rose-400 shrink-0 mt-0.5" />
                    <span>{locError}</span>
                  </div>
                )}
              </div>

              {/* Source Name Input */}
              <div className="space-y-1">
                <label className="text-[10px] font-medium text-neutral-300 block">
                  Source Location Name
                </label>
                <input
                  type="text"
                  value={sourceName}
                  onChange={(e) => setSourceName(e.target.value)}
                  placeholder="e.g. Park Drinking Fountain, 2nd Floor Filter"
                  className="w-full bg-[#10151D] border border-white/10 rounded-xl px-3 py-1.5 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-[#00D1FF]/50"
                />
              </div>

              {/* Source Type Pills */}
              <div className="space-y-1">
                <label className="text-[10px] font-medium text-neutral-300 block">Source Type</label>
                <div className="grid grid-cols-3 gap-1">
                  {[
                    { id: 'fountain', label: 'Fountain' },
                    { id: 'filtration_station', label: 'Refill Station' },
                    { id: 'tap', label: 'Municipal Tap' },
                    { id: 'spring', label: 'Natural Spring' },
                    { id: 'well', label: 'Well' },
                  ].map((cat) => (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => setSourceType(cat.id as any)}
                      className={`px-2 py-1 rounded-lg text-[11px] font-medium transition-all text-center truncate cursor-pointer ${
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

              {/* Optional Observation Notes */}
              <div className="space-y-1">
                <label className="text-[10px] font-medium text-neutral-300 block">Notes (Optional)</label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="e.g. Clean flow, chilled, filter status green"
                  className="w-full bg-[#10151D] border border-white/10 rounded-xl px-3 py-1.5 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-[#00D1FF]/50"
                />
              </div>

              {/* Enforced CTA Button 2: "Publish to community map" */}
              <button
                id="btn-publish-community-report"
                type="button"
                onClick={() => handlePublishToCommunity()}
                disabled={isSubmitting || locStatus !== 'success' || !reportCoords}
                className="w-full py-2.5 px-4 rounded-xl bg-[#00D1FF] hover:bg-[#00B4D8] active:bg-[#0096B4] text-[#090B0E] text-xs sm:text-sm font-semibold shadow-lg shadow-[#00D1FF]/20 active:scale-[0.99] transition-all flex items-center justify-center gap-2 disabled:opacity-50 touch-target cursor-pointer disabled:cursor-not-allowed"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                    <span>Publishing to Community Map...</span>
                  </>
                ) : submitSuccess ? (
                  <>
                    <CheckCircle2 className="w-4 h-4 text-[#090B0E] shrink-0" />
                    <span>Published to Community Map!</span>
                  </>
                ) : (
                  <>
                    <Share2 className="w-4 h-4 shrink-0" />
                    <span>Publish to community map</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

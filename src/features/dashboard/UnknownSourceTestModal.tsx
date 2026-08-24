import React, { useState, useEffect } from 'react';
import { useBottle } from '../../context/BottleContext';
import { useAuth } from '../../context/AuthContext';
import { geocodingService } from '../../services/geocoding/geocodingService';
import { createCommunityReport, savePrivateWaterTest } from '../../services/community/communityService';
import { CommunityReport } from '../../types';
import {
  FlaskConical,
  MapPin,
  CheckCircle2,
  AlertTriangle,
  X,
  Share2,
  Lock,
  Loader2,
  Navigation,
  Sparkles,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface UnknownSourceTestModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccessPublish?: (report: CommunityReport) => void;
}

export const UnknownSourceTestModal: React.FC<UnknownSourceTestModalProps> = ({
  isOpen,
  onClose,
  onSuccessPublish,
}) => {
  const { bottle, qualityEval, recordSensorReading } = useBottle();
  const { user } = useAuth();

  const [sourceName, setSourceName] = useState<string>('');
  const [sourceType, setSourceType] = useState<CommunityReport['sourceType']>('fountain');
  const [notes, setNotes] = useState<string>('');

  // Geolocation state
  const [locState, setLocState] = useState<{
    status: 'idle' | 'acquiring' | 'success' | 'error';
    lat: number | null;
    lon: number | null;
    placeName: string;
    errorMessage: string;
  }>({
    status: 'idle',
    lat: null,
    lon: null,
    placeName: '',
    errorMessage: '',
  });

  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [submitSuccess, setSubmitSuccess] = useState<boolean>(false);
  const [isPrivateSaving, setIsPrivateSaving] = useState<boolean>(false);

  // Auto-acquire geolocation when modal opens
  useEffect(() => {
    if (isOpen) {
      acquireLocation();
    } else {
      // Reset state on close
      setSubmitSuccess(false);
      setIsSubmitting(false);
      setIsPrivateSaving(false);
    }
  }, [isOpen]);

  const acquireLocation = () => {
    if (!navigator.geolocation) {
      setLocState({
        status: 'error',
        lat: null,
        lon: null,
        placeName: '',
        errorMessage: 'Geolocation is not supported by your browser.',
      });
      return;
    }

    setLocState((prev) => ({ ...prev, status: 'acquiring', errorMessage: '' }));

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude;
        const lon = pos.coords.longitude;
        let place = `${lat.toFixed(4)}°, ${lon.toFixed(4)}°`;

        try {
          place = await geocodingService.reverseGeocode(lat, lon);
        } catch {
          // Fallback to coordinates
        }

        setLocState({
          status: 'success',
          lat,
          lon,
          placeName: place,
          errorMessage: '',
        });

        if (!sourceName) {
          setSourceName(place.split(',')[0] || 'Public Water Source');
        }
      },
      (err) => {
        let msg = 'Could not determine location.';
        if (err.code === err.PERMISSION_DENIED) {
          msg = 'Location permission denied. Please allow location access to report community sources.';
        } else if (err.code === err.POSITION_UNAVAILABLE) {
          msg = 'Location information is currently unavailable.';
        } else if (err.code === err.TIMEOUT) {
          msg = 'Location acquisition timed out. Tap retry.';
        }
        setLocState({
          status: 'error',
          lat: null,
          lon: null,
          placeName: '',
          errorMessage: msg,
        });
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 30000 }
    );
  };

  const handlePublishToCommunity = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    if (locState.lat === null || locState.lon === null) {
      setLocState((prev) => ({
        ...prev,
        errorMessage: 'A confirmed GPS location is required to publish a community map report.',
      }));
      return;
    }

    setIsSubmitting(true);
    try {
      const newReport = await createCommunityReport({
        uid: user.uid,
        bottleId: bottle?.bottleId || user.bottleId || 'ASX-9821-4402',
        authorName: user.name || 'AquaSense Contributor',
        sourceName: sourceName.trim() || locState.placeName || 'Community Water Source',
        sourceType,
        latitude: locState.lat,
        longitude: locState.lon,
        qualityScore: qualityEval.score,
        temperature: bottle?.temperature || 21.0,
        tds: bottle?.tds || 180,
        turbidity: bottle?.turbidity || 0.4,
        ph: bottle?.ph || 7.2,
        verifiedReports: 1,
        userHasVerified: true,
        notes: notes.trim() || 'Verified with AquaSense X smart sensor.',
      });

      setSubmitSuccess(true);
      setTimeout(() => {
        onSuccessPublish?.(newReport);
        onClose();
      }, 1400);
    } catch (err: any) {
      console.error('Error publishing community report:', err);
      setLocState((prev) => ({
        ...prev,
        errorMessage: err.message || 'Failed to publish community report. Please try again.',
      }));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleKeepPrivate = async () => {
    if (!user) return;
    setIsPrivateSaving(true);
    try {
      // 1. Save in user's private waterTests subcollection (never published to community)
      await savePrivateWaterTest({
        uid: user.uid,
        bottleId: bottle?.bottleId || user.bottleId || 'ASX-9821-4402',
        sourceName: sourceName.trim() || locState.placeName || 'Private Water Test',
        sourceType,
        latitude: locState.lat,
        longitude: locState.lon,
        qualityScore: qualityEval.score,
        temperature: bottle?.temperature || 21.0,
        tds: bottle?.tds || 180,
        turbidity: bottle?.turbidity || 0.4,
        ph: bottle?.ph || 7.2,
        notes: notes.trim() || 'Private water test from AquaSense X sensor.',
      });

      // 2. Also record in user's personal bottle sensor history (no community publication, no hydration intake)
      await recordSensorReading(
        notes ? `[Private Water Test: ${sourceName || 'Unknown Source'}] ${notes}` : `Private Water Test: ${sourceName || 'Unknown Source'}`
      );
      onClose();
    } catch (err) {
      console.warn('Private reading save deferred:', err);
      onClose();
    } finally {
      setIsPrivateSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/80 backdrop-blur-md">
        <motion.div
          initial={{ opacity: 0, y: 24, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 24, scale: 0.98 }}
          className="w-full sm:max-w-xl bg-[#12161C] border-t sm:border border-white/10 rounded-t-[28px] sm:rounded-[32px] p-5 sm:p-7 shadow-2xl relative max-h-[90vh] overflow-y-auto safe-area-pb"
        >
          {/* Header */}
          <div className="flex items-center justify-between pb-3.5 border-b border-white/10">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-[#00D1FF]/15 border border-[#00D1FF]/30 flex items-center justify-center">
                <FlaskConical className="w-4 h-4 text-[#00D1FF]" />
              </div>
              <div>
                <h3 className="text-sm sm:text-base font-semibold text-white">Test Water From a New Source</h3>
                <p className="text-[10px] sm:text-xs text-neutral-400">
                  Live sensor snapshot from {bottle?.bottleId || 'AquaSense X'}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-xl text-neutral-400 hover:text-white hover:bg-white/5 transition-colors touch-target sm:min-h-0 sm:min-w-0 flex items-center justify-center"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {submitSuccess ? (
            <div className="py-10 text-center space-y-3">
              <div className="w-14 h-14 rounded-full bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center mx-auto shadow-lg shadow-emerald-500/10">
                <CheckCircle2 className="w-8 h-8 text-emerald-400" />
              </div>
              <h4 className="text-lg font-semibold text-white">Published to AquaSense Community!</h4>
              <p className="text-xs text-neutral-400 max-w-sm mx-auto leading-relaxed">
                Your verified water quality test has been mapped. Nearby community members can now discover and verify this source.
              </p>
            </div>
          ) : (
            <form onSubmit={handlePublishToCommunity} className="mt-4 space-y-4">
              {/* Live Sensor Values Snapshot */}
              <div className="p-4 rounded-2xl bg-[#090B0E] border border-white/10 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#00D1FF]">
                    Captured Sensor Telemetry
                  </span>
                  <span
                    className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${qualityEval.badgeBg} ${qualityEval.badgeText} border border-current/20`}
                  >
                    {qualityEval.score}/100 • {qualityEval.category}
                  </span>
                </div>

                <div className="grid grid-cols-4 gap-2 text-center text-xs">
                  <div className="p-2 rounded-xl bg-white/[0.03] border border-white/5">
                    <span className="text-[9px] text-neutral-500 block font-mono">pH</span>
                    <span className="font-semibold text-white font-sans">{bottle?.ph ?? 7.2}</span>
                  </div>
                  <div className="p-2 rounded-xl bg-white/[0.03] border border-white/5">
                    <span className="text-[9px] text-neutral-500 block font-mono">TDS</span>
                    <span className="font-semibold text-white font-sans">{bottle?.tds ?? 180} ppm</span>
                  </div>
                  <div className="p-2 rounded-xl bg-white/[0.03] border border-white/5">
                    <span className="text-[9px] text-neutral-500 block font-mono">TURBIDITY</span>
                    <span className="font-semibold text-white font-sans">{bottle?.turbidity ?? 0.4} NTU</span>
                  </div>
                  <div className="p-2 rounded-xl bg-white/[0.03] border border-white/5">
                    <span className="text-[9px] text-neutral-500 block font-mono">TEMP</span>
                    <span className="font-semibold text-white font-sans">{bottle?.temperature ?? 21}°C</span>
                  </div>
                </div>

                <p className="text-[11px] text-neutral-400 leading-relaxed pt-1 border-t border-white/5">
                  {qualityEval.headline} — {qualityEval.description}
                </p>
              </div>

              {/* Location Detection Section */}
              <div className="p-3.5 rounded-2xl bg-[#090B0E] border border-white/10 space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs font-medium text-neutral-300">
                    <MapPin className="w-3.5 h-3.5 text-[#00D1FF]" />
                    <span>Test Location</span>
                  </div>

                  <button
                    type="button"
                    onClick={acquireLocation}
                    disabled={locState.status === 'acquiring'}
                    className="text-[11px] text-[#00D1FF] hover:underline flex items-center gap-1 disabled:opacity-50"
                  >
                    {locState.status === 'acquiring' ? (
                      <>
                        <Loader2 className="w-3 h-3 animate-spin" />
                        <span>Acquiring GPS...</span>
                      </>
                    ) : (
                      <>
                        <Navigation className="w-3 h-3" />
                        <span>{locState.status === 'success' ? 'Update GPS' : 'Detect Location'}</span>
                      </>
                    )}
                  </button>
                </div>

                {locState.status === 'success' && (
                  <div className="flex items-center gap-2 p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-300">
                    <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
                    <span className="truncate">{locState.placeName}</span>
                  </div>
                )}

                {locState.status === 'error' && (
                  <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs text-rose-300 flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400 mt-0.5" />
                    <div className="min-w-0">
                      <p className="leading-snug">{locState.errorMessage}</p>
                      <button
                        type="button"
                        onClick={acquireLocation}
                        className="text-[10px] text-white underline mt-1 font-medium"
                      >
                        Tap to retry location access
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Source Name & Type Form */}
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-neutral-300 mb-1.5">
                    Source Name / Identifier *
                  </label>
                  <input
                    type="text"
                    required
                    value={sourceName}
                    onChange={(e) => setSourceName(e.target.value)}
                    placeholder="e.g. Golden Gate Park Fountain #3, Gym Water Cooler"
                    className="w-full bg-[#090B0E] border border-white/10 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-[#00D1FF]/50"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-neutral-300 mb-1.5">
                      Source Category
                    </label>
                    <select
                      value={sourceType}
                      onChange={(e) => setSourceType(e.target.value as any)}
                      className="w-full bg-[#090B0E] border border-white/10 rounded-xl px-3 py-2.5 text-xs sm:text-sm text-white focus:outline-none focus:border-[#00D1FF]/50"
                    >
                      <option value="fountain">Public Drinking Fountain</option>
                      <option value="filtration_station">Bottle Refill Station</option>
                      <option value="tap">Municipal Tap</option>
                      <option value="spring">Natural Spring</option>
                      <option value="well">Groundwater Well</option>
                      <option value="other">Other Source</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-neutral-300 mb-1.5">
                      Observations / Tasting Notes
                    </label>
                    <input
                      type="text"
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="e.g. Crisp flow, cold, filter light green"
                      className="w-full bg-[#090B0E] border border-white/10 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-[#00D1FF]/50"
                    />
                  </div>
                </div>
              </div>

              {/* Action Buttons: Share vs Keep Private */}
              <div className="pt-2 space-y-2 sm:space-y-0 sm:flex sm:gap-3">
                <button
                  type="button"
                  onClick={handleKeepPrivate}
                  disabled={isPrivateSaving || isSubmitting}
                  className="w-full sm:flex-1 py-3 px-4 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] text-neutral-300 hover:text-white border border-white/10 text-xs font-medium transition-all flex items-center justify-center gap-1.5 touch-target sm:min-h-0"
                >
                  <Lock className="w-3.5 h-3.5" />
                  <span>{isPrivateSaving ? 'Saving Privately...' : 'Keep Private'}</span>
                </button>

                <button
                  type="submit"
                  disabled={isSubmitting || locState.lat === null}
                  className="w-full sm:flex-1 py-3 px-4 rounded-xl bg-[#00D1FF] hover:bg-[#00B4D8] text-[#090B0E] text-xs font-semibold shadow-lg shadow-[#00D1FF]/20 active:scale-95 transition-all flex items-center justify-center gap-1.5 disabled:opacity-50 touch-target sm:min-h-0"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Publishing to Map...</span>
                    </>
                  ) : (
                    <>
                      <Share2 className="w-4 h-4" />
                      <span>Share With Community</span>
                    </>
                  )}
                </button>
              </div>

              <p className="text-[10px] text-center text-neutral-500">
                Community reports are publicly visible to all AquaSense users. Hydration tracking remains unaffected.
              </p>
            </form>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

import React, { useState, useEffect, useRef } from 'react';
import { useBottle } from '../../context/BottleContext';
import { useAuth } from '../../context/AuthContext';
import {
  locationService,
  LocationError,
  LocationErrorCode,
  REPORT_LOCATION_ADJUSTMENT_RADIUS_METERS,
} from '../../services/location/locationService';
import { geocodingService } from '../../services/geocoding/geocodingService';
import { createCommunityReport } from '../../services/community/communityService';
import { CommunityReport } from '../../types';
import L from 'leaflet';
import {
  FlaskConical,
  MapPin,
  CheckCircle2,
  AlertTriangle,
  X,
  Share2,
  Loader2,
  Navigation,
  Edit3,
  Check,
  RefreshCw,
  Info,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface UnknownSourceTestModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccessPublish?: (report: CommunityReport) => void;
}

// Mini interactive map for pinning and fine-tuning report location within 100m
const MiniReportLocationMap: React.FC<{
  deviceLat: number;
  deviceLon: number;
  reportLat: number;
  reportLon: number;
  accuracy?: number;
  isAdjusting: boolean;
  onLocationAdjusted: (newLat: number, newLon: number) => void;
}> = ({
  deviceLat,
  deviceLon,
  reportLat,
  reportLon,
  accuracy,
  isAdjusting,
  onLocationAdjusted,
}) => {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const accuracyCircleRef = useRef<L.Circle | null>(null);
  const boundaryCircleRef = useRef<L.Circle | null>(null);

  const onAdjustRef = useRef(onLocationAdjusted);
  useEffect(() => {
    onAdjustRef.current = onLocationAdjusted;
  }, [onLocationAdjusted]);

  useEffect(() => {
    if (!mapContainerRef.current) return;
    if (mapInstanceRef.current) return;

    const map = L.map(mapContainerRef.current, {
      center: [reportLat, reportLon],
      zoom: 17,
      zoomControl: false,
      attributionControl: false,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      className: 'dark-tiles',
    }).addTo(map);

    // 100m Allowed adjustment boundary zone circle
    const boundaryCircle = L.circle([deviceLat, deviceLon], {
      radius: REPORT_LOCATION_ADJUSTMENT_RADIUS_METERS,
      color: '#00D1FF',
      dashArray: '4, 4',
      fillColor: '#00D1FF',
      fillOpacity: 0.08,
      weight: 1.5,
    }).addTo(map);
    boundaryCircleRef.current = boundaryCircle;

    // GPS Accuracy circle
    if (typeof accuracy === 'number' && accuracy > 0 && accuracy < 500) {
      const accuracyCircle = L.circle([deviceLat, deviceLon], {
        radius: accuracy,
        color: '#10B981',
        fillColor: '#10B981',
        fillOpacity: 0.1,
        weight: 1,
      }).addTo(map);
      accuracyCircleRef.current = accuracyCircle;
    }

    const pinIcon = L.divIcon({
      className: 'report-pin-marker',
      html: `
        <div style="display: flex; flex-direction: column; align-items: center; transform: translateY(-50%);">
          <div style="width: 28px; height: 28px; border-radius: 9999px; background: #00D1FF; border: 2.5px solid #FFFFFF; box-shadow: 0 0 14px #00D1FF; display: flex; align-items: center; justify-content: center; color: #090B0E;">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
              <path d="M12 2a8 8 0 0 0-8 8c0 5.25 8 12 8 12s8-6.75 8-12a8 8 0 0 0-8-8z"></path>
              <circle cx="12" cy="10" r="3"></circle>
            </svg>
          </div>
        </div>
      `,
      iconSize: [28, 28],
      iconAnchor: [14, 14],
    });

    const marker = L.marker([reportLat, reportLon], {
      icon: pinIcon,
      draggable: true,
      zIndexOffset: 1000,
    }).addTo(map);

    marker.on('dragend', (e: any) => {
      const pos = e.target.getLatLng();
      onAdjustRef.current(pos.lat, pos.lng);
    });

    map.on('click', (e: L.LeafletMouseEvent) => {
      onAdjustRef.current(e.latlng.lat, e.latlng.lng);
    });

    markerRef.current = marker;
    mapInstanceRef.current = map;

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // Update marker position and map center when report location changes
  useEffect(() => {
    if (!mapInstanceRef.current || !markerRef.current) return;
    markerRef.current.setLatLng([reportLat, reportLon]);
    mapInstanceRef.current.panTo([reportLat, reportLon]);
  }, [reportLat, reportLon]);

  // Update boundary and accuracy circles when device GPS changes
  useEffect(() => {
    if (!mapInstanceRef.current) return;

    if (boundaryCircleRef.current) {
      boundaryCircleRef.current.setLatLng([deviceLat, deviceLon]);
    }
    if (accuracyCircleRef.current) {
      accuracyCircleRef.current.setLatLng([deviceLat, deviceLon]);
      if (typeof accuracy === 'number') {
        accuracyCircleRef.current.setRadius(accuracy);
      }
    }
  }, [deviceLat, deviceLon, accuracy]);

  return (
    <div className="relative w-full h-32 sm:h-36 rounded-xl overflow-hidden border border-white/10 my-1.5">
      <div ref={mapContainerRef} className="w-full h-full" />
      {isAdjusting ? (
        <div className="absolute top-2 left-2 right-2 z-[500] bg-[#12161C]/90 backdrop-blur-sm border border-[#00D1FF]/40 px-2 py-1 rounded-lg text-[10px] text-[#00D1FF] flex items-center justify-between shadow-md">
          <span>Drag pin to fountain (max 100 m)</span>
        </div>
      ) : (
        <div className="absolute bottom-2 right-2 z-[500] bg-[#12161C]/85 backdrop-blur-sm border border-white/10 px-1.5 py-0.5 rounded text-[9px] text-neutral-400 font-mono">
          100 m Zone
        </div>
      )}
    </div>
  );
};

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

  // 12. Keep original device GPS separate from adjusted report location
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
  const [locError, setLocError] = useState<{
    code: LocationErrorCode;
    message: string;
  } | null>(null);
  const [adjustmentWarning, setAdjustmentWarning] = useState<string | null>(null);
  const [distanceFromGpsMeters, setDistanceFromGpsMeters] = useState<number>(0);
  const [isAdjustingLocation, setIsAdjustingLocation] = useState<boolean>(false);

  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [submitSuccess, setSubmitSuccess] = useState<boolean>(false);

  // Auto-acquire fresh GPS location when modal opens
  useEffect(() => {
    if (isOpen) {
      acquireFreshLocation();
    } else {
      setSubmitSuccess(false);
      setIsSubmitting(false);
      setIsAdjustingLocation(false);
      setAdjustmentWarning(null);
      setLocError(null);
      setLocStatus('idle');
      setDeviceGps(null);
      setReportCoords(null);
    }
  }, [isOpen]);

  /**
   * 1 & 2. Request a fresh device location using shared location service
   */
  const acquireFreshLocation = async () => {
    setLocStatus('acquiring');
    setLocError(null);
    setAdjustmentWarning(null);

    try {
      const position = await locationService.getFreshPosition(12000);
      const { latitude, longitude, accuracy, timestamp } = position;

      setDeviceGps({
        lat: latitude,
        lon: longitude,
        accuracy,
        timestamp,
      });

      // 6. Set initial report location equal to fresh device location
      setReportCoords({
        lat: latitude,
        lon: longitude,
      });
      setDistanceFromGpsMeters(0);
      setLocStatus('success');

      // Attempt reverse-geocoding for friendly display
      try {
        const address = await geocodingService.reverseGeocode(latitude, longitude);
        const resolvedName = address || `${latitude.toFixed(5)}°, ${longitude.toFixed(5)}°`;
        setPlaceName(resolvedName);
        if (!sourceName) {
          setSourceName(resolvedName.split(',')[0] || 'Public Water Fountain');
        }
      } catch {
        const fallbackName = `${latitude.toFixed(5)}°, ${longitude.toFixed(5)}°`;
        setPlaceName(fallbackName);
        if (!sourceName) {
          setSourceName('Public Water Fountain');
        }
      }
    } catch (err: any) {
      console.warn('GPS fresh position acquisition failed:', err);
      setLocStatus('error');
      setDeviceGps(null);
      setReportCoords(null);

      if (err instanceof LocationError) {
        setLocError({
          code: err.code,
          message: getFriendlyErrorMessage(err.code, err.message),
        });
      } else {
        setLocError({
          code: LocationErrorCode.UNKNOWN,
          message: 'Unable to retrieve your current GPS location. Please ensure location services are enabled and tap Retry.',
        });
      }
    }
  };

  const getFriendlyErrorMessage = (code: LocationErrorCode, defaultMsg: string): string => {
    switch (code) {
      case LocationErrorCode.PERMISSION_DENIED:
        return 'Location permission was denied. Please allow location access in your browser or device settings to report water sources.';
      case LocationErrorCode.POSITION_UNAVAILABLE:
        return 'GPS position is currently unavailable on your device. Please verify location services are turned on.';
      case LocationErrorCode.TIMEOUT:
        return 'GPS location request timed out. Please check signal and tap Retry.';
      case LocationErrorCode.UNSUPPORTED:
        return 'Geolocation is not supported by your current browser environment.';
      default:
        return defaultMsg || 'An unexpected error occurred while retrieving GPS position.';
    }
  };

  /**
   * 9, 10, 11. Allow pin adjustment ONLY within centralized 100-meter radius
   */
  const handleLocationAdjusted = async (newLat: number, newLon: number) => {
    if (!deviceGps) return;

    const withinRadius = locationService.isWithinReportAdjustmentRadius(
      { latitude: deviceGps.lat, longitude: deviceGps.lon },
      { latitude: newLat, longitude: newLon }
    );

    const distance = Math.round(
      locationService.calculateDistanceMeters(
        deviceGps.lat,
        deviceGps.lon,
        newLat,
        newLon
      )
    );

    if (!withinRadius) {
      // 11. Reject change and explain location must remain within 100 meters
      setAdjustmentWarning(
        `Adjustment rejected: The water report pin must remain within 100 meters of your detected GPS location (selected point is ${distance}m away).`
      );
      return;
    }

    setAdjustmentWarning(null);
    setDistanceFromGpsMeters(distance);
    setReportCoords({ lat: newLat, lon: newLon });

    try {
      const address = await geocodingService.reverseGeocode(newLat, newLon);
      if (address) {
        setPlaceName(address);
      }
    } catch {
      // Retain previous or coordinate string
    }
  };

  const handleResetToGps = () => {
    if (!deviceGps) return;
    setReportCoords({ lat: deviceGps.lat, lon: deviceGps.lon });
    setDistanceFromGpsMeters(0);
    setAdjustmentWarning(null);
  };

  /**
   * 13. Validate final report location against original fresh GPS location before publishing
   */
  const handlePublishToCommunity = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    if (!deviceGps || !reportCoords) {
      setLocError({
        code: LocationErrorCode.POSITION_UNAVAILABLE,
        message: 'A confirmed device GPS location is required to publish a community report.',
      });
      return;
    }

    const isValidAdjustment = locationService.isWithinReportAdjustmentRadius(
      { latitude: deviceGps.lat, longitude: deviceGps.lon },
      { latitude: reportCoords.lat, longitude: reportCoords.lon }
    );

    if (!isValidAdjustment) {
      setAdjustmentWarning(
        'Cannot publish: The report pin must be within 100 meters of your verified device location.'
      );
      return;
    }

    setIsSubmitting(true);
    try {
      const newReport = await createCommunityReport({
        uid: user.uid,
        bottleId: bottle?.bottleId || user.bottleId || 'ASX-9821-4402',
        authorName: user.name || 'AquaSense Contributor',
        sourceName: sourceName.trim() || placeName || 'Community Water Source',
        sourceType,
        latitude: reportCoords.lat,
        longitude: reportCoords.lon,
        originalDeviceLat: deviceGps.lat,
        originalDeviceLon: deviceGps.lon,
        gpsAccuracy: deviceGps.accuracy,
        adjustmentDistanceMeters: distanceFromGpsMeters,
        qualityScore: qualityEval.score,
        temperature: bottle?.temperature || 21.0,
        tds: bottle?.tds || 180,
        turbidity: bottle?.turbidity || 0.4,
        ph: bottle?.ph || 7.2,
        verifiedReports: 1,
        userHasVerified: true,
        notes: notes.trim() || 'Verified with AquaSense X optical & electrical sensor.',
      });

      setSubmitSuccess(true);
      setTimeout(() => {
        onSuccessPublish?.(newReport);
        onClose();
      }, 1300);
    } catch (err) {
      console.warn('Publish failed:', err);
      setLocError({
        code: LocationErrorCode.UNKNOWN,
        message: 'Failed to publish report to the community. Please retry.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/80 backdrop-blur-md">
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20, scale: 0.98 }}
          className="w-full sm:max-w-xl bg-[#12161C] border-t sm:border border-white/10 rounded-t-[24px] sm:rounded-[28px] p-3.5 xs:p-4 sm:p-6 shadow-2xl relative max-h-[90vh] overflow-y-auto safe-area-pb"
        >
          {/* Header */}
          <div className="flex items-center justify-between pb-3 border-b border-white/10">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-xl bg-[#00D1FF]/15 border border-[#00D1FF]/30 flex items-center justify-center shrink-0">
                <FlaskConical className="w-4 h-4 text-[#00D1FF]" />
              </div>
              <div className="min-w-0">
                <h3 className="text-sm sm:text-base font-semibold text-white truncate">
                  Test & Report Water
                </h3>
                <p className="text-[11px] text-neutral-400 font-normal truncate">
                  Sensor snapshot · {bottle?.bottleId || 'AquaSense X'}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-white/5 transition-colors touch-target sm:min-h-0 sm:min-w-0 flex items-center justify-center cursor-pointer shrink-0"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {submitSuccess ? (
            <div className="py-8 text-center space-y-2.5">
              <div className="w-12 h-12 rounded-full bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center mx-auto shadow-lg shadow-emerald-500/10">
                <CheckCircle2 className="w-7 h-7 text-emerald-400" />
              </div>
              <h4 className="text-base font-semibold text-white">Published to Community Map!</h4>
              <p className="text-xs text-neutral-400 max-w-sm mx-auto leading-relaxed">
                Your verified water test is now live on the AquaSense Global Map for nearby members.
              </p>
            </div>
          ) : (
            <form onSubmit={handlePublishToCommunity} className="mt-3 space-y-3">
              {/* 1. Captured Sensor Telemetry (Single-Line Concept on Mobile) */}
              <div className="p-3 sm:p-3.5 rounded-xl sm:rounded-2xl bg-[#090B0E] border border-white/10 space-y-2">
                <div className="flex items-center justify-between gap-2 flex-nowrap">
                  <span className="text-[10px] uppercase font-mono tracking-wider text-neutral-400 shrink-0">
                    Captured Sensor Telemetry
                  </span>
                  <span
                    className={`text-xs font-semibold px-2 py-0.5 rounded-full ${qualityEval.badgeBg} ${qualityEval.badgeText} border border-current/20 whitespace-nowrap shrink-0`}
                  >
                    {qualityEval.score}/100 · {qualityEval.category}
                  </span>
                </div>

                <div className="grid grid-cols-4 gap-1.5 sm:gap-2 text-center">
                  <div className="py-1.5 px-1 rounded-lg bg-white/[0.03] border border-white/5">
                    <span className="text-[9px] text-neutral-400 block font-mono">pH</span>
                    <span className="font-semibold text-xs sm:text-sm text-white font-sans">{bottle?.ph ?? 7.2}</span>
                  </div>
                  <div className="py-1.5 px-1 rounded-lg bg-white/[0.03] border border-white/5">
                    <span className="text-[9px] text-neutral-400 block font-mono">TDS</span>
                    <span className="font-semibold text-xs sm:text-sm text-white font-sans">{bottle?.tds ?? 180} <span className="text-[9px] text-neutral-400 font-normal">ppm</span></span>
                  </div>
                  <div className="py-1.5 px-1 rounded-lg bg-white/[0.03] border border-white/5">
                    <span className="text-[9px] text-neutral-400 block font-mono">TURB</span>
                    <span className="font-semibold text-xs sm:text-sm text-white font-sans">{bottle?.turbidity ?? 0.4} <span className="text-[9px] text-neutral-400 font-normal">NTU</span></span>
                  </div>
                  <div className="py-1.5 px-1 rounded-lg bg-white/[0.03] border border-white/5">
                    <span className="text-[9px] text-neutral-400 block font-mono">TEMP</span>
                    <span className="font-semibold text-xs sm:text-sm text-white font-sans">{bottle?.temperature ?? 21}°C</span>
                  </div>
                </div>
              </div>

              {/* 2. Confirmed GPS Report Location */}
              <div className="p-3 sm:p-3.5 rounded-xl sm:rounded-2xl bg-[#090B0E] border border-white/10 space-y-2">
                {/* Single-line Header with live detected accuracy */}
                <div className="flex items-center justify-between gap-2 flex-nowrap">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <MapPin className="w-3.5 h-3.5 text-[#00D1FF] shrink-0" />
                    <span className="text-[10px] uppercase font-mono tracking-wider text-neutral-400 truncate">
                      GPS Report Location
                    </span>
                  </div>

                  {locStatus === 'success' && deviceGps && (
                    <span className="text-[10px] text-emerald-400 font-mono font-medium flex items-center gap-1 shrink-0">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block animate-pulse" />
                      ±{Math.round(deviceGps.accuracy)} m accuracy
                    </span>
                  )}
                  {locStatus === 'acquiring' && (
                    <span className="text-[10px] text-[#00D1FF] font-mono flex items-center gap-1 shrink-0">
                      <Loader2 className="w-2.5 h-2.5 animate-spin" />
                      Detecting...
                    </span>
                  )}
                  {locStatus === 'error' && (
                    <span className="text-[10px] text-rose-400 font-mono shrink-0">
                      Unavailable
                    </span>
                  )}
                </div>

                {/* Compact Map Actions */}
                <div className="flex items-center justify-between gap-2">
                  {locStatus === 'success' && (
                    <button
                      id="btn-modal-adjust-pin"
                      type="button"
                      onClick={() => setIsAdjustingLocation(!isAdjustingLocation)}
                      className={`flex items-center gap-1 px-2.5 py-1 rounded-lg border text-[11px] font-medium transition-all cursor-pointer ${
                        isAdjustingLocation
                          ? 'bg-[#00D1FF]/20 text-[#00D1FF] border-[#00D1FF]/50 shadow-sm'
                          : 'bg-white/5 hover:bg-white/10 text-neutral-300 hover:text-white border-white/10'
                      }`}
                    >
                      <Edit3 className="w-3 h-3 text-[#00D1FF]" />
                      <span>{isAdjustingLocation ? 'Done Adjusting' : 'Adjust Pin · 100 m'}</span>
                    </button>
                  )}

                  <button
                    id="btn-modal-refresh-gps"
                    type="button"
                    onClick={acquireFreshLocation}
                    disabled={locStatus === 'acquiring'}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-neutral-300 hover:text-white border border-white/10 text-[11px] font-medium transition-all ml-auto disabled:opacity-50 cursor-pointer"
                  >
                    {locStatus === 'acquiring' ? (
                      <>
                        <Loader2 className="w-3 h-3 animate-spin text-[#00D1FF]" />
                        <span>Acquiring...</span>
                      </>
                    ) : (
                      <>
                        <Navigation className="w-3 h-3 text-[#00D1FF]" />
                        <span>Refresh GPS</span>
                      </>
                    )}
                  </button>
                </div>

                {/* Loading State */}
                {locStatus === 'acquiring' && (
                  <div className="flex items-center gap-2 p-2.5 bg-[#00D1FF]/10 border border-[#00D1FF]/20 rounded-xl text-xs text-[#00D1FF]">
                    <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
                    <span>Detecting verified device GPS coordinates...</span>
                  </div>
                )}

                {/* Success State: Place label, status line & interactive mini map */}
                {locStatus === 'success' && deviceGps && reportCoords && (
                  <div className="space-y-1.5 pt-0.5">
                    <div className="flex items-center justify-between text-xs text-neutral-400 px-0.5">
                      <span className="truncate max-w-[170px] xs:max-w-[210px] sm:max-w-xs text-neutral-200 text-[11px] font-medium">
                        {placeName}
                      </span>
                      {distanceFromGpsMeters > 0 ? (
                        <div className="flex items-center gap-1.5 shrink-0">
                          <span className="text-amber-300 text-[11px] font-mono font-medium">
                            Adjusted · {distanceFromGpsMeters} m
                          </span>
                          <button
                            type="button"
                            onClick={handleResetToGps}
                            className="text-[10px] text-cyan-400 hover:text-cyan-300 underline cursor-pointer"
                          >
                            Reset
                          </button>
                        </div>
                      ) : (
                        <span className="text-emerald-400/90 text-[11px] font-mono shrink-0">
                          GPS position
                        </span>
                      )}
                    </div>

                    {/* Interactive Mini Map restricted to 100m */}
                    <MiniReportLocationMap
                      deviceLat={deviceGps.lat}
                      deviceLon={deviceGps.lon}
                      reportLat={reportCoords.lat}
                      reportLon={reportCoords.lon}
                      accuracy={deviceGps.accuracy}
                      isAdjusting={isAdjustingLocation}
                      onLocationAdjusted={handleLocationAdjusted}
                    />

                    {/* Adjustment warning banner if user attempts > 100m */}
                    {adjustmentWarning && (
                      <div className="p-2 rounded-xl bg-amber-500/15 border border-amber-500/30 text-xs text-amber-300 flex items-start gap-2">
                        <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-amber-400 mt-0.5" />
                        <p className="leading-snug text-[11px]">{adjustmentWarning}</p>
                      </div>
                    )}
                  </div>
                )}

                {/* Error State */}
                {locStatus === 'error' && (
                  <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs text-rose-300 flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400 mt-0.5" />
                    <div className="min-w-0 flex-1">
                      <p className="leading-snug text-rose-300/90 text-[11px]">
                        {locError?.message || 'Unable to detect device GPS position.'}
                      </p>
                      <button
                        type="button"
                        onClick={acquireFreshLocation}
                        className="mt-1.5 px-2.5 py-1 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/40 text-[11px] font-semibold text-white flex items-center gap-1 transition-colors cursor-pointer"
                      >
                        <RefreshCw className="w-3 h-3" />
                        <span>Retry GPS</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* 3. Source Name & Type Form */}
              <div className="space-y-2.5">
                <div>
                  <label className="block text-xs font-medium text-neutral-300 mb-1">
                    Source Name / Identifier *
                  </label>
                  <input
                    type="text"
                    required
                    value={sourceName}
                    onChange={(e) => setSourceName(e.target.value)}
                    placeholder="e.g. Golden Gate Fountain #3, Trailhead Tap"
                    className="w-full bg-[#090B0E] border border-white/10 rounded-xl px-3 py-2 text-xs sm:text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-[#00D1FF]/50"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-xs font-medium text-neutral-300 mb-1">
                      Source Category
                    </label>
                    <select
                      value={sourceType}
                      onChange={(e) => setSourceType(e.target.value as any)}
                      className="w-full bg-[#090B0E] border border-white/10 rounded-xl px-3 py-2 text-xs sm:text-sm text-white focus:outline-none focus:border-[#00D1FF]/50"
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
                    <label className="block text-xs font-medium text-neutral-300 mb-1">
                      Observations / Tasting Notes
                    </label>
                    <input
                      type="text"
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="e.g. Cold flow, clear, filter light active"
                      className="w-full bg-[#090B0E] border border-white/10 rounded-xl px-3 py-2 text-xs sm:text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-[#00D1FF]/50"
                    />
                  </div>
                </div>
              </div>

              {/* 4. Action Area: Share With Community */}
              <div className="pt-1">
                <button
                  id="btn-modal-share-community"
                  type="submit"
                  disabled={isSubmitting || locStatus !== 'success' || !reportCoords}
                  className="w-full py-3 px-4 rounded-xl bg-[#00D1FF] hover:bg-[#00B4D8] active:bg-[#0096B4] text-[#090B0E] text-xs sm:text-sm font-semibold shadow-lg shadow-[#00D1FF]/20 active:scale-[0.99] transition-all flex items-center justify-center gap-2 disabled:opacity-50 touch-target cursor-pointer"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                      <span>Publishing to Map...</span>
                    </>
                  ) : (
                    <>
                      <Share2 className="w-4 h-4 shrink-0" />
                      <span>Share With Community</span>
                    </>
                  )}
                </button>
              </div>

              <p className="text-[10px] text-center text-neutral-400">
                Your verified report will be published to the public AquaSense Community Map.
              </p>
            </form>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
};


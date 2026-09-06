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
import { evaluateWaterQuality } from '../../services/waterQuality/qualityEvaluator';
import { AnalysisResult } from '../dashboard/TestWaterActionCard';
import { WaterAnalysisReportModal } from '../dashboard/WaterAnalysisReportModal';
import { SmartwatchECGTelemetryView } from '../dashboard/SmartwatchECGTelemetryView';
import { BottleData, CommunityReport } from '../../types';
import L from 'leaflet';
import {
  FlaskConical,
  MapPin,
  CheckCircle2,
  AlertTriangle,
  Share2,
  Loader2,
  Navigation,
  RefreshCw,
  Info,
  Droplets,
  Thermometer,
  Eye,
  Activity,
  WifiOff,
  RotateCw,
  Sparkles,
  Clock,
  ShieldCheck,
  FileText,
  ArrowRight,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface CommunityReportModeProps {
  onSuccessPublish: (report: CommunityReport) => void;
  onCancel?: () => void;
  online?: boolean;
}

// Mini interactive map for pinning and fine-tuning report location within 100m
const ReportBoundaryMap: React.FC<{
  deviceLat: number;
  deviceLon: number;
  reportLat: number;
  reportLon: number;
  accuracy?: number;
  onLocationAdjusted: (newLat: number, newLon: number) => void;
}> = ({
  deviceLat,
  deviceLon,
  reportLat,
  reportLon,
  accuracy,
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
          <div style="width: 30px; height: 30px; border-radius: 9999px; background: #00D1FF; border: 2.5px solid #FFFFFF; box-shadow: 0 0 16px #00D1FF; display: flex; align-items: center; justify-content: center; color: #090B0E;">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
              <path d="M12 2a8 8 0 0 0-8 8c0 5.25 8 12 8 12s8-6.75 8-12a8 8 0 0 0-8-8z"></path>
              <circle cx="12" cy="10" r="3"></circle>
            </svg>
          </div>
        </div>
      `,
      iconSize: [30, 30],
      iconAnchor: [15, 15],
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
    <div className="relative w-full h-44 sm:h-52 lg:flex-1 lg:min-h-[220px] rounded-2xl overflow-hidden border border-white/10 my-2">
      <div ref={mapContainerRef} className="w-full h-full min-h-[176px]" />
      <div className="absolute top-2 left-2 right-2 sm:top-2.5 sm:left-2.5 sm:right-2.5 z-[500] bg-[#12161C]/90 backdrop-blur-md border border-[#00D1FF]/40 px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-xl text-[10px] sm:text-[11px] text-[#00D1FF] flex items-center justify-between shadow-lg">
        <span className="font-medium sm:hidden">Adjust pin · max 100 m</span>
        <span className="font-medium hidden sm:inline">Tap or drag pin to fine-tune exact fountain location</span>
        <span className="font-mono text-[9px] sm:text-[10px] bg-[#00D1FF]/20 px-1.5 sm:px-2 py-0.5 rounded-full text-cyan-300">
          Max 100m
        </span>
      </div>
      <div className="absolute bottom-2 right-2 sm:bottom-2.5 sm:right-2.5 z-[500] bg-[#12161C]/85 backdrop-blur-sm border border-white/10 px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-lg text-[9px] sm:text-[10px] text-neutral-300 font-mono">
        100m Allowed Zone
      </div>
    </div>
  );
};

export const CommunityReportMode: React.FC<CommunityReportModeProps> = ({
  onSuccessPublish,
  onCancel,
  online = true,
}) => {
  const { bottle, qualityEval, isDeviceOnline: contextIsDeviceOnline } = useBottle();
  const { user } = useAuth();
  const isDeviceOnline = online && (contextIsDeviceOnline ?? (bottle?.online ?? false));

  const [sourceName, setSourceName] = useState<string>('');
  const [sourceType, setSourceType] = useState<CommunityReport['sourceType']>('fountain');
  const [notes, setNotes] = useState<string>('');

  // Keep original device GPS separate from adjusted report location
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

  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [submitSuccess, setSubmitSuccess] = useState<boolean>(false);

  // 15-second smartwatch sampling engine for Community Report Mode
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [scanProgress, setScanProgress] = useState<number>(0);
  const [readingBuffer, setReadingBuffer] = useState<BottleData[]>([]);
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [isReportModalOpen, setIsReportModalOpen] = useState<boolean>(false);

  const readingBufferRef = useRef<BottleData[]>([]);
  useEffect(() => {
    readingBufferRef.current = readingBuffer;
  }, [readingBuffer]);

  useEffect(() => {
    if (!isAnalyzing || !bottle) return;
    setReadingBuffer((prev) => [...prev, bottle]);
  }, [bottle, isAnalyzing]);

  useEffect(() => {
    if (!isDeviceOnline && isAnalyzing) {
      setIsAnalyzing(false);
      setScanProgress(0);
      setReadingBuffer([]);
    }
  }, [isDeviceOnline, isAnalyzing]);

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
        finalizeCommunityAnalysis();
      }
    }, INTERVAL_MS);

    return () => {
      clearInterval(progressTimer);
    };
  }, [isAnalyzing]);

  const finalizeCommunityAnalysis = () => {
    const samples =
      readingBufferRef.current.length > 0
        ? readingBufferRef.current
        : bottle
        ? [bottle]
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
      : (bottle?.ph ?? null);
    const avgTds = validTds.length
      ? Math.round(validTds.reduce((a, b) => a + b, 0) / validTds.length)
      : (bottle?.tds ?? null);
    const avgTemp = validTemp.length
      ? Number((validTemp.reduce((a, b) => a + b, 0) / validTemp.length).toFixed(1))
      : (bottle?.temperature ?? null);
    const avgTurb = validTurb.length
      ? Number((validTurb.reduce((a, b) => a + b, 0) / validTurb.length).toFixed(2))
      : (bottle?.turbidity ?? null);

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
  };

  const handleStartAnalysis = () => {
    if (!isDeviceOnline) return;
    setIsAnalyzing(true);
    setScanProgress(0);
    if (bottle) {
      setReadingBuffer([bottle]);
    } else {
      setReadingBuffer([]);
    }
  };

  // Auto-acquire fresh GPS location upon entering Report mode
  useEffect(() => {
    acquireFreshLocation();
  }, []);

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

      // Initial report location equal to fresh device GPS
      setReportCoords({
        lat: latitude,
        lon: longitude,
      });
      setDistanceFromGpsMeters(0);
      setLocStatus('success');

      // Reverse-geocode to prefill a friendly name
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
        return 'Location permission was denied. Please allow location access in your browser or device settings to test & report water.';
      case LocationErrorCode.POSITION_UNAVAILABLE:
        return 'GPS position is currently unavailable on your device. Please verify location services are turned on.';
      case LocationErrorCode.TIMEOUT:
        return 'GPS location request timed out. Please check signal and tap Retry.';
      case LocationErrorCode.UNSUPPORTED:
        return 'Geolocation is not supported by your current browser environment or requires HTTPS.';
      default:
        return defaultMsg || 'An unexpected error occurred while retrieving GPS position.';
    }
  };

  // Allow pin adjustment ONLY within centralized 100-meter radius
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

  // Validate and publish to Community Map
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
      const verifiedPh = analysisResult?.ph ?? bottle?.ph ?? 7.2;
      const verifiedTds = analysisResult?.tds ?? bottle?.tds ?? 150;
      const verifiedTemp = analysisResult?.temperature ?? bottle?.temperature ?? 22.0;
      const verifiedTurb = analysisResult?.turbidity ?? bottle?.turbidity ?? 0.35;
      const verifiedScore = analysisResult?.qualityScore ?? qualityEval.score;

      const newReport = await createCommunityReport({
        uid: user.uid,
        bottleId: bottle?.bottleId || user.bottleId || '',
        authorName: user.name || 'AquaSense Contributor',
        sourceName: sourceName.trim() || placeName || 'Community Water Source',
        sourceType,
        latitude: reportCoords.lat,
        longitude: reportCoords.lon,
        originalDeviceLat: deviceGps.lat,
        originalDeviceLon: deviceGps.lon,
        gpsAccuracy: deviceGps.accuracy,
        adjustmentDistanceMeters: distanceFromGpsMeters,
        qualityScore: verifiedScore,
        temperature: verifiedTemp,
        tds: verifiedTds,
        turbidity: verifiedTurb,
        ph: verifiedPh,
        verifiedReports: 1,
        userHasVerified: true,
        notes: notes.trim() || (analysisResult ? `Verified 15-second stabilized analysis via ${bottle?.bottleId || 'AquaSense X'}.` : 'Verified with AquaSense X optical & electrical sensor.'),
      });

      setSubmitSuccess(true);
      setTimeout(() => {
        onSuccessPublish(newReport);
      }, 1200);
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

  const categories: { id: CommunityReport['sourceType']; label: string }[] = [
    { id: 'fountain', label: 'Drinking Fountain' },
    { id: 'filtration_station', label: 'Refill Station' },
    { id: 'tap', label: 'Municipal Tap' },
    { id: 'spring', label: 'Natural Spring' },
    { id: 'well', label: 'Groundwater Well' },
  ];

  return (
    <div className="space-y-4">
      {/* Success Notification */}
      {submitSuccess && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-4 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 flex items-center gap-3 text-emerald-300 shadow-xl"
        >
          <CheckCircle2 className="w-6 h-6 text-emerald-400 shrink-0" />
          <div>
            <h4 className="font-semibold text-white text-sm">Report Published to Community!</h4>
            <p className="text-xs text-emerald-300">
              Your water test is now live on the AquaSense Global Map. Transitioning to Explore...
            </p>
          </div>
        </motion.div>
      )}

      {/* Main Report Container */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 sm:gap-4 lg:gap-5 items-stretch">
        {/* Left Column: GPS & Location Boundary Map (6 cols on lg) */}
        <div className="lg:col-span-6 bg-[#12161C] p-3.5 sm:p-5 rounded-2xl sm:rounded-[28px] border border-white/5 shadow-2xl flex flex-col justify-between space-y-3.5">
          <div className="space-y-3.5 flex-1 flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between pb-2.5 border-b border-white/10 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-[#00D1FF]/15 border border-[#00D1FF]/30 flex items-center justify-center">
                  <Navigation className="w-4 h-4 text-[#00D1FF]" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-white">Physical Location Verification</h3>
                  <p className="text-[11px] text-neutral-400">Strict GPS verification for authentic reports</p>
                </div>
              </div>

              <button
                type="button"
                onClick={acquireFreshLocation}
                disabled={locStatus === 'acquiring'}
                title="Refresh GPS"
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-neutral-300 hover:text-white border border-white/10 text-[11px] font-medium transition-colors cursor-pointer"
              >
                <RefreshCw className={`w-3 h-3 ${locStatus === 'acquiring' ? 'animate-spin text-[#00D1FF]' : ''}`} />
                <span className="hidden sm:inline">Refresh</span>
              </button>
            </div>

            {/* GPS Status States */}
            {locStatus === 'acquiring' && (
              <div className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl bg-[#00D1FF]/10 border border-[#00D1FF]/20 text-xs text-[#00D1FF]">
                <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                <span>Acquiring high-precision GPS position from device...</span>
              </div>
            )}

            {locStatus === 'error' && locError && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-xs text-rose-300 space-y-2">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-rose-200">GPS Required for Community Reports</p>
                    <p className="text-[11px] text-rose-300/90 mt-0.5">{locError.message}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={acquireFreshLocation}
                  className="w-full py-1.5 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-white font-semibold text-xs transition-colors flex items-center justify-center gap-1.5"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Retry GPS Detection</span>
                </button>
              </div>
            )}

            {locStatus === 'success' && deviceGps && reportCoords && (
              <div className="space-y-2.5 flex-1 flex flex-col">
                {/* Confirmed GPS Coordinate Details */}
                <div className="p-2.5 rounded-xl bg-[#090B0E] border border-white/5 text-xs flex flex-wrap items-center justify-between gap-2 shrink-0">
                  <div className="flex items-center gap-2 min-w-0">
                    <MapPin className="w-3.5 h-3.5 text-[#00D1FF] shrink-0" />
                    <div className="truncate">
                      <span className="font-mono text-white text-[11px]">
                        {reportCoords.lat.toFixed(5)}°, {reportCoords.lon.toFixed(5)}°
                      </span>
                      {placeName && (
                        <p className="text-[10px] text-neutral-400 truncate">{placeName}</p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {typeof deviceGps.accuracy === 'number' && (
                      <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                        ±{Math.round(deviceGps.accuracy)}m GPS
                      </span>
                    )}
                    {distanceFromGpsMeters > 0 && (
                      <button
                        type="button"
                        onClick={handleResetToGps}
                        className="text-[10px] text-cyan-400 hover:text-white underline cursor-pointer"
                      >
                        Reset to GPS
                      </button>
                    )}
                  </div>
                </div>

                {/* 100m Adjustment Interactive Map */}
                <ReportBoundaryMap
                  deviceLat={deviceGps.lat}
                  deviceLon={deviceGps.lon}
                  reportLat={reportCoords.lat}
                  reportLon={reportCoords.lon}
                  accuracy={deviceGps.accuracy}
                  onLocationAdjusted={handleLocationAdjusted}
                />

                {/* Adjustment rejected or active distance feedback */}
                {adjustmentWarning ? (
                  <div className="p-2 rounded-xl bg-amber-500/15 border border-amber-500/30 text-[11px] text-amber-300 flex items-start gap-1.5 shrink-0">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                    <span>{adjustmentWarning}</span>
                  </div>
                ) : distanceFromGpsMeters > 0 ? (
                  <div className="px-2.5 py-1 rounded-lg bg-white/[0.04] border border-white/10 text-[10px] text-neutral-300 flex items-center justify-between shrink-0">
                    <span>Pin adjusted <strong>{distanceFromGpsMeters}m</strong> from detected GPS</span>
                    <span className="text-cyan-400">Within 100m limit ✓</span>
                  </div>
                ) : null}
              </div>
            )}
          </div>

          {/* Privacy info */}
          <div className="pt-2 border-t border-white/5 flex items-center gap-2 text-[10px] text-neutral-400 shrink-0 mt-2">
            <Info className="w-3.5 h-3.5 text-[#00D1FF] shrink-0" />
            <span>GPS location is only sampled on-demand when creating a report.</span>
          </div>
        </div>

        {/* Right Column: Sensor Telemetry & Report Details Form (6 cols on lg) */}
        <div className={`lg:col-span-6 bg-[#12161C] p-3.5 sm:p-5 rounded-2xl sm:rounded-[28px] border border-white/5 shadow-2xl flex flex-col justify-between space-y-4 transition-opacity ${!isDeviceOnline ? 'opacity-70' : ''}`}>
          {/* Header & Sensor Analysis Section */}
          <div className="space-y-3 pb-3 border-b border-white/10">
            <AnimatePresence mode="wait">
              {isAnalyzing ? (
                /* STATE 1: Smartwatch ECG Sampling HUD */
                <motion.div
                  key="analyzing"
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                >
                  <SmartwatchECGTelemetryView
                    scanProgress={scanProgress}
                    remainingSeconds={Math.max(1, Math.ceil(15 - (scanProgress / 100) * 15))}
                    packetCount={readingBuffer.length}
                    readingBuffer={readingBuffer}
                    currentPh={bottle?.ph}
                    currentTds={bottle?.tds}
                    currentTurbidity={bottle?.turbidity}
                    currentTemp={bottle?.temperature}
                  />
                </motion.div>
              ) : analysisResult ? (
                /* STATE 2: Verified Analysis Averages Display */
                <motion.div
                  key="analyzed"
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  className="space-y-3"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-1">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-8 h-8 rounded-xl bg-[#00D1FF]/15 border border-[#00D1FF]/30 text-[#00D1FF] flex items-center justify-center shrink-0">
                        <ShieldCheck className="w-4.5 h-4.5 text-[#00D1FF]" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="text-xs sm:text-sm font-bold text-white">
                            Verified Analysis
                          </span>
                          <span
                            className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full border ${
                              (analysisResult.qualityScore ?? 0) >= 88
                                ? 'bg-[#00D1FF]/15 text-[#00D1FF] border-[#00D1FF]/30'
                                : (analysisResult.qualityScore ?? 0) >= 70
                                ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                                : 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                            }`}
                          >
                            {analysisResult.qualityScore !== null ? `${analysisResult.qualityScore}/100 · ` : ''}
                            {analysisResult.qualityCategory || 'Optimal'}
                          </span>
                        </div>
                        <div className="flex items-center gap-1 text-[10px] text-neutral-400 font-mono mt-0.5">
                          <Clock className="w-2.5 h-2.5 text-neutral-500 shrink-0" />
                          <span>Sampled at {analysisResult.timestamp} (15s avg)</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                      <button
                        type="button"
                        onClick={handleStartAnalysis}
                        disabled={!isDeviceOnline}
                        title="Re-run 15s analysis"
                        className="flex items-center gap-1 px-2.5 py-1 rounded-xl bg-white/5 hover:bg-white/10 text-neutral-300 border border-white/10 text-xs font-medium cursor-pointer"
                      >
                        <RotateCw className="w-3 h-3" />
                        <span>Re-analyze</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setIsReportModalOpen(true)}
                        className="flex items-center gap-1 px-3 py-1 rounded-xl bg-[#00D1FF] hover:bg-[#00B4D8] text-[#090B0E] text-xs font-semibold shadow-sm cursor-pointer"
                      >
                        <FileText className="w-3 h-3" />
                        <span>Report</span>
                      </button>
                    </div>
                  </div>

                  {/* 4 Sensor Verified Averages Grid */}
                  <div className="grid grid-cols-4 gap-1.5 sm:gap-2 text-center text-xs p-2 rounded-xl bg-[#090B0E] border border-white/5">
                    <div className="p-1.5 rounded-lg bg-white/[0.02]">
                      <div className="flex items-center justify-center gap-1 text-[10px] text-neutral-400 mb-0.5">
                        <Activity className="w-3 h-3 text-[#00D1FF]" />
                        <span className="font-mono">Avg pH</span>
                      </div>
                      <span className="font-semibold text-white text-sm font-mono">
                        {analysisResult.ph !== null ? analysisResult.ph : '--'}
                      </span>
                    </div>
                    <div className="p-1.5 rounded-lg bg-white/[0.02]">
                      <div className="flex items-center justify-center gap-1 text-[10px] text-neutral-400 mb-0.5">
                        <Droplets className="w-3 h-3 text-cyan-400" />
                        <span className="font-mono">Avg TDS</span>
                      </div>
                      <span className="font-semibold text-white text-sm font-mono">
                        {analysisResult.tds !== null ? (
                          <>
                            {analysisResult.tds} <span className="text-[9px] font-normal text-neutral-400">ppm</span>
                          </>
                        ) : (
                          '--'
                        )}
                      </span>
                    </div>
                    <div className="p-1.5 rounded-lg bg-white/[0.02]">
                      <div className="flex items-center justify-center gap-1 text-[10px] text-neutral-400 mb-0.5">
                        <Eye className="w-3 h-3 text-amber-400" />
                        <span className="font-mono">Avg Turb</span>
                      </div>
                      <span className="font-semibold text-white text-sm font-mono">
                        {analysisResult.turbidity !== null ? (
                          <>
                            {analysisResult.turbidity} <span className="text-[9px] font-normal text-neutral-400">NTU</span>
                          </>
                        ) : (
                          '--'
                        )}
                      </span>
                    </div>
                    <div className="p-1.5 rounded-lg bg-white/[0.02]">
                      <div className="flex items-center justify-center gap-1 text-[10px] text-neutral-400 mb-0.5">
                        <Thermometer className="w-3 h-3 text-emerald-400" />
                        <span className="font-mono">Avg Temp</span>
                      </div>
                      <span className="font-semibold text-white text-sm font-mono">
                        {analysisResult.temperature !== null ? `${analysisResult.temperature}°C` : '--'}
                      </span>
                    </div>
                  </div>
                </motion.div>
              ) : (
                /* STATE 3: Idle / Live Pre-Analysis State */
                <motion.div
                  key="idle"
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  className="space-y-2.5"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div
                        className={`w-8 h-8 rounded-xl border flex items-center justify-center ${
                          isDeviceOnline
                            ? 'bg-cyan-500/15 border-cyan-500/30 text-[#00D1FF]'
                            : 'bg-white/5 border-white/10 text-neutral-500'
                        }`}
                      >
                        {isDeviceOnline ? <FlaskConical className="w-4 h-4" /> : <WifiOff className="w-4 h-4" />}
                      </div>
                      <div>
                        <h3 className="text-sm font-semibold text-white">
                          {isDeviceOnline ? 'Sensor Telemetry' : 'Device Offline'}
                        </h3>
                        <p className="text-[11px] text-neutral-400">
                          {isDeviceOnline
                            ? `Connected to ${bottle?.bottleId || 'AquaSense X'}`
                            : 'Power on bottle to capture telemetry'}
                        </p>
                      </div>
                    </div>

                    {isDeviceOnline && (
                      <button
                        type="button"
                        onClick={handleStartAnalysis}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#00D1FF] hover:bg-[#00B4D8] text-[#090B0E] text-xs font-semibold shadow-sm cursor-pointer transition-all active:scale-98"
                      >
                        <Activity className="w-3.5 h-3.5" />
                        <span>Analyze Water</span>
                      </button>
                    )}
                  </div>

                  {/* 4 Sensor Metrics Preview Grid */}
                  <div className="grid grid-cols-4 gap-1.5 sm:gap-2 text-center text-xs p-2.5 rounded-xl bg-[#090B0E] border border-white/5">
                    <div className="p-1.5 rounded-lg bg-white/[0.02]">
                      <div className="flex items-center justify-center gap-1 text-[10px] text-neutral-400 mb-0.5">
                        <Activity className={`w-3 h-3 ${isDeviceOnline ? 'text-[#00D1FF]' : 'text-neutral-500'}`} />
                        <span className="font-mono">pH</span>
                      </div>
                      <span className="font-semibold text-white text-sm">
                        {isDeviceOnline && bottle?.ph != null ? bottle.ph : '--'}
                      </span>
                    </div>
                    <div className="p-1.5 rounded-lg bg-white/[0.02]">
                      <div className="flex items-center justify-center gap-1 text-[10px] text-neutral-400 mb-0.5">
                        <Droplets className={`w-3 h-3 ${isDeviceOnline ? 'text-cyan-400' : 'text-neutral-500'}`} />
                        <span className="font-mono">TDS</span>
                      </div>
                      <span className="font-semibold text-white text-sm">
                        {isDeviceOnline && bottle?.tds != null ? (
                          <>
                            {bottle.tds} <span className="text-[9px] font-normal text-neutral-400">ppm</span>
                          </>
                        ) : (
                          '--'
                        )}
                      </span>
                    </div>
                    <div className="p-1.5 rounded-lg bg-white/[0.02]">
                      <div className="flex items-center justify-center gap-1 text-[10px] text-neutral-400 mb-0.5">
                        <Eye className={`w-3 h-3 ${isDeviceOnline ? 'text-amber-400' : 'text-neutral-500'}`} />
                        <span className="font-mono">CLARITY</span>
                      </div>
                      <span className="font-semibold text-white text-sm">
                        {isDeviceOnline && bottle?.turbidity != null ? (
                          <>
                            {bottle.turbidity} <span className="text-[9px] font-normal text-neutral-400">NTU</span>
                          </>
                        ) : (
                          '--'
                        )}
                      </span>
                    </div>
                    <div className="p-1.5 rounded-lg bg-white/[0.02]">
                      <div className="flex items-center justify-center gap-1 text-[10px] text-neutral-400 mb-0.5">
                        <Thermometer className={`w-3 h-3 ${isDeviceOnline ? 'text-emerald-400' : 'text-neutral-500'}`} />
                        <span className="font-mono">TEMP</span>
                      </div>
                      <span className="font-semibold text-white text-sm">
                        {isDeviceOnline && bottle?.temperature != null ? `${bottle.temperature}°C` : '--'}
                      </span>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Form */}
          <form onSubmit={handlePublishToCommunity} className="space-y-3">
            {/* Source Name */}
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-neutral-400 mb-1">
                Source Name or Place
              </label>
              <input
                type="text"
                value={sourceName}
                onChange={(e) => setSourceName(e.target.value)}
                placeholder="e.g. Yerba Buena Gardens Water Fountain #2"
                disabled={!isDeviceOnline}
                className="w-full bg-[#090B0E] border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-[#00D1FF]/50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                required
              />
            </div>

            {/* Source Category */}
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-neutral-400 mb-1">
                Source Category
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                {categories.map((cat) => (
                  <button
                    key={cat.id}
                    type="button"
                    disabled={!isDeviceOnline}
                    onClick={() => setSourceType(cat.id)}
                    className={`py-1.5 px-2 rounded-xl text-[11px] font-medium transition-all text-center border cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
                      sourceType === cat.id
                        ? 'bg-[#00D1FF]/15 text-[#00D1FF] border-[#00D1FF]/50 font-semibold'
                        : 'bg-[#090B0E] text-neutral-400 hover:text-white border-white/5 hover:border-white/15'
                    }`}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Tasting & Observation Notes */}
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-neutral-400 mb-1">
                Observations & Notes (Optional)
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                disabled={!isDeviceOnline}
                placeholder="e.g. Crisp and cold, fast refill flow rate, well maintained..."
                className="w-full bg-[#090B0E] border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-[#00D1FF]/50 transition-colors resize-none disabled:opacity-50 disabled:cursor-not-allowed"
              />
            </div>

            {/* Action Area: Share With Community */}
            <div className="pt-2">
              <button
                type="submit"
                disabled={
                  !isDeviceOnline ||
                  isSubmitting ||
                  locStatus !== 'success' ||
                  !deviceGps ||
                  !reportCoords
                }
                title={!isDeviceOnline ? 'Connect your AquaSense X device to submit water quality reports' : undefined}
                className="w-full py-3 px-4 rounded-xl bg-[#00D1FF] hover:bg-[#00B4D8] active:bg-[#0096B4] text-[#090B0E] text-xs sm:text-sm font-bold flex items-center justify-center gap-2 shadow-lg shadow-[#00D1FF]/25 active:scale-98 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed touch-target"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-[#090B0E]" />
                    <span>Publishing to Community...</span>
                  </>
                ) : !isDeviceOnline ? (
                  <>
                    <WifiOff className="w-4 h-4" />
                    <span>Connect Bottle to Report</span>
                  </>
                ) : (
                  <>
                    <Share2 className="w-4 h-4" />
                    <span>Share With Community</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Water Quality Report Modal synchronization */}
      <WaterAnalysisReportModal
        isOpen={isReportModalOpen}
        onClose={() => setIsReportModalOpen(false)}
        analysisResult={analysisResult}
        bottleId={bottle?.bottleId}
        onSuccessPublish={onSuccessPublish}
      />
    </div>
  );
};

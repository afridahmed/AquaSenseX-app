import React, { useState, useEffect, useMemo, useRef } from 'react';
import { CommunityReport } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { useBottle } from '../../context/BottleContext';
import { Header } from '../../components/common/Header';
import {
  LeafletCommunityMap,
  DeviceLocationState,
  SearchLocationState,
  ExplorationLocationState,
} from '../../components/common/LeafletCommunityMap';
import { CommunityReportMode } from './CommunityReportMode';
import {
  geocodingService,
  GeocodingResult,
} from '../../services/geocoding/geocodingService';
import {
  toggleReportVerification,
  formatRelativeTime,
} from '../../services/community/communityService';
import {
  locationService,
  LocationError,
  LocationErrorCode,
} from '../../services/location/locationService';
import { db } from '../../services/firebase/firebaseConfig';
import {
  collection,
  onSnapshot,
  query,
  orderBy,
} from 'firebase/firestore';
import {
  Clock,
  ThumbsUp,
  Search,
  Navigation,
  X,
  Info,
  Loader2,
  AlertTriangle,
  Compass,
  FlaskConical,
  Layers,
  Sparkles,
  Droplets,
  Waves,
  Check,
  ChevronRight,
  WifiOff,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

type CommunityMode = 'explore' | 'report';
type QualityFilterType = 'all' | 'excellent' | 'good' | 'caution';

interface CommunityMapScreenProps {
  initialSelectedReportId?: string | null;
  initialMode?: CommunityMode;
}

export const CommunityMapScreen: React.FC<CommunityMapScreenProps> = ({
  initialSelectedReportId,
  initialMode = 'explore',
}) => {
  const { user } = useAuth();
  const { bottle, isDeviceOnline } = useBottle();

  // Mode state: Explore vs Report
  const [mode, setMode] = useState<CommunityMode>(initialMode);

  // Core Reports State
  const [reports, setReports] = useState<CommunityReport[]>([]);
  const [selectedReport, setSelectedReport] = useState<CommunityReport | null>(null);
  const [filterQuality, setFilterQuality] = useState<QualityFilterType>('all');

  // Mobile Bottom Sheet state for selected source
  const [isMobileSheetOpen, setIsMobileSheetOpen] = useState<boolean>(false);

  // 1. Location State Model: Device Location (real browser GPS / fallback)
  const [deviceLocation, setDeviceLocation] = useState<DeviceLocationState | null>(null);
  const [locState, setLocState] = useState<{
    status: 'idle' | 'acquiring' | 'success' | 'error';
    stageText: string;
    errorMessage: string;
    sourceType?: 'gps' | 'network' | 'ip' | 'preset';
    isApproximate?: boolean;
  }>({
    status: 'idle',
    stageText: '',
    errorMessage: '',
    sourceType: undefined,
    isApproximate: false,
  });

  // 2. Location State Model: Search Location (from Nominatim geocoding)
  const [searchLocation, setSearchLocation] = useState<SearchLocationState | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [searchResults, setSearchResults] = useState<GeocodingResult[]>([]);
  const [isSearchingLocation, setIsSearchingLocation] = useState<boolean>(false);
  const [showSearchDropdown, setShowSearchDropdown] = useState<boolean>(false);
  const searchDebounceRef = useRef<NodeJS.Timeout | null>(null);

  // 3. Location State Model: Exploration Location (currently explored point for nearby sources discovery)
  const [explorationLocation, setExplorationLocation] = useState<ExplorationLocationState | null>(null);

  // Test & Report Water Modal from Community Screen (uses exact unified modal)
  const [isReportModalOpen, setIsReportModalOpen] = useState<boolean>(false);

  // Real-time Firestore sync for public community reports
  useEffect(() => {
    try {
      const colRef = collection(db, 'communityReports');
      const q = query(colRef, orderBy('createdAt', 'desc'));

      const unsubscribe = onSnapshot(
        q,
        (snapshot) => {
          const list: CommunityReport[] = snapshot.docs.map((docSnap) => {
            const data = docSnap.data() as Omit<CommunityReport, 'id'>;
            const hasVerified =
              user && Array.isArray(data.verifiedUids) ? data.verifiedUids.includes(user.uid) : false;

            const count = typeof data.verifiedReports === 'number'
              ? data.verifiedReports
              : (typeof (data as any).verifiedCount === 'number' ? (data as any).verifiedCount : 0);

            return {
              id: docSnap.id,
              ...data,
              verifiedReports: count,
              userHasVerified: hasVerified,
              lastTestedAt: formatRelativeTime(data.createdAt),
            };
          });

          setReports(list);

          // Handle initial deep-link selection or auto-selection
          if (initialSelectedReportId) {
            const matched = list.find((r) => r.id === initialSelectedReportId);
            if (matched) {
              setSelectedReport(matched);
              setIsMobileSheetOpen(true);
            }
          } else {
            setSelectedReport((prev) => {
              if (prev && list.some((r) => r.id === prev.id)) {
                return list.find((r) => r.id === prev.id) || prev;
              }
              return list.length > 0 ? list[0] : null;
            });
          }
        },
        (err) => {
          console.warn('Firestore community reports listener fallback:', err);
        }
      );

      return () => unsubscribe();
    } catch (e) {
      console.warn('Community reports listener init warning:', e);
    }
  }, [user?.uid, initialSelectedReportId]);

  // Handler: USE MY LOCATION (Strictly uses shared LocationService fresh position)
  const handleUseMyLocation = async () => {
    setLocState({
      status: 'acquiring',
      stageText: 'Acquiring device GPS position...',
      errorMessage: '',
      sourceType: undefined,
      isApproximate: false,
    });

    try {
      const pos = await locationService.getFreshPosition(12000);
      const { latitude, longitude, accuracy } = pos;

      // 1. Set Device Location
      setDeviceLocation({
        lat: latitude,
        lon: longitude,
        accuracy,
      });

      // 2. Set Exploration Reference Location
      let label = `${latitude.toFixed(4)}°, ${longitude.toFixed(4)}°`;
      try {
        const place = await geocodingService.reverseGeocode(latitude, longitude);
        if (place) label = place;
      } catch {
        // Fallback to coordinates
      }

      setExplorationLocation({
        lat: latitude,
        lon: longitude,
        label,
        source: 'device',
      });

      // 3. Clear search pin when user explicitly triggers my location
      setSearchLocation(null);
      setSearchQuery('');
      setShowSearchDropdown(false);

      setLocState({
        status: 'success',
        stageText: '',
        errorMessage: '',
        sourceType: 'gps',
        isApproximate: false,
      });
    } catch (err: any) {
      console.warn('My Location GPS acquisition failed:', err);
      let errorMsg = 'Unable to determine your GPS location. Please check browser location permissions and tap Retry.';
      if (err instanceof LocationError) {
        errorMsg = err.message;
      }
      setLocState({
        status: 'error',
        stageText: '',
        errorMessage: errorMsg,
        sourceType: undefined,
        isApproximate: false,
      });
    }
  };

  // SEARCH: Location Autocomplete & Geocoding
  const handleSearchChange = (text: string) => {
    setSearchQuery(text);

    if (searchDebounceRef.current) {
      clearTimeout(searchDebounceRef.current);
    }

    if (!text.trim() || text.length < 2) {
      setSearchResults([]);
      setShowSearchDropdown(false);
      return;
    }

    setIsSearchingLocation(true);
    searchDebounceRef.current = setTimeout(async () => {
      try {
        const results = await geocodingService.search(text);
        setSearchResults(results);
        setShowSearchDropdown(results.length > 0);
      } catch (err) {
        console.warn('Geocoding error:', err);
      } finally {
        setIsSearchingLocation(false);
      }
    }, 380);
  };

  // Handle Select Search Result
  const handleSelectSearchResult = (result: GeocodingResult) => {
    const label = result.name || result.displayName.split(',')[0];

    // 1. Set Search Location
    setSearchLocation({
      lat: result.lat,
      lon: result.lon,
      label,
    });

    // 2. Update Exploration Location
    setExplorationLocation({
      lat: result.lat,
      lon: result.lon,
      label,
      source: 'search',
    });

    setSearchQuery(label);
    setShowSearchDropdown(false);
  };

  // Direct Enter Key submit in search box
  const handleSearchSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    if (searchResults.length > 0) {
      handleSelectSearchResult(searchResults[0]);
      return;
    }

    setIsSearchingLocation(true);
    try {
      const results = await geocodingService.search(searchQuery.trim());
      if (results.length > 0) {
        handleSelectSearchResult(results[0]);
      }
    } catch (err) {
      console.warn('Search submit failed:', err);
    } finally {
      setIsSearchingLocation(false);
    }
  };

  // 4. MAP CLICK EXPLORATION (Click / Tap to discover water sources)
  const handleMapClick = async (lat: number, lon: number) => {
    // Set immediate exploration pin
    setExplorationLocation({
      lat,
      lon,
      label: 'Selected Point',
      source: 'map_click',
    });

    // Reverse geocode to get a readable neighborhood/place title
    try {
      const placeName = await geocodingService.reverseGeocode(lat, lon);
      const label = placeName.split(',')[0] || `${lat.toFixed(3)}°, ${lon.toFixed(3)}°`;
      setExplorationLocation({
        lat,
        lon,
        label,
        source: 'map_click',
      });
    } catch {
      // Keep coord label
    }
  };

  // Active Reference Point for Nearby Sources (Priority: explorationLocation -> searchLocation -> deviceLocation)
  const activeReferenceLocation = useMemo(() => {
    if (explorationLocation) {
      return {
        lat: explorationLocation.lat,
        lon: explorationLocation.lon,
        label: explorationLocation.label || 'Explored Area',
        type: explorationLocation.source || 'exploration',
      };
    }
    if (searchLocation) {
      return {
        lat: searchLocation.lat,
        lon: searchLocation.lon,
        label: searchLocation.label || 'Searched Location',
        type: 'search',
      };
    }
    if (deviceLocation) {
      return {
        lat: deviceLocation.lat,
        lon: deviceLocation.lon,
        label: 'Your GPS Location',
        type: 'device',
      };
    }
    return null;
  }, [explorationLocation, searchLocation, deviceLocation]);

  // Compute distance from active reference point for every report
  const reportsWithDistance = useMemo(() => {
    return reports.map((rep) => {
      let distanceKm: number | undefined = undefined;
      if (activeReferenceLocation) {
        distanceKm = geocodingService.calculateDistanceKm(
          activeReferenceLocation.lat,
          activeReferenceLocation.lon,
          rep.latitude,
          rep.longitude
        );
      }
      return {
        ...rep,
        distanceKm,
      };
    });
  }, [reports, activeReferenceLocation]);

  // Rank nearby results intelligently:
  // 1. Distance (proximity)
  // 2. Freshness / last tested
  // 3. Quality score
  // 4. Verification count
  const filteredAndRankedReports = useMemo(() => {
    return reportsWithDistance
      .filter((rep) => {
        // Text filter match
        const matchesSearch =
          searchQuery.length < 2 ||
          rep.sourceName.toLowerCase().includes(searchQuery.toLowerCase()) ||
          (rep.notes && rep.notes.toLowerCase().includes(searchQuery.toLowerCase())) ||
          (rep.sourceType && rep.sourceType.toLowerCase().includes(searchQuery.toLowerCase()));

        if (!matchesSearch && searchQuery.length >= 2 && searchResults.length === 0) return false;

        // Quality chip filter:
        // All, Excellent (≥88), Good (70–87), Caution (<70)
        if (filterQuality === 'excellent') return rep.qualityScore >= 88;
        if (filterQuality === 'good') return rep.qualityScore >= 70 && rep.qualityScore < 88;
        if (filterQuality === 'caution') return rep.qualityScore < 70;
        return true;
      })
      .sort((a, b) => {
        // 1. Distance proximity
        if (a.distanceKm !== undefined && b.distanceKm !== undefined) {
          const distDiff = a.distanceKm - b.distanceKm;
          if (Math.abs(distDiff) > 0.05) {
            return distDiff;
          }
        }
        // 2. Quality Score
        if (b.qualityScore !== a.qualityScore) {
          return b.qualityScore - a.qualityScore;
        }
        // 3. Verification count
        return (b.verifiedReports || 0) - (a.verifiedReports || 0);
      });
  }, [reportsWithDistance, searchQuery, filterQuality, searchResults.length]);

  // Select a report and open mobile bottom sheet if on small screens
  const handleSelectReport = (rep: CommunityReport) => {
    setSelectedReport(rep);
    setIsMobileSheetOpen(true);
  };

  // Toggle Verification with atomic Firestore transaction + optimistic UI
  const handleToggleVerification = async (report: CommunityReport) => {
    if (!user) return;

    const currentlyVerified = !!report.userHasVerified;
    const currentCount = report.verifiedReports || 0;
    const optimisticCount = currentlyVerified
      ? Math.max(0, currentCount - 1)
      : currentCount + 1;

    // Optimistic update
    const updateLocal = (list: CommunityReport[]) =>
      list.map((r) =>
        r.id === report.id
          ? { ...r, verifiedReports: optimisticCount, userHasVerified: !currentlyVerified }
          : r
      );

    setReports(updateLocal);
    if (selectedReport?.id === report.id) {
      setSelectedReport((prev) =>
        prev ? { ...prev, verifiedReports: optimisticCount, userHasVerified: !currentlyVerified } : null
      );
    }

    try {
      const result = await toggleReportVerification(report.id, user.uid, report);

      // Update with exact server transaction results
      setReports((prev) =>
        prev.map((r) =>
          r.id === report.id
            ? { ...r, verifiedReports: result.verifiedReports, userHasVerified: result.userHasVerified }
            : r
        )
      );
      if (selectedReport?.id === report.id) {
        setSelectedReport((prev) =>
          prev
            ? {
              ...prev,
              verifiedReports: result.verifiedReports,
              userHasVerified: result.userHasVerified,
            }
            : null
        );
      }
    } catch (err) {
      console.warn('Verification transaction error, reverting:', err);
      setReports(reports);
      if (selectedReport?.id === report.id) {
        setSelectedReport(report);
      }
    }
  };

  // Handler when a new report is published from the test modal
  const handlePublishSuccess = (newReport: CommunityReport) => {
    setReports((prev) => [newReport, ...prev]);
    setSelectedReport(newReport);
    setIsMobileSheetOpen(true);
  };

  const getScoreColor = (score: number) => {
    if (score >= 88) return { bg: 'bg-[#00D1FF]', text: 'text-[#00D1FF]', border: 'border-[#00D1FF]/30', label: 'Excellent' };
    if (score >= 70) return { bg: 'bg-emerald-400', text: 'text-emerald-400', border: 'border-emerald-500/30', label: 'Good' };
    return { bg: 'bg-amber-400', text: 'text-amber-300', border: 'border-amber-500/30', label: 'Caution' };
  };

  const getSourceTypeLabel = (type?: string) => {
    switch (type) {
      case 'filtration_station':
        return 'Refill Station';
      case 'tap':
        return 'Municipal Tap';
      case 'spring':
        return 'Natural Spring';
      case 'well':
        return 'Groundwater Well';
      case 'fountain':
      default:
        return 'Drinking Fountain';
    }
  };

  const getSourceIcon = (type?: string) => {
    switch (type) {
      case 'filtration_station':
        return Sparkles;
      case 'spring':
        return Waves;
      case 'well':
        return Layers;
      case 'tap':
      case 'fountain':
      default:
        return Droplets;
    }
  };

  return (
    <div className="space-y-3 sm:space-y-4 lg:space-y-5 pb-24 lg:pb-8 max-w-7xl mx-auto px-3 sm:px-4 lg:px-6">
      <Header />

      {/* 1. COMPACT PREMIUM SEGMENTED MODE SWITCHER */}
      <div className="flex items-center justify-between sm:justify-start gap-3">
        <div className="inline-flex items-center p-1 bg-[#090B0E] border border-white/10 rounded-2xl w-full sm:w-auto shadow-inner">
          <button
            id="mode-switch-explore-btn"
            type="button"
            onClick={() => setMode('explore')}
            className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-6 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              mode === 'explore'
                ? 'bg-[#181E26] text-[#00D1FF] border border-[#00D1FF]/40 shadow-sm shadow-[#00D1FF]/15'
                : 'text-neutral-400 hover:text-white border border-transparent'
            }`}
          >
            <Compass className="w-4 h-4" />
            <span>Explore</span>
          </button>
          <button
            id="mode-switch-report-btn"
            type="button"
            onClick={() => setMode('report')}
            title={!isDeviceOnline ? 'Connect your AquaSense X device to submit water quality reports' : undefined}
            className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-6 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              mode === 'report'
                ? 'bg-[#181E26] text-[#00D1FF] border border-[#00D1FF]/40 shadow-sm shadow-[#00D1FF]/15'
                : 'text-neutral-400 hover:text-white border border-transparent'
            }`}
          >
            {isDeviceOnline ? <FlaskConical className="w-4 h-4" /> : <WifiOff className="w-4 h-4 text-neutral-400" />}
            <span>Report</span>
            {!isDeviceOnline && (
              <span className="hidden xs:inline-block text-[9px] px-1.5 py-0.2 rounded-full bg-neutral-800 text-neutral-400 font-normal border border-neutral-700">
                Offline
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Offline Restriction Banner for Report Mode */}
      {mode === 'report' && !isDeviceOnline && (
        <div className="p-3.5 sm:p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-amber-300 shadow-xl">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center shrink-0">
              <WifiOff className="w-4 h-4 text-amber-400" />
            </div>
            <div>
              <h4 className="text-xs sm:text-sm font-semibold text-white">Device Offline</h4>
              <p className="text-xs text-amber-300/90">
                Connect your AquaSense X device to submit water quality reports.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setMode('explore')}
            className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/15 text-white text-xs font-semibold self-start sm:self-auto transition-colors cursor-pointer"
          >
            Back to Explore
          </button>
        </div>
      )}

      {/* 2. MODE CONTENT */}
      {mode === 'report' ? (
        /* REPORT MODE: Strict physical location acquisition & report submission */
        <CommunityReportMode
          online={isDeviceOnline}
          onSuccessPublish={(newReport) => {
            setReports((prev) => [newReport, ...prev.filter((r) => r.id !== newReport.id)]);
            setSelectedReport(newReport);
            setExplorationLocation({
              lat: newReport.latitude,
              lon: newReport.longitude,
              label: newReport.sourceName,
              source: 'device',
            });
            setMode('explore');
          }}
        />
      ) : (
        <div className="space-y-3 sm:space-y-4">
          {/* COMPACT RESPONSIVE TOP TOOLBAR (Search, Use My Location, Quality Filters) */}
          <div className="bg-[#12161C] p-2.5 sm:p-3 rounded-2xl sm:rounded-[24px] border border-white/5 shadow-xl space-y-2.5">
            <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-2 sm:gap-2.5">
              {/* Search Input with Nominatim Autocomplete */}
              <div className="relative flex-1 min-w-0">
                <form onSubmit={handleSearchSubmit} className="relative">
                  <Search className="w-3.5 h-3.5 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => handleSearchChange(e.target.value)}
                    onFocus={() => {
                      if (searchResults.length > 0) setShowSearchDropdown(true);
                    }}
                    placeholder="Search city, park, or source..."
                    className="w-full bg-[#090B0E] border border-white/10 rounded-xl pl-9 pr-9 py-2 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-[#00D1FF]/50 transition-colors"
                  />
                  {isSearchingLocation ? (
                    <Loader2 className="w-3.5 h-3.5 text-[#00D1FF] animate-spin absolute right-3 top-1/2 -translate-y-1/2" />
                  ) : searchQuery ? (
                    <button
                      type="button"
                      onClick={() => {
                        setSearchQuery('');
                        setSearchResults([]);
                        setShowSearchDropdown(false);
                        setSearchLocation(null);
                      }}
                      className="p-1 text-neutral-400 hover:text-white absolute right-2.5 top-1/2 -translate-y-1/2"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  ) : null}
                </form>

                {/* Autocomplete Dropdown */}
                {showSearchDropdown && searchResults.length > 0 && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-[#12161C] border border-white/10 rounded-xl shadow-2xl overflow-hidden z-50 divide-y divide-white/5 max-h-56 overflow-y-auto">
                    {searchResults.map((res) => (
                      <button
                        key={res.placeId}
                        type="button"
                        onClick={() => handleSelectSearchResult(res)}
                        className="w-full p-2.5 text-left hover:bg-white/[0.06] transition-colors flex items-center gap-2 text-xs text-white"
                      >
                        <Compass className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold text-white truncate">{res.name}</p>
                          <p className="text-[10px] text-neutral-400 truncate">{res.displayName}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Action Group: Use My Location + Single-Row Quality Filters */}
              <div className="flex items-center gap-1.5 xs:gap-2 w-full md:w-auto justify-between md:justify-end flex-nowrap shrink-0">
                {/* Icon-Only My Location Button */}
                <button
                  id="btn-use-my-location"
                  type="button"
                  onClick={handleUseMyLocation}
                  disabled={locState.status === 'acquiring'}
                  title="Use My Location"
                  aria-label="Use My Location"
                  className={`h-[34px] w-[34px] sm:h-9 sm:w-9 rounded-xl border transition-all flex items-center justify-center shrink-0 cursor-pointer ${deviceLocation && explorationLocation?.source === 'device'
                    ? 'bg-[#00D1FF]/20 text-[#00D1FF] border-[#00D1FF]/50 shadow-sm shadow-[#00D1FF]/20'
                    : 'bg-[#090B0E] text-neutral-300 hover:text-white border-white/10 hover:border-white/20'
                    }`}
                >
                  {locState.status === 'acquiring' ? (
                    <Loader2 className="w-4 h-4 animate-spin text-[#00D1FF]" />
                  ) : (
                    <Navigation className="w-4 h-4 text-[#00D1FF]" />
                  )}
                </button>

                {/* 4 Quality Filter Controls - Strictly ONE SINGLE ROW, No scroll, No wrap, balanced layout */}
                <div
                  role="radiogroup"
                  aria-label="Water Quality Filters"
                  className="flex-1 md:flex-initial flex items-center flex-nowrap bg-[#090B0E] border border-white/10 rounded-xl p-0.5 gap-0.5 xs:gap-1 h-[34px] sm:h-9 shrink-0"
                >
                  {/* ALL */}
                  <button
                    id="filter-quality-all"
                    type="button"
                    role="radio"
                    aria-checked={filterQuality === 'all'}
                    aria-label={`All water sources (${reports.length})`}
                    title={`All (${reports.length})`}
                    onClick={() => setFilterQuality('all')}
                    className={`flex-1 md:flex-initial h-full flex items-center justify-center gap-1 sm:gap-1.5 px-2 sm:px-3 rounded-lg border text-xs font-medium transition-all shrink-0 cursor-pointer ${filterQuality === 'all'
                      ? 'bg-white/15 text-white border-white/30 shadow-sm font-semibold'
                      : 'text-neutral-400 hover:text-white hover:bg-white/5 border-transparent'
                      }`}
                  >
                    <Layers className={`w-3.5 h-3.5 shrink-0 ${filterQuality === 'all' ? 'text-white' : 'text-neutral-400'}`} />
                    <span className="hidden sm:inline">All</span>
                  </button>

                  {/* EXCELLENT */}
                  <button
                    id="filter-quality-excellent"
                    type="button"
                    role="radio"
                    aria-checked={filterQuality === 'excellent'}
                    aria-label="Excellent quality (score ≥88)"
                    title="Excellent (Score ≥88)"
                    onClick={() => setFilterQuality('excellent')}
                    className={`flex-1 md:flex-initial h-full flex items-center justify-center gap-1 sm:gap-1.5 px-2 sm:px-3 rounded-lg border text-xs font-medium transition-all shrink-0 cursor-pointer ${filterQuality === 'excellent'
                      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 shadow-sm font-semibold'
                      : 'text-neutral-400 hover:text-emerald-300 hover:bg-emerald-500/5 border-transparent'
                      }`}
                  >
                    <Sparkles className={`w-3.5 h-3.5 shrink-0 ${filterQuality === 'excellent' ? 'text-emerald-300' : 'text-emerald-500/70'}`} />
                    <span className="hidden sm:inline">Excellent</span>
                  </button>

                  {/* GOOD */}
                  <button
                    id="filter-quality-good"
                    type="button"
                    role="radio"
                    aria-checked={filterQuality === 'good'}
                    aria-label="Good quality (score 70-87)"
                    title="Good (Score 70–87)"
                    onClick={() => setFilterQuality('good')}
                    className={`flex-1 md:flex-initial h-full flex items-center justify-center gap-1 sm:gap-1.5 px-2 sm:px-3 rounded-lg border text-xs font-medium transition-all shrink-0 cursor-pointer ${filterQuality === 'good'
                      ? 'bg-[#00D1FF]/20 text-[#00D1FF] border-[#00D1FF]/40 shadow-sm font-semibold'
                      : 'text-neutral-400 hover:text-[#00D1FF] hover:bg-[#00D1FF]/5 border-transparent'
                      }`}
                  >
                    <Droplets className={`w-3.5 h-3.5 shrink-0 ${filterQuality === 'good' ? 'text-[#00D1FF]' : 'text-cyan-500/70'}`} />
                    <span className="hidden sm:inline">Good</span>
                  </button>

                  {/* CAUTION */}
                  <button
                    id="filter-quality-caution"
                    type="button"
                    role="radio"
                    aria-checked={filterQuality === 'caution'}
                    aria-label="Caution quality (score <70)"
                    title="Caution (Score <70)"
                    onClick={() => setFilterQuality('caution')}
                    className={`flex-1 md:flex-initial h-full flex items-center justify-center gap-1 sm:gap-1.5 px-2 sm:px-3 rounded-lg border text-xs font-medium transition-all shrink-0 cursor-pointer ${filterQuality === 'caution'
                      ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 shadow-sm font-semibold'
                      : 'text-neutral-400 hover:text-amber-300 hover:bg-amber-500/5 border-transparent'
                      }`}
                  >
                    <AlertTriangle className={`w-3.5 h-3.5 shrink-0 ${filterQuality === 'caution' ? 'text-amber-300' : 'text-amber-500/70'}`} />
                    <span className="hidden sm:inline">Caution</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Location Acquisition Progress Indicator */}
            {locState.status === 'acquiring' && locState.stageText && (
              <div className="flex items-center gap-2 px-3 py-1.5 bg-[#00D1FF]/10 border border-[#00D1FF]/20 rounded-xl text-xs text-[#00D1FF]">
                <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
                <span>{locState.stageText}</span>
              </div>
            )}

            {/* GPS Error Banner with immediate resolution options */}
            {locState.status === 'error' && (
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-3 py-2 bg-rose-500/10 border border-rose-500/20 rounded-xl text-xs text-rose-300">
                <div className="flex items-center gap-1.5 min-w-0">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-rose-400" />
                  <span className="truncate">{locState.errorMessage}</span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={handleUseMyLocation}
                    className="px-2.5 py-1 bg-rose-500/20 hover:bg-rose-500/30 text-white rounded-lg text-[11px] font-semibold transition-colors"
                  >
                    Retry GPS
                  </button>
                </div>
              </div>
            )}

            {/* Approximate Network Location Banner */}
            {locState.status === 'success' && locState.isApproximate && (
              <div className="flex items-center justify-between px-3 py-1.5 bg-amber-500/10 border border-amber-500/20 rounded-xl text-xs text-amber-300">
                <div className="flex items-center gap-1.5 min-w-0">
                  <Info className="w-3.5 h-3.5 shrink-0 text-amber-400" />
                  <span className="truncate">
                    Using approximate Network location. Search or tap on map to pinpoint exact location.
                  </span>
                </div>
                <button
                  onClick={() => setLocState((prev) => ({ ...prev, isApproximate: false }))}
                  className="text-amber-400 hover:text-white p-0.5"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            )}

            {activeReferenceLocation && (
              <div className="flex items-center justify-between px-3 py-1.5 bg-[#181E26] border border-white/10 rounded-xl text-xs text-neutral-300">
                <div className="flex items-center gap-1.5 min-w-0">
                  {activeReferenceLocation.type === 'device' ? (
                    <Navigation className="w-3.5 h-3.5 text-[#00D1FF] shrink-0" />
                  ) : activeReferenceLocation.type === 'search' ? (
                    <Search className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  ) : (
                    <Compass className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  )}
                  <span className="truncate text-[11px] sm:text-xs">
                    Discovering water sources near:{' '}
                    <strong className="text-white">{activeReferenceLocation.label}</strong>
                  </span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {explorationLocation && (
                    <button
                      onClick={() => {
                        setExplorationLocation(null);
                        setSearchLocation(null);
                      }}
                      className="text-[10px] text-neutral-400 hover:text-white underline"
                    >
                      Reset
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* MAIN RESPONSIVE MAP & SOURCES LAYOUT */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 sm:gap-4 lg:gap-5 items-start">
            {/* Leaflet OpenStreetMap Canvas (7 cols on lg) */}
            <div className="lg:col-span-7 bg-[#12161C] border border-white/5 rounded-2xl sm:rounded-[28px] p-2 sm:p-3 overflow-hidden relative shadow-2xl flex flex-col">
              {/* Map Top Status Bar */}
              <div className="flex items-center justify-between pb-2 px-1 text-[11px]">
                <div className="flex items-center gap-1.5 text-neutral-300 font-medium truncate">
                  <Compass className="w-3.5 h-3.5 text-[#00D1FF] shrink-0" />
                  <span className="truncate">
                    {explorationLocation
                      ? `Exploring: ${explorationLocation.label}`
                      : searchLocation
                        ? `Search: ${searchLocation.label}`
                        : deviceLocation
                          ? 'Centered on your GPS location'
                          : 'AquaSense Global Water Network'}
                  </span>
                </div>
                <span className="text-[10px] text-neutral-400 font-mono shrink-0 ml-2">
                  {filteredAndRankedReports.length} Sources
                </span>
              </div>

              {/* Leaflet Map with 3 Location Models & Accuracy Circle */}
              <div className="w-full h-[320px] xs:h-[380px] sm:h-[460px] lg:h-[540px] rounded-xl sm:rounded-[22px] overflow-hidden border border-white/10 relative">
                <LeafletCommunityMap
                  reports={filteredAndRankedReports}
                  selectedReport={selectedReport}
                  onSelectReport={handleSelectReport}
                  deviceLocation={deviceLocation}
                  searchLocation={searchLocation}
                  explorationLocation={explorationLocation}
                  onMapClick={handleMapClick}
                />
              </div>

              {/* Map Legend & Exploration hint */}
              <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2 px-1 text-[10px] sm:text-[11px] text-neutral-400">
                <div className="flex flex-wrap items-center gap-2.5">
                  <span className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-[#00D1FF]" /> GPS
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-amber-400" /> Search
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-emerald-400" /> Explore Pin
                  </span>
                </div>
                <span className="text-[10px] text-neutral-500 font-mono">
                  Click map to explore nearby sources
                </span>
              </div>
            </div>

            {/* Selected Water Source Details Card & Nearby Sources Directory (5 cols on lg) */}
            <div className="lg:col-span-5 space-y-3 sm:space-y-4">
              {/* Desktop Selected Water Source Card */}
              {selectedReport ? (
                <div className="hidden lg:block p-4 sm:p-5 rounded-2xl sm:rounded-[28px] bg-[#12161C] border border-cyan-500/20 shadow-2xl space-y-3.5">
                  {/* Card Header */}
                  <div className="flex items-start justify-between gap-3 pb-3 border-b border-white/5">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[9px] font-bold uppercase tracking-wider text-[#00D1FF]">
                          Selected Water Source
                        </span>
                        <span className="text-[9px] font-mono px-2 py-0.5 rounded-full bg-white/[0.05] border border-white/10 text-neutral-300">
                          {getSourceTypeLabel(selectedReport.sourceType)}
                        </span>
                      </div>

                      <h3 className="text-sm sm:text-base font-semibold text-white leading-tight truncate">
                        {selectedReport.sourceName}
                      </h3>

                      <div className="flex flex-wrap items-center gap-2 mt-1 text-xs text-neutral-400">
                        <div className="flex items-center gap-1">
                          <Clock className="w-3 h-3 text-neutral-400" />
                          <span>{selectedReport.lastTestedAt}</span>
                        </div>
                        {selectedReport.distanceKm !== undefined && (
                          <>
                            <span>•</span>
                            <span className="text-cyan-300 font-medium">
                              {geocodingService.formatDistance(selectedReport.distanceKm)} away
                            </span>
                          </>
                        )}
                        <span>•</span>
                        <span className="truncate">
                          By {selectedReport.authorName || 'AquaSense Contributor'}
                        </span>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <div className="flex items-baseline justify-end gap-1">
                        <span className="text-2xl sm:text-3xl font-light text-white font-sans">
                          {selectedReport.qualityScore}
                        </span>
                        <span className="text-xs text-neutral-400 font-mono">/100</span>
                      </div>
                      <span
                        className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${getScoreColor(selectedReport.qualityScore).text} ${getScoreColor(selectedReport.qualityScore).border} bg-white/[0.02] inline-block mt-0.5`}
                      >
                        {getScoreColor(selectedReport.qualityScore).label}
                      </span>
                    </div>
                  </div>

                  {/* Sensor Telemetry Snapshot */}
                  <div className="grid grid-cols-4 gap-1.5 text-center text-xs p-2.5 rounded-xl bg-[#090B0E] border border-white/5">
                    <div>
                      <span className="text-[9px] text-neutral-500 block font-mono">pH</span>
                      <span className="font-semibold text-white">{selectedReport.ph}</span>
                    </div>
                    <div>
                      <span className="text-[9px] text-neutral-500 block font-mono">TDS</span>
                      <span className="font-semibold text-white">{selectedReport.tds} ppm</span>
                    </div>
                    <div>
                      <span className="text-[9px] text-neutral-500 block font-mono">CLARITY</span>
                      <span className="font-semibold text-white">{selectedReport.turbidity} NTU</span>
                    </div>
                    <div>
                      <span className="text-[9px] text-neutral-500 block font-mono">TEMP</span>
                      <span className="font-semibold text-white">{selectedReport.temperature}°C</span>
                    </div>
                  </div>

                  {/* Tester notes */}
                  {selectedReport.notes && (
                    <p className="text-xs text-neutral-300 leading-relaxed bg-[#090B0E] p-2.5 rounded-xl border border-white/5 italic">
                      "{selectedReport.notes}"
                    </p>
                  )}

                  {/* Verification Action Button */}
                  <button
                    onClick={() => handleToggleVerification(selectedReport)}
                    className={`w-full flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs font-semibold transition-all border touch-target sm:min-h-0 cursor-pointer active:scale-98 ${selectedReport.userHasVerified
                      ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40 shadow-sm'
                      : 'bg-white/[0.04] hover:bg-white/[0.08] text-white border-white/10 hover:border-[#00D1FF]/40'
                      }`}
                  >
                    <ThumbsUp className="w-3.5 h-3.5" />
                    <span>
                      {selectedReport.userHasVerified ? '✓ Verified by You' : 'Verify This Water Source'}{' '}
                      ({selectedReport.verifiedReports} verifications)
                    </span>
                  </button>

                  {/* Quality Guidance */}
                  <div className="pt-2 border-t border-white/5 text-[10px] text-neutral-400 flex items-center gap-1.5">
                    <Info className="w-3 h-3 shrink-0 text-[#00D1FF]" />
                    <span className="truncate">
                      Crowdsourced from verified AquaSense X smart bottle sensors.
                    </span>
                  </div>
                </div>
              ) : null}

              {/* Nearby Water Sources Feed (Naturally expanding, part of main page scroll) */}
              <div className="space-y-2 bg-[#12161C] p-3.5 sm:p-4 rounded-2xl sm:rounded-[28px] border border-white/5 shadow-xl">
                <div className="flex items-center justify-between px-1 pb-1">
                  <span className="text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-neutral-300">
                    {activeReferenceLocation
                      ? `Nearby Sources (${activeReferenceLocation.label})`
                      : 'Community Water Directory'}
                  </span>
                  <span className="text-[10px] text-neutral-400 font-mono">
                    {filteredAndRankedReports.length} results
                  </span>
                </div>

                <div className="space-y-1.5">
                  {filteredAndRankedReports.length === 0 ? (
                    <div className="text-center py-8 text-xs text-neutral-500">
                      No community water sources found for the selected filter.
                    </div>
                  ) : (
                    filteredAndRankedReports.map((rep) => {
                      const isSelected = selectedReport?.id === rep.id;
                      const scoreInfo = getScoreColor(rep.qualityScore);
                      const SourceIcon = getSourceIcon(rep.sourceType);

                      return (
                        <div
                          key={rep.id}
                          id={`directory-source-${rep.id}`}
                          onClick={() => handleSelectReport(rep)}
                          className={`p-2.5 sm:p-3 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-2.5 sm:gap-3 touch-target sm:min-h-0 ${isSelected
                            ? 'bg-[#181E26] border-[#00D1FF]/60 shadow-md ring-1 ring-[#00D1FF]/30'
                            : 'bg-[#090B0E] border-white/5 hover:bg-white/[0.04] hover:border-white/15'
                            }`}
                        >
                          {/* Compact Source Icon Badge */}
                          <div
                            className={`w-7 h-7 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center shrink-0 border transition-colors ${isSelected
                              ? 'bg-[#00D1FF]/15 border-[#00D1FF]/30 text-[#00D1FF]'
                              : 'bg-white/[0.04] border-white/10 text-cyan-400/90'
                              }`}
                          >
                            <SourceIcon className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                          </div>

                          {/* Primary Content Rows */}
                          <div className="min-w-0 flex-1">
                            {/* Row 1: Source Name */}
                            <p className="text-xs sm:text-sm font-semibold text-white truncate leading-tight">
                              {rep.sourceName}
                            </p>

                            {/* Row 2: Quality Category & Distance */}
                            <div className="flex items-center flex-wrap gap-x-1.5 gap-y-0.5 text-[11px] mt-0.5 leading-tight">
                              <span className={`font-medium ${scoreInfo.text}`}>
                                {scoreInfo.label}
                              </span>
                              {rep.distanceKm !== undefined && (
                                <>
                                  <span className="text-neutral-600">•</span>
                                  <span className="text-neutral-300 font-medium">
                                    {geocodingService.formatDistance(rep.distanceKm)}
                                  </span>
                                </>
                              )}
                            </div>

                            {/* Row 3: Tested Relative Time & Verification Count */}
                            <div className="flex items-center flex-wrap gap-x-1.5 gap-y-0.5 text-[10px] sm:text-[11px] text-neutral-400 mt-0.5 leading-tight">
                              <span>Tested {rep.lastTestedAt}</span>
                              <span className="text-neutral-600">•</span>
                              <span className="inline-flex items-center gap-0.5 text-emerald-400 font-medium">
                                <Check className="w-3 h-3 text-emerald-400" />
                                <span>{rep.verifiedReports || 0} verified</span>
                              </span>
                            </div>
                          </div>

                          {/* Right: Compact Quality Score Badge & Subtle Chevron */}
                          <div className="text-right shrink-0 flex items-center gap-1.5 sm:gap-2">
                            <span
                              className={`text-xs sm:text-sm font-bold px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-lg font-sans inline-block ${scoreInfo.bg}/15 ${scoreInfo.text} border ${scoreInfo.border}`}
                            >
                              {rep.qualityScore}
                            </span>
                            <ChevronRight className="w-3.5 h-3.5 text-neutral-500 hidden sm:block shrink-0" />
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* MOBILE BOTTOM SHEET FOR SELECTED WATER SOURCE */}
          <AnimatePresence>
            {isMobileSheetOpen && selectedReport && (
              <div className="lg:hidden fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-sm p-0">
                <motion.div
                  initial={{ y: '100%' }}
                  animate={{ y: 0 }}
                  exit={{ y: '100%' }}
                  transition={{ type: 'spring', damping: 25, stiffness: 280 }}
                  className="w-full bg-[#12161C] border-t border-cyan-500/30 rounded-t-[24px] p-4 sm:p-5 shadow-2xl max-h-[85vh] overflow-y-auto safe-area-pb space-y-3.5"
                >
                  {/* Header with dismiss button */}
                  <div className="flex items-start justify-between gap-3 pb-2.5 border-b border-white/10">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-[9px] font-bold uppercase tracking-wider text-[#00D1FF] whitespace-nowrap">
                          <span className="sm:hidden">Water Source</span>
                          <span className="hidden sm:inline">Selected Water Source</span>
                        </span>
                        <span className="text-[9px] font-mono px-2 py-0.5 rounded-full bg-white/[0.05] border border-white/10 text-neutral-300 shrink-0 whitespace-nowrap">
                          {getSourceTypeLabel(selectedReport.sourceType)}
                        </span>
                      </div>
                      <h3 className="text-sm sm:text-base font-semibold text-white leading-tight truncate">
                        {selectedReport.sourceName}
                      </h3>
                      <div className="flex flex-wrap items-center gap-2 mt-1 text-[11px] text-neutral-400">
                        <span>{selectedReport.lastTestedAt}</span>
                        {selectedReport.distanceKm !== undefined && (
                          <>
                            <span>•</span>
                            <span className="text-cyan-300 font-medium">
                              {geocodingService.formatDistance(selectedReport.distanceKm)} away
                            </span>
                          </>
                        )}
                        <span>•</span>
                        <span>
                          By {selectedReport.authorName || 'AquaSense Contributor'}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2.5 shrink-0">
                      <div className="text-right">
                        <span className="text-2xl font-light text-white font-sans">
                          {selectedReport.qualityScore}
                        </span>
                        <span className="text-[10px] text-neutral-400 font-mono">/100</span>
                      </div>
                      <button
                        onClick={() => setIsMobileSheetOpen(false)}
                        className="p-1.5 rounded-xl text-neutral-400 hover:text-white bg-white/5"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Sensor snapshot */}
                  <div className="grid grid-cols-4 gap-1.5 text-center text-xs p-2.5 rounded-xl bg-[#090B0E] border border-white/5">
                    <div>
                      <span className="text-[9px] text-neutral-500 block font-mono">pH</span>
                      <span className="font-semibold text-white">{selectedReport.ph}</span>
                    </div>
                    <div>
                      <span className="text-[9px] text-neutral-500 block font-mono">TDS</span>
                      <span className="font-semibold text-white">{selectedReport.tds} ppm</span>
                    </div>
                    <div>
                      <span className="text-[9px] text-neutral-500 block font-mono">CLARITY</span>
                      <span className="font-semibold text-white">{selectedReport.turbidity} NTU</span>
                    </div>
                    <div>
                      <span className="text-[9px] text-neutral-500 block font-mono">TEMP</span>
                      <span className="font-semibold text-white">{selectedReport.temperature}°C</span>
                    </div>
                  </div>

                  {selectedReport.notes && (
                    <p className="text-xs text-neutral-300 leading-relaxed bg-[#090B0E] p-2.5 rounded-xl border border-white/5 italic">
                      "{selectedReport.notes}"
                    </p>
                  )}

                  {/* Verification Button */}
                  <button
                    onClick={() => handleToggleVerification(selectedReport)}
                    className={`w-full flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs font-semibold transition-all border touch-target cursor-pointer ${selectedReport.userHasVerified
                      ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40'
                      : 'bg-white/[0.04] text-white border-white/10'
                      }`}
                  >
                    <ThumbsUp className="w-3.5 h-3.5" />
                    <span>
                      {selectedReport.userHasVerified ? '✓ Verified by You' : 'Verify This Water Source'}{' '}
                      ({selectedReport.verifiedReports} verifications)
                    </span>
                  </button>
                </motion.div>
              </div>
            )}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
};

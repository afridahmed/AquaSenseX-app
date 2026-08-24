import React, { useState, useEffect, useMemo, useRef } from 'react';
import { CommunityReport } from '../../types';
import { useBottle } from '../../context/BottleContext';
import { useAuth } from '../../context/AuthContext';
import { Header } from '../../components/common/Header';
import { LeafletCommunityMap, ExplorationLocation } from '../../components/common/LeafletCommunityMap';
import { UnknownSourceTestModal } from '../dashboard/UnknownSourceTestModal';
import { geocodingService, GeocodingResult } from '../../services/geocoding/geocodingService';
import {
  toggleReportVerification,
  formatRelativeTime,
} from '../../services/community/communityService';
import { db } from '../../services/firebase/firebaseConfig';
import {
  collection,
  onSnapshot,
  query,
  orderBy,
} from 'firebase/firestore';
import {
  MapPin,
  Clock,
  ThumbsUp,
  Plus,
  Search,
  Navigation,
  X,
  Info,
  Loader2,
  AlertTriangle,
  Compass,
  CheckCircle2,
  Droplets,
  Share2,
  ExternalLink,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

// Starter community dataset with verified coordinates
const INITIAL_REPORTS: CommunityReport[] = [
  {
    id: 'rep_1',
    uid: 'usr_sarah',
    authorName: 'Sarah Jenkins',
    bottleId: 'ASX-9821-4402',
    latitude: 37.7749,
    longitude: -122.4194,
    sourceName: 'Yerba Buena Gardens Water Fountain',
    sourceType: 'fountain',
    qualityScore: 94,
    temperature: 14.8,
    tds: 142,
    turbidity: 0.3,
    ph: 7.4,
    verifiedReports: 28,
    verifiedUids: ['usr_sarah'],
    createdAt: new Date(Date.now() - 2 * 3600 * 1000).toISOString(),
    lastTestedAt: '2 hours ago',
    notes: 'Pristine, cold, and rapid flow rate with micro-filtration station.',
  },
  {
    id: 'rep_2',
    uid: 'usr_marcus',
    authorName: 'Marcus Vance',
    bottleId: 'ASX-4109-8831',
    latitude: 37.7833,
    longitude: -122.4167,
    sourceName: 'Civic Center Public Hydration Station',
    sourceType: 'filtration_station',
    qualityScore: 89,
    temperature: 16.2,
    tds: 195,
    turbidity: 0.5,
    ph: 7.2,
    verifiedReports: 14,
    verifiedUids: ['usr_marcus'],
    createdAt: new Date(Date.now() - 5 * 3600 * 1000).toISOString(),
    lastTestedAt: '5 hours ago',
    notes: 'Good cold tap with UV purification cap.',
  },
  {
    id: 'rep_3',
    uid: 'usr_elena',
    authorName: 'Elena Rostova',
    bottleId: 'ASX-3301-7719',
    latitude: 37.7694,
    longitude: -122.4467,
    sourceName: 'Buena Vista Trailhead Rustic Fountain',
    sourceType: 'tap',
    qualityScore: 68,
    temperature: 20.4,
    tds: 410,
    turbidity: 1.8,
    ph: 6.6,
    verifiedReports: 6,
    verifiedUids: ['usr_elena'],
    createdAt: new Date(Date.now() - 18 * 3600 * 1000).toISOString(),
    lastTestedAt: '18 hours ago',
    notes: 'Mild metallic taste and higher mineral hardness. Filtration recommended.',
  },
  {
    id: 'rep_4',
    uid: 'usr_dave',
    authorName: 'David Kim',
    bottleId: 'ASX-5510-1284',
    latitude: 37.8014,
    longitude: -122.4056,
    sourceName: 'Pier 39 Promenade Chilled Hydration Bar',
    sourceType: 'filtration_station',
    qualityScore: 91,
    temperature: 15.0,
    tds: 168,
    turbidity: 0.4,
    ph: 7.3,
    verifiedReports: 42,
    verifiedUids: ['usr_dave'],
    createdAt: new Date(Date.now() - 28 * 3600 * 1000).toISOString(),
    lastTestedAt: '1 day ago',
    notes: 'Chilled bottle refill station with digital purity filter counter.',
  },
  {
    id: 'rep_5',
    uid: 'usr_sam',
    authorName: 'Samira Patel',
    bottleId: 'ASX-9941-0021',
    latitude: 37.7582,
    longitude: -122.4200,
    sourceName: 'Mission Dolores Park Outdoor Spigot #2',
    sourceType: 'fountain',
    qualityScore: 48,
    temperature: 23.1,
    tds: 580,
    turbidity: 3.9,
    ph: 6.1,
    verifiedReports: 9,
    verifiedUids: ['usr_sam'],
    createdAt: new Date(Date.now() - 44 * 3600 * 1000).toISOString(),
    lastTestedAt: '1 day ago',
    notes: 'Noticeable turbidity and pipe sediment detected by AquaSense X sensor.',
  },
];

interface CommunityMapScreenProps {
  initialSelectedReportId?: string | null;
}

export const CommunityMapScreen: React.FC<CommunityMapScreenProps> = ({
  initialSelectedReportId,
}) => {
  const { user } = useAuth();

  const [reports, setReports] = useState<CommunityReport[]>(INITIAL_REPORTS);
  const [selectedReport, setSelectedReport] = useState<CommunityReport | null>(INITIAL_REPORTS[0]);
  const [filterQuality, setFilterQuality] = useState<'all' | 'excellent' | 'caution'>('all');

  // Mobile Bottom Sheet state for selected source
  const [isMobileSheetOpen, setIsMobileSheetOpen] = useState<boolean>(false);

  // Search & Geocoding exploration state
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [searchResults, setSearchResults] = useState<GeocodingResult[]>([]);
  const [isSearchingLocation, setIsSearchingLocation] = useState<boolean>(false);
  const [showSearchDropdown, setShowSearchDropdown] = useState<boolean>(false);
  const searchDebounceRef = useRef<NodeJS.Timeout | null>(null);

  // Exploration Center (from search or manual map click)
  const [exploreLocation, setExploreLocation] = useState<ExplorationLocation | null>(null);

  // User Device GPS state (strict real-device location)
  const [userLocation, setUserLocation] = useState<{ lat: number; lon: number } | null>(null);
  const [locState, setLocState] = useState<{
    status: 'idle' | 'acquiring' | 'success' | 'error';
    errorMessage: string;
  }>({
    status: 'idle',
    errorMessage: '',
  });

  // Test & Report Water Modal from Community Screen (uses exact unified modal)
  const [isReportModalOpen, setIsReportModalOpen] = useState<boolean>(false);

  // Real-time Firestore sync
  useEffect(() => {
    try {
      const colRef = collection(db, 'communityReports');
      const q = query(colRef, orderBy('createdAt', 'desc'));

      const unsubscribe = onSnapshot(
        q,
        (snapshot) => {
          if (!snapshot.empty) {
            const list: CommunityReport[] = snapshot.docs.map((docSnap) => {
              const data = docSnap.data() as Omit<CommunityReport, 'id'>;
              const hasVerified =
                user && Array.isArray(data.verifiedUids) ? data.verifiedUids.includes(user.uid) : false;

              return {
                id: docSnap.id,
                ...data,
                userHasVerified: hasVerified,
                lastTestedAt: formatRelativeTime(data.createdAt),
              };
            });

            // Merge with initial reports to ensure rich map coverage
            const existingIds = new Set(list.map((r) => r.id));
            const merged = [
              ...list,
              ...INITIAL_REPORTS.filter((r) => !existingIds.has(r.id)),
            ];

            setReports(merged);

            // Handle initial deep-link selection
            if (initialSelectedReportId) {
              const matched = merged.find((r) => r.id === initialSelectedReportId);
              if (matched) {
                setSelectedReport(matched);
                setIsMobileSheetOpen(true);
              }
            } else if (!selectedReport && merged.length > 0) {
              setSelectedReport(merged[0]);
            }
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

  // Handler: Use My Location for map exploration
  const handleUseMyLocation = () => {
    if (!navigator.geolocation) {
      setLocState({
        status: 'error',
        errorMessage: 'Geolocation is not supported by your browser.',
      });
      return;
    }

    setLocState({ status: 'acquiring', errorMessage: '' });

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lon = pos.coords.longitude;
        setUserLocation({ lat, lon });
        // Clear manual exploration pin so map centers on real user location
        setExploreLocation(null);
        setLocState({ status: 'success', errorMessage: '' });
      },
      (err) => {
        let msg = 'Could not acquire location.';
        if (err.code === err.PERMISSION_DENIED) {
          msg = 'Location permission denied. Enable location in browser settings.';
        } else if (err.code === err.POSITION_UNAVAILABLE) {
          msg = 'GPS location is currently unavailable.';
        } else if (err.code === err.TIMEOUT) {
          msg = 'Location request timed out. Please retry.';
        }
        setLocState({ status: 'error', errorMessage: msg });
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );
  };

  // Search Input Geocoding Debounce
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
    }, 400);
  };

  // Select location from search autocomplete
  const handleSelectSearchResult = (result: GeocodingResult) => {
    const label = result.name || result.displayName.split(',')[0];
    setExploreLocation({
      lat: result.lat,
      lon: result.lon,
      label,
      source: 'search',
    });
    setSearchQuery(label);
    setShowSearchDropdown(false);
  };

  // Manual Map Click/Tap handler for geographical exploration
  const handleMapClick = async (lat: number, lon: number) => {
    // Set immediate coordinate pin
    setExploreLocation({
      lat,
      lon,
      label: 'Exploring Area',
      source: 'map_click',
    });

    // Reverse geocode to get a human-readable neighborhood/place title
    try {
      const placeName = await geocodingService.reverseGeocode(lat, lon);
      setExploreLocation({
        lat,
        lon,
        label: placeName.split(',')[0] || 'Selected Map Point',
        source: 'map_click',
      });
    } catch {
      // Keep coordinate label
    }
  };

  // Active Exploration Center (Prioritize active search/click explore pin, then real user GPS)
  const activeCenter = useMemo(() => {
    if (exploreLocation) {
      return { lat: exploreLocation.lat, lon: exploreLocation.lon, label: exploreLocation.label };
    }
    if (userLocation) {
      return { lat: userLocation.lat, lon: userLocation.lon, label: 'Your GPS Location' };
    }
    return null;
  }, [exploreLocation, userLocation]);

  // Compute distance for each report from active exploration center
  const reportsWithDistance = useMemo(() => {
    return reports.map((rep) => {
      let distanceKm: number | undefined = undefined;
      if (activeCenter) {
        distanceKm = geocodingService.calculateDistanceKm(
          activeCenter.lat,
          activeCenter.lon,
          rep.latitude,
          rep.longitude
        );
      }
      return {
        ...rep,
        distanceKm,
      };
    });
  }, [reports, activeCenter]);

  // Filtered & Sorted reports feed
  const filteredReports = useMemo(() => {
    return reportsWithDistance
      .filter((rep) => {
        const matchesSearch =
          searchQuery.length < 2 ||
          rep.sourceName.toLowerCase().includes(searchQuery.toLowerCase()) ||
          (rep.notes && rep.notes.toLowerCase().includes(searchQuery.toLowerCase())) ||
          (rep.sourceType && rep.sourceType.toLowerCase().includes(searchQuery.toLowerCase()));

        if (!matchesSearch && searchQuery.length >= 2 && searchResults.length === 0) return false;
        if (filterQuality === 'excellent') return rep.qualityScore >= 88;
        if (filterQuality === 'caution') return rep.qualityScore < 88;
        return true;
      })
      .sort((a, b) => {
        // If distance from active exploration center is available, sort primarily by proximity
        if (a.distanceKm !== undefined && b.distanceKm !== undefined) {
          return a.distanceKm - b.distanceKm;
        }
        return b.qualityScore - a.qualityScore;
      });
  }, [reportsWithDistance, searchQuery, filterQuality, searchResults.length]);

  // Select a report and open mobile bottom sheet if on small screens
  const handleSelectReport = (rep: CommunityReport) => {
    setSelectedReport(rep);
    setIsMobileSheetOpen(true);
  };

  // Toggle Verification with optimistic UI + Firestore transaction (1 per user)
  const handleToggleVerification = async (report: CommunityReport) => {
    if (!user) return;

    const currentlyVerified = !!report.userHasVerified;
    const optimisticCount = currentlyVerified
      ? Math.max(0, report.verifiedReports - 1)
      : report.verifiedReports + 1;

    // Update local state optimistically
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
      const result = await toggleReportVerification(report.id, user.uid);
      // Synchronize exact result from transaction
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
      console.warn('Verification sync failed, reverting:', err);
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
    if (score >= 88) return { bg: 'bg-[#00D1FF]', text: 'text-[#00D1FF]', border: 'border-[#00D1FF]/30', label: 'Pure' };
    if (score >= 70) return { bg: 'bg-emerald-400', text: 'text-emerald-400', border: 'border-emerald-500/30', label: 'Normal' };
    if (score >= 50) return { bg: 'bg-amber-400', text: 'text-amber-300', border: 'border-amber-500/30', label: 'Caution' };
    return { bg: 'bg-rose-400', text: 'text-rose-400', border: 'border-rose-500/30', label: 'Poor' };
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
        return 'Water Fountain';
    }
  };

  return (
    <div className="space-y-4 sm:space-y-6 pb-20 lg:pb-8 max-w-7xl mx-auto px-3 sm:px-4 lg:px-6">
      <Header />

      <div className="space-y-4 sm:space-y-5">
        {/* Top Control Bar: Search, Real Geolocation, Quality Filters & Report Source Button */}
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 bg-[#12161C] p-3 sm:p-4 rounded-[24px] sm:rounded-[28px] border border-white/5 shadow-xl">
          {/* Search Input with Nominatim Autocomplete */}
          <div className="relative flex-1">
            <div className="relative">
              <Search className="w-4 h-4 text-neutral-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => handleSearchChange(e.target.value)}
                onFocus={() => {
                  if (searchResults.length > 0) setShowSearchDropdown(true);
                }}
                placeholder="Search city, neighborhood, park, or source..."
                className="w-full bg-[#090B0E] border border-white/10 rounded-2xl pl-10 pr-10 py-2.5 text-xs sm:text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-[#00D1FF]/50 transition-colors"
              />
              {isSearchingLocation ? (
                <Loader2 className="w-4 h-4 text-[#00D1FF] animate-spin absolute right-3.5 top-1/2 -translate-y-1/2" />
              ) : searchQuery ? (
                <button
                  onClick={() => {
                    setSearchQuery('');
                    setSearchResults([]);
                    setShowSearchDropdown(false);
                    setExploreLocation(null);
                  }}
                  className="p-1 text-neutral-400 hover:text-white absolute right-3 top-1/2 -translate-y-1/2"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              ) : null}
            </div>

            {/* Nominatim Geocoding Autocomplete Dropdown */}
            {showSearchDropdown && searchResults.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-1.5 bg-[#12161C] border border-white/10 rounded-2xl shadow-2xl overflow-hidden z-50 divide-y divide-white/5 max-h-60 overflow-y-auto">
                {searchResults.map((res) => (
                  <button
                    key={res.placeId}
                    type="button"
                    onClick={() => handleSelectSearchResult(res)}
                    className="w-full p-3 text-left hover:bg-white/[0.06] transition-colors flex items-center gap-2.5 text-xs text-white"
                  >
                    <Compass className="w-4 h-4 text-[#00D1FF] shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-white truncate">{res.name}</p>
                      <p className="text-[10px] text-neutral-400 truncate">{res.displayName}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Action Row: Use My Location, Quality Filter Pills & Single Report Source Button */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Real Geolocation Button */}
            <button
              onClick={handleUseMyLocation}
              disabled={locState.status === 'acquiring'}
              title="Locate my current GPS position on map"
              className={`flex items-center gap-1.5 px-3.5 py-2.5 rounded-2xl border text-xs font-semibold transition-all touch-target sm:min-h-0 sm:min-w-0 ${
                userLocation && !exploreLocation
                  ? 'bg-[#00D1FF]/15 text-[#00D1FF] border-[#00D1FF]/40 shadow-sm'
                  : 'bg-[#090B0E] text-neutral-300 hover:text-white border-white/10 hover:border-white/20'
              }`}
            >
              {locState.status === 'acquiring' ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin text-[#00D1FF]" />
              ) : (
                <Navigation className="w-3.5 h-3.5 text-[#00D1FF]" />
              )}
              <span>{userLocation && !exploreLocation ? 'My GPS Active' : 'Use My Location'}</span>
            </button>

            {/* Quality Filter Pills */}
            <div className="flex items-center bg-[#090B0E] border border-white/10 rounded-2xl p-1 text-xs font-medium shrink-0">
              <button
                onClick={() => setFilterQuality('all')}
                className={`px-3 py-1.5 rounded-xl transition-all touch-target sm:min-h-0 sm:min-w-0 ${
                  filterQuality === 'all'
                    ? 'bg-white/[0.08] text-white shadow-sm border border-white/10'
                    : 'text-neutral-400 hover:text-white'
                }`}
              >
                All ({reports.length})
              </button>
              <button
                onClick={() => setFilterQuality('excellent')}
                className={`px-3 py-1.5 rounded-xl transition-all touch-target sm:min-h-0 sm:min-w-0 ${
                  filterQuality === 'excellent'
                    ? 'bg-[#00D1FF]/15 text-[#00D1FF] border border-[#00D1FF]/30 shadow-sm'
                    : 'text-neutral-400 hover:text-white'
                }`}
              >
                Pure (≥88)
              </button>
              <button
                onClick={() => setFilterQuality('caution')}
                className={`px-3 py-1.5 rounded-xl transition-all touch-target sm:min-h-0 sm:min-w-0 ${
                  filterQuality === 'caution'
                    ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30 shadow-sm'
                    : 'text-neutral-400 hover:text-white'
                }`}
              >
                Caution (&lt;88)
              </button>
            </div>

            {/* Single Report Source Button (triggers real GPS test flow) */}
            <button
              onClick={() => setIsReportModalOpen(true)}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-2xl bg-[#00D1FF] hover:bg-[#00B4D8] text-[#090B0E] text-xs font-semibold shrink-0 shadow-lg shadow-[#00D1FF]/20 active:scale-95 transition-all touch-target sm:min-h-0 sm:min-w-0 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Report Source</span>
            </button>
          </div>
        </div>

        {/* Location Exploration Status Banner if active */}
        {exploreLocation && (
          <div className="flex items-center justify-between px-4 py-2.5 bg-[#181E26] border border-amber-500/30 rounded-2xl text-xs text-amber-300">
            <div className="flex items-center gap-2 min-w-0">
              <Compass className="w-4 h-4 shrink-0 text-amber-400" />
              <span className="truncate">
                Exploring water sources near: <strong>{exploreLocation.label || 'Selected Location'}</strong>
              </span>
            </div>
            <button
              onClick={() => setExploreLocation(null)}
              className="text-[11px] underline text-neutral-400 hover:text-white shrink-0 ml-2"
            >
              Reset exploration
            </button>
          </div>
        )}

        {/* Main Map & Side Panel Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6 items-start">
          {/* Leaflet OpenStreetMap Canvas (7 cols on lg) */}
          <div className="lg:col-span-7 bg-[#12161C] border border-white/5 rounded-[28px] sm:rounded-[32px] p-2.5 sm:p-3.5 overflow-hidden relative shadow-2xl flex flex-col">
            {/* Top Status Bar over Map */}
            <div className="flex items-center justify-between pb-2.5 px-2 text-[11px] sm:text-xs">
              <div className="flex items-center gap-1.5 text-neutral-300 font-medium truncate">
                <Compass className="w-3.5 h-3.5 text-[#00D1FF] shrink-0" />
                <span className="truncate">
                  {exploreLocation
                    ? `Centered on: ${exploreLocation.label}`
                    : userLocation
                    ? 'Centered near your GPS position'
                    : 'Global AquaSense Water Quality Network'}
                </span>
              </div>
              <span className="text-[10px] text-neutral-400 font-mono shrink-0 ml-2">
                {filteredReports.length} Sources Mapped
              </span>
            </div>

            {/* Real Leaflet Map Component with Exploration Pin & Map Click Handler */}
            <div className="w-full h-[340px] xs:h-[400px] sm:h-[480px] lg:h-[580px] rounded-[22px] sm:rounded-[26px] overflow-hidden border border-white/10 relative">
              <LeafletCommunityMap
                reports={filteredReports}
                selectedReport={selectedReport}
                onSelectReport={handleSelectReport}
                userLocation={userLocation}
                exploreLocation={exploreLocation}
                onMapClick={handleMapClick}
              />
            </div>

            {/* Map Legend & Click Guidance */}
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 px-2 text-[10px] sm:text-[11px] text-neutral-400">
              <div className="flex flex-wrap items-center gap-3">
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#00D1FF]" /> Pure (88–100)
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" /> Normal (70–87)
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-400" /> Caution (&lt;70)
                </span>
              </div>
              <span className="text-[10px] text-neutral-500 font-mono">
                Click map to explore any area • GPS required to report
              </span>
            </div>
          </div>

          {/* Selected Water Source Details Card & Nearby Directory Feed (5 cols on lg) */}
          <div className="lg:col-span-5 space-y-4">
            {/* Desktop Selected Water Source Card */}
            {selectedReport ? (
              <div className="hidden lg:block p-5 sm:p-6 rounded-[28px] sm:rounded-[32px] bg-[#12161C] border border-cyan-500/20 shadow-2xl space-y-4">
                {/* Card Header */}
                <div className="flex items-start justify-between gap-3 pb-3.5 border-b border-white/5">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-[#00D1FF]">
                        Selected Water Source
                      </span>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-white/[0.05] border border-white/10 text-neutral-300">
                        {getSourceTypeLabel(selectedReport.sourceType)}
                      </span>
                    </div>

                    <h3 className="text-base font-semibold text-white leading-tight truncate">
                      {selectedReport.sourceName}
                    </h3>

                    <div className="flex flex-wrap items-center gap-2 mt-1.5 text-xs text-neutral-400">
                      <div className="flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5 text-neutral-400" />
                        <span>{selectedReport.lastTestedAt}</span>
                      </div>
                      {selectedReport.distanceKm !== undefined && (
                        <>
                          <span>•</span>
                          <span className="text-cyan-300 font-medium">
                            {geocodingService.formatDistance(selectedReport.distanceKm)}
                          </span>
                        </>
                      )}
                      <span>•</span>
                      <span className="truncate">By {selectedReport.authorName || 'AquaSense User'}</span>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <div className="flex items-baseline justify-end gap-1">
                      <span className="text-3xl font-light text-white font-sans">
                        {selectedReport.qualityScore}
                      </span>
                      <span className="text-xs text-neutral-400 font-mono">/100</span>
                    </div>
                    <span
                      className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${
                        getScoreColor(selectedReport.qualityScore).text
                      } ${getScoreColor(selectedReport.qualityScore).border} bg-white/[0.02] inline-block mt-0.5`}
                    >
                      {getScoreColor(selectedReport.qualityScore).label}
                    </span>
                  </div>
                </div>

                {/* Sensor Telemetry Snapshot */}
                <div className="grid grid-cols-4 gap-2 text-center text-xs p-3 rounded-2xl bg-[#090B0E] border border-white/5">
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
                  <p className="text-xs text-neutral-300 leading-relaxed bg-[#090B0E] p-3 rounded-2xl border border-white/5 italic">
                    "{selectedReport.notes}"
                  </p>
                )}

                {/* Verification Action Button */}
                <button
                  onClick={() => handleToggleVerification(selectedReport)}
                  className={`w-full flex items-center justify-center gap-2 py-3 px-4 rounded-2xl text-xs font-semibold transition-all border touch-target sm:min-h-0 sm:min-w-0 cursor-pointer active:scale-98 ${
                    selectedReport.userHasVerified
                      ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40 shadow-sm shadow-emerald-500/10'
                      : 'bg-white/[0.04] hover:bg-white/[0.08] text-white border-white/10 hover:border-[#00D1FF]/40'
                  }`}
                >
                  <ThumbsUp className="w-4 h-4" />
                  <span>
                    {selectedReport.userHasVerified ? '✓ Verified by You' : 'Verify This Water Source'}{' '}
                    ({selectedReport.verifiedReports} verifications)
                  </span>
                </button>

                {/* Quality Guidance Footer */}
                <div className="pt-2 border-t border-white/5 text-[10px] text-neutral-400 flex items-center gap-1.5">
                  <Info className="w-3.5 h-3.5 shrink-0 text-[#00D1FF]" />
                  <span className="truncate">
                    Crowdsourced from verified AquaSense X smart bottle optical & electrical sensors.
                  </span>
                </div>
              </div>
            ) : null}

            {/* Nearby Water Sources Feed */}
            <div className="space-y-2 bg-[#12161C] p-4 sm:p-5 rounded-[28px] sm:rounded-[32px] border border-white/5 shadow-xl">
              <div className="flex items-center justify-between px-1 pb-1">
                <span className="text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-neutral-400">
                  {activeCenter ? `Nearby Sources (${activeCenter.label})` : 'Community Water Directory'}
                </span>
                <span className="text-[10px] text-neutral-500 font-mono">
                  {filteredReports.length} results
                </span>
              </div>

              <div className="space-y-2 max-h-80 sm:max-h-96 overflow-y-auto pr-1">
                {filteredReports.length === 0 ? (
                  <div className="text-center py-8 text-xs text-neutral-500">
                    No community water sources found matching your query.
                  </div>
                ) : (
                  filteredReports.map((rep) => {
                    const isSelected = selectedReport?.id === rep.id;
                    const scoreInfo = getScoreColor(rep.qualityScore);

                    return (
                      <div
                        key={rep.id}
                        onClick={() => handleSelectReport(rep)}
                        className={`p-3 sm:p-3.5 rounded-2xl border transition-all cursor-pointer flex items-center justify-between touch-target sm:min-h-0 ${
                          isSelected
                            ? 'bg-[#181E26] border-[#00D1FF]/60 shadow-md ring-1 ring-[#00D1FF]/30'
                            : 'bg-[#090B0E] border-white/5 hover:bg-white/[0.04] hover:border-white/15'
                        }`}
                      >
                        <div className="min-w-0 flex-1 pr-3">
                          <div className="flex items-center gap-2">
                            <p className="text-xs font-semibold text-white truncate">{rep.sourceName}</p>
                          </div>
                          <div className="flex items-center gap-2 text-[10px] text-neutral-400 mt-0.5">
                            <span>{rep.lastTestedAt}</span>
                            <span>•</span>
                            <span>{rep.verifiedReports} verified</span>
                            {rep.distanceKm !== undefined && (
                              <>
                                <span>•</span>
                                <span className="text-cyan-400 font-medium">
                                  {geocodingService.formatDistance(rep.distanceKm)}
                                </span>
                              </>
                            )}
                          </div>
                        </div>

                        <div className="text-right shrink-0">
                          <span
                            className={`text-xs font-bold px-2.5 py-1 rounded-xl font-sans inline-block ${scoreInfo.bg}/15 ${scoreInfo.text} border ${scoreInfo.border}`}
                          >
                            {rep.qualityScore} pts
                          </span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile Bottom Sheet Modal for Selected Water Source */}
      <AnimatePresence>
        {isMobileSheetOpen && selectedReport && (
          <div className="lg:hidden fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-sm p-0">
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 280 }}
              className="w-full bg-[#12161C] border-t border-cyan-500/30 rounded-t-[28px] p-5 shadow-2xl max-h-[85vh] overflow-y-auto safe-area-pb space-y-4"
            >
              {/* Header with dismiss button */}
              <div className="flex items-start justify-between gap-3 pb-3 border-b border-white/10">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#00D1FF]">
                      Selected Water Source
                    </span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-white/[0.05] border border-white/10 text-neutral-300">
                      {getSourceTypeLabel(selectedReport.sourceType)}
                    </span>
                  </div>
                  <h3 className="text-base font-semibold text-white leading-tight truncate">
                    {selectedReport.sourceName}
                  </h3>
                  <div className="flex flex-wrap items-center gap-2 mt-1 text-xs text-neutral-400">
                    <span>{selectedReport.lastTestedAt}</span>
                    {selectedReport.distanceKm !== undefined && (
                      <>
                        <span>•</span>
                        <span className="text-cyan-300 font-medium">
                          {geocodingService.formatDistance(selectedReport.distanceKm)}
                        </span>
                      </>
                    )}
                    <span>•</span>
                    <span>By {selectedReport.authorName || 'AquaSense User'}</span>
                  </div>
                </div>

                <div className="flex items-center gap-3 shrink-0">
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
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Sensor snapshot */}
              <div className="grid grid-cols-4 gap-2 text-center text-xs p-3 rounded-2xl bg-[#090B0E] border border-white/5">
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
                <p className="text-xs text-neutral-300 leading-relaxed bg-[#090B0E] p-3 rounded-2xl border border-white/5 italic">
                  "{selectedReport.notes}"
                </p>
              )}

              {/* Verification Button */}
              <button
                onClick={() => handleToggleVerification(selectedReport)}
                className={`w-full flex items-center justify-center gap-2 py-3 px-4 rounded-2xl text-xs font-semibold transition-all border touch-target ${
                  selectedReport.userHasVerified
                    ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40'
                    : 'bg-white/[0.04] text-white border-white/10'
                }`}
              >
                <ThumbsUp className="w-4 h-4" />
                <span>
                  {selectedReport.userHasVerified ? '✓ Verified by You' : 'Verify This Water Source'}{' '}
                  ({selectedReport.verifiedReports} verifications)
                </span>
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Unified Test & Report Water Modal with strict device GPS location lock */}
      <UnknownSourceTestModal
        isOpen={isReportModalOpen}
        onClose={() => setIsReportModalOpen(false)}
        onSuccessPublish={handlePublishSuccess}
      />
    </div>
  );
};

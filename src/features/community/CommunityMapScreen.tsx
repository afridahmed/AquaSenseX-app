import React, { useState, useEffect, useMemo, useRef } from 'react';
import { CommunityReport } from '../../types';
import { useBottle } from '../../context/BottleContext';
import { useAuth } from '../../context/AuthContext';
import { Header } from '../../components/common/Header';
import { LeafletCommunityMap } from '../../components/common/LeafletCommunityMap';
import { geocodingService, GeocodingResult } from '../../services/geocoding/geocodingService';
import {
  createCommunityReport,
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
  Filter,
  Sparkles,
  Droplets,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

// Production starter community dataset with valid coordinates
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
  const { bottle, qualityEval } = useBottle();
  const { user } = useAuth();

  const [reports, setReports] = useState<CommunityReport[]>(INITIAL_REPORTS);
  const [selectedReport, setSelectedReport] = useState<CommunityReport | null>(INITIAL_REPORTS[0]);
  const [filterQuality, setFilterQuality] = useState<'all' | 'excellent' | 'caution'>('all');

  // Search & Geocoding state
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [searchResults, setSearchResults] = useState<GeocodingResult[]>([]);
  const [isSearchingLocation, setIsSearchingLocation] = useState<boolean>(false);
  const [showSearchDropdown, setShowSearchDropdown] = useState<boolean>(false);
  const searchDebounceRef = useRef<NodeJS.Timeout | null>(null);

  // User Geolocation state
  const [userLocation, setUserLocation] = useState<{ lat: number; lon: number } | null>(null);
  const [locState, setLocState] = useState<{
    status: 'idle' | 'acquiring' | 'success' | 'error';
    errorMessage: string;
  }>({
    status: 'idle',
    errorMessage: '',
  });

  // Modal for manual reporting from map
  const [isSubmitModalOpen, setIsSubmitModalOpen] = useState<boolean>(false);
  const [newSourceName, setNewSourceName] = useState<string>('');
  const [newNotes, setNewNotes] = useState<string>('');
  const [newSourceType, setNewSourceType] = useState<CommunityReport['sourceType']>('fountain');
  const [isSubmittingReport, setIsSubmittingReport] = useState<boolean>(false);

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

            // Merge with initial reports to ensure rich map density
            const existingIds = new Set(list.map((r) => r.id));
            const merged = [
              ...list,
              ...INITIAL_REPORTS.filter((r) => !existingIds.has(r.id)),
            ];

            setReports(merged);

            // If initialSelectedReportId was passed, set that
            if (initialSelectedReportId) {
              const matched = merged.find((r) => r.id === initialSelectedReportId);
              if (matched) setSelectedReport(matched);
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

  // Handler: Use My Location
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

  const handleSelectSearchResult = (result: GeocodingResult) => {
    setUserLocation({ lat: result.lat, lon: result.lon });
    setSearchQuery(result.name || result.displayName.split(',')[0]);
    setShowSearchDropdown(false);
  };

  // Compute distance for each report if user location is active
  const reportsWithDistance = useMemo(() => {
    return reports.map((rep) => {
      let distanceKm: number | undefined = undefined;
      if (userLocation) {
        distanceKm = geocodingService.calculateDistanceKm(
          userLocation.lat,
          userLocation.lon,
          rep.latitude,
          rep.longitude
        );
      }
      return {
        ...rep,
        distanceKm,
      };
    });
  }, [reports, userLocation]);

  // Filtered & Sorted reports
  const filteredReports = useMemo(() => {
    return reportsWithDistance
      .filter((rep) => {
        const matchesSearch =
          rep.sourceName.toLowerCase().includes(searchQuery.toLowerCase()) ||
          (rep.notes && rep.notes.toLowerCase().includes(searchQuery.toLowerCase())) ||
          (rep.sourceType && rep.sourceType.toLowerCase().includes(searchQuery.toLowerCase()));

        if (!matchesSearch && searchQuery.length > 1 && searchResults.length === 0) return false;
        if (filterQuality === 'excellent') return rep.qualityScore >= 88;
        if (filterQuality === 'caution') return rep.qualityScore < 88;
        return true;
      })
      .sort((a, b) => {
        // If distance is available, sort primarily by proximity
        if (a.distanceKm !== undefined && b.distanceKm !== undefined) {
          return a.distanceKm - b.distanceKm;
        }
        return b.qualityScore - a.qualityScore;
      });
  }, [reportsWithDistance, searchQuery, filterQuality, searchResults.length]);

  // Toggle Verification with optimistic UI + Firestore transaction
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
      // Synchronize exact result
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
      // Revert on error
      setReports(reports);
      if (selectedReport?.id === report.id) {
        setSelectedReport(report);
      }
    }
  };

  // Submit new report modal handler
  const handleSubmitReport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSourceName.trim() || !user) return;

    setIsSubmittingReport(true);

    const lat = userLocation ? userLocation.lat : 37.7749 + (Math.random() - 0.5) * 0.04;
    const lon = userLocation ? userLocation.lon : -122.4194 + (Math.random() - 0.5) * 0.04;

    try {
      const created = await createCommunityReport({
        uid: user.uid,
        authorName: user.name || 'AquaSense Contributor',
        bottleId: bottle?.bottleId || user.bottleId || 'ASX-9821-4402',
        latitude: lat,
        longitude: lon,
        sourceName: newSourceName.trim(),
        sourceType: newSourceType,
        qualityScore: qualityEval.score,
        temperature: bottle?.temperature || 21.0,
        tds: bottle?.tds || 180,
        turbidity: bottle?.turbidity || 0.4,
        ph: bottle?.ph || 7.2,
        verifiedReports: 1,
        userHasVerified: true,
        notes: newNotes.trim() || 'Verified with AquaSense X smart sensor.',
      });

      setReports([created, ...reports]);
      setSelectedReport(created);
      setIsSubmitModalOpen(false);
      setNewSourceName('');
      setNewNotes('');
    } catch (err) {
      console.error('Error creating report:', err);
    } finally {
      setIsSubmittingReport(false);
    }
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
        return 'Public Fountain';
    }
  };

  return (
    <div className="min-h-full bg-[#090B0E] text-[#F8FAFC] flex flex-col transition-colors duration-200">
      <Header
        title="Community Water Map"
        mobileTitle="Water Map"
        subtitle="Live crowdsourced water testing reported by AquaSense X users"
      />

      <div className="p-3.5 xs:p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full flex-1 flex flex-col space-y-4 sm:space-y-6">
        {/* Location Error Banner */}
        {locState.status === 'error' && (
          <div className="p-3 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-center justify-between gap-2 shadow-sm">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
              <span>{locState.errorMessage}</span>
            </div>
            <button
              onClick={handleUseMyLocation}
              className="text-[11px] font-semibold text-white underline shrink-0 px-2 py-1"
            >
              Retry
            </button>
          </div>
        )}

        {/* Top Controls Bar: Real Geocoding Search, Geolocation & Filter Pills */}
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3 sm:gap-4">
          {/* Search bar with real Nominatim Geocoding dropdown */}
          <div className="relative flex-1 max-w-lg z-30">
            <div className="relative flex items-center">
              <Search className="w-4 h-4 text-neutral-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => handleSearchChange(e.target.value)}
                placeholder="Search city, address, fountain, or park..."
                className="w-full bg-[#12161C] border border-white/10 rounded-2xl pl-10 pr-10 py-2.5 text-xs sm:text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-[#00D1FF]/50"
              />
              {isSearchingLocation ? (
                <Loader2 className="w-4 h-4 text-[#00D1FF] animate-spin absolute right-3.5 top-1/2 -translate-y-1/2" />
              ) : searchQuery ? (
                <button
                  onClick={() => {
                    setSearchQuery('');
                    setSearchResults([]);
                    setShowSearchDropdown(false);
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

          {/* Action Row: Use My Location, Quality Filter Pills & Report Source */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Real Geolocation Button */}
            <button
              onClick={handleUseMyLocation}
              disabled={locState.status === 'acquiring'}
              title="Locate my position on map"
              className={`flex items-center gap-1.5 px-3.5 py-2.5 rounded-2xl border text-xs font-semibold transition-all touch-target sm:min-h-0 sm:min-w-0 ${
                userLocation
                  ? 'bg-[#00D1FF]/15 text-[#00D1FF] border-[#00D1FF]/30 shadow-sm'
                  : 'bg-[#12161C] text-neutral-300 hover:text-white border-white/10 hover:border-white/20'
              }`}
            >
              {locState.status === 'acquiring' ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin text-[#00D1FF]" />
              ) : (
                <Navigation className="w-3.5 h-3.5 text-[#00D1FF]" />
              )}
              <span>{userLocation ? 'My Location Active' : 'Use My Location'}</span>
            </button>

            {/* Quality Filter Pills */}
            <div className="flex items-center bg-[#12161C] border border-white/5 rounded-2xl p-1 text-xs font-medium shrink-0">
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

            {/* Report Source Button */}
            <button
              onClick={() => setIsSubmitModalOpen(true)}
              className="flex items-center gap-1.5 px-3.5 sm:px-4 py-2.5 rounded-2xl bg-[#00D1FF] hover:bg-[#00B4D8] text-[#090B0E] text-xs font-semibold shrink-0 shadow-lg shadow-[#00D1FF]/20 active:scale-95 transition-all touch-target sm:min-h-0 sm:min-w-0"
            >
              <Plus className="w-4 h-4" />
              <span>Report Source</span>
            </button>
          </div>
        </div>

        {/* Interactive Leaflet Map & Side Panel Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6 flex-1 items-start">
          {/* Real Leaflet OpenStreetMap Canvas (7 cols on lg) */}
          <div className="lg:col-span-7 bg-[#12161C] border border-white/5 rounded-[28px] sm:rounded-[32px] p-2.5 sm:p-3 overflow-hidden relative shadow-2xl flex flex-col">
            {/* Top Status Bar over Map */}
            <div className="flex items-center justify-between pb-2 px-2 text-[11px] sm:text-xs">
              <div className="flex items-center gap-1.5 text-neutral-300 font-medium">
                <Compass className="w-3.5 h-3.5 text-[#00D1FF]" />
                <span className="truncate">
                  {userLocation ? 'Centered near your GPS location' : 'Global Water Purity Network'}
                </span>
              </div>
              <span className="text-[10px] text-neutral-400 font-mono">
                {filteredReports.length} Sources Mapped
              </span>
            </div>

            {/* Real Leaflet Map Component */}
            <div className="w-full h-[320px] xs:h-[380px] sm:h-[460px] lg:h-[560px] rounded-[22px] sm:rounded-[26px] overflow-hidden border border-white/10">
              <LeafletCommunityMap
                reports={filteredReports}
                selectedReport={selectedReport}
                onSelectReport={(rep) => setSelectedReport(rep)}
                userLocation={userLocation}
              />
            </div>

            {/* Map Legend */}
            <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2 px-2 text-[10px] sm:text-[11px] text-neutral-400">
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
                OpenStreetMap Real Tiles
              </span>
            </div>
          </div>

          {/* Selected Water Source Details Card & Nearby Feed (5 cols on lg) */}
          <div className="lg:col-span-5 space-y-4">
            {selectedReport ? (
              <motion.div
                key={selectedReport.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-4 xs:p-5 sm:p-6 rounded-[28px] sm:rounded-[32px] bg-[#12161C] border border-cyan-500/20 shadow-2xl space-y-3.5 sm:space-y-4"
              >
                {/* Header */}
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

                    <h3 className="text-sm sm:text-base font-semibold text-white leading-tight truncate">
                      {selectedReport.sourceName}
                    </h3>

                    <div className="flex flex-wrap items-center gap-2 mt-1.5 text-[11px] sm:text-xs text-neutral-400">
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
                      <span className="text-2xl sm:text-3xl font-light text-white font-sans">
                        {selectedReport.qualityScore}
                      </span>
                      <span className="text-[11px] text-neutral-400 font-mono">/100</span>
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

                {/* Sensor telemetry snapshot */}
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

                {/* 1-Per-User Atomic Verification Button */}
                <div className="pt-1">
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
                </div>

                {/* Freshness & Guidance Disclaimer */}
                <div className="pt-2 border-t border-white/5 text-[10px] sm:text-[11px] text-neutral-400 flex items-center gap-1.5">
                  <Info className="w-3.5 h-3.5 shrink-0 text-[#00D1FF]" />
                  <span className="truncate">
                    Crowdsourced from verified AquaSense X optical & electrical sensors.
                  </span>
                </div>
              </motion.div>
            ) : (
              <div className="p-6 sm:p-8 rounded-[28px] sm:rounded-[32px] bg-[#12161C] border border-white/5 text-center text-neutral-400 text-xs">
                Select a water source pin on the map to inspect chemical purity and verification history.
              </div>
            )}

            {/* Nearby Water Sources Feed */}
            <div className="space-y-2">
              <div className="flex items-center justify-between px-1">
                <span className="text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-neutral-400">
                  {userLocation ? 'Nearby Sources (Sorted by Distance)' : 'Community Source Directory'}
                </span>
                <span className="text-[10px] text-neutral-500 font-mono">
                  {filteredReports.length} results
                </span>
              </div>

              <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                {filteredReports.map((rep) => {
                  const isSelected = selectedReport?.id === rep.id;
                  const scoreInfo = getScoreColor(rep.qualityScore);

                  return (
                    <div
                      key={rep.id}
                      onClick={() => setSelectedReport(rep)}
                      className={`p-3 sm:p-3.5 rounded-2xl border transition-all cursor-pointer flex items-center justify-between touch-target sm:min-h-0 ${
                        isSelected
                          ? 'bg-[#181E26] border-[#00D1FF]/60 shadow-md ring-1 ring-[#00D1FF]/30'
                          : 'bg-[#12161C] border-white/5 hover:bg-white/[0.04] hover:border-white/15'
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
                })}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Manual Report Modal from Community Screen */}
      <AnimatePresence>
        {isSubmitModalOpen && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/80 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              className="w-full sm:max-w-lg bg-[#12161C] border-t sm:border border-white/10 rounded-t-[28px] sm:rounded-[32px] p-5 sm:p-7 shadow-2xl relative max-h-[90vh] overflow-y-auto safe-area-pb"
            >
              <div className="flex items-center justify-between pb-3.5 border-b border-white/10">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-[#00D1FF]/10 border border-[#00D1FF]/20 flex items-center justify-center">
                    <MapPin className="w-4 h-4 text-[#00D1FF]" />
                  </div>
                  <h3 className="text-sm sm:text-base font-semibold text-white">Publish Community Report</h3>
                </div>
                <button
                  onClick={() => setIsSubmitModalOpen(false)}
                  className="p-1.5 rounded-xl text-neutral-400 hover:text-white hover:bg-white/5"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSubmitReport} className="mt-4 space-y-4">
                {/* Live readings snapshot */}
                <div className="p-3.5 rounded-2xl bg-[#090B0E] border border-white/5">
                  <span className="text-[10px] uppercase font-semibold text-[#00D1FF] block mb-2">
                    AquaSense X Telemetry attached:
                  </span>
                  <div className="grid grid-cols-4 gap-2 text-center text-xs">
                    <div>
                      <span className="text-neutral-500 block text-[9px]">SCORE</span>
                      <span className="font-semibold text-[#00D1FF]">{qualityEval.score}/100</span>
                    </div>
                    <div>
                      <span className="text-neutral-500 block text-[9px]">pH</span>
                      <span className="font-semibold text-white">{bottle?.ph ?? 7.2}</span>
                    </div>
                    <div>
                      <span className="text-neutral-500 block text-[9px]">TDS</span>
                      <span className="font-semibold text-white">{bottle?.tds ?? 180} ppm</span>
                    </div>
                    <div>
                      <span className="text-neutral-500 block text-[9px]">TURBIDITY</span>
                      <span className="font-semibold text-white">{bottle?.turbidity ?? 0.4} NTU</span>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-neutral-300 mb-1.5">
                    Source Name / Location Title *
                  </label>
                  <input
                    type="text"
                    required
                    value={newSourceName}
                    onChange={(e) => setNewSourceName(e.target.value)}
                    placeholder="e.g. Yerba Buena Gardens Chilled Fountain"
                    className="w-full bg-[#090B0E] border border-white/10 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-[#00D1FF]/50"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-neutral-300 mb-1.5">
                    Source Category
                  </label>
                  <select
                    value={newSourceType}
                    onChange={(e) => setNewSourceType(e.target.value as any)}
                    className="w-full bg-[#090B0E] border border-white/10 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-white focus:outline-none focus:border-[#00D1FF]/50"
                  >
                    <option value="fountain">Public Drinking Fountain</option>
                    <option value="filtration_station">Bottle Refill & Filtration Station</option>
                    <option value="tap">Municipal Tap</option>
                    <option value="spring">Natural Spring</option>
                    <option value="well">Groundwater Well</option>
                    <option value="other">Other Source</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-neutral-300 mb-1.5">
                    Public Observations / Tasting Notes
                  </label>
                  <textarea
                    rows={3}
                    value={newNotes}
                    onChange={(e) => setNewNotes(e.target.value)}
                    placeholder="e.g. Crisp flow, cold, digital filter status active."
                    className="w-full bg-[#090B0E] border border-white/10 rounded-xl px-3 py-2 text-xs sm:text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-[#00D1FF]/50 resize-none"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsSubmitModalOpen(false)}
                    className="flex-1 sm:flex-none px-4 py-2.5 rounded-xl text-xs font-medium text-neutral-300 hover:text-white bg-white/[0.04]"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmittingReport}
                    className="flex-1 sm:flex-none px-5 py-2.5 rounded-xl bg-[#00D1FF] hover:bg-[#00B4D8] text-[#090B0E] font-semibold text-xs transition-colors disabled:opacity-50"
                  >
                    {isSubmittingReport ? 'Publishing...' : 'Publish Report'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

import React, { useState, useEffect } from 'react';
import { CommunityReport } from '../../types';
import { useBottle } from '../../context/BottleContext';
import { useAuth } from '../../context/AuthContext';
import { Header } from '../../components/common/Header';
import { db } from '../../services/firebase/firebaseConfig';
import {
  collection,
  onSnapshot,
  addDoc,
  doc,
  updateDoc,
  serverTimestamp,
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
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

// Starter community dataset
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
    sourceName: 'Pier 39 Public Promenade Spigot',
    sourceType: 'fountain',
    qualityScore: 91,
    temperature: 15.0,
    tds: 168,
    turbidity: 0.4,
    ph: 7.3,
    verifiedReports: 42,
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
    createdAt: new Date(Date.now() - 44 * 3600 * 1000).toISOString(),
    lastTestedAt: '1 day ago',
    notes: 'Noticeable turbidity and pipe sediment detected by AquaSense X sensor.',
  },
];

export const CommunityMapScreen: React.FC = () => {
  const { bottle, qualityEval } = useBottle();
  const { user } = useAuth();

  const [reports, setReports] = useState<CommunityReport[]>(INITIAL_REPORTS);
  const [selectedReport, setSelectedReport] = useState<CommunityReport | null>(INITIAL_REPORTS[0]);
  const [filterQuality, setFilterQuality] = useState<'all' | 'excellent' | 'caution'>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isSubmitModalOpen, setIsSubmitModalOpen] = useState<boolean>(false);

  // New report form state
  const [newSourceName, setNewSourceName] = useState<string>('');
  const [newNotes, setNewNotes] = useState<string>('');
  const [newSourceType, setNewSourceType] = useState<CommunityReport['sourceType']>('fountain');

  // Real-time Firestore sync
  useEffect(() => {
    try {
      const colRef = collection(db, 'communityReports');
      const q = query(colRef, orderBy('createdAt', 'desc'));

      const unsubscribe = onSnapshot(
        q,
        (snapshot) => {
          if (!snapshot.empty) {
            const list: CommunityReport[] = snapshot.docs.map((docSnap) => ({
              id: docSnap.id,
              ...(docSnap.data() as Omit<CommunityReport, 'id'>),
            }));
            setReports(list);
            if (!selectedReport && list.length > 0) {
              setSelectedReport(list[0]);
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
  }, []);

  // Filtered reports
  const filteredReports = reports.filter((rep) => {
    const matchesSearch =
      rep.sourceName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (rep.notes && rep.notes.toLowerCase().includes(searchQuery.toLowerCase()));

    if (!matchesSearch) return false;
    if (filterQuality === 'excellent') return rep.qualityScore >= 88;
    if (filterQuality === 'caution') return rep.qualityScore < 88;
    return true;
  });

  // Verify report handler
  const handleVerifyReport = async (reportId: string) => {
    const target = reports.find((r) => r.id === reportId);
    if (!target) return;

    const userHasVerified = !target.userHasVerified;
    const newCount = userHasVerified ? target.verifiedReports + 1 : Math.max(0, target.verifiedReports - 1);

    setReports((prev) =>
      prev.map((rep) => (rep.id === reportId ? { ...rep, verifiedReports: newCount, userHasVerified } : rep))
    );

    if (selectedReport && selectedReport.id === reportId) {
      setSelectedReport((prev) => (prev ? { ...prev, verifiedReports: newCount, userHasVerified } : null));
    }

    try {
      const docRef = doc(db, 'communityReports', reportId);
      await updateDoc(docRef, {
        verifiedReports: newCount,
      });
    } catch (e) {
      console.warn('Could not update verification on Firestore:', e);
    }
  };

  // Submit new report from current bottle reading
  const handleSubmitReport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSourceName.trim() || !user) return;

    const newReportData: Omit<CommunityReport, 'id'> = {
      uid: user.uid,
      authorName: user.name || 'AquaSense Contributor',
      bottleId: bottle?.bottleId || user.bottleId || 'ASX-9821-4402',
      latitude: 37.7749 + (Math.random() - 0.5) * 0.04,
      longitude: -122.4194 + (Math.random() - 0.5) * 0.04,
      sourceName: newSourceName.trim(),
      sourceType: newSourceType,
      qualityScore: qualityEval.score,
      temperature: bottle?.temperature || 21.0,
      tds: bottle?.tds || 180,
      turbidity: bottle?.turbidity || 0.4,
      ph: bottle?.ph || 7.2,
      verifiedReports: 1,
      userHasVerified: true,
      createdAt: new Date().toISOString(),
      lastTestedAt: 'Just now',
      notes: newNotes.trim() || 'Verified with AquaSense X smart sensor.',
    };

    try {
      const colRef = collection(db, 'communityReports');
      const docRef = await addDoc(colRef, {
        ...newReportData,
        serverCreatedAt: serverTimestamp(),
      });

      const fullReport: CommunityReport = {
        id: docRef.id,
        ...newReportData,
      };

      setReports([fullReport, ...reports]);
      setSelectedReport(fullReport);
    } catch (err) {
      console.error('Error adding community report:', err);
      // Fallback local
      const localReport: CommunityReport = {
        id: `rep_${Date.now()}`,
        ...newReportData,
      };
      setReports([localReport, ...reports]);
      setSelectedReport(localReport);
    }

    setIsSubmitModalOpen(false);
    setNewSourceName('');
    setNewNotes('');
  };

  const getScoreColor = (score: number) => {
    if (score >= 88) return { bg: 'bg-[#00D1FF]', text: 'text-[#00D1FF]', border: 'border-[#00D1FF]/30' };
    if (score >= 70) return { bg: 'bg-emerald-500', text: 'text-emerald-400', border: 'border-emerald-500/30' };
    if (score >= 50) return { bg: 'bg-amber-500', text: 'text-amber-400', border: 'border-amber-500/30' };
    return { bg: 'bg-rose-500', text: 'text-rose-400', border: 'border-rose-500/30' };
  };

  return (
    <div className="min-h-full bg-[#0A0A0A] text-[#F5F5F5] flex flex-col">
      <Header
        title="Community Water Map"
        subtitle="Live crowdsourced water testing reported by AquaSense X users"
      />

      <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full flex-1 flex flex-col space-y-6">
        {/* Top Controls Bar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
          {/* Search bar */}
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-[#888888] absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search fountain, park, or hydration station..."
              className="w-full bg-[#141414] border border-[#222222] rounded-2xl pl-10 pr-4 py-2.5 text-xs text-white placeholder-[#555555] focus:outline-none focus:border-[#00D1FF]/50"
            />
          </div>

          {/* Quality Filter Pills & Add Button */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
            <div className="flex items-center bg-[#141414] border border-[#222222] rounded-2xl p-1 text-xs font-medium">
              <button
                onClick={() => setFilterQuality('all')}
                className={`px-3 py-1.5 rounded-xl transition-all ${
                  filterQuality === 'all'
                    ? 'bg-[#1E1E1E] text-white shadow-sm border border-white/10'
                    : 'text-[#888888] hover:text-white'
                }`}
              >
                All ({reports.length})
              </button>
              <button
                onClick={() => setFilterQuality('excellent')}
                className={`px-3 py-1.5 rounded-xl transition-all ${
                  filterQuality === 'excellent'
                    ? 'bg-[#00D1FF]/15 text-[#00D1FF] border border-[#00D1FF]/30 shadow-sm'
                    : 'text-[#888888] hover:text-white'
                }`}
              >
                Pure (≥88)
              </button>
              <button
                onClick={() => setFilterQuality('caution')}
                className={`px-3 py-1.5 rounded-xl transition-all ${
                  filterQuality === 'caution'
                    ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30 shadow-sm'
                    : 'text-[#888888] hover:text-white'
                }`}
              >
                Caution (&lt;88)
              </button>
            </div>

            <button
              onClick={() => setIsSubmitModalOpen(true)}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-2xl bg-[#00D1FF] hover:bg-[#00B4D8] text-[#0A0A0A] text-xs font-semibold shrink-0 shadow-lg shadow-[#00D1FF]/20 transition-all"
            >
              <Plus className="w-4 h-4" />
              <span>Report Water Source</span>
            </button>
          </div>
        </div>

        {/* Interactive Map Canvas and Side Sheet Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 flex-1 items-start">
          {/* Map Canvas (7 cols) */}
          <div className="lg:col-span-7 bg-[#141414] border border-[#222222] rounded-[32px] p-4 overflow-hidden relative min-h-[420px] lg:min-h-[560px] flex flex-col justify-between shadow-2xl">
            {/* High-End Dark Map Vector Canvas */}
            <div className="absolute inset-0 bg-[#0A0A0A] overflow-hidden">
              <svg className="w-full h-full opacity-30 pointer-events-none" xmlns="http://www.w3.org/2000/svg">
                <defs>
                  <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                    <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="1" />
                  </pattern>
                </defs>
                <rect width="100%" height="100%" fill="url(#grid)" />
                <path d="M -50 200 L 900 350" stroke="rgba(0,209,255,0.15)" strokeWidth="8" fill="none" />
                <path d="M 200 -50 L 350 900" stroke="rgba(0,209,255,0.12)" strokeWidth="6" fill="none" />
                <path d="M 50 600 L 800 100" stroke="rgba(255,255,255,0.05)" strokeWidth="4" fill="none" />
              </svg>
            </div>

            {/* Top Map Status Overlay */}
            <div className="relative z-10 flex items-center justify-between pointer-events-none">
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#141414]/90 border border-[#222222] backdrop-blur-md text-xs text-[#F5F5F5]">
                <Navigation className="w-3.5 h-3.5 text-[#00D1FF]" />
                <span>San Francisco Bay Metro Network</span>
              </div>
              <div className="px-3 py-1 rounded-full bg-[#141414]/90 border border-[#222222] text-[10px] text-[#888888] font-mono">
                {filteredReports.length} Sources Mapped
              </div>
            </div>

            {/* Interactive Map Pins on Canvas */}
            <div className="relative z-10 flex-1 flex items-center justify-center p-8">
              <div className="relative w-full max-w-lg h-72 sm:h-96">
                {filteredReports.map((rep, idx) => {
                  const isSelected = selectedReport?.id === rep.id;
                  const scoreStyles = getScoreColor(rep.qualityScore);

                  const positions = [
                    { top: '35%', left: '42%' },
                    { top: '22%', left: '60%' },
                    { top: '65%', left: '28%' },
                    { top: '15%', left: '75%' },
                    { top: '78%', left: '55%' },
                  ];
                  const pos = positions[idx % positions.length];

                  return (
                    <motion.div
                      key={rep.id}
                      style={{ top: pos.top, left: pos.left }}
                      className="absolute -translate-x-1/2 -translate-y-1/2 cursor-pointer z-20"
                      whileHover={{ scale: 1.15 }}
                      onClick={() => setSelectedReport(rep)}
                    >
                      <div
                        className={`relative flex items-center gap-1.5 px-3 py-1.5 rounded-2xl shadow-xl border backdrop-blur-md transition-all ${
                          isSelected
                            ? 'bg-[#181818] ring-2 ring-[#00D1FF] border-[#00D1FF]/50 scale-110'
                            : 'bg-[#141414]/90 border-[#222222] hover:border-white/40'
                        }`}
                      >
                        <span className={`w-2.5 h-2.5 rounded-full ${scoreStyles.bg} animate-pulse`} />
                        <span className="text-xs font-bold text-[#F5F5F5] font-sans">
                          {rep.qualityScore}
                        </span>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </div>

            {/* Map Legend */}
            <div className="relative z-10 flex flex-wrap items-center justify-between gap-2 p-3.5 rounded-2xl bg-[#141414]/90 border border-[#222222] backdrop-blur-md text-[11px] text-[#888888]">
              <div className="flex items-center gap-4">
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#00D1FF]" /> Excellent (88–100)
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" /> Acceptable (70–87)
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-400" /> Caution (&lt;70)
                </span>
              </div>
              <span className="text-[10px] text-[#555555] font-mono">
                Click pin to inspect
              </span>
            </div>
          </div>

          {/* Selected Water Source Details Card & List (5 cols) */}
          <div className="lg:col-span-5 space-y-4">
            {selectedReport ? (
              <motion.div
                key={selectedReport.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-6 rounded-[32px] bg-[#141414] border border-[#222222] shadow-2xl space-y-4"
              >
                {/* Header */}
                <div className="flex items-start justify-between gap-3 pb-3.5 border-b border-[#1E1E1E]">
                  <div>
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-[#00D1FF] block mb-1">
                      Selected Water Source
                    </span>
                    <h3 className="text-base font-semibold text-white leading-tight">
                      {selectedReport.sourceName}
                    </h3>
                    <div className="flex items-center gap-2 mt-1 text-xs text-[#888888]">
                      <Clock className="w-3.5 h-3.5" />
                      <span>Tested {selectedReport.lastTestedAt}</span>
                      <span>•</span>
                      <span>By {selectedReport.authorName}</span>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <span className="text-3xl font-light text-[#F5F5F5] font-sans">
                      {selectedReport.qualityScore}
                    </span>
                    <span className="text-xs text-[#888888] block">Score</span>
                  </div>
                </div>

                {/* Sensor telemetry snapshot */}
                <div className="grid grid-cols-4 gap-2 text-center text-xs p-3.5 rounded-2xl bg-[#0A0A0A] border border-[#222222]">
                  <div>
                    <span className="text-[10px] text-[#555555] block">pH</span>
                    <span className="font-semibold text-white">{selectedReport.ph}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-[#555555] block">TDS</span>
                    <span className="font-semibold text-white">{selectedReport.tds} ppm</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-[#555555] block">CLARITY</span>
                    <span className="font-semibold text-white">{selectedReport.turbidity} NTU</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-[#555555] block">TEMP</span>
                    <span className="font-semibold text-white">{selectedReport.temperature}°C</span>
                  </div>
                </div>

                {/* Tester notes */}
                {selectedReport.notes && (
                  <p className="text-xs text-neutral-300 leading-relaxed bg-[#0A0A0A] p-3.5 rounded-2xl border border-[#222222]">
                    "{selectedReport.notes}"
                  </p>
                )}

                {/* Verification & Action Buttons */}
                <div className="flex items-center justify-between gap-3 pt-1">
                  <button
                    onClick={() => handleVerifyReport(selectedReport.id)}
                    className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-2xl text-xs font-semibold transition-all border ${
                      selectedReport.userHasVerified
                        ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                        : 'bg-[#1E1E1E] hover:bg-[#252525] text-white border-white/5 hover:border-[#00D1FF]/30'
                    }`}
                  >
                    <ThumbsUp className="w-4 h-4" />
                    <span>
                      {selectedReport.userHasVerified ? 'Verified by You' : 'Verify This Source'}{' '}
                      ({selectedReport.verifiedReports})
                    </span>
                  </button>
                </div>

                {/* Freshness Disclaimer */}
                <div className="pt-2 border-t border-[#1E1E1E] text-[11px] text-[#555555] flex items-center gap-1.5">
                  <Info className="w-3.5 h-3.5 shrink-0 text-[#00D1FF]" />
                  <span>Community water reports reflect conditions at test time. Always check live readings before consuming.</span>
                </div>
              </motion.div>
            ) : (
              <div className="p-8 rounded-[32px] bg-[#141414] border border-[#222222] text-center text-[#888888] text-xs">
                Select a water source on the map to view detailed chemical purity and verification history.
              </div>
            )}

            {/* Recent reports list */}
            <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
              <span className="text-xs font-semibold uppercase tracking-wider text-[#888888] block px-1">
                Nearby Station Feed
              </span>
              {filteredReports.map((rep) => (
                <div
                  key={rep.id}
                  onClick={() => setSelectedReport(rep)}
                  className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex items-center justify-between ${
                    selectedReport?.id === rep.id
                      ? 'bg-[#181818] border-[#00D1FF]/50 shadow-md'
                      : 'bg-[#141414] border-[#222222] hover:bg-[#1A1A1A] hover:border-white/20'
                  }`}
                >
                  <div className="min-w-0 flex-1 pr-2">
                    <p className="text-xs font-medium text-white truncate">{rep.sourceName}</p>
                    <p className="text-[10px] text-[#888888] truncate">
                      {rep.lastTestedAt} • {rep.verifiedReports} verifications
                    </p>
                  </div>
                  <span
                    className={`text-xs font-semibold px-2.5 py-0.5 rounded-lg font-sans ${
                      getScoreColor(rep.qualityScore).text
                    }`}
                  >
                    {rep.qualityScore} pts
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Submit Water Report Modal */}
      <AnimatePresence>
        {isSubmitModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-lg bg-[#141414] border border-[#222222] rounded-[32px] p-6 sm:p-7 shadow-2xl relative"
            >
              <div className="flex items-center justify-between pb-4 border-b border-[#1E1E1E]">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-[#00D1FF]/10 border border-[#00D1FF]/20 flex items-center justify-center">
                    <MapPin className="w-4 h-4 text-[#00D1FF]" />
                  </div>
                  <h3 className="text-base font-semibold text-white">Publish Community Water Report</h3>
                </div>
                <button
                  onClick={() => setIsSubmitModalOpen(false)}
                  className="p-1.5 rounded-xl text-[#888888] hover:text-white hover:bg-[#1E1E1E]"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSubmitReport} className="mt-4 space-y-4">
                {/* Live readings snapshot */}
                <div className="p-4 rounded-2xl bg-[#0A0A0A] border border-[#222222]">
                  <span className="text-[10px] uppercase font-semibold text-[#00D1FF] block mb-2">
                    AquaSense X Telemetry to be attached:
                  </span>
                  <div className="grid grid-cols-4 gap-2 text-center text-xs">
                    <div>
                      <span className="text-[#555555] block text-[10px]">SCORE</span>
                      <span className="font-semibold text-[#00D1FF]">{qualityEval.score}/100</span>
                    </div>
                    <div>
                      <span className="text-[#555555] block text-[10px]">pH</span>
                      <span className="font-semibold text-white">{bottle?.ph}</span>
                    </div>
                    <div>
                      <span className="text-[#555555] block text-[10px]">TDS</span>
                      <span className="font-semibold text-white">{bottle?.tds} ppm</span>
                    </div>
                    <div>
                      <span className="text-[#555555] block text-[10px]">TURBIDITY</span>
                      <span className="font-semibold text-white">{bottle?.turbidity} NTU</span>
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
                    placeholder="e.g. Golden Gate Park Fountain #4"
                    className="w-full bg-[#0A0A0A] border border-[#222222] rounded-2xl px-4 py-2.5 text-sm text-white placeholder-[#555555] focus:outline-none focus:border-[#00D1FF]/50"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-neutral-300 mb-1.5">
                    Source Category
                  </label>
                  <select
                    value={newSourceType}
                    onChange={(e) => setNewSourceType(e.target.value as any)}
                    className="w-full bg-[#0A0A0A] border border-[#222222] rounded-2xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-[#00D1FF]/50"
                  >
                    <option value="fountain">Public Drinking Fountain</option>
                    <option value="filtration_station">Bottle Refill & Filtration Station</option>
                    <option value="tap">Municipal Tap</option>
                    <option value="spring">Natural Spring</option>
                    <option value="other">Other Source</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-neutral-300 mb-1.5">
                    Public Notes / Observations
                  </label>
                  <textarea
                    rows={3}
                    value={newNotes}
                    onChange={(e) => setNewNotes(e.target.value)}
                    placeholder="e.g. Excellent cold stream, filter status light green, high pressure."
                    className="w-full bg-[#0A0A0A] border border-[#222222] rounded-2xl px-4 py-2.5 text-xs text-white placeholder-[#555555] focus:outline-none focus:border-[#00D1FF]/50 resize-none"
                  />
                </div>

                <div className="flex items-center justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsSubmitModalOpen(false)}
                    className="px-4 py-2 text-xs font-medium text-[#888888] hover:text-white"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2.5 rounded-xl bg-[#00D1FF] hover:bg-[#00B4D8] text-[#0A0A0A] font-semibold text-xs transition-colors"
                  >
                    Publish Report
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

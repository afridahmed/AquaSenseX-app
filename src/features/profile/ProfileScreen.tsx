import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useBottle } from '../../context/BottleContext';
import { useTheme } from '../../context/ThemeContext';
import { Header } from '../../components/common/Header';
import {
  User,
  Droplets,
  Target,
  Bell,
  Moon,
  Sun,
  Shield,
  LogOut,
  Trash2,
  Cpu,
  RefreshCw,
  CheckCircle2,
  Sliders,
  ChevronRight,
  AlertTriangle,
  Lock,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface ProfileScreenProps {
  onChangeBottle: () => void;
}

export const ProfileScreen: React.FC<ProfileScreenProps> = ({ onChangeBottle }) => {
  const { user, signOut, deleteAccount, updateUserProfile } = useAuth();
  const { bottle, hydrationGoal, updateHydrationGoal } = useBottle();
  const { theme, toggleTheme } = useTheme();

  const [tempGoal, setTempGoal] = useState<number>(hydrationGoal);
  const [isSavedGoal, setIsSavedGoal] = useState<boolean>(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState<boolean>(false);
  const [notificationState, setNotificationState] = useState(
    user?.notifications || {
      drinkReminders: true,
      waterQualityAlerts: true,
      nearbyCommunitySourceAlerts: true,
      lowBatteryAlerts: true,
    }
  );
  const [notificationToast, setNotificationToast] = useState<string>('');

  const handleGoalPreset = async (val: number) => {
    setTempGoal(val);
    await updateHydrationGoal(val);
    setIsSavedGoal(true);
    setTimeout(() => setIsSavedGoal(false), 1500);
  };

  const handleGoalSliderChange = async (val: number) => {
    setTempGoal(val);
    await updateHydrationGoal(val);
    setIsSavedGoal(true);
    setTimeout(() => setIsSavedGoal(false), 1500);
  };

  const handleToggleNotification = async (key: keyof typeof notificationState) => {
    const updated = { ...notificationState, [key]: !notificationState[key] };
    setNotificationState(updated);
    if (user) {
      await updateUserProfile({ notifications: updated });
    }

    if (updated[key] && 'Notification' in window) {
      if (Notification.permission !== 'granted') {
        Notification.requestPermission();
      }
    }
  };

  const triggerTestNotification = () => {
    setNotificationToast('💧 AquaSense X: Water Purity 94/100. Time for an afternoon hydration sip!');
    setTimeout(() => setNotificationToast(''), 4000);

    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification('AquaSense X Alert', {
        body: '💧 Water Purity 94/100. Time for an afternoon hydration sip!',
        icon: '/favicon.ico',
      });
    }
  };

  return (
    <div className="min-h-full bg-[#0A0A0A] text-[#F5F5F5] flex flex-col">
      <Header title="Account & Bottle Settings" />

      <div className="p-4 sm:p-6 lg:p-8 max-w-4xl mx-auto w-full flex-1 space-y-6">
        {/* Notification Toast */}
        <AnimatePresence>
          {notificationToast && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="p-4 rounded-2xl bg-[#00D1FF]/15 border border-[#00D1FF]/30 text-[#00D1FF] text-xs flex items-center justify-between shadow-xl backdrop-blur-md"
            >
              <span>{notificationToast}</span>
              <button onClick={() => setNotificationToast('')} className="text-xs font-semibold underline ml-2">
                Dismiss
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* User Card */}
        <div className="p-6 rounded-[32px] bg-[#141414] border border-[#222222] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-xl">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-[#00D1FF]/10 border border-[#00D1FF]/20 p-0.5 flex items-center justify-center shadow-lg shadow-[#00D1FF]/10 shrink-0">
              <div className="w-full h-full rounded-[14px] bg-[#0A0A0A] flex items-center justify-center text-xl font-bold text-[#00D1FF]">
                {user?.name ? user.name[0].toUpperCase() : 'A'}
              </div>
            </div>
            <div>
              <h2 className="text-lg font-bold text-white leading-tight">{user?.name || 'AquaSense User'}</h2>
              <p className="text-xs text-[#888888] mt-0.5">{user?.email}</p>
              <span className="inline-block text-[10px] font-mono text-[#00D1FF] bg-[#00D1FF]/10 px-2.5 py-0.5 rounded-lg border border-[#00D1FF]/20 mt-1.5">
                UID: {user?.uid.slice(0, 16)}...
              </span>
            </div>
          </div>

          <button
            onClick={() => signOut()}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-2xl bg-[#1E1E1E] hover:bg-[#252525] text-[#888888] hover:text-rose-400 border border-white/5 text-xs font-medium transition-all"
          >
            <LogOut className="w-4 h-4" />
            <span>Sign Out</span>
          </button>
        </div>

        {/* SECTION 1: MY BOTTLE */}
        <div className="p-6 rounded-[32px] bg-[#141414] border border-[#222222] space-y-4 shadow-xl">
          <div className="flex items-center justify-between pb-3.5 border-b border-[#1E1E1E]">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-[#00D1FF]/10 border border-[#00D1FF]/20 flex items-center justify-center">
                <Cpu className="w-4 h-4 text-[#00D1FF]" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-white">My AquaSense X Bottle</h3>
                <p className="text-xs text-[#888888]">Hardware telemetry & bonded device</p>
              </div>
            </div>

            <button
              onClick={onChangeBottle}
              className="flex items-center gap-1.5 px-4 py-2 rounded-2xl bg-[#00D1FF] hover:bg-[#00B4D8] text-[#0A0A0A] text-xs font-semibold transition-all shadow-md shadow-[#00D1FF]/20"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Change Bottle</span>
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div className="p-3.5 rounded-2xl bg-[#0A0A0A] border border-[#222222]">
              <span className="text-[10px] text-[#555555] uppercase tracking-wider block mb-0.5">BOTTLE ID</span>
              <span className="font-mono font-semibold text-white">{bottle?.bottleId || user?.bottleId || 'ASX-9821-4402'}</span>
            </div>
            <div className="p-3.5 rounded-2xl bg-[#0A0A0A] border border-[#222222]">
              <span className="text-[10px] text-[#555555] uppercase tracking-wider block mb-0.5">STATUS</span>
              <span className={`font-semibold ${bottle?.online ? 'text-emerald-400' : 'text-[#888888]'}`}>
                {bottle?.online ? 'Online (ESP32-S3)' : 'Offline'}
              </span>
            </div>
            <div className="p-3.5 rounded-2xl bg-[#0A0A0A] border border-[#222222]">
              <span className="text-[10px] text-[#555555] uppercase tracking-wider block mb-0.5">BATTERY</span>
              <span className="font-semibold text-white">{bottle?.battery || 88}%</span>
            </div>
            <div className="p-3.5 rounded-2xl bg-[#0A0A0A] border border-[#222222]">
              <span className="text-[10px] text-[#555555] uppercase tracking-wider block mb-0.5">FIRMWARE</span>
              <span className="font-semibold text-white">v2.4.1-prod</span>
            </div>
          </div>
        </div>

        {/* SECTION 2: HYDRATION GOAL */}
        <div className="p-6 rounded-[32px] bg-[#141414] border border-[#222222] space-y-4 shadow-xl">
          <div className="flex items-center justify-between pb-3.5 border-b border-[#1E1E1E]">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-[#00D1FF]/10 border border-[#00D1FF]/20 flex items-center justify-center">
                <Target className="w-4 h-4 text-[#00D1FF]" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-white">Daily Hydration Target</h3>
                <p className="text-xs text-[#888888]">Personalized fluid intake quota</p>
              </div>
            </div>

            {isSavedGoal && (
              <span className="text-xs text-emerald-400 flex items-center gap-1 font-medium">
                <CheckCircle2 className="w-3.5 h-3.5" /> Saved
              </span>
            )}
          </div>

          <div>
            <div className="flex justify-between items-baseline mb-2">
              <span className="text-2xl font-light text-white font-sans">{tempGoal.toLocaleString()} ml</span>
              <span className="text-xs text-[#888888]">~{Math.round(tempGoal / 250)} glasses / day</span>
            </div>

            <input
              type="range"
              min="1500"
              max="4500"
              step="100"
              value={tempGoal}
              onChange={(e) => handleGoalSliderChange(parseInt(e.target.value))}
              className="w-full accent-[#00D1FF] bg-[#1E1E1E] cursor-pointer rounded-lg"
            />
          </div>

          {/* Activity presets */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-2">
            {[
              { label: 'Sedentary', ml: 2000 },
              { label: 'Moderate', ml: 2500 },
              { label: 'Active', ml: 3200 },
              { label: 'Athlete', ml: 3800 },
            ].map((p) => (
              <button
                key={p.label}
                onClick={() => handleGoalPreset(p.ml)}
                className={`py-2.5 px-3 rounded-2xl text-xs font-medium border transition-all ${
                  tempGoal === p.ml
                    ? 'bg-[#00D1FF]/15 text-[#00D1FF] border-[#00D1FF]/40 shadow-sm'
                    : 'bg-[#0A0A0A] text-[#888888] border-[#222222] hover:bg-[#1E1E1E] hover:text-white'
                }`}
              >
                {p.label} ({p.ml} ml)
              </button>
            ))}
          </div>
        </div>

        {/* SECTION 3: NOTIFICATIONS */}
        <div className="p-6 rounded-[32px] bg-[#141414] border border-[#222222] space-y-4 shadow-xl">
          <div className="flex items-center justify-between pb-3.5 border-b border-[#1E1E1E]">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-[#00D1FF]/10 border border-[#00D1FF]/20 flex items-center justify-center">
                <Bell className="w-4 h-4 text-[#00D1FF]" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-white">Smart Notification Preferences</h3>
                <p className="text-xs text-[#888888]">Contextual alerts & hydration reminders</p>
              </div>
            </div>

            <button
              onClick={triggerTestNotification}
              className="text-xs text-[#00D1FF] hover:underline font-medium"
            >
              Test Notification
            </button>
          </div>

          <div className="space-y-3">
            {[
              {
                key: 'drinkReminders' as const,
                title: 'Smart Drink Reminders',
                desc: 'Prompt when hydration falls behind daily target',
              },
              {
                key: 'waterQualityAlerts' as const,
                title: 'Water Quality Alerts',
                desc: 'Instant alert when unusual pH, TDS, or turbidity is detected',
              },
              {
                key: 'nearbyCommunitySourceAlerts' as const,
                title: 'Nearby Safe Water Source Alerts',
                desc: 'Notify when verified clean hydration stations are within 500m',
              },
              {
                key: 'lowBatteryAlerts' as const,
                title: 'Low Bottle Battery Warning',
                desc: 'Alert when ESP32-S3 battery drops below 20%',
              },
            ].map((n) => {
              const checked = !!notificationState[n.key];
              return (
                <div key={n.key} className="flex items-center justify-between p-3.5 rounded-2xl bg-[#0A0A0A] border border-[#222222]">
                  <div>
                    <p className="text-xs font-semibold text-white">{n.title}</p>
                    <p className="text-[11px] text-[#888888]">{n.desc}</p>
                  </div>
                  <button
                    onClick={() => handleToggleNotification(n.key)}
                    className={`w-11 h-6 rounded-full transition-colors relative p-0.5 ${
                      checked ? 'bg-[#00D1FF]' : 'bg-[#1E1E1E]'
                    }`}
                  >
                    <div
                      className={`w-5 h-5 rounded-full ${checked ? 'bg-[#0A0A0A]' : 'bg-white/60'} transition-transform ${
                        checked ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        {/* SECTION 4: APPEARANCE & SECURITY */}
        <div className="p-6 rounded-[32px] bg-[#141414] border border-[#222222] space-y-4 shadow-xl">
          <div className="flex items-center justify-between pb-3.5 border-b border-[#1E1E1E]">
            <h3 className="text-sm font-semibold text-white">System & Security</h3>
            <span className="text-xs text-[#555555]">AquaSense X Core v2.4</span>
          </div>

          <div className="flex items-center justify-between p-3.5 rounded-2xl bg-[#0A0A0A] border border-[#222222]">
            <div className="flex items-center gap-3">
              {theme === 'dark' ? <Moon className="w-4 h-4 text-[#00D1FF]" /> : <Sun className="w-4 h-4 text-amber-400" />}
              <div>
                <p className="text-xs font-semibold text-white">Color Palette Theme</p>
                <p className="text-[11px] text-[#888888]">
                  {theme === 'dark' ? 'Sleek Interface Charcoal (Default)' : 'Refined Light Canvas'}
                </p>
              </div>
            </div>
            <button
              onClick={toggleTheme}
              className="px-3.5 py-1.5 rounded-2xl bg-[#1E1E1E] border border-white/5 text-xs font-medium text-[#F5F5F5] hover:text-white"
            >
              Toggle {theme === 'dark' ? 'Light' : 'Dark'}
            </button>
          </div>

          <div className="flex items-center justify-between p-3.5 rounded-2xl bg-[#0A0A0A] border border-[#222222]">
            <div className="flex items-center gap-3">
              <Shield className="w-4 h-4 text-emerald-400" />
              <div>
                <p className="text-xs font-semibold text-white">Firebase Security & App Check</p>
                <p className="text-[11px] text-[#888888]">Authenticated user-isolated collections</p>
              </div>
            </div>
            <span className="text-[10px] text-emerald-400 font-mono bg-emerald-500/10 px-2.5 py-0.5 rounded-lg border border-emerald-500/20">
              Active
            </span>
          </div>

          <div className="pt-2 flex flex-wrap items-center justify-between gap-3">
            <button
              onClick={() => setIsDeleteModalOpen(true)}
              className="flex items-center gap-1.5 text-xs text-rose-400 hover:text-rose-300 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Delete Account & Data</span>
            </button>
          </div>
        </div>
      </div>

      {/* Delete Account Confirmation Modal */}
      <AnimatePresence>
        {isDeleteModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-sm bg-[#141414] border border-rose-500/30 rounded-[32px] p-6 shadow-2xl space-y-4"
            >
              <div className="w-10 h-10 rounded-2xl bg-rose-500/20 text-rose-400 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <h3 className="text-base font-semibold text-white">Delete AquaSense Account?</h3>
              <p className="text-xs text-[#888888] leading-relaxed">
                This will permanently delete your user profile, paired bottle association, and hydration logs from Cloud Firestore.
              </p>
              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  onClick={() => setIsDeleteModalOpen(false)}
                  className="px-4 py-2 rounded-2xl text-xs font-medium text-[#888888] hover:text-white"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    setIsDeleteModalOpen(false);
                    deleteAccount();
                  }}
                  className="px-4 py-2 rounded-2xl bg-rose-500 hover:bg-rose-600 text-white text-xs font-semibold transition-colors"
                >
                  Confirm Deletion
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

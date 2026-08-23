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
    <div className="min-h-full bg-[#090B0E] text-[#F8FAFC] flex flex-col transition-colors duration-200">
      <Header
        title="Account & Bottle Settings"
        mobileTitle="Account"
      />

      <div className="p-3.5 xs:p-4 sm:p-6 lg:p-8 max-w-4xl mx-auto w-full flex-1 space-y-4 sm:space-y-6">
        {/* Notification Toast */}
        <AnimatePresence>
          {notificationToast && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="p-3.5 sm:p-4 rounded-2xl bg-[#00D1FF]/15 border border-[#00D1FF]/30 text-[#00D1FF] text-xs flex items-center justify-between shadow-xl backdrop-blur-md"
            >
              <span className="truncate">{notificationToast}</span>
              <button onClick={() => setNotificationToast('')} className="text-xs font-semibold underline ml-2 shrink-0">
                Dismiss
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* User Card */}
        <div className="p-4 xs:p-5 sm:p-6 rounded-[28px] sm:rounded-[32px] bg-[#12161C] border border-white/5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-xl">
          <div className="flex items-center gap-3 sm:gap-4 min-w-0">
            <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-[#00D1FF]/10 border border-[#00D1FF]/20 p-0.5 flex items-center justify-center shadow-lg shadow-[#00D1FF]/10 shrink-0">
              <div className="w-full h-full rounded-[14px] bg-[#090B0E] flex items-center justify-center text-lg sm:text-xl font-bold text-[#00D1FF]">
                {user?.name ? user.name[0].toUpperCase() : 'A'}
              </div>
            </div>
            <div className="min-w-0">
              <h2 className="text-base sm:text-lg font-bold text-white leading-tight truncate">{user?.name || 'AquaSense User'}</h2>
              <p className="text-xs text-neutral-400 mt-0.5 truncate">{user?.email}</p>
              <span className="inline-block text-[10px] font-mono text-[#00D1FF] bg-[#00D1FF]/10 px-2.5 py-0.5 rounded-lg border border-[#00D1FF]/20 mt-1.5">
                UID: {user?.uid ? `${user.uid.slice(0, 12)}...` : 'Local User'}
              </span>
            </div>
          </div>

          <button
            onClick={() => signOut()}
            className="flex items-center gap-1.5 px-3.5 sm:px-4 py-2 sm:py-2.5 rounded-xl bg-white/[0.04] hover:bg-rose-500/10 text-neutral-300 hover:text-rose-400 border border-white/10 hover:border-rose-500/30 text-xs font-medium transition-all touch-target sm:min-h-0 sm:min-w-0 self-stretch sm:self-auto justify-center"
          >
            <LogOut className="w-4 h-4" />
            <span>Sign Out</span>
          </button>
        </div>

        {/* SECTION 1: MY BOTTLE */}
        <div className="p-4 xs:p-5 sm:p-6 rounded-[28px] sm:rounded-[32px] bg-[#12161C] border border-white/5 space-y-4 shadow-xl">
          <div className="flex items-center justify-between pb-3 sm:pb-3.5 border-b border-white/5">
            <div className="flex items-center gap-2.5 sm:gap-3">
              <div className="w-8 h-8 rounded-xl bg-[#00D1FF]/10 border border-[#00D1FF]/20 flex items-center justify-center shrink-0">
                <Cpu className="w-4 h-4 text-[#00D1FF]" />
              </div>
              <div>
                <h3 className="text-xs sm:text-sm font-semibold text-white">AquaSense X Bottle</h3>
                <p className="text-[11px] sm:text-xs text-neutral-400">Hardware telemetry & bonded device</p>
              </div>
            </div>

            <button
              onClick={onChangeBottle}
              className="flex items-center gap-1.5 px-3.5 sm:px-4 py-1.5 sm:py-2 rounded-xl bg-white/[0.06] hover:bg-[#00D1FF]/15 text-white hover:text-[#00D1FF] border border-white/10 hover:border-[#00D1FF]/30 text-xs font-medium transition-all shadow-sm touch-target sm:min-h-0 sm:min-w-0"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Change</span>
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3 text-xs">
            <div className="p-3 sm:p-3.5 rounded-2xl bg-[#090B0E] border border-white/5">
              <span className="text-[9px] sm:text-[10px] text-neutral-500 uppercase tracking-wider block mb-0.5">BOTTLE ID</span>
              <span className="font-mono font-semibold text-white truncate block">{bottle?.bottleId || user?.bottleId || 'ASX-9821-4402'}</span>
            </div>
            <div className="p-3 sm:p-3.5 rounded-2xl bg-[#090B0E] border border-white/5">
              <span className="text-[9px] sm:text-[10px] text-neutral-500 uppercase tracking-wider block mb-0.5">STATUS</span>
              <span className={`font-semibold ${bottle?.online ? 'text-emerald-400' : 'text-neutral-500'}`}>
                {bottle?.online ? 'Online (ESP32)' : 'Offline'}
              </span>
            </div>
            <div className="p-3 sm:p-3.5 rounded-2xl bg-[#090B0E] border border-white/5">
              <span className="text-[9px] sm:text-[10px] text-neutral-500 uppercase tracking-wider block mb-0.5">BATTERY</span>
              <span className="font-semibold text-white">{bottle?.battery || 88}%</span>
            </div>
            <div className="p-3 sm:p-3.5 rounded-2xl bg-[#090B0E] border border-white/5">
              <span className="text-[9px] sm:text-[10px] text-neutral-500 uppercase tracking-wider block mb-0.5">FIRMWARE</span>
              <span className="font-semibold text-white">v2.4.1-prod</span>
            </div>
          </div>
        </div>

        {/* SECTION 2: HYDRATION GOAL */}
        <div className="p-4 xs:p-5 sm:p-6 rounded-[28px] sm:rounded-[32px] bg-[#12161C] border border-white/5 space-y-4 shadow-xl">
          <div className="flex items-center justify-between pb-3 sm:pb-3.5 border-b border-white/5">
            <div className="flex items-center gap-2.5 sm:gap-3">
              <div className="w-8 h-8 rounded-xl bg-[#00D1FF]/10 border border-[#00D1FF]/20 flex items-center justify-center shrink-0">
                <Target className="w-4 h-4 text-[#00D1FF]" />
              </div>
              <div>
                <h3 className="text-xs sm:text-sm font-semibold text-white">Daily Hydration Target</h3>
                <p className="text-[11px] sm:text-xs text-neutral-400">Personalized fluid intake quota</p>
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
              <span className="text-xs text-neutral-400">~{Math.round(tempGoal / 250)} glasses / day</span>
            </div>

            <input
              type="range"
              min="1500"
              max="4500"
              step="100"
              value={tempGoal}
              onChange={(e) => handleGoalSliderChange(parseInt(e.target.value))}
              className="w-full accent-[#00D1FF] bg-[#1E1E1E] cursor-pointer rounded-lg h-2"
            />
          </div>

          {/* Activity presets - Apple / Tesla Segmented Selector */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-2.5 pt-1">
            {[
              { label: 'Sedentary', ml: 2000, desc: 'Desk / Light' },
              { label: 'Moderate', ml: 2500, desc: 'Daily Routine' },
              { label: 'Active', ml: 3200, desc: 'Fitness' },
              { label: 'Athlete', ml: 3800, desc: 'Extreme' },
            ].map((p) => {
              const isSelected = tempGoal === p.ml;
              return (
                <button
                  key={p.label}
                  onClick={() => handleGoalPreset(p.ml)}
                  className={`py-2.5 px-3 rounded-2xl text-left border transition-all duration-200 flex flex-col justify-between group touch-target sm:min-h-0 relative overflow-hidden ${
                    isSelected
                      ? 'bg-gradient-to-b from-[#00D1FF]/15 to-[#00D1FF]/5 text-white border-[#00D1FF]/40 shadow-[0_0_15px_rgba(0,209,255,0.12)]'
                      : 'bg-[#090B0E]/80 text-neutral-400 border-white/5 hover:border-white/15 hover:bg-white/[0.03] hover:text-neutral-200'
                  }`}
                >
                  <div className="flex items-center justify-between w-full mb-1">
                    <span className={`text-xs font-semibold tracking-tight ${isSelected ? 'text-[#00D1FF]' : 'text-neutral-300'}`}>
                      {p.label}
                    </span>
                    {isSelected && (
                      <span className="w-1.5 h-1.5 rounded-full bg-[#00D1FF] shadow-[0_0_6px_rgba(0,209,255,0.8)]" />
                    )}
                  </div>
                  <div className="flex items-baseline justify-between w-full">
                    <span className="text-[11px] font-mono font-medium text-white/90">
                      {p.ml} <span className="text-[10px] text-neutral-500 font-sans font-normal">ml</span>
                    </span>
                    <span className="text-[9px] text-neutral-500 hidden sm:inline truncate">
                      {p.desc}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* SECTION 3: NOTIFICATIONS */}
        <div className="p-4 xs:p-5 sm:p-6 rounded-[28px] sm:rounded-[32px] bg-[#12161C] border border-white/5 space-y-4 shadow-xl">
          <div className="flex items-center justify-between pb-3 sm:pb-3.5 border-b border-white/5">
            <div className="flex items-center gap-2.5 sm:gap-3">
              <div className="w-8 h-8 rounded-xl bg-[#00D1FF]/10 border border-[#00D1FF]/20 flex items-center justify-center shrink-0">
                <Bell className="w-4 h-4 text-[#00D1FF]" />
              </div>
              <div>
                <h3 className="text-xs sm:text-sm font-semibold text-white">Smart Notifications</h3>
                <p className="text-[11px] sm:text-xs text-neutral-400">Contextual alerts & reminders</p>
              </div>
            </div>

            <button
              onClick={triggerTestNotification}
              className="px-2.5 py-1 rounded-lg bg-[#00D1FF]/10 hover:bg-[#00D1FF]/20 text-[#00D1FF] text-xs font-medium transition-all border border-[#00D1FF]/20 touch-target sm:min-h-0 sm:min-w-0"
            >
              Test Alert
            </button>
          </div>

          <div className="space-y-2.5 sm:space-y-3">
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
                <div key={n.key} className="flex items-center justify-between p-3 sm:p-3.5 rounded-2xl bg-[#090B0E] border border-white/5 gap-3.5">
                  <div className="min-w-0 flex-1 pr-1">
                    <p className="text-xs sm:text-sm font-semibold text-slate-100 truncate">{n.title}</p>
                    <p className="text-[11px] sm:text-xs text-neutral-400 leading-relaxed mt-0.5">{n.desc}</p>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={checked}
                    aria-label={n.title}
                    onClick={() => handleToggleNotification(n.key)}
                    className={`w-[44px] h-[24px] sm:w-[48px] sm:h-[26px] rounded-full relative shrink-0 transition-all duration-200 ease-out active:scale-[0.96] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#38BDF8] focus-visible:ring-offset-2 focus-visible:ring-offset-[#090B0E] cursor-pointer ${
                      checked
                        ? 'bg-[#0284C7] border border-[#38BDF8]/40 hover:bg-[#0369A1]'
                        : 'bg-[#181D24] border border-white/[0.08] hover:border-white/[0.16]'
                    }`}
                  >
                    <span
                      aria-hidden="true"
                      className={`absolute left-[2px] top-1/2 -translate-y-1/2 w-[18px] h-[18px] sm:w-[20px] sm:h-[20px] rounded-full transition-all duration-200 ease-out pointer-events-none ${
                        checked
                          ? 'translate-x-[20px] sm:translate-x-[22px] bg-[#F8FAFC] shadow-[0_1px_3px_rgba(0,0,0,0.3)]'
                          : 'translate-x-0 bg-[#7E8B9B] shadow-sm'
                      }`}
                    />
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        {/* SECTION 4: APPEARANCE & SECURITY */}
        <div className="p-4 xs:p-5 sm:p-6 rounded-[28px] sm:rounded-[32px] bg-[#12161C] border border-white/5 space-y-4 shadow-xl">
          <div className="flex items-center justify-between pb-3 sm:pb-3.5 border-b border-white/5">
            <h3 className="text-xs sm:text-sm font-semibold text-white">System & Security</h3>
            <span className="text-[10px] sm:text-xs text-neutral-500 font-mono">AquaSense Core v2.4</span>
          </div>

          <div className="flex items-center justify-between p-3 sm:p-3.5 rounded-2xl bg-[#090B0E] border border-white/5 gap-3">
            <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
              {theme === 'dark' ? <Moon className="w-4 h-4 text-[#00D1FF] shrink-0" /> : <Sun className="w-4 h-4 text-amber-400 shrink-0" />}
              <div className="min-w-0">
                <p className="text-xs font-semibold text-white">Theme</p>
                <p className="text-[11px] text-neutral-400 truncate">
                  {theme === 'dark' ? 'Interface Charcoal (Default)' : 'Refined Light Canvas'}
                </p>
              </div>
            </div>
            <button
              onClick={toggleTheme}
              className="px-3.5 py-1.5 rounded-xl bg-white/[0.04] border border-white/10 text-xs font-medium text-white hover:bg-white/[0.08] hover:border-white/20 shrink-0 touch-target sm:min-h-0 sm:min-w-0 transition-all"
            >
              Toggle {theme === 'dark' ? 'Light' : 'Dark'}
            </button>
          </div>

          <div className="flex items-center justify-between p-3 sm:p-3.5 rounded-2xl bg-[#090B0E] border border-white/5">
            <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
              <Shield className="w-4 h-4 text-emerald-400 shrink-0" />
              <div className="min-w-0">
                <p className="text-xs font-semibold text-white">Firebase Firestore Rules</p>
                <p className="text-[11px] text-neutral-400 truncate">Authenticated user-isolated collections</p>
              </div>
            </div>
            <span className="text-[10px] text-emerald-400 font-mono bg-emerald-500/10 px-2.5 py-0.5 rounded-lg border border-emerald-500/20 shrink-0">
              Active
            </span>
          </div>

          <div className="pt-2 flex flex-wrap items-center justify-between gap-3">
            <button
              onClick={() => setIsDeleteModalOpen(true)}
              className="flex items-center gap-1.5 text-xs text-rose-400 hover:text-rose-300 transition-colors touch-target sm:min-h-0 sm:min-w-0"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Delete Account & Data</span>
            </button>
          </div>
        </div>
      </div>

      {/* Delete Account Confirmation Modal / Responsive Bottom Sheet */}
      <AnimatePresence>
        {isDeleteModalOpen && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/80 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              className="w-full sm:max-w-sm bg-[#12161C] border-t sm:border border-rose-500/30 rounded-t-[28px] sm:rounded-[32px] p-5 sm:p-6 shadow-2xl space-y-4 safe-area-pb"
            >
              <div className="w-10 h-10 rounded-2xl bg-rose-500/20 text-rose-400 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <h3 className="text-sm sm:text-base font-semibold text-white">Delete AquaSense Account?</h3>
              <p className="text-xs text-neutral-400 leading-relaxed">
                This will permanently delete your user profile, paired bottle association, and hydration logs from Cloud Firestore.
              </p>
              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  onClick={() => setIsDeleteModalOpen(false)}
                  className="flex-1 sm:flex-none px-4 py-2.5 rounded-xl text-xs font-medium text-neutral-300 hover:text-white bg-white/[0.04]"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    setIsDeleteModalOpen(false);
                    deleteAccount();
                  }}
                  className="flex-1 sm:flex-none px-4 py-2.5 rounded-xl bg-rose-500 hover:bg-rose-600 text-white text-xs font-semibold transition-colors"
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

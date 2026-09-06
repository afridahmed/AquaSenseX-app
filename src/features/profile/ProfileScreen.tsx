import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useBottle } from '../../context/BottleContext';
import { useTheme } from '../../context/ThemeContext';
import { Header } from '../../components/common/Header';
import { NotificationPreferences } from '../../types';
import { notificationService } from '../../services/notifications/notificationService';
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
  Eye,
  EyeOff,
  Loader2,
  Clock,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { formatBottleId } from '../pairing/BottlePairingScreen';

interface ProfileScreenProps {
  onChangeBottle: () => void;
}

export const ProfileScreen: React.FC<ProfileScreenProps> = ({ onChangeBottle }) => {
  const { user, firebaseUser, signOut, deleteAccount, updateUserProfile, unpairBottle, pairBottle } = useAuth();
  const { bottle, hydrationGoal, updateHydrationGoal } = useBottle();
  const { theme, toggleTheme } = useTheme();

  const [tempGoal, setTempGoal] = useState<number>(hydrationGoal);
  const [isSavedGoal, setIsSavedGoal] = useState<boolean>(false);
  const [isChangeBottleModalOpen, setIsChangeBottleModalOpen] = useState<boolean>(false);
  const [changeBottleError, setChangeBottleError] = useState<string>('');
  const [newBottleInput, setNewBottleInput] = useState<string>('');
  const [isPairingNewBottle, setIsPairingNewBottle] = useState<boolean>(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState<boolean>(false);
  const [isDeletingAccount, setIsDeletingAccount] = useState<boolean>(false);
  const [deletePassword, setDeletePassword] = useState<string>('');
  const [deleteError, setDeleteError] = useState<string>('');
  const [showDeletePassword, setShowDeletePassword] = useState<boolean>(false);
  const [isReleasingBottle, setIsReleasingBottle] = useState<boolean>(false);
  const [notificationState, setNotificationState] = useState<NotificationPreferences>(() => {
    const raw = user?.notificationSettings || user?.notifications;
    return {
      drinkReminders: Boolean(raw?.drinkReminders),
      drinkReminderStart: raw?.drinkReminderStart || '08:00',
      drinkReminderEnd: raw?.drinkReminderEnd || '22:00',
      drinkReminderIntervalMinutes: raw?.drinkReminderIntervalMinutes || 60,
      lowBatteryAlerts: Boolean(raw?.lowBatteryAlerts),
    };
  });
  const [notificationToast, setNotificationToast] = useState<string>('');

  // Keep notificationState synchronized with current user profile
  useEffect(() => {
    if (user) {
      const settings = user.notificationSettings || user.notifications;
      if (settings) {
        setNotificationState({
          drinkReminders: Boolean(settings.drinkReminders),
          drinkReminderStart: settings.drinkReminderStart || '08:00',
          drinkReminderEnd: settings.drinkReminderEnd || '22:00',
          drinkReminderIntervalMinutes: settings.drinkReminderIntervalMinutes || 60,
          lowBatteryAlerts: Boolean(settings.lowBatteryAlerts),
        });
      }
    }
  }, [user?.uid, user?.notificationSettings]);

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

  const handleToggleNotification = async (key: keyof NotificationPreferences) => {
    if (!user) return;

    const previousState = { ...notificationState };
    const targetValue = !notificationState[key];

    // If enabling a setting, check/request browser notification permission non-blockingly
    if (targetValue) {
      const permissionStatus = notificationService.getPermissionStatus();

      if (permissionStatus === 'unsupported') {
        setNotificationToast('ℹ️ Web notifications are not supported on this browser, but your preference is saved.');
        setTimeout(() => setNotificationToast(''), 4500);
      } else if (permissionStatus === 'denied') {
        setNotificationToast(
          '⚠️ Notifications are blocked in your browser settings. Preference saved for your AquaSense X account.'
        );
        setTimeout(() => setNotificationToast(''), 5500);
      } else if (permissionStatus === 'default') {
        try {
          const requested = await notificationService.requestPermission();
          if (requested === 'denied') {
            setNotificationToast(
              '⚠️ Notification permission was not granted. Preference saved for your AquaSense X account.'
            );
            setTimeout(() => setNotificationToast(''), 5500);
          }
        } catch {
          // non-blocking
        }
      }
    }

    const updated: NotificationPreferences = {
      ...notificationState,
      [key]: targetValue,
    };

    // Immediate optimistic local state update
    setNotificationState(updated);

    try {
      // Save exclusively to canonical users/{uid}.notificationSettings field
      await updateUserProfile({ notificationSettings: updated });

      // If user enabled a setting and permission is granted, attempt background FCM token registration
      if (targetValue && user?.uid && notificationService.getPermissionStatus() === 'granted') {
        notificationService.requestFCMToken(user.uid).catch((err) => {
          console.warn('FCM token registration background warning:', err);
        });
      }
    } catch (err: any) {
      console.error('Failed to save notification settings:', err);
      // Revert state on failure
      setNotificationState(previousState);
      setNotificationToast(
        err?.message ? `⚠️ ${err.message}` : '⚠️ Could not save notification setting. Please try again.'
      );
      setTimeout(() => setNotificationToast(''), 4500);
    }
  };

  const handleScheduleChange = async (
    field: 'drinkReminderStart' | 'drinkReminderEnd' | 'drinkReminderIntervalMinutes',
    value: string | number
  ) => {
    if (!user) return;

    let validValue: string | number = value;
    if (field === 'drinkReminderStart' || field === 'drinkReminderEnd') {
      if (typeof value !== 'string' || !/^([01]\d|2[0-3]):([0-5]\d)$/.test(value)) {
        return;
      }
      validValue = value;
    } else if (field === 'drinkReminderIntervalMinutes') {
      const num = Number(value);
      if (![15, 30, 60, 90, 120].includes(num)) {
        return;
      }
      validValue = num;
    }

    const previousState = { ...notificationState };
    const updated: NotificationPreferences = {
      ...notificationState,
      [field]: validValue,
    };

    setNotificationState(updated);

    try {
      await updateUserProfile({ notificationSettings: updated });
    } catch (err: any) {
      console.error('Failed to save reminder schedule:', err);
      setNotificationState(previousState);
      setNotificationToast(
        err?.message ? `⚠️ ${err.message}` : '⚠️ Could not save reminder schedule. Please try again.'
      );
      setTimeout(() => setNotificationToast(''), 4500);
    }
  };

  const triggerTestNotification = async () => {
    const permissionStatus = notificationService.getPermissionStatus();

    if (permissionStatus === 'unsupported') {
      setNotificationToast('ℹ️ Web notifications are not supported on this browser.');
      setTimeout(() => setNotificationToast(''), 4500);
      return;
    }

    if (permissionStatus === 'denied') {
      setNotificationToast(
        '⚠️ Notifications are blocked. Please allow notifications in your browser settings to test alerts.'
      );
      setTimeout(() => setNotificationToast(''), 5500);
      return;
    }

    if (permissionStatus === 'default') {
      const requested = await notificationService.requestPermission();
      if (requested !== 'granted') {
        setNotificationToast('⚠️ Permission is required to send notifications.');
        setTimeout(() => setNotificationToast(''), 4500);
        return;
      }
    }

    const result = await notificationService.sendTestPushNotification(user?.uid);

    if (result.success) {
      if (result.deliveredVia === 'fcm') {
        setNotificationToast('✅ Push notification sent to your device via Firebase Cloud Messaging!');
      } else {
        setNotificationToast('💧 AquaSense X: Push notifications are working.');
      }
    } else {
      setNotificationToast(result.error ? `⚠️ ${result.error}` : '⚠️ Unable to display notification.');
    }
    setTimeout(() => setNotificationToast(''), 4500);
  };

  // Handle new bottle ID input with automatic uppercase, masking & hyphen insertion
  const handleNewBottleInputChange = (val: string) => {
    const formatted = formatBottleId(val, newBottleInput);
    setNewBottleInput(formatted);
    setChangeBottleError('');
  };

  const handlePairNewBottle = async () => {
    const cleanId = newBottleInput.trim().toUpperCase();
    if (!cleanId || cleanId.length < 3) {
      setChangeBottleError('Please enter a valid identifier printed on your AquaSense X device.');
      return;
    }

    setChangeBottleError('');
    setIsPairingNewBottle(true);
    try {
      await pairBottle(cleanId);
      setIsChangeBottleModalOpen(false);
      setNewBottleInput('');
    } catch (err: any) {
      setChangeBottleError(err.message || 'Failed to link new bottle. Please try again.');
    } finally {
      setIsPairingNewBottle(false);
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
              id="btn-change-bottle"
              type="button"
              onClick={() => {
                setNewBottleInput('');
                setChangeBottleError('');
                setIsChangeBottleModalOpen(true);
              }}
              disabled={isReleasingBottle || isPairingNewBottle}
              className="flex items-center gap-1.5 px-3.5 sm:px-4 py-1.5 sm:py-2 rounded-xl bg-[#00D1FF]/10 hover:bg-[#00D1FF]/20 text-[#00D1FF] border border-[#00D1FF]/30 hover:border-[#00D1FF]/50 text-xs font-semibold transition-all shadow-sm touch-target sm:min-h-0 sm:min-w-0 cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Change Bottle</span>
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3 text-xs">
            <div className="p-3 sm:p-3.5 rounded-2xl bg-[#090B0E] border border-white/5">
              <span className="text-[9px] sm:text-[10px] text-neutral-500 uppercase tracking-wider block mb-0.5">LINKED BOTTLE</span>
              <span className="font-mono font-semibold text-[#00D1FF] truncate block">
                {user?.assignedBottleId || user?.bottleId || bottle?.bottleId || 'Not connected'}
              </span>
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
                key: 'lowBatteryAlerts' as const,
                title: 'Low Bottle Battery Warning',
                desc: 'Alert when ESP32-S3 battery drops below 20%',
              },
            ].map((n) => {
              const checked = !!notificationState[n.key];
              const isDrinkReminder = n.key === 'drinkReminders';

              return (
                <div key={n.key} className="p-3 sm:p-3.5 rounded-2xl bg-[#090B0E] border border-white/5 space-y-3">
                  <div className="flex items-center justify-between gap-3.5">
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

                  {/* Schedule Controls (Rendered when Smart Drink Reminders is enabled) */}
                  {isDrinkReminder && checked && (
                    <div className="pt-2.5 border-t border-white/5 space-y-2.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-medium text-neutral-300 flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5 text-[#00D1FF]" />
                          Reminder Active Window
                        </span>
                        <span className="text-[10px] text-neutral-500 font-mono">
                          {notificationState.drinkReminderStart || '08:00'} – {notificationState.drinkReminderEnd || '22:00'}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-[10px] text-neutral-400 mb-1">Start Time</label>
                          <input
                            type="time"
                            value={notificationState.drinkReminderStart || '08:00'}
                            onChange={(e) => handleScheduleChange('drinkReminderStart', e.target.value)}
                            className="w-full bg-[#12161C] border border-white/10 rounded-xl px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-[#00D1FF]/50 transition-colors"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] text-neutral-400 mb-1">End Time</label>
                          <input
                            type="time"
                            value={notificationState.drinkReminderEnd || '22:00'}
                            onChange={(e) => handleScheduleChange('drinkReminderEnd', e.target.value)}
                            className="w-full bg-[#12161C] border border-white/10 rounded-xl px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-[#00D1FF]/50 transition-colors"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-[10px] text-neutral-400 mb-1.5">Reminder Interval</label>
                        <div className="grid grid-cols-5 gap-1 xs:gap-1.5">
                          {[15, 30, 60, 90, 120].map((mins) => {
                            const isSelected = (notificationState.drinkReminderIntervalMinutes || 60) === mins;
                            return (
                              <button
                                key={mins}
                                type="button"
                                onClick={() => handleScheduleChange('drinkReminderIntervalMinutes', mins)}
                                className={`py-1.5 px-1 rounded-xl text-center text-[11px] font-medium transition-all duration-150 border ${
                                  isSelected
                                    ? 'bg-[#00D1FF]/20 text-[#00D1FF] border-[#00D1FF]/40 shadow-sm font-semibold'
                                    : 'bg-[#12161C] text-neutral-400 border-white/5 hover:text-white hover:bg-white/[0.04]'
                                }`}
                              >
                                {mins < 60 ? `${mins}m` : `${mins / 60}h`}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  )}
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

          <div className="flex flex-col sm:flex-row sm:items-center justify-between p-3.5 sm:p-4 rounded-2xl bg-[#090B0E] border border-white/5 gap-3">
            <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
              <div className="w-8 h-8 rounded-xl bg-[#00D1FF]/10 border border-[#00D1FF]/20 flex items-center justify-center shrink-0">
                {theme === 'dark' ? <Moon className="w-4 h-4 text-[#00D1FF]" /> : <Sun className="w-4 h-4 text-amber-500" />}
              </div>
              <div className="min-w-0">
                <p className="text-xs sm:text-sm font-semibold text-white">Appearance Theme</p>
                <p className="text-[11px] text-neutral-400">
                  {theme === 'dark' ? 'Interface Charcoal (Dark)' : 'Refined Light Canvas'}
                </p>
              </div>
            </div>
            
            {/* Segmented Theme Switcher */}
            <div className="flex items-center p-1 rounded-xl bg-white/[0.04] border border-white/10 shrink-0 self-start sm:self-auto">
              <button
                type="button"
                id="btn-theme-dark"
                onClick={() => { if (theme !== 'dark') toggleTheme(); }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  theme === 'dark'
                    ? 'bg-[#00D1FF] text-[#090B0E] font-semibold shadow-md shadow-[#00D1FF]/20'
                    : 'text-neutral-400 hover:text-white'
                }`}
              >
                <Moon className="w-3.5 h-3.5" />
                <span>Dark</span>
              </button>
              <button
                type="button"
                id="btn-theme-light"
                onClick={() => { if (theme !== 'light') toggleTheme(); }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  theme === 'light'
                    ? 'bg-[#0284C7] text-white font-semibold shadow-md shadow-[#0284C7]/20'
                    : 'text-neutral-400 hover:text-white'
                }`}
              >
                <Sun className="w-3.5 h-3.5" />
                <span>Light</span>
              </button>
            </div>
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
              onClick={() => {
                setDeleteError('');
                setDeletePassword('');
                setIsDeleteModalOpen(true);
              }}
              className="flex items-center gap-1.5 text-xs text-rose-400 hover:text-rose-300 transition-colors touch-target sm:min-h-0 sm:min-w-0"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Delete Account & Data</span>
            </button>
          </div>
        </div>
      </div>

      {/* Change Bottle Confirmation Modal */}
      <AnimatePresence>
        {isChangeBottleModalOpen && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/80 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              className="w-full sm:max-w-md bg-[#12161C] border-t sm:border border-[#00D1FF]/30 rounded-t-[28px] sm:rounded-[32px] p-5 sm:p-6 shadow-2xl space-y-4 safe-area-pb"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-[#00D1FF]/15 text-[#00D1FF] flex items-center justify-center shrink-0">
                  <RefreshCw className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-semibold text-white">Change Paired Bottle</h3>
                  <p className="text-[11px] text-neutral-400">Release device and pair another</p>
                </div>
              </div>

              <div className="p-3.5 rounded-2xl bg-[#090B0E] border border-white/5 space-y-1">
                <span className="text-[10px] text-neutral-500 uppercase tracking-wider block">CURRENT BOTTLE</span>
                <span className="font-mono font-semibold text-[#00D1FF] text-sm block">
                  {bottle?.bottleId || user?.bottleId || 'ASX-XXXX-XXXX'}
                </span>
              </div>

              {/* New Bottle ID Input with auto-masking, uppercase, and subtle cyan focus ring */}
              <div className="space-y-1.5 pt-1">
                <div className="flex items-center justify-between">
                  <label htmlFor="input-change-bottle-serial" className="block text-xs font-medium text-neutral-400">
                    New Bottle Serial ID
                  </label>
                  <span className="text-[10px] font-mono text-neutral-500">
                    Format: ASX-PROD-01
                  </span>
                </div>
                <div className="relative">
                  <input
                    id="input-change-bottle-serial"
                    type="text"
                    value={newBottleInput}
                    onChange={(e) => handleNewBottleInputChange(e.target.value)}
                    placeholder="e.g., ASX-PROD-01"
                    maxLength={11}
                    autoComplete="off"
                    autoCorrect="off"
                    autoCapitalize="characters"
                    spellCheck={false}
                    className="w-full bg-[#090B0E] border border-white/10 rounded-2xl px-4 py-3 text-sm font-mono text-center tracking-wider xs:tracking-widest text-[#00D1FF] placeholder-neutral-500 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500/30 transition-all uppercase"
                  />
                </div>
                <div className="flex items-center justify-between px-1 text-[11px] text-neutral-500 font-mono">
                  <span>Auto-formatted</span>
                  <span>11 chars max</span>
                </div>
              </div>

              {changeBottleError && (
                <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                  <span>{changeBottleError}</span>
                </div>
              )}

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  disabled={isReleasingBottle || isPairingNewBottle}
                  onClick={() => {
                    setIsChangeBottleModalOpen(false);
                    setChangeBottleError('');
                    setNewBottleInput('');
                  }}
                  className="flex-1 sm:flex-none px-4 py-2.5 rounded-xl text-xs font-medium text-neutral-300 hover:text-white bg-white/[0.04] disabled:opacity-50 touch-target cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  id="btn-confirm-pair-new-bottle"
                  disabled={isReleasingBottle || isPairingNewBottle || newBottleInput.trim().length < 3}
                  onClick={handlePairNewBottle}
                  className="flex-1 sm:flex-none px-4 py-2.5 rounded-xl bg-[#00D1FF] hover:bg-[#00B4D8] text-[#090B0E] text-xs font-semibold transition-all flex items-center justify-center gap-1.5 disabled:opacity-50 shadow-lg shadow-[#00D1FF]/20 touch-target cursor-pointer disabled:cursor-not-allowed"
                >
                  {isPairingNewBottle ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-[#090B0E]" />
                      <span>Pairing...</span>
                    </>
                  ) : (
                    <span>Pair New Bottle</span>
                  )}
                </button>
              </div>

              <div className="pt-2 border-t border-white/5 text-center">
                <button
                  type="button"
                  disabled={isReleasingBottle || isPairingNewBottle}
                  onClick={async () => {
                    setChangeBottleError('');
                    setIsReleasingBottle(true);
                    try {
                      await unpairBottle();
                      setIsChangeBottleModalOpen(false);
                      onChangeBottle();
                    } catch (err: any) {
                      setChangeBottleError(err.message || 'Failed to release bottle. Please try again.');
                    } finally {
                      setIsReleasingBottle(false);
                    }
                  }}
                  className="text-[11px] text-neutral-400 hover:text-[#00D1FF] transition-colors cursor-pointer disabled:opacity-50"
                >
                  Or release current bottle and launch pairing wizard &rarr;
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Delete Account Confirmation Modal / Responsive Bottom Sheet */}
      <AnimatePresence>
        {isDeleteModalOpen && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/80 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              className="w-full sm:max-w-md bg-[#12161C] border-t sm:border border-rose-500/30 rounded-t-[28px] sm:rounded-[32px] p-5 sm:p-6 shadow-2xl space-y-4 safe-area-pb max-h-[90vh] overflow-y-auto"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-rose-500/20 text-rose-400 flex items-center justify-center shrink-0">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-semibold text-white">Delete account and all data?</h3>
                  <p className="text-[11px] text-neutral-400">Irreversible permanent action</p>
                </div>
              </div>

              <div className="p-3.5 rounded-2xl bg-rose-500/[0.06] border border-rose-500/20 space-y-2 text-xs text-neutral-300">
                <p className="font-semibold text-rose-300">The following will be permanently removed:</p>
                <ul className="list-disc list-inside space-y-1 text-[11px] text-neutral-400">
                  <li>Your user account profile and credentials</li>
                  <li>Paired bottle association & sensor logs</li>
                  <li>All personal hydration and intake history</li>
                  <li>Community water source reports & verification marks</li>
                  <li>Notification preferences & saved chat history</li>
                </ul>
              </div>

              {/* Error Alert */}
              <AnimatePresence>
                {deleteError && (
                  <motion.div
                    initial={{ opacity: 0, y: -5 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="p-3 sm:p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex flex-col gap-2"
                  >
                    <div className="flex items-start gap-2.5">
                      <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                      <span className="leading-relaxed">{deleteError}</span>
                    </div>

                    {/* If popup blocked or sensitive reauth issue, offer immediate data wipe fallback */}
                    <button
                      type="button"
                      disabled={isDeletingAccount}
                      onClick={async () => {
                        setIsDeletingAccount(true);
                        setDeleteError('');
                        try {
                          await deleteAccount({ forceWipeAndSignOutIfBlocked: true });
                          setIsDeleteModalOpen(false);
                        } catch (err: any) {
                          setDeleteError(err.message || 'Failed to wipe data. Please try again.');
                        } finally {
                          setIsDeletingAccount(false);
                        }
                      }}
                      className="mt-1 w-full py-2 px-3 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/40 text-rose-200 text-xs font-semibold text-center transition-colors"
                    >
                      Wipe Cloud Data & Sign Out Now
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Account verification notice based on provider */}
              {firebaseUser?.providerData.some((p) => p.providerId === 'google.com') ? (
                <div className="p-3 rounded-2xl bg-white/[0.03] border border-white/5 text-[11px] text-neutral-400 flex items-center gap-2">
                  <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24">
                    <path
                      fill="#4285F4"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                    />
                  </svg>
                  <span>Google Account: Re-verification may open or you can wipe and sign out.</span>
                </div>
              ) : (
                <div className="space-y-1.5 pt-1">
                  <label className="block text-xs font-medium text-neutral-300">
                    Confirm Account Password
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-neutral-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type={showDeletePassword ? 'text' : 'password'}
                      value={deletePassword}
                      onChange={(e) => setDeletePassword(e.target.value)}
                      placeholder="Enter your current password"
                      className="w-full bg-[#090B0E] border border-white/10 rounded-2xl pl-10 pr-10 py-2.5 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-rose-500/50 transition-colors"
                    />
                    <button
                      type="button"
                      onClick={() => setShowDeletePassword(!showDeletePassword)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-white p-1"
                    >
                      {showDeletePassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>
              )}

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  disabled={isDeletingAccount}
                  onClick={() => {
                    setIsDeleteModalOpen(false);
                    setDeleteError('');
                    setDeletePassword('');
                  }}
                  className="flex-1 sm:flex-none px-4 py-2.5 rounded-xl text-xs font-medium text-neutral-300 hover:text-white bg-white/[0.04] disabled:opacity-50 touch-target"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={isDeletingAccount}
                  onClick={async () => {
                    setDeleteError('');
                    setIsDeletingAccount(true);
                    try {
                      await deleteAccount({
                        password: deletePassword.trim() || undefined,
                        forceWipeAndSignOutIfBlocked: true,
                      });
                      setIsDeleteModalOpen(false);
                    } catch (err: any) {
                      setDeleteError(err.message || 'Failed to delete account. Please try again.');
                    } finally {
                      setIsDeletingAccount(false);
                    }
                  }}
                  className="flex-1 sm:flex-none px-4 py-2.5 rounded-xl bg-rose-500 hover:bg-rose-600 text-white text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50 shadow-lg shadow-rose-500/20 touch-target"
                >
                  {isDeletingAccount ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Deleting...</span>
                    </>
                  ) : (
                    <span>Confirm Deletion</span>
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

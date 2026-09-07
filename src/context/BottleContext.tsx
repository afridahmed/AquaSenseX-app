import React, { createContext, useContext, useEffect, useState, ReactNode, useCallback, useRef, useMemo } from 'react';
import { BottleData, HydrationLog, SensorReading, WaterQualityEvaluation, TrackingMode } from '../types';
import { useAuth } from './AuthContext';
import { defaultSensorProvider } from '../services/sensor/SensorDataProvider';
import { evaluateWaterQuality } from '../services/waterQuality/qualityEvaluator';
import { db } from '../services/firebase/firebaseConfig';
import { triggerBottleVibration } from '../services/firebase/vibrationService';
import { notificationService } from '../services/notifications/notificationService';
import { InAppToast } from '../components/notifications/InAppToastContainer';
import {
  collection,
  addDoc,
  onSnapshot,
  query,
  orderBy,
  limit,
  serverTimestamp,
} from 'firebase/firestore';

export interface AlertNotificationParams {
  type: InAppToast['type'];
  title: string;
  message: string;
  vibrateHardware?: boolean;
  notificationTag?: string;
}

interface BottleContextType {
  bottle: BottleData | null;
  qualityEval: WaterQualityEvaluation;
  hydrationLogs: HydrationLog[];
  todayConsumed: number;
  hardwareConsumed: number;
  manualConsumed: number;
  hydrationGoal: number;
  hydrationPercent: number;
  remainingMl: number;
  trackingMode: TrackingMode;
  setTrackingMode: (mode: TrackingMode) => Promise<void>;
  aiTip: string;
  isStale: boolean;
  isOnline: boolean;
  isDeviceOnline: boolean;
  isAwaitingConnection: boolean;
  isSimulatorOpen: boolean;
  setIsSimulatorOpen: (open: boolean) => void;
  recordIntake: (amountMl: number, source?: HydrationLog['source'], note?: string) => Promise<void>;
  recordSensorReading: (notes?: string) => Promise<SensorReading>;
  updateHydrationGoal: (goal: number) => Promise<void>;
  simulateDrink: (amountMl: number) => void;
  simulateRefill: () => void;
  simulateAbnormalWater: (preset: 'acidic' | 'turbid' | 'mineral_overload' | 'optimal') => void;
  simulateToggleOnline: () => void;
  refreshAiTip: () => Promise<void>;
  triggerHardwareVibration: () => Promise<void>;
  triggerAlertNotification: (params: AlertNotificationParams) => Promise<void>;
  toasts: InAppToast[];
  showToast: (toast: Omit<InAppToast, 'id' | 'timestamp'>) => void;
  dismissToast: (id: string) => void;
  isMockMode: boolean;
}

const BottleContext = createContext<BottleContextType | undefined>(undefined);

// 45-second hardware offline watchdog timeout to prevent false-positive offline flips
const OFFLINE_WATCHDOG_TIMEOUT_MS = 45000;
const TRACKING_MODE_STORAGE_KEY = 'aquasense_tracking_mode';

export const BottleProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { user, updateUserProfile } = useAuth();
  const [bottle, setBottle] = useState<BottleData | null>(null);
  const [hydrationLogs, setHydrationLogs] = useState<HydrationLog[]>([]);
  const [aiTip, setAiTip] = useState<string>('AquaSense X is monitoring water safety and hydration.');
  const [isSimulatorOpen, setIsSimulatorOpen] = useState<boolean>(false);
  const [isHardwareTimedOut, setIsHardwareTimedOut] = useState<boolean>(false);
  const [toasts, setToasts] = useState<InAppToast[]>([]);

  // Tracking Mode: 'smart_sync' (Auto ToF delta tracking) vs 'manual' (Manual Track)
  const [trackingMode, setTrackingModeState] = useState<TrackingMode>(() => {
    try {
      const saved = localStorage.getItem(TRACKING_MODE_STORAGE_KEY);
      if (saved === 'smart_sync' || saved === 'manual') return saved as TrackingMode;
    } catch {}
    return user?.trackingMode || 'smart_sync';
  });

  const setTrackingMode = useCallback(
    async (mode: TrackingMode) => {
      setTrackingModeState(mode);
      try {
        localStorage.setItem(TRACKING_MODE_STORAGE_KEY, mode);
      } catch (e) {
        console.warn('Failed to save tracking mode to localStorage', e);
      }
      if (user) {
        try {
          await updateUserProfile({ trackingMode: mode });
        } catch (err) {
          console.warn('Failed to sync tracking mode to user profile', err);
        }
      }
    },
    [user, updateUserProfile]
  );

  useEffect(() => {
    if (user?.trackingMode) {
      try {
        const localSaved = localStorage.getItem(TRACKING_MODE_STORAGE_KEY);
        if (!localSaved) {
          setTrackingModeState(user.trackingMode);
        }
      } catch {}
    }
  }, [user?.trackingMode]);

  const bottleId = user?.bottleId || user?.assignedBottleId;
  const hydrationGoal = user?.hydrationGoal || 2500;

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback((toast: Omit<InAppToast, 'id' | 'timestamp'>) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const newToast: InAppToast = {
      ...toast,
      id,
      timestamp: Date.now(),
    };

    setToasts((prev) => [newToast, ...prev.slice(0, 4)]);

    // Auto-dismiss toast after 6.5 seconds
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 6500);
  }, []);

  // Immediate state wiping on user logout, unpairing, or bottle change
  useEffect(() => {
    if (!user) {
      setBottle(null);
      setHydrationLogs([]);
      setIsHardwareTimedOut(false);
      setIsSimulatorOpen(false);
      setToasts([]);
      setAiTip('AquaSense X is monitoring water safety and hydration.');
    }
  }, [user]);

  // Physical ESP32 watchdog timer
  useEffect(() => {
    const checkWatchdog = () => {
      if (!bottle) {
        setIsHardwareTimedOut(true);
        return;
      }

      if (bottle.online === false) {
        setIsHardwareTimedOut(true);
        return;
      }

      const syncObj = (bottle.lastSyncTimestamp || bottle.lastUpdated) as any;

      // Bug fix: If the hardware reports online=true but no timestamp is available
      // (e.g. initial Firestore snapshot before the simulator writes fresh data),
      // treat the device as recently synced. The watchdog will naturally expire
      // in 45 seconds if no fresh data arrives — this prevents false offline flicker.
      if (!syncObj) {
        setIsHardwareTimedOut(false);
        return;
      }

      let lastSyncMs: number;
      if (typeof syncObj === 'number') {
        lastSyncMs = syncObj < 1e11 ? syncObj * 1000 : syncObj;
      } else if (typeof syncObj === 'object' && syncObj && 'toMillis' in syncObj) {
        lastSyncMs = syncObj.toMillis();
      } else if (typeof syncObj === 'object' && syncObj && typeof syncObj.seconds === 'number') {
        lastSyncMs = syncObj.seconds * 1000;
      } else {
        lastSyncMs = new Date(syncObj).getTime();
      }

      if (isNaN(lastSyncMs) || lastSyncMs <= 0) {
        // Bug fix: Unknown/unparseable timestamp on an online device — don't mark offline.
        // Give it the benefit of the doubt; the watchdog will expire naturally.
        setIsHardwareTimedOut(false);
        return;
      }

      const elapsed = Math.max(0, Date.now() - lastSyncMs);
      const timedOut = elapsed > OFFLINE_WATCHDOG_TIMEOUT_MS;
      setIsHardwareTimedOut(timedOut);
    };

    checkWatchdog();
    const interval = setInterval(checkWatchdog, 2500);
    return () => clearInterval(interval);
  }, [bottle]);

  // Listen to user's real Firestore hydration logs
  useEffect(() => {
    if (!user) {
      setHydrationLogs([]);
      return;
    }

    try {
      const logsRef = collection(db, 'users', user.uid, 'hydrationLogs');
      const q = query(logsRef, orderBy('timestamp', 'desc'), limit(100));

      const unsubscribe = onSnapshot(
        q,
        (snapshot) => {
          if (!snapshot.empty) {
            const logs: HydrationLog[] = snapshot.docs.map((docSnap) => {
              const d = docSnap.data();
              return {
                id: docSnap.id,
                uid: user.uid,
                amountMl: d.amountMl || 0,
                timestamp: d.timestamp || new Date().toISOString(),
                source: d.source || 'quick_preset',
                note: d.note || d.optionalNote || '',
                optionalNote: d.note || d.optionalNote || '',
              };
            });
            setHydrationLogs(logs);
          } else {
            setHydrationLogs([]);
          }
        },
        (error) => {
          console.warn('Firestore hydration logs listener warning:', error);
        }
      );

      return () => unsubscribe();
    } catch (e) {
      console.warn('Error setting up hydration listener:', e);
    }
  }, [user?.uid]);

  // Subscribe to real-time IoT bottle telemetry via Firestore provider
  useEffect(() => {
    // Bug fix: Reset bottle state to null immediately whenever the bottleId changes
    // (including when it becomes null after unpairBottle). Without this reset, the
    // previous user's BottleData persists in state while the new subscription is
    // initializing, causing stale "Invalid Bottle ID" / "Already Owned" validation
    // errors in the pairing flow and data bleeding between accounts.
    setBottle(null);
    setIsHardwareTimedOut(false);

    if (!bottleId) {
      return;
    }

    const unsubscribe = defaultSensorProvider.subscribe(bottleId, (data) => {
      setBottle(data);
    });

    return () => {
      unsubscribe();
    };
  }, [bottleId]);

  // Ref to track physical bottle water level changes across snapshots
  const prevPhysicalLevelMlRef = useRef<number | null>(null);

  // Normalize live bottle water level to milliliters.
  // The ESP32 ToF sensor reports waterLevel as a 0-100 percentage.
  // Physical bottle capacity is 2000 ml (2L), so 10% drop = 200 ml consumed.
  const currentPhysicalLevelMl = useMemo(() => {
    if (!bottle || bottle.waterLevel === null || bottle.waterLevel === undefined) return null;
    const maxCap = bottle.maxCapacity || 2000; // Default: 2L physical bottle
    if (bottle.waterLevel <= 100 && maxCap > 100) {
      return Math.round((bottle.waterLevel / 100) * maxCap);
    }
    return Math.round(bottle.waterLevel);
  }, [bottle?.waterLevel, bottle?.maxCapacity]);

  // Monitor physical bottle water level drop to record hardware-synced consumption
  useEffect(() => {
    if (currentPhysicalLevelMl === null || !user) {
      return;
    }

    if (prevPhysicalLevelMlRef.current === null) {
      // First baseline reading
      prevPhysicalLevelMlRef.current = currentPhysicalLevelMl;
      return;
    }

    const prev = prevPhysicalLevelMlRef.current;
    const drop = prev - currentPhysicalLevelMl;

    // A drop in water level (>= 15 ml to ignore ToF micro-jitter) indicates fluid drunk from physical smart bottle
    if (drop >= 15) {
      // Auto Mode (Smart Sync): increment daily hydration total automatically
      // Manual Mode: delta-tracking is disconnected from daily total
      if (trackingMode === 'smart_sync') {
        recordIntake(drop, 'bottle_auto', 'Detected from Smart Bottle ToF sensor');
      }
      // Always sync baseline so toggling modes does not trigger phantom delta spikes
      prevPhysicalLevelMlRef.current = currentPhysicalLevelMl;
    } else if (drop < -15) {
      // Refill detected (water level increased): ignore consumption and sync baseline
      prevPhysicalLevelMlRef.current = currentPhysicalLevelMl;
    }
  }, [currentPhysicalLevelMl, user, trackingMode]);

  // Calculate today's consumed total (matching today's date in local ISO string)
  const todayDateStr = new Date().toISOString().slice(0, 10);
  const todayLogs = hydrationLogs.filter((l) => l.timestamp?.startsWith(todayDateStr));
  const todayConsumed = Math.max(0, todayLogs.reduce((sum, log) => sum + log.amountMl, 0));
  const hydrationPercent = Math.min(100, Math.round((todayConsumed / hydrationGoal) * 100));
  const remainingMl = Math.max(0, hydrationGoal - todayConsumed);

  // Split consumed fluid by source: Hardware (bottle_auto) vs Manual (quick_preset, manual_add, etc.)
  const hardwareConsumed = Math.max(
    0,
    todayLogs
      .filter((l) => l.source === 'bottle_auto' || l.source === 'hardware_synced')
      .reduce((sum, log) => sum + log.amountMl, 0)
  );

  const manualConsumed = Math.max(
    0,
    todayLogs
      .filter((l) => l.source !== 'bottle_auto' && l.source !== 'hardware_synced')
      .reduce((sum, log) => sum + log.amountMl, 0)
  );

  // Determine physical handshake status & live online status
  let lastSyncTimeMs: number | null = null;
  const syncObj = (bottle?.lastSyncTimestamp || bottle?.lastUpdated) as any;
  if (syncObj) {
    if (typeof syncObj === 'number') {
      lastSyncTimeMs = syncObj < 1e11 ? syncObj * 1000 : syncObj;
    } else if (typeof syncObj === 'object' && syncObj && 'toMillis' in syncObj) {
      lastSyncTimeMs = syncObj.toMillis();
    } else if (typeof syncObj === 'object' && syncObj && typeof syncObj.seconds === 'number') {
      lastSyncTimeMs = syncObj.seconds * 1000;
    } else {
      const parsed = new Date(syncObj).getTime();
      if (!isNaN(parsed)) {
        lastSyncTimeMs = parsed;
      }
    }
  }

  // Bug fix: If the device reports online=true but has no parseable timestamp
  // (e.g. initial snapshot before simulator writes, or missing field), treat
  // it as synced right now so the watchdog never falsely trips on mount.
  if (bottle?.online === true && (lastSyncTimeMs === null || isNaN(lastSyncTimeMs) || lastSyncTimeMs <= 0)) {
    lastSyncTimeMs = Date.now();
  }

  const hasSyncedOnce = Boolean(lastSyncTimeMs && !isNaN(lastSyncTimeMs) && lastSyncTimeMs > 0);
  const now = Date.now();
  const elapsed = lastSyncTimeMs ? Math.max(0, now - lastSyncTimeMs) : Infinity;
  const isWithinWatchdog = Boolean(hasSyncedOnce && elapsed < OFFLINE_WATCHDOG_TIMEOUT_MS);
  const isDeviceOnline = Boolean(bottle?.online === true && isWithinWatchdog && !isHardwareTimedOut);
  const isOnline = isDeviceOnline;
  const isAwaitingConnection = Boolean(bottleId && (!bottle || !hasSyncedOnce));

  // Compute live quality evaluation (gracefully handles offline states while preserving readings)
  const qualityEval: WaterQualityEvaluation = evaluateWaterQuality({
    isOffline: !isDeviceOnline,
    ph: bottle?.ph ?? null,
    tds: bottle?.tds ?? null,
    turbidity: bottle?.turbidity ?? null,
    temperature: bottle?.temperature ?? null,
  });

  const effectiveBottle: BottleData | null = bottle
    ? {
        ...bottle,
        online: isDeviceOnline,
        // Preserve sensor readings from bottle so historical/recent data remains visible even when offline
        ph: bottle.ph ?? null,
        tds: bottle.tds ?? null,
        turbidity: bottle.turbidity ?? null,
        temperature: bottle.temperature ?? null,
        waterLevel: typeof bottle.waterLevel === 'number' ? bottle.waterLevel : 0,
        qualityScore: isDeviceOnline
          ? (typeof bottle.qualityScore === 'number' ? bottle.qualityScore : qualityEval.score)
          : (typeof bottle.qualityScore === 'number' ? bottle.qualityScore : qualityEval.score),
        qualityCategory: isDeviceOnline
          ? (bottle.qualityCategory && bottle.qualityCategory !== 'Offline' && bottle.qualityCategory !== 'Awaiting Connection'
              ? bottle.qualityCategory
              : qualityEval.category)
          : (isAwaitingConnection ? 'Awaiting Connection' : 'Offline'),
        isStale: !isDeviceOnline,
      }
    : null;

  const isStale = !isDeviceOnline;

  // ─── UNIFIED ALERT NOTIFICATION DISPATCHER ────────────────────────────────
  // Dispatches rich in-app toast, browser native Notification, and remote ESP32 vibration
  const triggerAlertNotification = useCallback(
    async (params: AlertNotificationParams) => {
      // 1. Dispatch rich in-app toast
      showToast({
        type: params.type,
        title: params.title,
        message: params.message,
        hardwareVibrated: params.vibrateHardware,
      });

      // 2. Dispatch browser native Notification if permission is granted
      try {
        if (typeof window !== 'undefined' && 'Notification' in window) {
          const permStatus = notificationService.getPermissionStatus();
          if (permStatus === 'granted') {
            new Notification(params.title, {
              body: params.message,
              icon: '/icons/icon-192x192.png',
              tag: params.notificationTag || `aquasense-${Date.now()}`,
            });
          }
        }
      } catch (err) {
        console.warn('[BottleContext] Browser native notification failed:', err);
      }

      // 3. Remote hardware vibration trigger on physical ESP32
      if (params.vibrateHardware) {
        const targetBottleId = bottleRef.current?.bottleId;
        if (targetBottleId) {
          triggerBottleVibration(targetBottleId).catch((err) => {
            console.warn('[BottleContext] Hardware vibration trigger failed:', err);
          });
        }
      }
    },
    [showToast]
  );

  // Synchronized refs to guarantee access to fresh state inside intervals without closure freezing
  const userRef = useRef(user);
  useEffect(() => { userRef.current = user; }, [user]);

  const bottleRef = useRef(bottle);
  useEffect(() => { bottleRef.current = bottle; }, [bottle]);

  const hydrationLogsRef = useRef(hydrationLogs);
  useEffect(() => { hydrationLogsRef.current = hydrationLogs; }, [hydrationLogs]);

  const todayConsumedRef = useRef(todayConsumed);
  useEffect(() => { todayConsumedRef.current = todayConsumed; }, [todayConsumed]);

  // Evaluator tracking refs
  const lastRecordedDayRef = useRef<string>(new Date().toISOString().slice(0, 10));
  const lastHydrationCheckTimeRef = useRef<number>(Date.now());
  const lowBatteryAlertedRef = useRef<boolean>(false);
  const goalReachedAlertedTodayRef = useRef<boolean>(false);

  // ─── PERSISTENT BACKGROUND EVALUATOR & SMART HYDRATION ENGINE ──────────────
  // Executes continuously every 60 seconds (1 minute interval) to evaluate:
  // 1. Daily Reset Cycle: Tracks date rollover, resets cumulative intake to 0, fires reset alert.
  // 2. Low Battery Engine: Fires alert + pulses ESP32 hardware motor when battery < 20%.
  // 3. Daily Goal Cutoff: Completely suppresses reminders & vibrations when ≥ 2000 ml is met.
  // 4. Time Gap & 400ml Rule: Only triggers reminder if < 400 ml consumed in the window.
  useEffect(() => {
    const runBackgroundEvaluation = async () => {
      const currentUser = userRef.current;
      const currentBottle = bottleRef.current;
      const logs = hydrationLogsRef.current || [];
      const now = Date.now();

      // ─────────────────────────────────────────────────────────────────
      // RULE 1: Daily Hydration Goal Reset Cycle (Tracking Date Changes)
      // ─────────────────────────────────────────────────────────────────
      const currentDayStr = new Date().toISOString().slice(0, 10);
      if (lastRecordedDayRef.current !== currentDayStr) {
        lastRecordedDayRef.current = currentDayStr;
        goalReachedAlertedTodayRef.current = false;
        lastHydrationCheckTimeRef.current = now;

        await triggerAlertNotification({
          type: 'reset',
          title: '🌅 Daily Hydration Goal Reset',
          message: 'Welcome to a fresh day! Your daily hydration intake has reset to 0/2,000 ml. Start your day with clean, pure water!',
          notificationTag: 'aquasense-daily-reset',
        });
        return;
      }

      // Calculate today's intake from logs matching today's date
      const todayLogs = logs.filter((l) => l.timestamp?.startsWith(currentDayStr));
      const currentTodayTotal = Math.max(0, todayLogs.reduce((sum, l) => sum + l.amountMl, 0));

      // ─────────────────────────────────────────────────────────────────
      // RULE 2: Low Battery Notifications & ESP32 Vibration Trigger (< 20%)
      // ─────────────────────────────────────────────────────────────────
      const battery = currentBottle?.battery;
      if (typeof battery === 'number' && battery > 0 && battery < 20) {
        if (!lowBatteryAlertedRef.current) {
          lowBatteryAlertedRef.current = true;
          if (currentUser?.notificationSettings?.lowBatteryAlerts !== false) {
            await triggerAlertNotification({
              type: 'battery',
              title: '🔋 Low Bottle Battery Warning',
              message: `Your AquaSense X battery has dropped to ${battery}%. Please connect your bottle to a charger.`,
              vibrateHardware: true,
              notificationTag: 'aquasense-low-battery',
            });
          }
        }
      } else if (typeof battery === 'number' && battery >= 25) {
        // Re-armed when battery charges back up to 25%+
        lowBatteryAlertedRef.current = false;
      }

      // ─────────────────────────────────────────────────────────────────
      // RULE 3: Daily Goal Cutoff (2,000 ml / 2-Liter Baseline Capacity)
      // ─────────────────────────────────────────────────────────────────
      const DAILY_GOAL_CUTOFF_ML = 2000;
      if (currentTodayTotal >= DAILY_GOAL_CUTOFF_ML) {
        if (!goalReachedAlertedTodayRef.current) {
          goalReachedAlertedTodayRef.current = true;
          await triggerAlertNotification({
            type: 'goal',
            title: '🎉 Daily Hydration Goal Achieved!',
            message: 'Outstanding! You have reached your full 2,000 ml daily goal. Hydration reminders are paused for the remainder of today.',
            notificationTag: 'aquasense-daily-goal',
          });
        }
        // Completely suppress all hydration reminders and vibration triggers for remainder of the day
        return;
      }

      // ─────────────────────────────────────────────────────────────────
      // RULE 4: Refined Smart Hydration Rules (Time Gap & 400ml Rule)
      // ─────────────────────────────────────────────────────────────────
      const settings = currentUser?.notificationSettings;
      if (!settings?.drinkReminders) return;

      // Active reminder window check (e.g. 08:00 – 22:00)
      const nowDate = new Date();
      const [startH, startM] = (settings.drinkReminderStart || '08:00').split(':').map(Number);
      const [endH, endM] = (settings.drinkReminderEnd || '22:00').split(':').map(Number);
      const startMinutes = startH * 60 + startM;
      const endMinutes = endH * 60 + endM;
      const currentMinutes = nowDate.getHours() * 60 + nowDate.getMinutes();
      if (currentMinutes < startMinutes || currentMinutes > endMinutes) return;

      const intervalMinutes = settings.drinkReminderIntervalMinutes || 60;
      const intervalMs = intervalMinutes * 60 * 1000;

      if (now - lastHydrationCheckTimeRef.current >= intervalMs) {
        const windowCutoffTime = new Date(now - intervalMs).toISOString();
        const recentLogs = logs.filter((l) => l.timestamp >= windowCutoffTime);
        const recentConsumed = recentLogs.reduce((sum, l) => sum + l.amountMl, 0);

        const DRINK_THRESHOLD_ML = 400; // 400 ml Rule

        if (recentConsumed < DRINK_THRESHOLD_ML) {
          const remainingToDrink = Math.max(0, DRINK_THRESHOLD_ML - recentConsumed);
          const intervalLabel = intervalMinutes < 60 ? `${intervalMinutes}m` : `${intervalMinutes / 60}h`;

          await triggerAlertNotification({
            type: 'hydration',
            title: '💧 Smart Hydration Reminder',
            message: `You've only consumed ${recentConsumed} ml in the past ${intervalLabel} (< 400 ml). Drink at least ${remainingToDrink} ml more to stay on track! 💧`,
            vibrateHardware: true,
            notificationTag: 'aquasense-hydration-reminder',
          });

          lastHydrationCheckTimeRef.current = now;
        } else {
          // Consumed ≥ 400 ml: silently reset timer, staying quiet without interruptions
          lastHydrationCheckTimeRef.current = now;
        }
      }
    };

    // Run initial evaluation shortly after mount, then every 60 seconds without freezing
    const initialTimer = setTimeout(runBackgroundEvaluation, 3500);
    const intervalTimer = setInterval(runBackgroundEvaluation, 60000);

    return () => {
      clearTimeout(initialTimer);
      clearInterval(intervalTimer);
    };
  }, [triggerAlertNotification]);

  // Immediate low-battery trigger on live telemetry packet arrival
  useEffect(() => {
    const battery = bottle?.battery;
    if (
      typeof battery === 'number' &&
      battery > 0 &&
      battery < 20 &&
      !lowBatteryAlertedRef.current &&
      user?.notificationSettings?.lowBatteryAlerts !== false
    ) {
      lowBatteryAlertedRef.current = true;
      triggerAlertNotification({
        type: 'battery',
        title: '🔋 Low Bottle Battery Warning',
        message: `Your AquaSense X battery has dropped to ${battery}%. Please connect your bottle to a charger.`,
        vibrateHardware: true,
        notificationTag: 'aquasense-low-battery',
      });
    } else if (typeof battery === 'number' && battery >= 25) {
      lowBatteryAlertedRef.current = false;
    }
  }, [bottle?.battery, user?.notificationSettings?.lowBatteryAlerts, triggerAlertNotification]);

  // ─── TRIGGER HARDWARE VIBRATION (manual / context-exposed) ───────────────────
  const triggerHardwareVibration = useCallback(async () => {
    const currentBottleId = bottle?.bottleId;
    if (!currentBottleId) {
      console.warn('[BottleContext] No bottle connected — cannot trigger vibration.');
      return;
    }
    await triggerBottleVibration(currentBottleId);
  }, [bottle?.bottleId]);

  // Fetch AI hydration tip
  const refreshAiTip = useCallback(async () => {
    if (!isOnline) {
      if (isAwaitingConnection) {
        setAiTip('AquaSense X is awaiting initial connection from your physical smart bottle. Power on the bottle to begin streaming live sensor data.');
      } else {
        setAiTip('AquaSense X is currently offline. Reconnect your bottle or transmit telemetry to receive live AI purity & hydration insights.');
      }
      return;
    }

    try {
      const response = await fetch('/api/ai/tip', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          hydrationGoal,
          consumed: todayConsumed,
          bottleData: {
            waterLevel: bottle?.waterLevel,
            temperature: bottle?.temperature,
            qualityScore: qualityEval.score,
            ph: bottle?.ph,
            tds: bottle?.tds,
          },
        }),
      });
      if (response.ok) {
        const data = await response.json();
        if (data.tip) setAiTip(data.tip);
      }
    } catch (e) {
      const pct = Math.round((todayConsumed / hydrationGoal) * 100);
      setAiTip(`You're at ${pct}% of your daily target. Drink steadily throughout the day.`);
    }
  }, [isOnline, isAwaitingConnection, hydrationGoal, todayConsumed, bottle, qualityEval.score]);

  useEffect(() => {
    const timer = setTimeout(() => {
      refreshAiTip();
    }, 1200);
    return () => clearTimeout(timer);
  }, [todayConsumed, bottle?.bottleId, isOnline, isAwaitingConnection]);

  // Record an intake event directly in Firestore
  const recordIntake = async (
    amountMl: number,
    source: HydrationLog['source'] = 'quick_preset',
    note?: string
  ) => {
    if (!user) return;

    const newLogItem = {
      uid: user.uid,
      amountMl,
      timestamp: new Date().toISOString(),
      source,
      note: note || '',
    };

    try {
      // 1. User subcollection
      const userLogsCol = collection(db, 'users', user.uid, 'hydrationLogs');
      await addDoc(userLogsCol, {
        ...newLogItem,
        serverCreatedAt: serverTimestamp(),
      });

      // 2. Top-level collection
      const topLogsCol = collection(db, 'hydrationLogs');
      await addDoc(topLogsCol, {
        ...newLogItem,
        serverCreatedAt: serverTimestamp(),
      });
    } catch (err) {
      console.error('Error saving hydration log to Firestore:', err);
    }

    // Deduct fluid from bottle in Firestore only for manual additions (not hardware auto-detected drops)
    if (
      source !== 'bottle_auto' &&
      source !== 'hardware_synced' &&
      amountMl > 0 &&
      bottle &&
      bottle.bottleId &&
      typeof bottle.waterLevel === 'number' &&
      bottle.waterLevel > 0
    ) {
      const newLevel = Math.max(0, bottle.waterLevel - amountMl);
      await defaultSensorProvider.updateBottleState(bottle.bottleId, {
        waterLevel: newLevel,
      });
    }
  };

  // Record bottle reading to Firestore
  const recordSensorReading = async (notes?: string): Promise<SensorReading> => {
    if (!bottle) throw new Error('No bottle connected');

    const reading: SensorReading = {
      uid: user?.uid,
      bottleId: bottle.bottleId,
      temperature: bottle.temperature,
      tds: bottle.tds,
      turbidity: bottle.turbidity,
      ph: bottle.ph,
      waterLevel: bottle.waterLevel,
      qualityScore: qualityEval.score,
      timestamp: new Date().toISOString(),
      notes,
    };

    await defaultSensorProvider.recordReading(bottle.bottleId, reading);
    return reading;
  };

  // Update Hydration Goal
  const updateHydrationGoal = async (goal: number) => {
    if (user) {
      await updateUserProfile({ hydrationGoal: goal });
    }
  };

  // IoT Simulator controls
  const simulateDrink = (amountMl: number) => {
    if (!bottle) return;
    recordIntake(amountMl, 'bottle_auto', 'Detected from AquaSense X fluid sensor');
  };

  const simulateRefill = () => {
    if (!bottle || !bottle.bottleId) return;
    defaultSensorProvider.updateBottleState(bottle.bottleId, {
      waterLevel: 100,
      temperature: 16.5,
      tds: 145,
      turbidity: 0.2,
      ph: 7.4,
      online: true,
      battery: 92,
    });
  };

  const simulateAbnormalWater = (preset: 'acidic' | 'turbid' | 'mineral_overload' | 'optimal') => {
    if (!bottle || !bottle.bottleId) return;
    switch (preset) {
      case 'acidic':
        defaultSensorProvider.updateBottleState(bottle.bottleId, {
          ph: 5.4,
          tds: 340,
          turbidity: 1.8,
          temperature: 22.0,
          online: true,
        });
        break;
      case 'turbid':
        defaultSensorProvider.updateBottleState(bottle.bottleId, {
          ph: 6.9,
          tds: 480,
          turbidity: 4.8,
          temperature: 23.5,
          online: true,
        });
        break;
      case 'mineral_overload':
        defaultSensorProvider.updateBottleState(bottle.bottleId, {
          ph: 8.8,
          tds: 890,
          turbidity: 2.2,
          temperature: 21.0,
          online: true,
        });
        break;
      case 'optimal':
        defaultSensorProvider.updateBottleState(bottle.bottleId, {
          ph: 7.3,
          tds: 160,
          turbidity: 0.3,
          temperature: 18.0,
          waterLevel: 680,
          online: true,
        });
        break;
    }
  };

  const simulateToggleOnline = () => {
    if (!bottle || !bottle.bottleId) return;
    defaultSensorProvider.updateBottleState(bottle.bottleId, {
      online: !bottle.online,
    });
  };

  return (
    <BottleContext.Provider
      value={{
        bottle: effectiveBottle,
        qualityEval,
        hydrationLogs,
        todayConsumed,
        hardwareConsumed,
        manualConsumed,
        hydrationGoal,
        hydrationPercent,
        remainingMl,
        trackingMode,
        setTrackingMode,
        aiTip,
        isStale,
        isOnline,
        isDeviceOnline,
        isAwaitingConnection,
        isSimulatorOpen,
        setIsSimulatorOpen,
        recordIntake,
        recordSensorReading,
        updateHydrationGoal,
        simulateDrink,
        simulateRefill,
        simulateAbnormalWater,
        simulateToggleOnline,
        refreshAiTip,
        triggerHardwareVibration,
        triggerAlertNotification,
        toasts,
        showToast,
        dismissToast,
        isMockMode: !defaultSensorProvider.isLive(),
      }}
    >
      {children}
    </BottleContext.Provider>
  );
};

export const useBottle = () => {
  const context = useContext(BottleContext);
  if (!context) {
    throw new Error('useBottle must be used within a BottleProvider');
  }
  return context;
};

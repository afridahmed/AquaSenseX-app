import React, { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react';
import { BottleData, HydrationLog, SensorReading, WaterQualityEvaluation } from '../types';
import { useAuth } from './AuthContext';
import { defaultSensorProvider } from '../services/sensor/SensorDataProvider';
import { evaluateWaterQuality } from '../services/waterQuality/qualityEvaluator';
import { db } from '../services/firebase/firebaseConfig';
import {
  collection,
  doc,
  addDoc,
  onSnapshot,
  query,
  orderBy,
  limit,
  serverTimestamp,
} from 'firebase/firestore';

interface BottleContextType {
  bottle: BottleData | null;
  qualityEval: WaterQualityEvaluation;
  hydrationLogs: HydrationLog[];
  todayConsumed: number;
  hydrationGoal: number;
  hydrationPercent: number;
  remainingMl: number;
  aiTip: string;
  isStale: boolean;
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
  isMockMode: boolean;
}

const BottleContext = createContext<BottleContextType | undefined>(undefined);

export const BottleProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { user, updateUserProfile } = useAuth();
  const [bottle, setBottle] = useState<BottleData | null>(null);
  const [hydrationLogs, setHydrationLogs] = useState<HydrationLog[]>([]);
  const [aiTip, setAiTip] = useState<string>('Stay hydrated! Hydration optimizes energy, cognition, and cellular repair.');
  const [isSimulatorOpen, setIsSimulatorOpen] = useState<boolean>(false);

  const bottleId = user?.bottleId;
  const hydrationGoal = user?.hydrationGoal || 2500;

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
    if (!bottleId) {
      setBottle(null);
      return;
    }

    const unsubscribe = defaultSensorProvider.subscribe(bottleId, (data) => {
      setBottle(data);
    });

    return () => {
      unsubscribe();
    };
  }, [bottleId]);

  // Calculate today's consumed total (matching today's date in local ISO string)
  const todayDateStr = new Date().toISOString().slice(0, 10);
  const todayLogs = hydrationLogs.filter((l) => l.timestamp?.startsWith(todayDateStr));
  const todayConsumed = todayLogs.reduce((sum, log) => sum + log.amountMl, 0);
  const hydrationPercent = Math.min(100, Math.round((todayConsumed / hydrationGoal) * 100));
  const remainingMl = Math.max(0, hydrationGoal - todayConsumed);

  // Compute live quality evaluation
  const qualityEval: WaterQualityEvaluation = evaluateWaterQuality({
    ph: bottle?.ph ?? 7.2,
    tds: bottle?.tds ?? 180,
    turbidity: bottle?.turbidity ?? 0.4,
    temperature: bottle?.temperature ?? 21.0,
  });

  // Check if data is stale (> 45s without update and bottle offline)
  const isStale = !!(
    bottle &&
    (!bottle.online || Date.now() - new Date(bottle.lastUpdated).getTime() > 45000)
  );

  // Fetch AI hydration tip
  const refreshAiTip = useCallback(async () => {
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
  }, [hydrationGoal, todayConsumed, bottle, qualityEval.score]);

  useEffect(() => {
    const timer = setTimeout(() => {
      refreshAiTip();
    }, 1200);
    return () => clearTimeout(timer);
  }, [todayConsumed, bottle?.bottleId]);

  // Record an intake event directly in Firestore (both users/{uid}/hydrationLogs and hydrationLogs)
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
      // 1. Subcollection
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

    // Deduct fluid from bottle if present
    if (bottle && bottle.bottleId && bottle.waterLevel > 0) {
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

  // IoT Simulator controls (writes directly to Firestore)
  const simulateDrink = (amountMl: number) => {
    if (!bottle) return;
    recordIntake(amountMl, 'bottle_auto', 'Detected from AquaSense X fluid sensor');
  };

  const simulateRefill = () => {
    if (!bottle || !bottle.bottleId) return;
    defaultSensorProvider.updateBottleState(bottle.bottleId, {
      waterLevel: 750,
      temperature: 16.5,
      tds: 145,
      turbidity: 0.2,
      ph: 7.4,
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
        });
        break;
      case 'turbid':
        defaultSensorProvider.updateBottleState(bottle.bottleId, {
          ph: 6.9,
          tds: 480,
          turbidity: 4.8,
          temperature: 23.5,
        });
        break;
      case 'mineral_overload':
        defaultSensorProvider.updateBottleState(bottle.bottleId, {
          ph: 8.8,
          tds: 890,
          turbidity: 2.2,
          temperature: 21.0,
        });
        break;
      case 'optimal':
        defaultSensorProvider.updateBottleState(bottle.bottleId, {
          ph: 7.3,
          tds: 160,
          turbidity: 0.3,
          temperature: 18.0,
          waterLevel: 680,
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
        bottle,
        qualityEval,
        hydrationLogs,
        todayConsumed,
        hydrationGoal,
        hydrationPercent,
        remainingMl,
        aiTip,
        isStale,
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

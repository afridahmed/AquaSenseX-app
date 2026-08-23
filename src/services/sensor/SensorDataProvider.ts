import { BottleData, SensorReading } from '../../types';
import { evaluateWaterQuality } from '../waterQuality/qualityEvaluator';
import { db, auth } from '../firebase/firebaseConfig';
import {
  doc,
  onSnapshot,
  setDoc,
  updateDoc,
  collection,
  addDoc,
  serverTimestamp,
} from 'firebase/firestore';

export type SensorDataListener = (data: BottleData) => void;

export interface ISensorDataProvider {
  name: string;
  subscribe(bottleId: string, callback: SensorDataListener): () => void;
  recordReading(bottleId: string, reading: SensorReading): Promise<void>;
  updateBottleState(bottleId: string, partial: Partial<BottleData>): Promise<void>;
  isLive(): boolean;
}

/**
 * Cloud Firestore Real-time Sensor Data Provider
 * Connects to live Firebase Firestore `bottles/{bottleId}` collection with real-time onSnapshot listeners
 */
export class FirestoreSensorDataProvider implements ISensorDataProvider {
  name = 'AquaSense Cloud (Live Firestore IoT)';
  private activeSimTimers: Map<string, any> = new Map();

  subscribe(bottleId: string, callback: SensorDataListener): () => void {
    const cleanedId = bottleId.trim().toUpperCase();

    // Default template state if Firestore record is initially empty
    const emitEvaluated = (raw: Partial<BottleData>) => {
      const ph = raw.ph ?? 7.2;
      const tds = raw.tds ?? 182;
      const turbidity = raw.turbidity ?? 0.4;
      const temperature = raw.temperature ?? 21.4;

      const evalResult = evaluateWaterQuality({ ph, tds, turbidity, temperature });

      const fullData: BottleData = {
        bottleId: cleanedId,
        ownerUid: raw.ownerUid ?? null,
        online: raw.online ?? true,
        battery: raw.battery ?? 88,
        temperature,
        tds,
        turbidity,
        ph,
        waterLevel: raw.waterLevel ?? 650,
        maxCapacity: raw.maxCapacity ?? 750,
        lastUpdated: raw.lastUpdated ?? new Date().toISOString(),
        qualityScore: evalResult.score,
        qualityCategory: evalResult.category,
      };

      callback(fullData);
    };

    try {
      const bottleRef = doc(db, 'bottles', cleanedId);
      const unsubscribe = onSnapshot(
        bottleRef,
        (snap) => {
          if (snap.exists()) {
            const data = snap.data() as Partial<BottleData>;
            emitEvaluated(data);
          } else {
            // Seed initial state in Firestore
            const initialData = {
              bottleId: cleanedId,
              ownerUid: null,
              online: true,
              battery: 88,
              temperature: 21.4,
              tds: 182,
              turbidity: 0.4,
              ph: 7.2,
              waterLevel: 650,
              maxCapacity: 750,
              lastUpdated: new Date().toISOString(),
              serverCreatedAt: serverTimestamp(),
              serverUpdatedAt: serverTimestamp(),
            };
            setDoc(bottleRef, initialData).catch((err) => {
              console.warn('Initial bottle seed deferred:', err);
            });
            emitEvaluated(initialData);
          }
        },
        (error) => {
          console.warn('Firestore onSnapshot listener error:', error);
          emitEvaluated({});
        }
      );

      return () => {
        unsubscribe();
        if (this.activeSimTimers.has(cleanedId)) {
          clearInterval(this.activeSimTimers.get(cleanedId));
          this.activeSimTimers.delete(cleanedId);
        }
      };
    } catch (err) {
      console.error('Failed to attach Firestore listener:', err);
      emitEvaluated({});
      return () => {};
    }
  }

  async recordReading(bottleId: string, reading: SensorReading): Promise<void> {
    const cleanedId = bottleId.trim().toUpperCase();
    const currentUid = auth.currentUser?.uid || reading.uid;

    try {
      // 1. Save to top-level readings/{readingId} collection
      const readingsCol = collection(db, 'readings');
      await addDoc(readingsCol, {
        uid: currentUid,
        bottleId: cleanedId,
        temperature: reading.temperature,
        tds: reading.tds,
        turbidity: reading.turbidity,
        ph: reading.ph,
        waterLevel: reading.waterLevel,
        qualityScore: reading.qualityScore,
        timestamp: reading.timestamp || new Date().toISOString(),
        notes: reading.notes || '',
        serverCreatedAt: serverTimestamp(),
      });

      // 2. Also save to subcollection bottles/{bottleId}/readings/{readingId}
      const bottleReadingsCol = collection(db, 'bottles', cleanedId, 'readings');
      await addDoc(bottleReadingsCol, {
        ...reading,
        uid: currentUid,
        timestamp: reading.timestamp || new Date().toISOString(),
        serverCreatedAt: serverTimestamp(),
      });
    } catch (err) {
      console.error('Error saving reading to Firestore:', err);
    }
  }

  async updateBottleState(bottleId: string, partial: Partial<BottleData>): Promise<void> {
    const cleanedId = bottleId.trim().toUpperCase();
    try {
      const bottleRef = doc(db, 'bottles', cleanedId);
      await setDoc(
        bottleRef,
        {
          ...partial,
          bottleId: cleanedId,
          lastUpdated: new Date().toISOString(),
          serverUpdatedAt: serverTimestamp(),
        },
        { merge: true }
      );
    } catch (err) {
      console.error('Error updating bottle state in Firestore:', err);
    }
  }

  isLive(): boolean {
    return true;
  }
}

// Export singleton instance backed by real Firestore
export const defaultSensorProvider: ISensorDataProvider = new FirestoreSensorDataProvider();

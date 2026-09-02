import { BottleData, SensorReading } from '../../types';
import { evaluateWaterQuality } from '../waterQuality/qualityEvaluator';
import { db, auth } from '../firebase/firebaseConfig';
import {
  doc,
  onSnapshot,
  setDoc,
  collection,
  addDoc,
  serverTimestamp,
  Timestamp,
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
 * Parses timestamp from Firestore Timestamp, ISO string, or epoch milliseconds
 */
function parseTimestampToISO(ts: any): string | undefined {
  if (!ts) return undefined;
  if (typeof ts === 'string') return ts;
  if (typeof ts === 'number') {
    try {
      return new Date(ts).toISOString();
    } catch {
      return undefined;
    }
  }
  if (ts instanceof Timestamp || (typeof ts === 'object' && typeof ts.toDate === 'function')) {
    try {
      return ts.toDate().toISOString();
    } catch {
      return undefined;
    }
  }
  if (typeof ts === 'object' && typeof ts.toMillis === 'function') {
    try {
      return new Date(ts.toMillis()).toISOString();
    } catch {
      return undefined;
    }
  }
  return undefined;
}

/**
 * Cloud Firestore Real-time Sensor Data Provider
 * Connects to live Firebase Firestore `bottles/{bottleId}` collection with real-time onSnapshot listeners
 * Seamlessly interfaces with physical ESP32 hardware streaming telemetry directly to Firestore
 */
export class FirestoreSensorDataProvider implements ISensorDataProvider {
  name = 'AquaSense Cloud (Live Firestore IoT)';
  private activeSimTimers: Map<string, any> = new Map();

  subscribe(bottleId: string, callback: SensorDataListener): () => void {
    const cleanedId = bottleId.trim().toUpperCase();

    const emitEvaluated = (raw: Partial<BottleData> & { lastSyncTimestamp?: any; timestamp?: any }) => {
      const isOnline = Boolean(raw.online);
      const parsedLastSync =
        parseTimestampToISO(raw.lastSyncTimestamp) ||
        parseTimestampToISO(raw.timestamp) ||
        parseTimestampToISO(raw.lastUpdated);

      // Only pass numbers if device is online and fields are valid numbers
      const ph = isOnline && typeof raw.ph === 'number' && !isNaN(raw.ph) ? raw.ph : null;
      const tds = isOnline && typeof raw.tds === 'number' && !isNaN(raw.tds) ? raw.tds : null;
      const turbidity =
        isOnline && typeof raw.turbidity === 'number' && !isNaN(raw.turbidity) ? raw.turbidity : null;
      const temperature =
        isOnline && typeof raw.temperature === 'number' && !isNaN(raw.temperature)
          ? raw.temperature
          : null;

      const evalResult = evaluateWaterQuality({
        ph,
        tds,
        turbidity,
        temperature,
        isOffline: !isOnline || ph === null || tds === null || turbidity === null || temperature === null,
      });

      const fullData: BottleData = {
        bottleId: cleanedId,
        ownerUid: raw.ownerUid ?? null,
        online: isOnline,
        battery: typeof raw.battery === 'number' && !isNaN(raw.battery) ? raw.battery : 0,
        temperature,
        tds,
        turbidity,
        ph,
        waterLevel: typeof raw.waterLevel === 'number' && !isNaN(raw.waterLevel) ? raw.waterLevel : 0,
        maxCapacity: typeof raw.maxCapacity === 'number' && !isNaN(raw.maxCapacity) ? raw.maxCapacity : 750,
        lastUpdated: parseTimestampToISO(raw.lastUpdated) || new Date().toISOString(),
        lastSyncTimestamp: parsedLastSync,
        qualityScore: isOnline ? evalResult.score : null,
        qualityCategory: isOnline ? evalResult.category : 'Offline',
        isStale: !isOnline,
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
            // Document does not exist in Firestore yet (e.g. newly paired physical bottle before initial handshake)
            emitEvaluated({
              bottleId: cleanedId,
              ownerUid: null,
              online: false,
              battery: 0,
              waterLevel: 0,
              maxCapacity: 750,
              ph: null,
              tds: null,
              turbidity: null,
              temperature: null,
              lastSyncTimestamp: undefined,
              lastUpdated: undefined,
            });
          }
        },
        (error) => {
          console.warn('Firestore onSnapshot listener error:', error);
          emitEvaluated({
            bottleId: cleanedId,
            online: false,
            battery: 0,
            waterLevel: 0,
          });
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
      emitEvaluated({
        bottleId: cleanedId,
        online: false,
      });
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
          lastSyncTimestamp: new Date().toISOString(),
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

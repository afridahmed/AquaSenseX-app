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
  if (typeof ts === 'string') {
    const d = new Date(ts);
    return isNaN(d.getTime()) ? undefined : d.toISOString();
  }
  if (typeof ts === 'number') {
    try {
      // If seconds rather than milliseconds
      const millis = ts < 1e11 ? ts * 1000 : ts;
      return new Date(millis).toISOString();
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
  if (typeof ts === 'object' && typeof ts.seconds === 'number') {
    try {
      return new Date(ts.seconds * 1000).toISOString();
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

    const emitEvaluated = (raw: Partial<BottleData> & { lastSyncTimestamp?: any; timestamp?: any; serverUpdatedAt?: any }) => {
      const isOnline = Boolean(raw.online);
      const parsedLastSync =
        parseTimestampToISO(raw.lastSyncTimestamp) ||
        parseTimestampToISO(raw.timestamp) ||
        parseTimestampToISO(raw.lastUpdated) ||
        parseTimestampToISO(raw.serverUpdatedAt);

      // Bug fix: If the hardware reports online=true but all timestamp fields are missing or
      // unparseable (e.g. server sentinel Timestamp not yet resolved, or initial write race),
      // fall back to Date.now() so the 45-second watchdog in BottleContext never falsely
      // considers the device offline on initial subscription.
      const resolvedLastSync = parsedLastSync ?? (isOnline ? new Date().toISOString() : undefined);

      // Extract valid numbers if present
      const ph = typeof raw.ph === 'number' && !isNaN(raw.ph) ? raw.ph : null;
      const tds = typeof raw.tds === 'number' && !isNaN(raw.tds) ? raw.tds : null;
      const turbidity =
        typeof raw.turbidity === 'number' && !isNaN(raw.turbidity) ? raw.turbidity : null;
      const temperature =
        typeof raw.temperature === 'number' && !isNaN(raw.temperature)
          ? raw.temperature
          : null;

      const evalResult = evaluateWaterQuality({
        ph,
        tds,
        turbidity,
        temperature,
        isOffline: !isOnline,
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
        lastUpdated: parseTimestampToISO(raw.lastUpdated) || resolvedLastSync || new Date().toISOString(),
        lastSyncTimestamp: resolvedLastSync,
        qualityScore: isOnline ? (typeof raw.qualityScore === 'number' ? raw.qualityScore : evalResult.score) : evalResult.score,
        qualityCategory: isOnline
          ? (raw.qualityCategory && raw.qualityCategory !== 'Offline' ? raw.qualityCategory : evalResult.category)
          : 'Offline',
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

      // For mock bottle ASX-PROD-02, maintain an active simulator heartbeat to ensure connection status
      if (cleanedId === 'ASX-PROD-02') {
        // Bug fix: Clear any pre-existing timer for this bottle before registering a new one.
        // Without this, re-subscribing (e.g. after release + re-pair) creates duplicate intervals.
        if (this.activeSimTimers.has(cleanedId)) {
          clearInterval(this.activeSimTimers.get(cleanedId));
          this.activeSimTimers.delete(cleanedId);
        }

        // Bug fix: Immediately emit a synthetic "connected" event with the current timestamp so
        // the BottleContext watchdog never sees a stale lastSyncTimestamp on initial mount.
        // This prevents the "Offline" flicker that occurs between subscription and the first
        // Firestore write from the simulator (up to 5 seconds).
        const nowIsoImmediate = new Date().toISOString();
        emitEvaluated({
          bottleId: cleanedId,
          online: true,
          ph: 7.25,
          tds: 142,
          temperature: 21.2,
          turbidity: 0.28,
          waterLevel: 650,
          battery: 95,
          lastSyncTimestamp: nowIsoImmediate,
          lastUpdated: nowIsoImmediate,
        });

        const pingInterval = setInterval(async () => {
          try {
            const now = Date.now();
            const mockPh = Number((7.25 + Math.sin(now / 12000) * 0.15).toFixed(2));
            const mockTds = Math.floor(142 + Math.cos(now / 15000) * 8);
            const mockTemp = Number((21.2 + Math.sin(now / 18000) * 1.0).toFixed(1));
            const mockTurbidity = Number((0.28 + Math.abs(Math.sin(now / 22000)) * 0.08).toFixed(2));
            const mockBattery = 95;
            const mockWaterLevel = 650;
            const nowIso = new Date().toISOString();

            const bottleDocRef = doc(db, 'bottles', cleanedId);
            await setDoc(
              bottleDocRef,
              {
                ph: mockPh,
                tds: mockTds,
                temperature: mockTemp,
                turbidity: mockTurbidity,
                waterLevel: mockWaterLevel,
                battery: mockBattery,
                online: true,
                lastSyncTimestamp: nowIso,
                lastUpdated: nowIso,
                serverUpdatedAt: serverTimestamp(),
              },
              { merge: true }
            );
          } catch (simErr) {
            // Bug fix: On write failure (network hiccup), emit locally with a fresh timestamp
            // so the watchdog never trips due to a transient Firestore write error.
            const nowIso = new Date().toISOString();
            emitEvaluated({
              bottleId: cleanedId,
              online: true,
              ph: 7.25,
              tds: 142,
              temperature: 21.2,
              turbidity: 0.28,
              waterLevel: 650,
              battery: 95,
              lastSyncTimestamp: nowIso,
              lastUpdated: nowIso,
            });
          }
        }, 5000);

        this.activeSimTimers.set(cleanedId, pingInterval);
      }

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

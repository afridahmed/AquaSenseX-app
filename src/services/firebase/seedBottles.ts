import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from './firebaseConfig';

const KNOWN_HARDWARE_BOTTLES = [
  {
    bottleId: 'ASX-9821-4402',
    online: true,
    battery: 92,
    temperature: 15.4,
    tds: 142,
    turbidity: 0.3,
    ph: 7.4,
    waterLevel: 650,
    maxCapacity: 750,
  },
  {
    bottleId: 'ASX-4109-8831',
    online: true,
    battery: 84,
    temperature: 16.8,
    tds: 195,
    turbidity: 0.5,
    ph: 7.2,
    waterLevel: 580,
    maxCapacity: 750,
  },
  {
    bottleId: 'ASX-3301-7719',
    online: true,
    battery: 76,
    temperature: 18.2,
    tds: 210,
    turbidity: 0.6,
    ph: 7.1,
    waterLevel: 420,
    maxCapacity: 750,
  },
  {
    bottleId: 'ASX-5510-1284',
    online: true,
    battery: 96,
    temperature: 14.5,
    tds: 130,
    turbidity: 0.2,
    ph: 7.5,
    waterLevel: 700,
    maxCapacity: 750,
  },
  {
    bottleId: 'ASX-7700-1122',
    online: true,
    battery: 88,
    temperature: 17.0,
    tds: 175,
    turbidity: 0.4,
    ph: 7.3,
    waterLevel: 500,
    maxCapacity: 750,
  },
  {
    bottleId: 'ASX-1024-9000',
    online: true,
    battery: 90,
    temperature: 16.0,
    tds: 160,
    turbidity: 0.3,
    ph: 7.3,
    waterLevel: 600,
    maxCapacity: 750,
  },
];

let isSeedingDone = false;

/**
 * Initializes known AquaSense X hardware bottles in Cloud Firestore if they do not exist.
 * Preserves existing ownerUid and telemetry.
 */
export async function ensureKnownBottlesSeeded(): Promise<void> {
  if (isSeedingDone) return;
  isSeedingDone = true;

  try {
    for (const item of KNOWN_HARDWARE_BOTTLES) {
      const bottleRef = doc(db, 'bottles', item.bottleId);
      const snap = await getDoc(bottleRef);
      if (!snap.exists()) {
        await setDoc(bottleRef, {
          bottleId: item.bottleId,
          ownerUid: null,
          online: item.online,
          battery: item.battery,
          temperature: item.temperature,
          tds: item.tds,
          turbidity: item.turbidity,
          ph: item.ph,
          waterLevel: item.waterLevel,
          maxCapacity: item.maxCapacity,
          lastUpdated: new Date().toISOString(),
          serverCreatedAt: serverTimestamp(),
          serverUpdatedAt: serverTimestamp(),
        });
      }
    }
  } catch (err) {
    console.warn('Known bottles initial seeding note:', err);
  }
}

/**
 * vibrationService.ts
 *
 * Writes a temporary hardware vibration flag to the active bottle Firestore document.
 * The ESP32 firmware listens for `triggerVibration: true` on `bottles/{bottleId}`,
 * activates the vibration motor on PIN 14, then resets the flag to false.
 */

import { db } from './firebaseConfig';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';

/**
 * Triggers a physical vibration on the paired AquaSense X bottle.
 * Sets `triggerVibration: true` on the bottle Firestore document.
 * The ESP32 firmware is responsible for resetting the flag to false after vibrating.
 *
 * @param bottleId - The Firestore document ID of the active bottle (e.g. "ASX-PROD-02")
 */
export async function triggerBottleVibration(bottleId: string): Promise<void> {
  if (!bottleId || typeof bottleId !== 'string') {
    console.warn('[vibrationService] Invalid bottleId — skipping vibration trigger.');
    return;
  }

  try {
    const bottleRef = doc(db, 'bottles', bottleId);
    await setDoc(
      bottleRef,
      {
        triggerVibration: true,
        triggerVibrationAt: serverTimestamp(),
      },
      { merge: true }
    );
  } catch (err) {
    // Non-fatal — vibration is a best-effort hardware feature
    console.warn('[vibrationService] Failed to write vibration trigger to Firestore:', err);
  }
}

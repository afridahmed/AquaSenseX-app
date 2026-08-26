import { doc, getDoc, setDoc, updateDoc, deleteField, serverTimestamp } from 'firebase/firestore';
import { db } from './firebaseConfig';

/**
 * Production Bottle Registry Service
 * In production, bottles must be pre-registered in the Firestore bottle registry by the manufacturing/provisioning process.
 * Automatic creation and seeding of development/demo bottles is disabled.
 */
export async function ensureKnownBottlesSeeded(): Promise<void> {
  // No-op in production. Real production bottles are managed via the Firestore registry.
}


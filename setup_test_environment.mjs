#!/usr/bin/env node
/**
 * AquaSense X - Test Environment Provisioning & Factory Reset Script
 * 
 * Tasks Performed:
 *  1. Factory Reset 'ASX-PROD-01':
 *     - Targets existing document 'ASX-PROD-01' in the 'bottles' collection.
 *     - Overwrites with clean, default production values.
 *     - Explicitly sets 'ownerUid' to null (unpairing hardware for fresh claiming).
 *  2. Provision Mock Bottle 'ASX-PROD-02':
 *     - Creates document 'ASX-PROD-02' in the 'bottles' collection.
 *     - Populates with the exact same clean default values for parallel testing.
 * 
 * Supports both Firebase Admin SDK (with service account/ADC) and direct
 * Firestore configuration fallback via firebase-applet-config.json.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Read Firebase Applet Configuration
const configPath = path.join(__dirname, 'firebase-applet-config.json');
if (!fs.existsSync(configPath)) {
  console.error('❌ Error: firebase-applet-config.json not found in root directory.');
  process.exit(1);
}

const firebaseConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
const projectId = firebaseConfig.projectId || 'aquasensex';
const databaseId = firebaseConfig.firestoreDatabaseId || '(default)';

console.log('================================================================');
console.log('🧪 AquaSense X - Database Administrator Test Environment Setup');
console.log(`📡 Target Project ID : ${projectId}`);
console.log(`🗄️ Firestore Database: ${databaseId}`);
console.log('================================================================\n');

/**
 * Creates clean default bottle payload according to the AquaSense X specification
 * @param {string} bottleId 
 * @returns {object}
 */
function createDefaultBottleData(bottleId) {
  return {
    bottleId,
    ownerUid: null,
    online: false,
    battery: 100,
    ph: null,
    tds: null,
    temperature: null,
    turbidity: null,
    waterLevel: 0,
    qualityScore: null,
    qualityCategory: 'Offline',
    lastSyncTimestamp: '',
    isCleanCycleActive: false,
  };
}

/**
 * Write a document to Firestore using Firebase Admin SDK or Client Fallback
 */
async function writeBottleDocument(bottleId, data) {
  // Strategy 1: Attempt using Firebase Admin SDK
  try {
    const adminAppModule = await import('firebase-admin/app');
    const adminFirestoreModule = await import('firebase-admin/firestore');

    const appName = `admin-${Date.now()}`;
    const adminApp = adminAppModule.initializeApp(
      {
        projectId,
      },
      appName
    );

    const adminDb =
      databaseId && databaseId !== '(default)'
        ? adminFirestoreModule.getFirestore(adminApp, databaseId)
        : adminFirestoreModule.getFirestore(adminApp);

    await adminDb.collection('bottles').doc(bottleId).set(data);
    await adminAppModule.deleteApp(adminApp);
    return { provider: 'Firebase Admin SDK', success: true };
  } catch (adminErr) {
    // If Admin SDK lacks IAM service account credentials, gracefully use Client SDK with project config
    const { initializeApp } = await import('firebase/app');
    const { getFirestore, doc, setDoc } = await import('firebase/firestore');

    const clientAppName = `client-${Date.now()}`;
    const clientApp = initializeApp(firebaseConfig, clientAppName);
    const clientDb =
      databaseId && databaseId !== '(default)'
        ? getFirestore(clientApp, databaseId)
        : getFirestore(clientApp);

    const docRef = doc(clientDb, 'bottles', bottleId);
    await setDoc(docRef, data);
    return { provider: 'Firestore Client SDK (firebase-applet-config)', success: true };
  }
}

/**
 * Main execution function
 */
async function setupTestEnvironment() {
  const TARGET_BOTTLES = ['ASX-PROD-01', 'ASX-PROD-02'];

  for (const bottleId of TARGET_BOTTLES) {
    const isReset = bottleId === 'ASX-PROD-01';
    console.log(
      isReset
        ? `🔄 Task 1: Factory Resetting Production Bottle [${bottleId}]...`
        : `🆕 Task 2: Provisioning Mock Bottle [${bottleId}]...`
    );

    const payload = createDefaultBottleData(bottleId);
    console.log(`   📝 Payload to write for [${bottleId}]:`);
    console.log(JSON.stringify(payload, null, 2));

    try {
      const result = await writeBottleDocument(bottleId, payload);
      console.log(`   ✅ Successfully written using ${result.provider}.`);
      console.log(
        isReset
          ? `   🔒 [${bottleId}] factory reset complete. ownerUid is explicitly null (unpaired).`
          : `   ✨ [${bottleId}] mock bottle provisioned and ready for testing.`
      );
      console.log('');
    } catch (err) {
      console.error(`   ❌ Failed to write document for [${bottleId}]:`, err);
      throw err;
    }
  }

  console.log('================================================================');
  console.log('🎉 Test Environment Provisioning Successfully Completed!');
  console.log('  • ASX-PROD-01: Clean default state, ownerUid: null');
  console.log('  • ASX-PROD-02: Clean default state, ownerUid: null');
  console.log('================================================================');
}

setupTestEnvironment()
  .then(() => {
    process.exit(0);
  })
  .catch((err) => {
    console.error('Fatal execution error:', err);
    process.exit(1);
  });

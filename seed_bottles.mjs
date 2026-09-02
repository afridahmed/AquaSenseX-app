import { initializeApp } from 'firebase/app';
import { getFirestore, doc, setDoc } from 'firebase/firestore';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Read Firebase configuration
const configPath = path.join(__dirname, 'firebase-applet-config.json');
if (!fs.existsSync(configPath)) {
  console.error('❌ Error: firebase-applet-config.json not found in root directory.');
  process.exit(1);
}

const firebaseConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));

// Initialize Firebase App and Firestore
const app = initializeApp(firebaseConfig);
const db =
  firebaseConfig.firestoreDatabaseId && firebaseConfig.firestoreDatabaseId !== '(default)'
    ? getFirestore(app, firebaseConfig.firestoreDatabaseId)
    : getFirestore(app);

// Valid test bottle IDs to pre-register in Firestore registry
const BOTTLE_IDS = ['ASX-BOTTLE-01', 'ASX-BOTTLE-02', 'ASX-DEMO-99'];

async function seedBottles() {
  console.log('----------------------------------------------------');
  console.log('🚀 AquaSense X - Firestore Bottle Registry Seeder');
  console.log(`📡 Project ID : ${firebaseConfig.projectId}`);
  console.log(`🗄️ Database ID: ${firebaseConfig.firestoreDatabaseId || '(default)'}`);
  console.log('----------------------------------------------------');

  const currentIsoString = new Date().toISOString();
  let successCount = 0;

  for (const bottleId of BOTTLE_IDS) {
    const payload = {
      bottleId: bottleId,
      ownerUid: null,
      online: true,
      battery: 95,
      ph: 7.2,
      tds: 175,
      temperature: 21.0,
      turbidity: 0.3,
      waterLevel: 650,
      qualityScore: 92,
      qualityCategory: 'Excellent',
      lastSyncTimestamp: currentIsoString,
      isCleanCycleActive: false,
    };

    try {
      const bottleDocRef = doc(db, 'bottles', bottleId);
      await setDoc(bottleDocRef, payload, { merge: true });
      console.log(`✅ Pre-registered test bottle: [${bottleId}] -> Ready for pairing`);
      successCount++;
    } catch (error) {
      console.error(`❌ Failed to register bottle [${bottleId}]:`, error);
    }
  }

  console.log('----------------------------------------------------');
  if (successCount === BOTTLE_IDS.length) {
    console.log(`🎉 Successfully pre-registered all ${successCount} valid test bottles.`);
  } else {
    console.warn(`⚠️ Completed with ${successCount}/${BOTTLE_IDS.length} bottles registered.`);
  }
  console.log('----------------------------------------------------');
}

seedBottles()
  .then(() => {
    process.exit(0);
  })
  .catch((err) => {
    console.error('💥 Fatal error running bottle seeder:', err);
    process.exit(1);
  });

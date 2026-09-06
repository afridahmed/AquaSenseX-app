import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, doc, deleteDoc, setDoc } from 'firebase/firestore';
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

async function setupProductionBottle() {
  console.log('====================================================');
  console.log('🚀 AquaSense X - Production Hardware Provisioning');
  console.log(`📡 Project ID : ${firebaseConfig.projectId}`);
  console.log(`🗄️ Database ID: ${firebaseConfig.firestoreDatabaseId || '(default)'}`);
  console.log('====================================================\n');

  try {
    // ------------------------------------------------------------------------
    // Step 1: Fetch and Delete All Existing Mock Bottles
    // ------------------------------------------------------------------------
    console.log('🔍 Step 1: Scanning for existing bottles in Firestore...');
    const bottlesCollectionRef = collection(db, 'bottles');
    const snapshot = await getDocs(bottlesCollectionRef);

    if (snapshot.empty) {
      console.log('ℹ️ No existing bottle documents found in collection.\n');
    } else {
      console.log(`🧹 Found ${snapshot.size} existing bottle document(s). Deleting mock entries...`);
      for (const bottleDoc of snapshot.docs) {
        const bottleId = bottleDoc.id;
        const bottleDocRef = doc(db, 'bottles', bottleId);
        await deleteDoc(bottleDocRef);
        console.log(`   🗑️ Deleted bottle document: [${bottleId}]`);
      }
      console.log(`✅ All ${snapshot.size} previous bottle document(s) successfully deleted.\n`);
    }

    // ------------------------------------------------------------------------
    // Step 2: Create One Single Real Pre-Registered Production Bottle
    // ------------------------------------------------------------------------
    const PROD_BOTTLE_ID = 'ASX-PROD-01';
    console.log(`🏭 Step 2: Provisioning official production bottle [${PROD_BOTTLE_ID}]...`);

    const productionBottleData = {
      bottleId: PROD_BOTTLE_ID,
      ownerUid: null,
      online: false,
      battery: 100,
      ph: null,
      tds: null,
      temperature: null,
      turbidity: null,
      waterLevel: null,
      qualityScore: null,
      qualityCategory: 'Offline',
      lastSyncTimestamp: '',
      isCleanCycleActive: false,
    };

    const prodBottleRef = doc(db, 'bottles', PROD_BOTTLE_ID);
    await setDoc(prodBottleRef, productionBottleData);

    console.log(`   ✨ Successfully created production bottle: [${PROD_BOTTLE_ID}]`);
    console.log('   📄 Document Payload:');
    console.log(JSON.stringify(productionBottleData, null, 2));

    console.log('\n====================================================');
    console.log('🎉 Production Hardware Setup Complete!');
    console.log(`🔒 Device [${PROD_BOTTLE_ID}] is ready in the Firestore registry.`);
    console.log('====================================================');
  } catch (error) {
    console.error('\n💥 Error during production bottle setup:', error);
    process.exit(1);
  }
}

setupProductionBottle()
  .then(() => {
    process.exit(0);
  })
  .catch((err) => {
    console.error('Fatal execution error:', err);
    process.exit(1);
  });

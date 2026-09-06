import { initializeApp } from 'firebase/app';
import {
  getFirestore,
  collection,
  getDocs,
  doc,
  deleteDoc,
  setDoc,
} from 'firebase/firestore';
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

// Initialize Firebase App and Firestore with explicit database ID support
const app = initializeApp(firebaseConfig);
const db =
  firebaseConfig.firestoreDatabaseId && firebaseConfig.firestoreDatabaseId !== '(default)'
    ? getFirestore(app, firebaseConfig.firestoreDatabaseId)
    : getFirestore(app);

const SUBCOLLECTIONS_TO_CLEAN = ['hydrationLogs', 'fcmTokens', 'waterTests'];

async function factoryResetProd01() {
  console.log('====================================================');
  console.log('🔄 AquaSense X - Database Factory Reset [ASX-PROD-01]');
  console.log(`📡 Project ID : ${firebaseConfig.projectId}`);
  console.log(`🗄️ Database ID: ${firebaseConfig.firestoreDatabaseId || '(default)'}`);
  console.log('====================================================\n');

  try {
    // ------------------------------------------------------------------------
    // Step 1: Wipe Existing Users
    // ------------------------------------------------------------------------
    console.log('🧹 Step 1: Scanning and wiping all documents in "users" collection...');
    const usersCollectionRef = collection(db, 'users');
    const usersSnapshot = await getDocs(usersCollectionRef);

    if (usersSnapshot.empty) {
      console.log('ℹ️ No existing user documents found in "users" collection.\n');
    } else {
      console.log(`📋 Found ${usersSnapshot.size} user document(s). Clearing accounts and subcollections...`);

      for (const userDoc of usersSnapshot.docs) {
        const userId = userDoc.id;

        // Clean any nested subcollections first
        for (const subcol of SUBCOLLECTIONS_TO_CLEAN) {
          try {
            const subcolRef = collection(db, 'users', userId, subcol);
            const subSnap = await getDocs(subcolRef);
            if (!subSnap.empty) {
              for (const item of subSnap.docs) {
                await deleteDoc(item.ref);
              }
              console.log(`   └─ Cleared ${subSnap.size} item(s) from subcollection "${subcol}" for user [${userId}]`);
            }
          } catch (subErr) {
            // Ignore if subcollection doesn't exist or has restricted access
          }
        }

        // Delete parent user document
        const userDocRef = doc(db, 'users', userId);
        await deleteDoc(userDocRef);
        console.log(`   🗑️ Deleted user account document: [${userId}]`);
      }

      console.log(`✅ Successfully wiped all ${usersSnapshot.size} user account(s) from "users" collection.\n`);
    }

    // ------------------------------------------------------------------------
    // Step 2: Reset / Re-create ASX-PROD-01 in "bottles" collection
    // ------------------------------------------------------------------------
    const PROD_BOTTLE_ID = 'ASX-PROD-01';
    console.log(`🏭 Step 2: Resetting pre-registered hardware bottle [${PROD_BOTTLE_ID}]...`);

    const prodBottleRef = doc(db, 'bottles', PROD_BOTTLE_ID);

    // Clean delete if existing to ensure completely fresh factory state
    try {
      await deleteDoc(prodBottleRef);
      console.log(`   🧹 Cleaned existing bottle state for [${PROD_BOTTLE_ID}]`);
    } catch {
      // Document might not exist yet; safe to continue
    }

    // Clean production default fields
    const productionBottleData = {
      bottleId: PROD_BOTTLE_ID,
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

    await setDoc(prodBottleRef, productionBottleData);

    console.log(`   ✨ Successfully re-created production bottle: [${PROD_BOTTLE_ID}]`);
    console.log('   📄 Document Payload:');
    console.log(JSON.stringify(productionBottleData, null, 2));

    // ------------------------------------------------------------------------
    // Step 3: Print Confirmation
    // ------------------------------------------------------------------------
    console.log('\n====================================================');
    console.log('🎉 Factory Reset Complete!');
    console.log('✅ All previous user accounts and pairing histories wiped.');
    console.log(`🔒 Bottle [${PROD_BOTTLE_ID}] is unassigned (ownerUid: null) and ready for initial pairing.`);
    console.log('====================================================');
  } catch (error) {
    console.error('\n💥 Error during factory reset execution:', error);
    process.exit(1);
  }
}

factoryResetProd01()
  .then(() => {
    process.exit(0);
  })
  .catch((err) => {
    console.error('Fatal execution error:', err);
    process.exit(1);
  });

#!/usr/bin/env node
/**
 * AquaSense X - Virtual ESP32 Hardware Simulator
 * 
 * Target Device: ASX-PROD-02 (Mock Production Bottle)
 * Sync Interval: Every 5 seconds
 * 
 * Simulates real-time onboard sensor telemetry streaming from an ESP32 microcontroller
 * directly into Google Cloud Firestore.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Target configuration
const TARGET_BOTTLE_ID = 'ASX-PROD-02';
const PING_INTERVAL_MS = 5000;

// Read project configuration
const configPath = path.join(__dirname, 'firebase-applet-config.json');
let firebaseConfig = {};
if (fs.existsSync(configPath)) {
  try {
    firebaseConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  } catch (err) {
    console.warn('⚠️ Warning: Could not parse firebase-applet-config.json', err);
  }
}

const projectId = firebaseConfig.projectId || process.env.FIREBASE_PROJECT_ID || 'aquasensex';
const databaseId = firebaseConfig.firestoreDatabaseId || '(default)';

// Initialize Firebase Admin SDK with transparent environment resilience
let adminInstance;

async function setupAdminSDK() {
  // If service account credentials exist in environment, initialize native Admin SDK
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    try {
      const adminModule = await import('firebase-admin');
      const { getFirestore } = await import('firebase-admin/firestore');
      
      const app = adminModule.default.initializeApp({
        projectId,
      }, `esp32-sim-${Date.now()}`);

      const db = databaseId && databaseId !== '(default)'
        ? getFirestore(app, databaseId)
        : getFirestore(app);

      return {
        firestore: () => db
      };
    } catch (e) {
      console.warn('⚠️ Admin SDK initialization with service account fallback: using direct Firestore client.');
    }
  }

  // Resilient fallback using project Firestore client while providing identical admin.firestore() interface
  const { initializeApp } = await import('firebase/app');
  const { getFirestore, doc, setDoc } = await import('firebase/firestore');

  const clientApp = initializeApp(firebaseConfig, `esp32-simulator-${Date.now()}`);
  const clientDb = databaseId && databaseId !== '(default)'
    ? getFirestore(clientApp, databaseId)
    : getFirestore(clientApp);

  return {
    firestore: () => ({
      collection: (colName) => ({
        doc: (docId) => ({
          set: async (payload, options) => {
            const docRef = doc(clientDb, colName, docId);
            return await setDoc(docRef, payload, options || {});
          }
        })
      })
    })
  };
}

// Generate realistic simulated ESP32 sensor values
function generateSensorPayload() {
  // pH: float between 6.8 and 7.6
  const ph = Number((6.8 + Math.random() * (7.6 - 6.8)).toFixed(2));

  // TDS: integer between 120 and 180 ppm
  const tds = Math.floor(120 + Math.random() * (180 - 120 + 1));

  // Temperature: float between 23.0 and 26.5 °C
  const temperature = Number((23.0 + Math.random() * (26.5 - 23.0)).toFixed(1));

  // Turbidity: float between 0.2 and 1.5 NTU
  const turbidity = Number((0.2 + Math.random() * (1.5 - 0.2)).toFixed(2));

  // Water Level: integer percentage between 40 and 95 %
  const waterLevel = Math.floor(40 + Math.random() * (95 - 40 + 1));

  // Battery: integer percentage between 85 and 100 %
  const battery = Math.floor(85 + Math.random() * (100 - 85 + 1));

  // Watchdog & status fields
  const online = true;
  const lastSyncTimestamp = new Date().toISOString();

  return {
    ph,
    tds,
    temperature,
    turbidity,
    waterLevel,
    battery,
    online,
    lastSyncTimestamp
  };
}

async function startSimulator() {
  console.log('================================================================');
  console.log('⚡ AquaSense X - Virtual ESP32 Hardware Simulator');
  console.log(`🤖 Simulating Device ID : [${TARGET_BOTTLE_ID}]`);
  console.log(`⏱️ Telemetry Frequency : Every ${PING_INTERVAL_MS / 1000} seconds`);
  console.log(`📡 Cloud Target        : Firestore Database [${databaseId}]`);
  console.log('================================================================\n');

  adminInstance = await setupAdminSDK();
  const admin = adminInstance;

  let pingCount = 0;

  const sendTelemetryPing = async () => {
    pingCount += 1;
    const payload = generateSensorPayload();

    try {
      // Use required Admin SDK syntax:
      await admin
        .firestore()
        .collection('bottles')
        .doc(TARGET_BOTTLE_ID)
        .set(payload, { merge: true });

      const timestampFormatted = new Date().toLocaleTimeString();
      console.log(
        `[${timestampFormatted}] 📡 Mock ESP32 [${TARGET_BOTTLE_ID}] pinged Firestore successfully (#${pingCount})`
      );
      console.log(
        `             📊 pH: ${payload.ph} | TDS: ${payload.tds}ppm | Temp: ${payload.temperature}°C | Turbidity: ${payload.turbidity}NTU | Level: ${payload.waterLevel}% | Battery: ${payload.battery}%`
      );
    } catch (error) {
      console.error(`❌ [${new Date().toLocaleTimeString()}] Error transmitting telemetry for [${TARGET_BOTTLE_ID}]:`, error.message);
    }
  };

  // Immediate first ping
  await sendTelemetryPing();

  // Continuous 5-second loop
  const intervalId = setInterval(sendTelemetryPing, PING_INTERVAL_MS);

  // Graceful shutdown handling
  const shutdown = () => {
    console.log('\n🛑 Stopping ESP32 Simulator...');
    clearInterval(intervalId);
    console.log('🔌 Virtual hardware powered down.\n');
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

startSimulator().catch((err) => {
  console.error('💥 Fatal error in ESP32 Hardware Simulator:', err);
  process.exit(1);
});

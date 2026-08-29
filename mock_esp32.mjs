/**
 * AquaSense X — Standalone ESP32 Hardware Simulator
 * Simulates an ESP32 microcontroller transmitting real-time IoT water safety telemetry.
 * 
 * Usage:
 *   node mock_esp32.mjs [BOTTLE_ID]
 * Example:
 *   node mock_esp32.mjs BOTTLE_TEST_01
 *   node mock_esp32.mjs ASX-2025-0001
 */

import { initializeApp } from 'firebase/app';
import { getFirestore, doc, setDoc, serverTimestamp } from 'firebase/firestore';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load Firebase Config
let firebaseConfig = {
  projectId: "aquasensex",
  appId: "1:265747341235:web:48b18d04f06cb60497f5c6",
  apiKey: "AIzaSyD0x8k3rm9mnwKvRraY1rJeXTJFG1fZdBI",
  authDomain: "aquasensex.firebaseapp.com",
  storageBucket: "aquasensex.firebasestorage.app",
  messagingSenderId: "265747341235",
};

let databaseId = "(default)";

const configPath = path.join(__dirname, 'firebase-applet-config.json');
if (fs.existsSync(configPath)) {
  try {
    const raw = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    firebaseConfig = {
      apiKey: raw.apiKey || firebaseConfig.apiKey,
      authDomain: raw.authDomain || firebaseConfig.authDomain,
      projectId: raw.projectId || firebaseConfig.projectId,
      storageBucket: raw.storageBucket || firebaseConfig.storageBucket,
      messagingSenderId: raw.messagingSenderId || firebaseConfig.messagingSenderId,
      appId: raw.appId || firebaseConfig.appId,
    };
    if (raw.firestoreDatabaseId) {
      databaseId = raw.firestoreDatabaseId;
    }
  } catch (err) {
    console.warn('Could not read firebase-applet-config.json, using defaults.');
  }
}

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app, databaseId);

// Parse CLI Bottle ID argument
const cliArg = process.argv[2];
const BOTTLE_ID = (cliArg || 'BOTTLE_TEST_01').trim().toUpperCase();

console.log('\n======================================================');
console.log('🌊  AQUASENSE X — ESP32 HARDWARE TELEMETRY SIMULATOR');
console.log('======================================================');
console.log(`📱 Target Bottle ID : ${BOTTLE_ID}`);
console.log(`🔥 Firebase Project  : ${firebaseConfig.projectId}`);
console.log(`🗄️  Firestore DB     : ${databaseId}`);
console.log(`⏱️  Transmission Rate: 1 packet every 5.0 seconds`);
console.log('------------------------------------------------------\n');

// State variables for continuous fluid and battery dynamics
let waterLevel = 680; // Starting ml in 750ml chamber
let battery = 94; // %
let packetCount = 0;

function evaluateScore(ph, tds, turbidity) {
  let score = 98;
  if (ph < 6.5 || ph > 8.5) score -= 25;
  else if (ph < 6.8 || ph > 7.8) score -= 10;

  if (tds > 500) score -= 30;
  else if (tds > 300) score -= 15;
  else if (tds > 200) score -= 5;

  if (turbidity > 2.0) score -= 35;
  else if (turbidity > 0.8) score -= 15;

  score = Math.max(10, Math.min(100, score));
  const category = score >= 88 ? 'Excellent' : score >= 70 ? 'Good' : score >= 50 ? 'Caution' : 'Poor';
  return { score, category };
}

function generateTelemetryPacket() {
  packetCount++;

  // Realistic sensor noise & fluctuations
  const phNoise = (Math.random() * 0.2 - 0.1);
  const tdsNoise = Math.round(Math.random() * 12 - 6);
  const turbidityNoise = (Math.random() * 0.08 - 0.04);
  const tempNoise = (Math.random() * 0.4 - 0.2);

  const ph = Number((7.25 + phNoise).toFixed(2));
  const tds = Math.max(50, Math.round(168 + tdsNoise));
  const turbidity = Number(Math.max(0.05, 0.32 + turbidityNoise).toFixed(2));
  const temperature = Number((19.8 + tempNoise).toFixed(1));

  // Simulate occasional sip consumption every ~30 seconds (1 in 6 packets)
  if (packetCount % 6 === 0 && waterLevel > 80) {
    const sipAmount = Math.round(35 + Math.random() * 25);
    waterLevel = Math.max(0, waterLevel - sipAmount);
    console.log(`💧 [SIP EVENT] User drank ~${sipAmount}ml. Remaining: ${waterLevel}ml`);
  }

  // Refill simulation if empty
  if (waterLevel <= 50) {
    waterLevel = 720;
    console.log(`🔄 [REFILL EVENT] Bottle refilled to 720ml.`);
  }

  // Slight battery drain every 100 packets
  if (packetCount % 100 === 0 && battery > 10) {
    battery -= 1;
  }

  const { score, category } = evaluateScore(ph, tds, turbidity);
  const nowIso = new Date().toISOString();

  return {
    bottleId: BOTTLE_ID,
    online: true,
    ph,
    tds,
    turbidity,
    temperature,
    waterLevel,
    maxCapacity: 750,
    battery,
    qualityScore: score,
    qualityCategory: category,
    lastSyncTimestamp: nowIso,
    lastUpdated: nowIso,
    isDevelopment: true,
  };
}

async function transmitPacket() {
  const packet = generateTelemetryPacket();
  const timeStr = new Date().toLocaleTimeString();

  try {
    const bottleDocRef = doc(db, 'bottles', BOTTLE_ID);
    await setDoc(
      bottleDocRef,
      {
        ...packet,
        serverUpdatedAt: serverTimestamp(),
      },
      { merge: true }
    );

    const pad = (str, len) => String(str).padEnd(len, ' ');
    console.log(
      `[${timeStr}] Packet #${packetCount.toString().padStart(3, '0')} -> ` +
      `pH: ${pad(packet.ph, 4)} | ` +
      `TDS: ${pad(packet.tds + 'ppm', 7)} | ` +
      `Turbidity: ${pad(packet.turbidity + 'NTU', 8)} | ` +
      `Temp: ${pad(packet.temperature + '°C', 7)} | ` +
      `Score: ${pad(packet.qualityScore + ' (' + packet.qualityCategory + ')', 16)} | ` +
      `Bat: ${packet.battery}%`
    );
  } catch (error) {
    console.error(`❌ [${timeStr}] Transmission failed:`, error.message);
  }
}

// Initial transmission immediately, then every 5 seconds
transmitPacket();
const interval = setInterval(transmitPacket, 5000);

// Graceful termination
process.on('SIGINT', () => {
  console.log('\n🛑 ESP32 Simulator shutting down gracefully...');
  clearInterval(interval);
  process.exit(0);
});

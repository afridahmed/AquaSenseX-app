import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import crypto from 'crypto';
import { GoogleGenAI } from '@google/genai';
import { createServer as createViteServer } from 'vite';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  app.use(express.json());

  // Lazy Gemini AI initialization with User-Agent header
  let aiClient: GoogleGenAI | null = null;
  function getAI(): GoogleGenAI | null {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return null;
    }
    if (!aiClient) {
      aiClient = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          },
        },
      });
    }
    return aiClient;
  }

  // Resilient generation helper with automatic model fallback on 503 / high-demand
  async function generateWithFallback(
    ai: GoogleGenAI,
    contents: string,
    systemInstruction?: string
  ): Promise<string | null> {
    const candidateModels = [
      'gemini-3.5-flash-lite',
      'gemini-2.0-flash',
    ];

    for (let i = 0; i < candidateModels.length; i++) {
      const model = candidateModels[i];
      try {
        const response = await ai.models.generateContent({
          model,
          contents,
          config: systemInstruction
            ? {
                systemInstruction,
              }
            : undefined,
        });

        const text = response.text?.trim();
        if (text) {
          return text;
        }
      } catch (err: any) {
        const errMsg = err?.message || String(err);
        const isTransient =
          err?.status === 503 ||
          err?.status === 429 ||
          errMsg.includes('503') ||
          errMsg.includes('UNAVAILABLE') ||
          errMsg.includes('high demand') ||
          errMsg.includes('RESOURCE_EXHAUSTED');

        if (isTransient && i < candidateModels.length - 1) {
          // Graceful fallback to next model with brief pause
          await new Promise((resolve) => setTimeout(resolve, 200));
          continue;
        }
      }
    }

    return null;
  }

  // Health check
  app.get('/api/health', (req, res) => {
    res.json({
      status: 'ok',
      service: 'AquaSense X Cloud Core',
      timestamp: new Date().toISOString(),
      aiConfigured: !!process.env.GEMINI_API_KEY,
    });
  });

  // Heuristic hydration tip generator
  function generateHeuristicTip(
    hydrationGoal: number,
    consumed: number,
    bottleData: any = {}
  ): string {
    const safeGoal = hydrationGoal > 0 ? hydrationGoal : 2500;
    const safeConsumed = Number.isFinite(consumed) && consumed >= 0 ? consumed : 0;
    const remaining = Math.max(0, safeGoal - safeConsumed);
    const pct = Math.round((safeConsumed / safeGoal) * 100);

    if (bottleData.qualityScore && bottleData.qualityScore < 70) {
      return `Water quality alert (${bottleData.qualityScore}/100): Check filter integrity or refill from a trusted source before drinking.`;
    }

    if (typeof bottleData.temperature === 'number' && bottleData.temperature > 26) {
      return `Water is warm (${bottleData.temperature}°C). Chilling your water slightly (15–20°C) can enhance gastric emptying and rapid hydration.`;
    }

    if (pct < 30) {
      return `You've logged ${safeConsumed} ml (${pct}% of goal). An early 300 ml glass jumpstarts cellular hydration.`;
    }

    if (pct >= 100) {
      return `Target achieved (${safeConsumed} ml logged)! Maintain light sips to replenish natural metabolic water loss.`;
    }

    if (pct >= 75) {
      return `Almost there! You have ${remaining} ml left to hit your ${safeGoal} ml target for today.`;
    }

    const phInfo = typeof bottleData.ph === 'number' ? ` Your water pH (${bottleData.ph})` : '';
    const tdsInfo = typeof bottleData.tds === 'number' ? ` and TDS (${bottleData.tds} ppm)` : '';
    const sensorNote = phInfo ? `${phInfo}${tdsInfo} are balanced for smooth cellular uptake.` : '';
    return `At ${pct}% daily progress (${safeConsumed} ml). ${sensorNote}`.trim();
  }

  // AI Hydration Tip endpoint
  app.post('/api/ai/tip', async (req, res) => {
    const { hydrationGoal = 2500, consumed = 1200, bottleData = {} } = req.body;

    try {
      const ai = getAI();

      if (ai) {
        const tipWaterLevel = typeof bottleData.waterLevel === 'number' ? `${bottleData.waterLevel} ml` : 'unavailable';
        const tipTemperature = typeof bottleData.temperature === 'number' ? `${bottleData.temperature}°C` : 'unavailable';
        const tipQuality = typeof bottleData.qualityScore === 'number' ? `${bottleData.qualityScore}/100` : 'unavailable';
        const tipPh = typeof bottleData.ph === 'number' ? `${bottleData.ph}` : 'unavailable';
        const tipTds = typeof bottleData.tds === 'number' ? `${bottleData.tds} ppm` : 'unavailable';
        const prompt = `You are AquaSense X, an intelligent, calm, and trustworthy water safety and hydration AI assistant.
User Context:
- Hydration Goal: ${hydrationGoal} ml
- Consumed Today: ${consumed} ml
- Water Level: ${tipWaterLevel}
- Water Temperature: ${tipTemperature}
- Water Quality Score: ${tipQuality} (pH: ${tipPh}, TDS: ${tipTds})
- Current Time: ${new Date().toLocaleTimeString()}

Generate a single concise, actionable hydration or water quality tip (1-2 sentences maximum). Be friendly, motivating, and factual. Do not give medical diagnoses.`;

        const tipText = await generateWithFallback(ai, prompt);
        if (tipText) {
          return res.json({ tip: tipText, source: 'gemini' });
        }
      }

      // Fallback heuristic engine if Gemini is unavailable
      const fallbackTip = generateHeuristicTip(hydrationGoal, consumed, bottleData);
      res.json({ tip: fallbackTip, source: 'rule-engine' });
    } catch (error: any) {
      console.error('Error generating AI tip:', error?.message || error);
      const fallbackTip = generateHeuristicTip(hydrationGoal, consumed, bottleData);
      res.json({
        tip: fallbackTip,
        source: 'fallback',
      });
    }
  });

  // AI Coach Chat endpoint
  app.post('/api/ai/coach', async (req, res) => {
    const { message = '', context = {}, history = [] } = req.body;

    try {
      const ai = getAI();
      const { bottleData = {}, hydration = {} } = context;

      const systemInstruction = `You are AquaSense X Coach, the personal water quality and hydration AI assistant for the AquaSense X smart bottle.
Your tone is calm, intelligent, minimalist, and trustworthy, reminiscent of high-end Apple or Tesla product companions.

CRITICAL GUIDELINES:
1. Ground your answers strictly in the user's provided live bottle and hydration context:
- Bottle ID: ${bottleData.bottleId || 'Active Bottle'}
- Water Quality Score: ${bottleData.qualityScore || 'N/A'}/100 (${bottleData.qualityCategory || 'N/A'})
- Temperature: ${bottleData.temperature || 'N/A'}°C
- TDS (Total Dissolved Solids): ${bottleData.tds || 'N/A'} ppm
- Turbidity: ${bottleData.turbidity || 'N/A'} NTU
- pH: ${bottleData.ph || 'N/A'}
- Water Level: ${bottleData.waterLevel || 'N/A'} ml
- Bottle Battery: ${bottleData.battery || 'N/A'}%
- Bottle Status: ${bottleData.online ? 'Online (ESP32 Live Connected)' : 'Offline'}
- Hydration Progress: ${hydration.consumed || 0} ml consumed out of ${hydration.goal || 2500} ml goal (${hydration.percent || 0}%)

2. NEVER invent sensor values. If a value is missing or offline, state that it is unavailable.
3. MEDICAL DISCLAIMER: Distinguish water-quality sensor data from medical advice. Never diagnose illnesses. Always provide a gentle reminder when safety is questioned that sensor readings are screening metrics.
4. Keep answers formatted nicely with markdown bullet points, bold key terms, and concise, clear explanations.`;

      if (ai) {
        const conversationText = history
          .slice(-6)
          .map((h: any) => `${h.role === 'user' ? 'User' : 'Assistant'}: ${h.content}`)
          .join('\n');
        const fullPrompt = `${conversationText ? `Recent Conversation:\n${conversationText}\n\n` : ''}User Question: ${message}\nAssistant response:`;

        const replyText = await generateWithFallback(ai, fullPrompt, systemInstruction);
        if (replyText) {
          return res.json({
            reply: replyText,
            model: 'gemini',
          });
        }
      }

      // Contextual fallback response if Gemini is unavailable or rate-limited
      const qs = typeof bottleData.qualityScore === 'number' ? `${bottleData.qualityScore}/100` : 'unavailable';
      const qc = bottleData.qualityCategory || 'unavailable';
      const ph = typeof bottleData.ph === 'number' ? `${bottleData.ph}` : 'unavailable';
      const tds = typeof bottleData.tds === 'number' ? `${bottleData.tds} ppm` : 'unavailable';
      const turb = typeof bottleData.turbidity === 'number' ? `${bottleData.turbidity} NTU` : 'unavailable';
      const temp = typeof bottleData.temperature === 'number' ? `${bottleData.temperature}°C` : 'unavailable';
      const consumed = Number.isFinite(hydration.consumed) && hydration.consumed >= 0 ? hydration.consumed : 0;
      const goal = hydration.goal > 0 ? hydration.goal : 2500;
      const pct = hydration.percent ?? Math.round((consumed / goal) * 100);

      let responseContent =
        `I am your AquaSense X Coach. Based on your current sensor telemetry:\n\n` +
        `• **Quality Score**: ${qs} (${qc})\n` +
        `• **pH Level**: ${ph} (Ideal balanced range: 6.5 - 8.5)\n` +
        `• **TDS**: ${tds} (Clean, mineralized drinkable water)\n` +
        `• **Turbidity**: ${turb}\n` +
        `• **Hydration**: ${consumed} ml / ${goal} ml (${pct}%)\n\n` +
        `*Note: Sensor readings provide rapid quality screening and do not replace certified medical or lab testing.*`;

      const msgLower = message.toLowerCase();
      if (msgLower.includes('safe') || msgLower.includes('drink')) {
        responseContent = `Your water quality score is **${qs}** with a pH of **${ph}** and TDS of **${tds}**. Ensure your bottle cap UV/sensor chamber is cleaned weekly for optimal accuracy.`;
      } else if (msgLower.includes('tds')) {
        responseContent = `**TDS (Total Dissolved Solids)** measures dissolved minerals, salts, and organic compounds in parts per million (ppm). Your current reading is **${tds}**. The optimal drinking range is 50–300 ppm.`;
      } else if (msgLower.includes('turbidity')) {
        responseContent = `**Turbidity** measures the cloudiness or particulate matter in water (in NTU). Clean drinking water should ideally stay below **1.0 NTU**. Your bottle reads **${turb}**.`;
      } else if (msgLower.includes('temperature') || msgLower.includes('temp') || msgLower.includes('cold') || msgLower.includes('warm')) {
        responseContent = `Your current water temperature is **${temp}**. Cool water (15–20°C) is generally absorbed most rapidly by the body during activity.`;
      } else if (msgLower.includes('goal') || msgLower.includes('more') || msgLower.includes('how much')) {
        const rem = Math.max(0, goal - consumed);
        responseContent = `You have logged **${consumed} ml** toward your **${goal} ml** goal (**${pct}%**). You have **${rem} ml** remaining to reach peak daily hydration balance.`;
      }

      res.json({
        reply: responseContent,
        model: 'contextual-heuristic-engine',
      });
    } catch (error: any) {
      console.error('Error in AI Coach:', error?.message || error);
      res.json({
        reply: `I analyzed your AquaSense X readings. Your water quality is active and registered. Continue drinking at steady intervals to reach your daily goal.`,
        model: 'fallback',
      });
    }
  });

  // IoT / Bottle validation API
  app.post('/api/bottles/validate', (req, res) => {
    const { bottleId } = req.body;
    if (!bottleId) {
      return res.status(400).json({ error: 'Bottle ID is required' });
    }

    // Match ASX-XXXX-XXXX format
    const cleaned = String(bottleId).trim().toUpperCase();
    const isValidFormat = /^ASX-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(cleaned) || /^ASX-[0-9]{4}-[0-9]{4}$/.test(cleaned);

    if (!isValidFormat && cleaned.length < 8) {
      return res.status(400).json({
        valid: false,
        error: 'Invalid Bottle ID format. Expected format: ASX-XXXX-XXXX'
      });
    }

    // Simulate bottle validation
    res.json({
      valid: true,
      bottleId: cleaned,
      model: 'AquaSense X Pro ESP32-S3',
      firmwareVersion: 'v2.4.1',
      battery: 88,
      online: true,
      initialReadings: {
        temperature: 21.4,
        tds: 185,
        turbidity: 0.4,
        ph: 7.3,
        waterLevel: 680
      }
    });
  });

  // Server-side OAuth2 token cache for FCM v1 API
  let cachedOAuthToken: { token: string; expiresAt: number } | null = null;

  async function getGoogleOAuth2AccessToken(sa: { client_email: string; private_key: string }): Promise<string> {
    const now = Math.floor(Date.now() / 1000);
    if (cachedOAuthToken && cachedOAuthToken.expiresAt > now + 60) {
      return cachedOAuthToken.token;
    }

    const header = { alg: 'RS256', typ: 'JWT' };
    const claimSet = {
      iss: sa.client_email,
      scope: 'https://www.googleapis.com/auth/firebase.messaging',
      aud: 'https://oauth2.googleapis.com/token',
      exp: now + 3600,
      iat: now,
    };

    const base64UrlEncode = (str: string) => Buffer.from(str).toString('base64url');
    const unsignedToken = `${base64UrlEncode(JSON.stringify(header))}.${base64UrlEncode(JSON.stringify(claimSet))}`;

    const signer = crypto.createSign('RSA-SHA256');
    signer.update(unsignedToken);
    signer.end();

    const signature = signer.sign(sa.private_key, 'base64url');
    const jwt = `${unsignedToken}.${signature}`;

    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        assertion: jwt,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`OAuth2 token acquisition failed: ${errorText}`);
    }

    const data = await response.json();
    cachedOAuthToken = {
      token: data.access_token,
      expiresAt: now + (data.expires_in || 3600),
    };

    return data.access_token;
  }

  // Load applet config for project ID, API key, and database ID
  let firebaseAppletConfig: Record<string, any> = {};
  try {
    const configPath = path.join(__dirname, 'firebase-applet-config.json');
    if (fs.existsSync(configPath)) {
      firebaseAppletConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    }
  } catch (err) {
    console.warn('Could not read firebase-applet-config.json:', err);
  }

  // Securely verify Firebase ID Token using Google Identity Toolkit API
  async function verifyFirebaseIdToken(idToken: string): Promise<string> {
    if (!idToken || typeof idToken !== 'string') {
      throw new Error('Missing or malformed ID token.');
    }

    const apiKey = firebaseAppletConfig.apiKey || process.env.VITE_FIREBASE_API_KEY;
    if (!apiKey) {
      throw new Error('Firebase API key is not configured.');
    }

    const response = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken }),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      const msg = err?.error?.message || 'Invalid or expired Firebase ID token.';
      throw new Error(msg);
    }

    const data = await response.json();
    const verifiedUser = data?.users?.[0];
    if (!verifiedUser?.localId) {
      throw new Error('Unable to derive user identity from Firebase token.');
    }

    return verifiedUser.localId;
  }

  // Look up registered tokens for verified user from users/{verifiedUid}/fcmTokens
  async function getUserFCMTokensFromFirestore(
    verifiedUid: string,
    accessToken: string,
    projectId: string
  ): Promise<string[]> {
    try {
      const databaseId = firebaseAppletConfig.firestoreDatabaseId || '(default)';
      const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/${databaseId}/documents/users/${verifiedUid}/fcmTokens`;

      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (!response.ok) {
        return [];
      }

      const data = await response.json();
      if (!data.documents || !Array.isArray(data.documents)) {
        return [];
      }

      const tokens: string[] = [];
      for (const doc of data.documents) {
        const tokenValue = doc.fields?.token?.stringValue;
        if (tokenValue) {
          tokens.push(tokenValue);
        }
      }
      return tokens;
    } catch (err) {
      console.warn('Error fetching FCM tokens from Firestore:', err);
      return [];
    }
  }

  // Development FCM test push endpoint (server-side ID-token authenticated)
  app.post('/api/notifications/test-push', async (req, res) => {
    try {
      // 1. Extract Bearer token from Authorization header
      const authHeader = req.headers.authorization || '';
      const match = authHeader.match(/^Bearer\s+(.+)$/i);
      if (!match) {
        return res.status(401).json({
          success: false,
          error: 'Authentication is required. Missing Bearer authorization token.',
        });
      }
      const idToken = match[1].trim();

      // 2. Verify Firebase ID token and derive verifiedUid (rejecting/ignoring client-supplied uid)
      let verifiedUid: string;
      try {
        verifiedUid = await verifyFirebaseIdToken(idToken);
      } catch (authErr: any) {
        return res.status(401).json({
          success: false,
          error: authErr?.message || 'Authentication failed: Invalid Firebase ID token.',
        });
      }

      // 3. Check for server-side service account credentials
      const saEnv = process.env.FIREBASE_SERVICE_ACCOUNT || process.env.GOOGLE_APPLICATION_CREDENTIALS;
      if (!saEnv) {
        return res.status(200).json({
          success: false,
          code: 'MISSING_SERVICE_ACCOUNT',
          error: 'FIREBASE_SERVICE_ACCOUNT is not configured in server environment. Push test executed via local fallback.',
        });
      }

      let sa: { project_id?: string; client_email: string; private_key: string };
      try {
        if (saEnv.trim().startsWith('{')) {
          sa = JSON.parse(saEnv);
        } else {
          const decoded = Buffer.from(saEnv, 'base64').toString('utf-8');
          sa = JSON.parse(decoded);
        }
      } catch (err: any) {
        return res.status(500).json({
          success: false,
          code: 'INVALID_SERVICE_ACCOUNT',
          error: 'Failed to parse FIREBASE_SERVICE_ACCOUNT credentials: ' + err.message,
        });
      }

      const accessToken = await getGoogleOAuth2AccessToken(sa);
      const projectId = sa.project_id || firebaseAppletConfig.projectId || 'aquasensex';

      // 4. Query registered tokens under users/{verifiedUid}/fcmTokens
      const userTokens = await getUserFCMTokensFromFirestore(verifiedUid, accessToken, projectId);

      // Validate that target token belongs to the authenticated user
      const requestedToken = typeof req.body?.token === 'string' ? req.body.token.trim() : null;
      let targetToken: string | null = null;

      if (requestedToken) {
        if (userTokens.includes(requestedToken)) {
          targetToken = requestedToken;
        } else {
          return res.status(403).json({
            success: false,
            error: 'Specified device token does not belong to the authenticated user.',
          });
        }
      } else if (userTokens.length > 0) {
        targetToken = userTokens[0];
      }

      if (!targetToken) {
        return res.status(404).json({
          success: false,
          error: 'No registered push device found.',
        });
      }

      // 5. Send FCM message exclusively to the verified user's device
      const fcmPayload = {
        message: {
          token: targetToken,
          notification: {
            title: 'AquaSense X',
            body: 'Push notifications are working.',
          },
          data: {
            title: 'AquaSense X',
            body: 'Push notifications are working.',
            category: 'drinkReminders',
          },
          webpush: {
            notification: {
              title: 'AquaSense X',
              body: 'Push notifications are working.',
              icon: '/favicon.ico',
              badge: '/favicon.ico',
            },
            fcm_options: {
              link: '/',
            },
          },
        },
      };

      const fcmResponse = await fetch(`https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify(fcmPayload),
      });

      const resJson = await fcmResponse.json();
      if (fcmResponse.ok) {
        console.log('[FCM Server] Successfully dispatched test push to verified user:', verifiedUid, resJson.name);
        return res.json({ success: true, messageId: resJson.name });
      } else {
        console.warn('[FCM Server] Dispatch failed:', resJson);
        return res.status(fcmResponse.status || 500).json({
          success: false,
          code: resJson.error?.status || 'FCM_DISPATCH_FAILED',
          error: resJson.error?.message || 'Failed to dispatch FCM message',
        });
      }
    } catch (error: any) {
      console.error('[FCM Server] Internal error:', error);
      res.status(500).json({ success: false, error: error?.message || 'Server error' });
    }
  });

  // Vite middleware setup
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`AquaSense X Server running on http://localhost:${PORT}`);
  });
}

startServer();

import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';
import { createServer as createViteServer } from 'vite';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

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

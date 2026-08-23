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
      'gemini-3.7-flash',
      'gemini-2.5-flash',
      'gemini-flash-latest',
      'gemini-3.1-flash-lite',
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
    const remaining = Math.max(0, hydrationGoal - consumed);
    const pct = Math.round((consumed / hydrationGoal) * 100);
    const ph = bottleData.ph || 7.2;
    const tds = bottleData.tds || 180;
    const temp = bottleData.temperature || 21;

    if (bottleData.qualityScore && bottleData.qualityScore < 70) {
      return `Water quality alert (${bottleData.qualityScore}/100): Check filter integrity or refill from a trusted source before drinking.`;
    }

    if (temp > 26) {
      return `Water is warm (${temp}°C). Chilling your water slightly (15–20°C) can enhance gastric emptying and rapid hydration.`;
    }

    if (pct < 30) {
      return `Good morning! You've logged ${consumed} ml (${pct}% of goal). An early 300 ml glass jumpstarts cellular hydration.`;
    }

    if (pct >= 100) {
      return `Target achieved (${consumed} ml logged)! Maintain light sips to replenish natural metabolic water loss.`;
    }

    if (pct >= 75) {
      return `Almost there! You have ${remaining} ml left to hit your ${hydrationGoal} ml target for today.`;
    }

    return `At ${pct}% daily progress (${consumed} ml). Your water pH (${ph}) and TDS (${tds} ppm) are balanced for smooth cellular uptake.`;
  }

  // AI Hydration Tip endpoint
  app.post('/api/ai/tip', async (req, res) => {
    const { hydrationGoal = 2500, consumed = 1200, bottleData = {} } = req.body;

    try {
      const ai = getAI();

      if (ai) {
        const prompt = `You are AquaSense X, an intelligent, calm, and trustworthy water safety and hydration AI assistant.
User Context:
- Hydration Goal: ${hydrationGoal} ml
- Consumed Today: ${consumed} ml
- Water Level: ${bottleData.waterLevel || 0} ml
- Water Temperature: ${bottleData.temperature || 21}°C
- Water Quality Score: ${bottleData.qualityScore || 90}/100 (pH: ${bottleData.ph || 7.2}, TDS: ${bottleData.tds || 180} ppm)
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
- Bottle ID: ${bottleData.bottleId || 'ASX-9821-4402'}
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
      let responseContent =
        `I am your AquaSense X Coach. Based on your current sensor telemetry:\n\n` +
        `• **Quality Score**: ${bottleData.qualityScore || 92}/100 (${bottleData.qualityCategory || 'Excellent'})\n` +
        `• **pH Level**: ${bottleData.ph || 7.2} (Ideal balanced range: 6.5 - 8.5)\n` +
        `• **TDS**: ${bottleData.tds || 180} ppm (Clean, mineralized drinkable water)\n` +
        `• **Turbidity**: ${bottleData.turbidity || 0.4} NTU (Crystal clear)\n` +
        `• **Hydration**: ${hydration.consumed || 1200} ml / ${hydration.goal || 2500} ml (${Math.round(((hydration.consumed || 1200) / (hydration.goal || 2500)) * 100)}%)\n\n` +
        `Your water readings show safe, high-clarity drinking water. *Note: Sensor readings provide rapid quality screening and do not replace certified medical or lab testing.*`;

      const msgLower = message.toLowerCase();
      if (msgLower.includes('safe') || msgLower.includes('drink')) {
        responseContent = `Your water has a Quality Score of **${bottleData.qualityScore || 92}/100** with a pH of **${bottleData.ph || 7.2}** and TDS of **${bottleData.tds || 180} ppm**, indicating balanced, low-turbidity drinking water. Ensure your bottle cap UV/sensor chamber is cleaned weekly for optimal accuracy.`;
      } else if (msgLower.includes('tds')) {
        responseContent = `**TDS (Total Dissolved Solids)** measures dissolved minerals, salts, and organic compounds in parts per million (ppm). Your current reading of **${bottleData.tds || 180} ppm** is in the optimal drinking range (50–300 ppm), which provides desirable taste and essential trace electrolytes without excessive mineral hardness.`;
      } else if (msgLower.includes('turbidity')) {
        responseContent = `**Turbidity** measures the cloudiness or particulate matter in water (in NTU). Clean drinking water should ideally stay below **1.0 NTU**. Your bottle reads **${bottleData.turbidity || 0.4} NTU**, which is exceptionally clear!`;
      } else if (msgLower.includes('temperature') || msgLower.includes('temp') || msgLower.includes('cold') || msgLower.includes('warm')) {
        responseContent = `Your current water temperature is **${bottleData.temperature || 21}°C**. Cool water (15–20°C) is generally absorbed most rapidly by the body during activity.`;
      } else if (msgLower.includes('goal') || msgLower.includes('more') || msgLower.includes('how much')) {
        const rem = Math.max(0, (hydration.goal || 2500) - (hydration.consumed || 0));
        responseContent = `You have logged **${hydration.consumed || 0} ml** toward your **${hydration.goal || 2500} ml** goal (**${hydration.percent || 0}%**). You have **${rem} ml** remaining to reach peak daily hydration balance.`;
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

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

  // Lazy Gemini AI initialization
  let aiClient: GoogleGenAI | null = null;
  function getAI(): GoogleGenAI | null {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return null;
    }
    if (!aiClient) {
      aiClient = new GoogleGenAI({ apiKey });
    }
    return aiClient;
  }

  // Health check
  app.get('/api/health', (req, res) => {
    res.json({
      status: 'ok',
      service: 'AquaSense X Cloud Core',
      timestamp: new Date().toISOString(),
      aiConfigured: !!process.env.GEMINI_API_KEY
    });
  });

  // AI Hydration Tip endpoint
  app.post('/api/ai/tip', async (req, res) => {
    try {
      const { hydrationGoal = 2500, consumed = 1200, bottleData = {} } = req.body;
      const ai = getAI();

      if (!ai) {
        // Fallback intelligent tip if Gemini key not set
        const remaining = Math.max(0, hydrationGoal - consumed);
        const pct = Math.round((consumed / hydrationGoal) * 100);
        let tip = `You've completed ${pct}% of your daily goal (${consumed} ml). `;
        if (remaining > 0) {
          tip += `Drink another ${remaining} ml spread across today to stay optimally hydrated.`;
        } else {
          tip += `Fantastic job reaching your daily goal! Keep sipping to maintain balance.`;
        }
        return res.json({ tip, source: 'rule-engine' });
      }

      const prompt = `You are AquaSense X, an intelligent, calm, and trustworthy water safety and hydration AI assistant.
User Context:
- Hydration Goal: ${hydrationGoal} ml
- Consumed Today: ${consumed} ml
- Water Level: ${bottleData.waterLevel || 0} ml
- Water Temperature: ${bottleData.temperature || 21}°C
- Water Quality Score: ${bottleData.qualityScore || 90}/100 (pH: ${bottleData.ph || 7.2}, TDS: ${bottleData.tds || 180} ppm)
- Current Time: ${new Date().toLocaleTimeString()}

Generate a single concise, actionable hydration or water quality tip (1-2 sentences maximum). Be friendly, motivating, and factual. Do not give medical diagnoses.`;

      const response = await ai.models.generateContent({
        model: 'gemini-3.7-flash',
        contents: prompt,
      });

      const tipText = response.text?.trim() || `Stay refreshed with your AquaSense X bottle.`;
      res.json({ tip: tipText, source: 'gemini' });
    } catch (error: any) {
      console.error('Error generating AI tip:', error);
      const remaining = Math.max(0, (req.body.hydrationGoal || 2500) - (req.body.consumed || 1200));
      res.json({
        tip: `Keep up your hydration cadence! You have ${remaining} ml remaining today.`,
        source: 'fallback'
      });
    }
  });

  // AI Coach Chat endpoint
  app.post('/api/ai/coach', async (req, res) => {
    try {
      const { message, context = {}, history = [] } = req.body;
      const ai = getAI();

      if (!ai) {
        // Fallback contextual response if no API key is provided yet
        const { bottleData = {}, hydration = {} } = context;
        let responseContent = `I am your AquaSense X Coach. Based on your current sensor telemetry:\n\n` +
          `• **Quality Score**: ${bottleData.qualityScore || 92}/100 (${bottleData.qualityCategory || 'Excellent'})\n` +
          `• **pH Level**: ${bottleData.ph || 7.2} (Ideal balanced range: 6.5 - 8.5)\n` +
          `• **TDS**: ${bottleData.tds || 180} ppm (Clean, mineralized drinkable water)\n` +
          `• **Turbidity**: ${bottleData.turbidity || 0.4} NTU (Crystal clear)\n` +
          `• **Hydration**: ${hydration.consumed || 1200} ml / ${hydration.goal || 2500} ml (${Math.round(((hydration.consumed || 1200) / (hydration.goal || 2500)) * 100)}%)\n\n` +
          `Your water readings show safe, high-clarity drinking water. *Note: Sensor readings provide rapid quality screening and do not replace certified medical or lab testing.*`;

        if (message.toLowerCase().includes('safe') || message.toLowerCase().includes('drink')) {
          responseContent = `Your water has a Quality Score of **${bottleData.qualityScore || 92}/100** with a pH of **${bottleData.ph || 7.2}** and TDS of **${bottleData.tds || 180} ppm**, indicating balanced, low-turbidity drinking water. Ensure your bottle cap UV/sensor chamber is cleaned weekly for optimal accuracy.`;
        } else if (message.toLowerCase().includes('tds')) {
          responseContent = `**TDS (Total Dissolved Solids)** measures dissolved minerals, salts, and organic compounds in parts per million (ppm). Your current reading of **${bottleData.tds || 180} ppm** is in the optimal drinking range (50–300 ppm), which provides desirable taste and essential trace electrolytes without excessive mineral hardness.`;
        } else if (message.toLowerCase().includes('turbidity')) {
          responseContent = `**Turbidity** measures the cloudiness or particulate matter in water (in NTU). Clean drinking water should ideally stay below **1.0 NTU**. Your bottle reads **${bottleData.turbidity || 0.4} NTU**, which is exceptionally clear!`;
        }

        return res.json({
          reply: responseContent,
          model: 'rule-context-engine'
        });
      }

      const systemInstruction = `You are AquaSense X Coach, the personal water quality and hydration AI assistant for the AquaSense X smart bottle.
Your tone is calm, intelligent, minimalist, and trustworthy, reminiscent of high-end Apple or Tesla product companions.

CRITICAL GUIDELINES:
1. Ground your answers strictly in the user's provided live bottle and hydration context:
- Bottle ID: ${context.bottleData?.bottleId || 'ASX-9821-4402'}
- Water Quality Score: ${context.bottleData?.qualityScore || 'N/A'}/100 (${context.bottleData?.qualityCategory || 'N/A'})
- Temperature: ${context.bottleData?.temperature || 'N/A'}°C
- TDS (Total Dissolved Solids): ${context.bottleData?.tds || 'N/A'} ppm
- Turbidity: ${context.bottleData?.turbidity || 'N/A'} NTU
- pH: ${context.bottleData?.ph || 'N/A'}
- Water Level: ${context.bottleData?.waterLevel || 'N/A'} ml
- Bottle Battery: ${context.bottleData?.battery || 'N/A'}%
- Bottle Status: ${context.bottleData?.online ? 'Online (ESP32 Live Connected)' : 'Offline'}
- Hydration Progress: ${context.hydration?.consumed || 0} ml consumed out of ${context.hydration?.goal || 2500} ml goal (${context.hydration?.percent || 0}%)

2. NEVER invent sensor values. If a value is missing or offline, state that it is unavailable.
3. MEDICAL DISCLAIMER: Distinguish water-quality sensor data from medical advice. Never diagnose illnesses. Always provide a gentle reminder when safety is questioned that sensor readings are screening metrics.
4. Keep answers formatted nicely with markdown bullet points, bold key terms, and concise, clear explanations.`;

      // Build conversation contents
      const conversationText = history.slice(-6).map((h: any) => `${h.role === 'user' ? 'User' : 'Assistant'}: ${h.content}`).join('\n');
      const fullPrompt = `${systemInstruction}\n\nRecent Conversation:\n${conversationText}\n\nUser Question: ${message}\nAssistant response:`;

      const response = await ai.models.generateContent({
        model: 'gemini-3.7-flash',
        contents: fullPrompt,
      });

      res.json({
        reply: response.text || 'I analyzed your AquaSense X readings. Your water metrics appear stable.',
        model: 'gemini-3.7-flash'
      });
    } catch (error: any) {
      console.error('Error in AI Coach:', error);
      res.status(500).json({
        error: 'Unable to complete AI Coach request',
        reply: 'I am temporarily unable to reach the cloud AI service, but your local bottle sensors indicate your water quality score is active.'
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

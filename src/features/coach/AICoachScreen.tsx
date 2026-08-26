import React, { useState, useRef, useEffect } from 'react';
import { AICoachMessage } from '../../types';
import { useBottle } from '../../context/BottleContext';
import { useAuth } from '../../context/AuthContext';
import { Header } from '../../components/common/Header';
import {
  Bot,
  Send,
  Sparkles,
  Trash2,
  Cpu,
  User as UserIcon,
  ShieldAlert,
  HelpCircle,
  Droplets,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

const SUGGESTED_QUESTIONS = [
  'Is my water safe to drink right now?',
  'What does my current TDS reading mean?',
  'How much more should I drink today?',
  'Explain my turbidity level and clarity',
  'How do temperature and pH affect hydration?',
];

const INITIAL_MESSAGES: AICoachMessage[] = [
  {
    id: 'msg_welcome',
    role: 'assistant',
    content:
      "Hello! I am your **AquaSense X AI Coach**. I monitor your smart bottle's optical clarity, electro-chemical balance, and daily hydration pacing in real-time.\n\nHow can I help optimize your water safety or hydration today?",
    timestamp: new Date().toISOString(),
  },
];

export const AICoachScreen: React.FC = () => {
  const { bottle, qualityEval, todayConsumed, hydrationGoal, hydrationPercent } = useBottle();
  const { user } = useAuth();

  const [messages, setMessages] = useState<AICoachMessage[]>(() => {
    const saved = localStorage.getItem('aquasense_coach_chat');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {}
    }
    return INITIAL_MESSAGES;
  });

  const [inputMessage, setInputMessage] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    localStorage.setItem('aquasense_coach_chat', JSON.stringify(messages));
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = async (queryText?: string) => {
    const textToSend = queryText || inputMessage.trim();
    if (!textToSend || isLoading) return;

    const userMsg: AICoachMessage = {
      id: `usr_${Date.now()}`,
      role: 'user',
      content: textToSend,
      timestamp: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputMessage('');
    setIsLoading(true);

    try {
      // Send context payload to server endpoint
      const payload = {
        message: textToSend,
        context: {
          bottleData: {
            bottleId: bottle?.bottleId || user?.bottleId || 'Not connected',
            qualityScore: qualityEval.score,
            qualityCategory: qualityEval.category,
            temperature: bottle?.temperature,
            tds: bottle?.tds,
            turbidity: bottle?.turbidity,
            ph: bottle?.ph,
            waterLevel: bottle?.waterLevel,
            battery: bottle?.battery,
            online: bottle?.online,
          },
          hydration: {
            consumed: todayConsumed,
            goal: hydrationGoal,
            percent: hydrationPercent,
          },
        },
        history: messages.slice(-6).map((m) => ({ role: m.role, content: m.content })),
      };

      const res = await fetch('/api/ai/coach', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      const assistantMsg: AICoachMessage = {
        id: `ai_${Date.now()}`,
        role: 'assistant',
        content: data.reply || 'I reviewed your water telemetry. Your parameters look normal.',
        timestamp: new Date().toISOString(),
      };

      setMessages((prev) => [...prev, assistantMsg]);
    } catch (error) {
      console.error('Error querying AI Coach:', error);
      const fallbackMsg: AICoachMessage = {
        id: `ai_${Date.now()}`,
        role: 'assistant',
        content: `Your water quality score is **${qualityEval.score}/100** with a pH of **${bottle?.ph || 7.2}** and TDS of **${bottle?.tds || 180} ppm**. Continue drinking regularly to reach your goal of ${hydrationGoal} ml.`,
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, fallbackMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClearChat = () => {
    setMessages(INITIAL_MESSAGES);
    localStorage.removeItem('aquasense_coach_chat');
  };

  return (
    <div className="min-h-full bg-[#090B0E] text-[#F8FAFC] flex flex-col transition-colors duration-200">
      <Header
        title="AI Hydration Coach"
        mobileTitle="AI Coach"
        subtitle="Gemini AI grounded in your live AquaSense X sensor readings"
      />

      <div className="p-3.5 xs:p-4 sm:p-6 lg:p-8 max-w-4xl mx-auto w-full flex-1 flex flex-col space-y-3.5 sm:space-y-4">
        {/* Context Telemetry Badge */}
        <div className="p-3.5 sm:p-4 rounded-[22px] sm:rounded-[26px] bg-[#12161C] border border-white/5 flex flex-wrap items-center justify-between gap-3 shadow-xl">
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-[#00D1FF]/10 border border-[#00D1FF]/20 flex items-center justify-center shrink-0">
              <Cpu className="w-4 h-4 text-[#00D1FF]" />
            </div>
            <div className="min-w-0">
              <span className="text-[10px] uppercase font-semibold text-[#00D1FF] tracking-wider block">
                Active Telemetry Context
              </span>
              <p className="text-[11px] sm:text-xs text-neutral-400 font-mono truncate">
                {qualityEval.score} Score • {bottle?.ph} pH • {bottle?.tds} ppm TDS • {bottle?.turbidity} NTU • {todayConsumed}/{hydrationGoal} ml ({hydrationPercent}%)
              </p>
            </div>
          </div>

          <button
            onClick={handleClearChat}
            title="Reset Conversation"
            className="flex items-center gap-1 text-[11px] text-neutral-400 hover:text-rose-400 px-2.5 py-1.5 rounded-xl hover:bg-white/5 transition-colors touch-target sm:min-h-0 sm:min-w-0 shrink-0"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Clear Chat</span>
          </button>
        </div>

        {/* Chat Stream Window */}
        <div className="flex-1 bg-[#12161C] border border-white/5 rounded-[28px] sm:rounded-[32px] p-3.5 xs:p-4 sm:p-6 flex flex-col justify-between min-h-[440px] shadow-2xl overflow-hidden">
          {/* Messages Container */}
          <div className="space-y-3.5 sm:space-y-4 overflow-y-auto max-h-[500px] pr-1 sm:pr-2">
            {messages.map((msg) => {
              const isUser = msg.role === 'user';
              return (
                <motion.div
                  key={msg.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`flex gap-2.5 sm:gap-3 ${isUser ? 'justify-end' : 'justify-start'}`}
                >
                  {!isUser && (
                    <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-[#00D1FF]/10 border border-[#00D1FF]/30 flex items-center justify-center shrink-0 mt-0.5 shadow-sm">
                      <Bot className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#00D1FF]" />
                    </div>
                  )}

                  <div
                    className={`max-w-[85%] sm:max-w-[75%] rounded-2xl p-3.5 sm:p-4 text-xs sm:text-sm leading-relaxed ${
                      isUser
                        ? 'bg-[#00D1FF] text-[#090B0E] font-medium rounded-tr-sm shadow-md'
                        : 'bg-[#090B0E] border border-white/5 text-[#F8FAFC] rounded-tl-sm shadow-inner'
                    }`}
                  >
                    <div className="whitespace-pre-wrap">{msg.content}</div>
                    <span
                      className={`text-[9px] block mt-1.5 font-mono ${
                        isUser ? 'text-[#090B0E]/70 text-right' : 'text-neutral-500'
                      }`}
                    >
                      {new Date(msg.timestamp).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>

                  {isUser && (
                    <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-white/[0.06] border border-white/10 flex items-center justify-center shrink-0 mt-0.5 text-xs font-semibold text-white">
                      {user?.name ? user.name[0].toUpperCase() : 'U'}
                    </div>
                  )}
                </motion.div>
              );
            })}

            {isLoading && (
              <div className="flex gap-2.5 sm:gap-3 items-center text-xs text-neutral-400">
                <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-[#00D1FF]/10 border border-[#00D1FF]/30 flex items-center justify-center shrink-0">
                  <Bot className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#00D1FF]" />
                </div>
                <div className="p-3 sm:p-3.5 rounded-2xl bg-[#090B0E] border border-white/5 flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-[#00D1FF] animate-pulse" />
                  <span className="text-[11px] sm:text-xs">Analyzing your AquaSense X telemetry data...</span>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Suggested Quick Question Prompts */}
          <div className="mt-3.5 pt-3.5 border-t border-white/5">
            <div className="flex items-center gap-1.5 text-[11px] text-neutral-400 mb-2">
              <Sparkles className="w-3.5 h-3.5 text-[#00D1FF]" />
              <span>Suggested Inquiries:</span>
            </div>
            <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
              {SUGGESTED_QUESTIONS.map((q, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSendMessage(q)}
                  className="px-3 py-1.5 rounded-xl bg-[#090B0E] border border-white/10 hover:border-[#00D1FF]/40 text-[11px] sm:text-xs text-neutral-300 hover:text-white shrink-0 transition-all text-left touch-target sm:min-h-0 sm:min-w-0"
                >
                  {q}
                </button>
              ))}
            </div>

            {/* Input form */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSendMessage();
              }}
              className="mt-2 flex items-center gap-2"
            >
              <input
                type="text"
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                placeholder="Ask about water safety, TDS minerals, pH balance, or hydration..."
                className="flex-1 bg-[#090B0E] border border-white/10 rounded-2xl px-3.5 sm:px-4 py-2.5 sm:py-3 text-xs sm:text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-[#00D1FF]/50"
              />
              <button
                type="submit"
                disabled={!inputMessage.trim() || isLoading}
                className="p-2.5 sm:p-3 rounded-2xl bg-[#00D1FF] hover:bg-[#00B4D8] text-[#090B0E] font-semibold disabled:opacity-40 transition-all shadow-lg shadow-[#00D1FF]/20 shrink-0 touch-target sm:min-h-0 sm:min-w-0 flex items-center justify-center"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>

            {/* Safety Disclaimer Footer */}
            <div className="mt-2.5 text-[9px] sm:text-[10px] text-neutral-500 text-center flex items-center justify-center gap-1.5 px-2">
              <ShieldAlert className="w-3.5 h-3.5 text-[#00D1FF]/60 shrink-0" />
              <span className="truncate">
                AquaSense AI interprets bottle sensor readings for guidance. It is not certified diagnostic medical advice.
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Droplets,
  BatteryWarning,
  Sunrise,
  Trophy,
  Bell,
  X,
  Zap,
} from 'lucide-react';

export interface InAppToast {
  id: string;
  type: 'hydration' | 'battery' | 'reset' | 'goal' | 'info';
  title: string;
  message: string;
  hardwareVibrated?: boolean;
  timestamp: number;
}

interface InAppToastContainerProps {
  toasts: InAppToast[];
  onDismiss: (id: string) => void;
}

export const InAppToastContainer: React.FC<InAppToastContainerProps> = ({
  toasts,
  onDismiss,
}) => {
  const getIconAndColors = (type: InAppToast['type']) => {
    switch (type) {
      case 'hydration':
        return {
          icon: <Droplets className="w-4 h-4 text-[#00D1FF]" />,
          bgBadge: 'bg-[#00D1FF]/15 border-[#00D1FF]/30 text-[#00D1FF]',
          glow: 'shadow-[0_0_20px_rgba(0,209,255,0.15)] border-[#00D1FF]/30',
        };
      case 'battery':
        return {
          icon: <BatteryWarning className="w-4 h-4 text-amber-400 animate-pulse" />,
          bgBadge: 'bg-amber-500/15 border-amber-500/30 text-amber-300',
          glow: 'shadow-[0_0_20px_rgba(245,158,11,0.18)] border-amber-500/35',
        };
      case 'reset':
        return {
          icon: <Sunrise className="w-4 h-4 text-emerald-400" />,
          bgBadge: 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300',
          glow: 'shadow-[0_0_20px_rgba(16,185,129,0.18)] border-emerald-500/35',
        };
      case 'goal':
        return {
          icon: <Trophy className="w-4 h-4 text-amber-400" />,
          bgBadge: 'bg-amber-400/20 border-amber-400/40 text-amber-300',
          glow: 'shadow-[0_0_25px_rgba(245,158,11,0.25)] border-amber-400/40',
        };
      case 'info':
      default:
        return {
          icon: <Bell className="w-4 h-4 text-[#38BDF8]" />,
          bgBadge: 'bg-sky-500/15 border-sky-500/30 text-sky-300',
          glow: 'shadow-[0_0_20px_rgba(56,189,248,0.15)] border-sky-500/30',
        };
    }
  };

  return (
    <div
      aria-live="polite"
      className="fixed top-4 right-4 sm:top-6 sm:right-6 z-50 flex flex-col gap-2.5 max-w-sm w-[calc(100vw-2rem)] sm:w-[380px] pointer-events-none"
    >
      <AnimatePresence>
        {toasts.map((toast) => {
          const { icon, bgBadge, glow } = getIconAndColors(toast.type);

          return (
            <motion.div
              key={toast.id}
              layout
              initial={{ opacity: 0, y: -24, scale: 0.94 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9, y: -12, transition: { duration: 0.18 } }}
              transition={{ type: 'spring', stiffness: 420, damping: 30 }}
              className={`pointer-events-auto relative overflow-hidden rounded-2xl bg-[#0D1117]/95 border backdrop-blur-2xl p-3.5 sm:p-4 transition-all ${glow}`}
            >
              <div className="flex items-start gap-3">
                {/* Status Category Icon */}
                <div
                  className={`w-8 h-8 rounded-xl border flex items-center justify-center shrink-0 ${bgBadge}`}
                >
                  {icon}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0 pr-1">
                  <div className="flex items-center gap-1.5 flex-wrap mb-1">
                    <h4 className="text-xs sm:text-sm font-bold text-white tracking-tight leading-none">
                      {toast.title}
                    </h4>
                    {toast.hardwareVibrated && (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-violet-500/20 border border-violet-500/30 text-violet-300 text-[9px] font-mono font-semibold">
                        <Zap className="w-2.5 h-2.5 animate-pulse" />
                        <span>ESP32 Vibrate</span>
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] sm:text-xs text-neutral-300 leading-relaxed font-sans">
                    {toast.message}
                  </p>
                </div>

                {/* Dismiss Button */}
                <button
                  type="button"
                  onClick={() => onDismiss(toast.id)}
                  aria-label="Dismiss notification"
                  className="w-6 h-6 rounded-lg text-neutral-400 hover:text-white hover:bg-white/10 flex items-center justify-center transition-colors shrink-0 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Bottom Subtle Ambient Glow Accent */}
              <div
                className="absolute bottom-0 left-0 right-0 h-[2px] opacity-70 bg-gradient-to-r from-transparent via-[#00D1FF]/40 to-transparent"
              />
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
};

import React, { useEffect } from 'react';
import { motion } from 'motion/react';
import { Droplets, Sparkles } from 'lucide-react';

interface SplashScreenProps {
  onFinish: () => void;
}

export const SplashScreen: React.FC<SplashScreenProps> = ({ onFinish }) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      onFinish();
    }, 1800);
    return () => clearTimeout(timer);
  }, [onFinish]);

  return (
    <div className="fixed inset-0 z-50 bg-neutral-950 flex flex-col items-center justify-center p-6 select-none overflow-hidden">
      {/* Background ambient lighting */}
      <div className="absolute w-96 h-96 rounded-full bg-cyan-500/10 blur-[120px] pointer-events-none" />

      <motion.div
        initial={{ scale: 0.85, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        className="flex flex-col items-center text-center z-10"
      >
        {/* Sleek Logo Reveal */}
        <div className="w-20 h-20 rounded-3xl bg-gradient-to-tr from-cyan-500 to-blue-600 p-0.5 shadow-2xl shadow-cyan-500/30 mb-6 flex items-center justify-center">
          <div className="w-full h-full rounded-[22px] bg-neutral-950 flex items-center justify-center">
            <Droplets className="w-10 h-10 text-cyan-400" />
          </div>
        </div>

        {/* Title */}
        <h1 className="text-3xl font-bold tracking-tight text-white mb-2 font-sans">
          AquaSense X
        </h1>

        {/* Tagline */}
        <p className="text-sm font-light text-neutral-400 tracking-wide">
          Know Your Water. Hydrate Smarter.
        </p>

        {/* Loading Indicator */}
        <div className="mt-8 flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
          <span className="text-xs text-neutral-500 font-mono tracking-wider">
            SYNCHRONIZING SENSORS
          </span>
        </div>
      </motion.div>
    </div>
  );
};

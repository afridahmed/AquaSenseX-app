import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { motion, AnimatePresence } from 'motion/react';
import {
  Droplets,
  Wifi,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  Sparkles,
  Cpu,
  LogOut,
  Loader2,
  X,
} from 'lucide-react';

interface BottlePairingScreenProps {
  onPaired?: () => void;
  isChangeBottle?: boolean;
}

export const BottlePairingScreen: React.FC<BottlePairingScreenProps> = ({
  onPaired,
  isChangeBottle = false,
}) => {
  const { pairBottle, setIsPairingModalOpen, signOut, user } = useAuth();
  const [bottleInput, setBottleInput] = useState<string>('');
  const [status, setStatus] = useState<
    'idle' | 'validating' | 'found' | 'success' | 'error'
  >('idle');
  const [errorMessage, setErrorMessage] = useState<string>('');

  // Auto-format ASX-XXXX-XXXX
  const handleInputChange = (val: string) => {
    let clean = val.toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (clean.startsWith('ASX')) {
      clean = clean.substring(3);
    }
    let formatted = 'ASX';
    if (clean.length > 0) {
      formatted += '-' + clean.substring(0, 4);
    }
    if (clean.length > 4) {
      formatted += '-' + clean.substring(4, 8);
    }
    setBottleInput(formatted);
    setStatus('idle');
    setErrorMessage('');
  };

  const handleConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanId = bottleInput.trim().toUpperCase();

    // Check formatting
    const isValidFormat =
      /^ASX-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(cleanId) ||
      /^ASX-[0-9]{4}-[0-9]{4}$/.test(cleanId);
    if (!isValidFormat && cleanId.length < 8) {
      setStatus('error');
      setErrorMessage('Please enter a valid Bottle ID (e.g. ASX-XXXX-XXXX).');
      return;
    }

    setStatus('validating');
    setErrorMessage('');

    try {
      // Verify and pair with Firestore
      await pairBottle(cleanId);

      setStatus('success');
      setTimeout(() => {
        if (onPaired) onPaired();
      }, 1000);
    } catch (err: any) {
      setStatus('error');
      setErrorMessage(
        err.message || 'Connection failed. Please check the bottle ID and try again.'
      );
    }
  };

  return (
    <div className="min-h-screen bg-[#090B0E] flex items-center justify-center p-3.5 xs:p-4 sm:p-6 select-none relative overflow-hidden text-[#F8FAFC]">
      {/* Ambient background glow */}
      <div className="absolute w-[400px] sm:w-[600px] h-[400px] sm:h-[600px] rounded-full bg-[#00D1FF]/5 blur-[100px] sm:blur-[150px] pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-lg bg-[#12161C] border border-white/5 rounded-[28px] sm:rounded-[32px] p-5 sm:p-8 shadow-2xl relative z-10 my-auto"
      >
        {/* 1. Header Layout & Flexbox Guard (Resolved iPhone SE / 320px overlap) */}
        <div className="flex items-center justify-between gap-3 mb-4 sm:mb-6">
          <div className="min-w-0 flex-1">
            <h1 className="text-lg xs:text-xl sm:text-2xl font-bold tracking-tight text-white font-sans truncate">
              Link Your Bottle
            </h1>
            <p className="text-xs sm:text-sm text-neutral-400 mt-0.5 truncate">
              AquaSense X Smart Hydration
            </p>
          </div>

          {/* Icon-Only Action Button with shrink-0 Flex Guard */}
          {isChangeBottle && user?.bottleId ? (
            <button
              id="btn-pairing-cancel"
              type="button"
              onClick={() => setIsPairingModalOpen(false)}
              aria-label="Cancel"
              title="Cancel"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-neutral-400 hover:text-white hover:bg-white/10 active:scale-95 transition-all cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
          ) : (
            <button
              id="btn-pairing-signout"
              type="button"
              onClick={() => signOut()}
              aria-label="Sign Out"
              title="Sign Out"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-rose-500/20 bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 hover:text-rose-300 active:scale-95 transition-all cursor-pointer"
            >
              <LogOut className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Pairing Hardware Animation Illustration */}
        <div className="flex items-center justify-center my-3 sm:my-5">
          <div className="relative flex items-center justify-center gap-4 xs:gap-6 sm:gap-8 max-w-full">
            {/* User Phone */}
            <div className="w-10 xs:w-12 sm:w-14 h-18 xs:h-20 sm:h-24 rounded-2xl bg-[#090B0E] border-2 border-white/10 flex flex-col items-center justify-between p-1.5 xs:p-2 shadow-lg shrink-0">
              <div className="w-3 xs:w-4 h-1 rounded-full bg-white/20" />
              <div className="w-5 xs:w-6 h-5 xs:h-6 rounded-full bg-[#00D1FF]/10 flex items-center justify-center">
                <Droplets className="w-3 xs:w-3.5 h-3 xs:h-3.5 text-[#00D1FF]" />
              </div>
              <div className="w-2.5 xs:w-3 h-0.5 rounded-full bg-white/20" />
            </div>

            {/* Wireless Connecting Radio Waves */}
            <div className="flex flex-col items-center gap-1 shrink-0">
              <div className="relative flex items-center justify-center w-10 xs:w-14 sm:w-16">
                <motion.div
                  animate={{
                    scale: [1, 1.3, 1],
                    opacity: [0.3, 0.8, 0.3],
                  }}
                  transition={{ repeat: Infinity, duration: 2, ease: 'easeInOut' }}
                  className="w-8 h-8 xs:w-9 xs:h-9 sm:w-10 sm:h-10 rounded-full bg-[#00D1FF]/10 border border-[#00D1FF]/30 flex items-center justify-center"
                >
                  <Wifi className="w-3.5 h-3.5 xs:w-4 xs:h-4 text-[#00D1FF]" />
                </motion.div>
              </div>
              <span className="text-[8px] xs:text-[9px] sm:text-[10px] font-mono text-[#00D1FF] uppercase tracking-wider xs:tracking-widest mt-0.5">
                BLE / Wi-Fi
              </span>
            </div>

            {/* AquaSense X Smart Bottle */}
            <div className="w-10 xs:w-11 sm:w-12 h-20 xs:h-24 sm:h-28 rounded-2xl bg-[#090B0E] border-2 border-[#00D1FF]/40 flex flex-col items-center justify-between p-1 xs:p-1.5 shadow-lg shadow-[#00D1FF]/10 relative shrink-0">
              {/* Bottle cap UV sensor */}
              <div className="w-6 xs:w-7 sm:w-8 h-3 xs:h-3.5 sm:h-4 rounded-lg bg-white/[0.06] border border-white/10 flex items-center justify-center">
                <div className="w-1.5 xs:w-2 h-1.5 xs:h-2 rounded-full bg-[#00D1FF] animate-pulse" />
              </div>
              {/* Liquid chamber */}
              <div className="w-full h-10 xs:h-12 sm:h-14 rounded-lg bg-[#00D1FF]/15 border border-[#00D1FF]/30 flex items-center justify-center">
                <span className="text-[7px] xs:text-[8px] font-mono text-[#00D1FF]">ESP32</span>
              </div>
              <div className="w-5 xs:w-6 sm:w-7 h-1 sm:h-1.5 rounded-full bg-white/20" />
            </div>
          </div>
        </div>

        {/* Descriptive Subtext with Adaptive Typography */}
        <div className="text-center mb-4 sm:mb-6">
          <p className="text-xs sm:text-sm text-neutral-400 max-w-sm mx-auto leading-relaxed">
            Enter the 8-character ID laser-engraved under the silicone base of your AquaSense X bottle.
          </p>
        </div>

        {/* Status Alerts */}
        <AnimatePresence>
          {status === 'error' && (
            <motion.div
              initial={{ opacity: 0, y: -5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="mb-4 p-3 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs sm:text-sm flex items-center gap-2"
            >
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              <span className="leading-snug">{errorMessage}</span>
            </motion.div>
          )}

          {status === 'validating' && (
            <motion.div
              initial={{ opacity: 0, y: -5 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-4 p-3 rounded-2xl bg-[#00D1FF]/10 border border-[#00D1FF]/30 text-[#00D1FF] text-xs sm:text-sm flex items-center justify-between"
            >
              <div className="flex items-center gap-2 min-w-0">
                <Cpu className="w-4 h-4 text-[#00D1FF] animate-spin shrink-0" />
                <span className="font-medium text-white truncate">Checking bottle registry...</span>
              </div>
              <span className="text-[11px] font-mono text-[#00D1FF]/80 shrink-0 ml-2">Verifying ESP32</span>
            </motion.div>
          )}

          {status === 'success' && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="mb-4 p-3.5 sm:p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs sm:text-sm flex items-center gap-3"
            >
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
              <div>
                <p className="font-semibold text-white">Bottle paired successfully!</p>
                <p className="text-[11px] sm:text-xs text-emerald-300/80">Redirecting to your dashboard...</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Pairing Form with Adaptive Inputs */}
        <form onSubmit={handleConnect} className="space-y-3.5 sm:space-y-4">
          <div>
            <label className="block text-xs sm:text-sm font-medium text-neutral-400 mb-1.5">
              Bottle Serial ID
            </label>
            <div className="relative">
              <input
                id="input-bottle-serial"
                type="text"
                required
                value={bottleInput}
                onChange={(e) => handleInputChange(e.target.value)}
                placeholder="ASX-XXXX-XXXX"
                maxLength={13}
                className="w-full bg-[#090B0E] border border-white/10 rounded-2xl px-3.5 xs:px-4 py-3 text-sm sm:text-base font-mono text-center tracking-wider xs:tracking-widest text-[#00D1FF] placeholder-neutral-600 focus:outline-none focus:border-[#00D1FF]/50 transition-colors uppercase"
              />
            </div>
          </div>

          {/* Primary Action Button with Touch-Friendly Height & Loading Spinner */}
          <button
            id="btn-pair-launch-dashboard"
            type="submit"
            disabled={status === 'validating' || status === 'success'}
            className="w-full py-3 px-4 rounded-2xl bg-[#00D1FF] hover:bg-[#00B4D8] active:bg-[#0096B4] text-[#090B0E] font-semibold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg shadow-[#00D1FF]/20 active:scale-[0.98] transition-all disabled:opacity-50 touch-target cursor-pointer disabled:cursor-not-allowed"
          >
            {status === 'validating' ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-[#090B0E]" />
                <span>Pairing Bottle...</span>
              </>
            ) : status === 'success' ? (
              <>
                <CheckCircle2 className="w-4 h-4 text-[#090B0E]" />
                <span>Pair & Launch Dashboard</span>
              </>
            ) : (
              <>
                <span>Pair & Launch Dashboard</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        {/* Security / Onboarding Guarantee Footer */}
        <div className="mt-4 sm:mt-6 pt-3 sm:pt-4 border-t border-white/5 flex items-center justify-between text-[10px] sm:text-[11px] text-neutral-500">
          <span className="flex items-center gap-1 truncate">
            <Sparkles className="w-3 h-3 text-[#00D1FF] shrink-0" /> Verified Device Registry
          </span>
          <span className="shrink-0 font-mono">BLE v5.3</span>
        </div>
      </motion.div>
    </div>
  );
};

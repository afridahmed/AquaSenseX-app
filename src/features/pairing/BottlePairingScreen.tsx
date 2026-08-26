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
    const isValidFormat = /^ASX-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(cleanId) || /^ASX-[0-9]{4}-[0-9]{4}$/.test(cleanId);
    if (!isValidFormat && cleanId.length < 8) {
      setStatus('error');
      setErrorMessage('Please enter a valid Bottle ID (e.g. ASX-XXXX-XXXX).');
      return;
    }

    setStatus('validating');
    setErrorMessage('');

    try {
      // 1. Verify and pair with Firestore
      await pairBottle(cleanId);

      setStatus('success');
      setTimeout(() => {
        if (onPaired) onPaired();
      }, 1000);
    } catch (err: any) {
      setStatus('error');
      setErrorMessage(err.message || 'Connection failed. Please check the bottle ID.');
    }
  };

  return (
    <div className="min-h-screen bg-[#090B0E] flex items-center justify-center p-3.5 xs:p-4 sm:p-6 select-none relative overflow-hidden text-[#F8FAFC]">
      {/* Ambient background glow */}
      <div className="absolute w-[500px] sm:w-[600px] h-[500px] sm:h-[600px] rounded-full bg-[#00D1FF]/5 blur-[120px] sm:blur-[150px] pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-lg bg-[#12161C] border border-white/5 rounded-[28px] sm:rounded-[32px] p-5 xs:p-6 sm:p-8 shadow-2xl relative z-10 my-auto"
      >
        {/* Top actions: Cancel (if has bottle) or Sign Out */}
        <div className="absolute right-5 sm:right-6 top-5 sm:top-6 flex items-center gap-2">
          {isChangeBottle && user?.bottleId ? (
            <button
              onClick={() => setIsPairingModalOpen(false)}
              className="text-xs text-neutral-400 hover:text-white px-2.5 py-1 rounded-lg bg-white/[0.04] hover:bg-white/10 transition-colors touch-target sm:min-h-0 sm:min-w-0"
            >
              Cancel
            </button>
          ) : (
            <button
              onClick={() => signOut()}
              className="text-xs text-neutral-400 hover:text-rose-400 px-2.5 py-1 rounded-lg bg-white/[0.04] hover:bg-rose-500/10 transition-colors touch-target sm:min-h-0 sm:min-w-0"
            >
              Sign Out
            </button>
          )}
        </div>

        {/* Pairing Hardware Animation Illustration */}
        <div className="flex items-center justify-center my-4 sm:my-6">
          <div className="relative flex items-center gap-6 sm:gap-8">
            {/* User Phone */}
            <div className="w-12 sm:w-14 h-20 sm:h-24 rounded-2xl bg-[#090B0E] border-2 border-white/10 flex flex-col items-center justify-between p-2 shadow-lg">
              <div className="w-4 h-1 rounded-full bg-white/20" />
              <div className="w-6 h-6 rounded-full bg-[#00D1FF]/10 flex items-center justify-center">
                <Droplets className="w-3.5 h-3.5 text-[#00D1FF]" />
              </div>
              <div className="w-3 h-0.5 rounded-full bg-white/20" />
            </div>

            {/* Wireless Connecting Radio Waves */}
            <div className="flex flex-col items-center gap-1">
              <div className="relative flex items-center justify-center w-14 sm:w-16">
                <motion.div
                  animate={{
                    scale: [1, 1.35, 1],
                    opacity: [0.3, 0.8, 0.3],
                  }}
                  transition={{ repeat: Infinity, duration: 2, ease: 'easeInOut' }}
                  className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-[#00D1FF]/10 border border-[#00D1FF]/30 flex items-center justify-center"
                >
                  <Wifi className="w-4 h-4 text-[#00D1FF]" />
                </motion.div>
              </div>
              <span className="text-[9px] sm:text-[10px] font-mono text-[#00D1FF] uppercase tracking-widest mt-1">
                BLE / Wi-Fi
              </span>
            </div>

            {/* AquaSense X Smart Bottle */}
            <div className="w-11 sm:w-12 h-24 sm:h-28 rounded-2xl bg-[#090B0E] border-2 border-[#00D1FF]/40 flex flex-col items-center justify-between p-1.5 shadow-lg shadow-[#00D1FF]/10 relative">
              {/* Bottle cap UV sensor */}
              <div className="w-7 sm:w-8 h-3.5 sm:h-4 rounded-lg bg-white/[0.06] border border-white/10 flex items-center justify-center">
                <div className="w-2 h-2 rounded-full bg-[#00D1FF] animate-pulse" />
              </div>
              {/* Liquid chamber */}
              <div className="w-full h-12 sm:h-14 rounded-lg bg-[#00D1FF]/15 border border-[#00D1FF]/30 flex items-center justify-center">
                <span className="text-[8px] font-mono text-[#00D1FF]">ESP32</span>
              </div>
              <div className="w-6 sm:w-7 h-1 sm:h-1.5 rounded-full bg-white/20" />
            </div>
          </div>
        </div>

        {/* Text Header */}
        <div className="text-center mb-5 sm:mb-6">
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white font-sans">
            Connect Your AquaSense X
          </h1>
          <p className="text-xs text-neutral-400 mt-1 max-w-sm mx-auto leading-relaxed px-2">
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
              className="mb-4 sm:mb-5 p-3 sm:p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-center gap-2"
            >
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{errorMessage}</span>
            </motion.div>
          )}

          {status === 'validating' && (
            <motion.div
              initial={{ opacity: 0, y: -5 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-4 sm:mb-5 p-3 sm:p-3.5 rounded-2xl bg-[#00D1FF]/10 border border-[#00D1FF]/30 text-[#00D1FF] text-xs flex items-center justify-between"
            >
              <div className="flex items-center gap-2">
                <Cpu className="w-4 h-4 text-[#00D1FF] animate-spin" />
                <span className="font-medium text-white">Checking bottle registry...</span>
              </div>
              <span className="text-[11px] font-mono text-[#00D1FF]/80">Verifying ESP32</span>
            </motion.div>
          )}

          {status === 'success' && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="mb-4 sm:mb-5 p-3.5 sm:p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-3"
            >
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
              <div>
                <p className="font-semibold text-white">Bottle paired successfully!</p>
                <p className="text-[11px] text-emerald-300/80">Redirecting to your live dashboard...</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Pairing Form */}
        <form onSubmit={handleConnect} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-neutral-400 mb-1.5">
              Bottle Serial ID
            </label>
            <div className="relative">
              <input
                type="text"
                required
                value={bottleInput}
                onChange={(e) => handleInputChange(e.target.value)}
                placeholder="ASX-XXXX-XXXX"
                maxLength={13}
                className="w-full bg-[#090B0E] border border-white/10 rounded-2xl px-4 py-3 text-base sm:text-lg font-mono text-center tracking-widest text-[#00D1FF] focus:outline-none focus:border-[#00D1FF]/50 transition-colors uppercase"
              />
            </div>
          </div>

          {/* Connect Button */}
          <button
            type="submit"
            disabled={status === 'validating' || status === 'success'}
            className="w-full mt-2 py-3.5 px-4 rounded-2xl bg-[#00D1FF] hover:bg-[#00B4D8] text-[#090B0E] font-semibold text-sm flex items-center justify-center gap-2 shadow-lg shadow-[#00D1FF]/20 active:scale-98 transition-all disabled:opacity-50 touch-target"
          >
            {status === 'validating' ? (
              <>
                <span className="inline-block w-4 h-4 border-2 border-[#090B0E] border-t-transparent rounded-full animate-spin" />
                <span>Checking bottle...</span>
              </>
            ) : status === 'success' ? (
              <>
                <CheckCircle2 className="w-4 h-4" />
                <span>Bottle Paired!</span>
              </>
            ) : (
              <>
                <span>Connect Bottle</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        {/* Security / Onboarding Guarantee Footer */}
        <div className="mt-5 sm:mt-6 pt-3.5 sm:pt-4 border-t border-white/5 flex items-center justify-between text-[10px] sm:text-[11px] text-neutral-500">
          <span className="flex items-center gap-1 truncate">
            <Sparkles className="w-3 h-3 text-[#00D1FF] shrink-0" /> Verified Device Registry
          </span>
          <span className="shrink-0 font-mono">BLE v5.3</span>
        </div>
      </motion.div>
    </div>
  );
};

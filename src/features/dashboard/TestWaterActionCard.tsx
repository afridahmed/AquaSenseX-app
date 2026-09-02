import React, { useState } from 'react';
import { FlaskConical, ArrowRight, MapPin, WifiOff, AlertCircle } from 'lucide-react';

interface TestWaterActionCardProps {
  onOpenTestModal: () => void;
  online?: boolean;
}

export const TestWaterActionCard: React.FC<TestWaterActionCardProps> = ({
  onOpenTestModal,
  online = true,
}) => {
  const [showTooltip, setShowTooltip] = useState(false);

  const handleClick = () => {
    if (!online) {
      setShowTooltip(true);
      setTimeout(() => setShowTooltip(false), 3500);
      return;
    }
    onOpenTestModal();
  };

  return (
    <div
      className={`relative overflow-hidden rounded-2xl sm:rounded-[24px] border transition-all ${
        online
          ? 'bg-gradient-to-r from-[#12161C] via-[#141B24] to-[#101720] border-[#00D1FF]/25 shadow-xl hover:border-[#00D1FF]/40 group'
          : 'bg-[#12161C]/80 border-white/5 opacity-60'
      }`}
    >
      {/* Ambient water glow (only when online) */}
      {online && (
        <div className="absolute -right-12 -top-12 w-36 h-36 bg-[#00D1FF]/10 rounded-full blur-3xl pointer-events-none group-hover:bg-[#00D1FF]/15 transition-all duration-500" />
      )}

      <div className="relative z-10 p-3 xs:p-3.5 sm:p-4.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-4">
        {/* Left icon + copy block */}
        <div className="flex items-center gap-2.5 sm:gap-3.5 min-w-0">
          <div
            className={`w-8 h-8 sm:w-9 sm:h-9 rounded-xl border flex items-center justify-center shrink-0 transition-colors ${
              online
                ? 'bg-[#00D1FF]/15 border-[#00D1FF]/30 text-[#00D1FF] shadow-sm shadow-[#00D1FF]/10'
                : 'bg-white/5 border-white/10 text-neutral-500'
            }`}
          >
            {online ? <FlaskConical className="w-4 h-4" /> : <WifiOff className="w-4 h-4" />}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 mb-0.5">
              <span
                className={`text-[10px] sm:text-[11px] font-semibold uppercase tracking-wider flex items-center gap-1 ${
                  online ? 'text-[#00D1FF]' : 'text-neutral-400'
                }`}
              >
                {online ? (
                  <>
                    <MapPin className="w-3 h-3 text-[#00D1FF]" />
                    <span>Test a New Source</span>
                  </>
                ) : (
                  <>
                    <WifiOff className="w-3 h-3 text-neutral-400" />
                    <span>Test Water · Device Offline</span>
                  </>
                )}
              </span>
            </div>

            {/* Supporting sentence or offline explanation */}
            <p className="text-xs text-neutral-300 leading-snug">
              {online
                ? 'Capture live sensor telemetry to verify and report an unmapped fountain or tap.'
                : 'Live bottle connection required to generate reports.'}
            </p>
          </div>
        </div>

        {/* Primary Action Button */}
        <div className="w-full sm:w-auto shrink-0 relative">
          <button
            id="btn-dashboard-test-report"
            type="button"
            onClick={handleClick}
            disabled={!online}
            title={!online ? 'Live bottle connection required to generate reports' : undefined}
            className={`w-full sm:w-auto flex items-center justify-center gap-1.5 px-3.5 sm:px-4 py-2 sm:py-2.5 rounded-xl text-xs font-semibold transition-all touch-target sm:min-h-0 select-none ${
              online
                ? 'bg-[#00D1FF] hover:bg-[#00B4D8] active:bg-[#0096B4] text-[#090B0E] shadow-md shadow-[#00D1FF]/20 active:scale-[0.98] cursor-pointer'
                : 'bg-neutral-800 text-neutral-400 border border-neutral-700/60 cursor-not-allowed opacity-80'
            }`}
          >
            <FlaskConical className="w-3.5 h-3.5 shrink-0" />
            <span className="whitespace-nowrap">Test & Report</span>
            {online && (
              <ArrowRight className="w-3 h-3 shrink-0 opacity-80 group-hover:translate-x-0.5 transition-transform" />
            )}
          </button>

          {/* Disabled tooltip state on click/hover */}
          {showTooltip && !online && (
            <div className="absolute bottom-full right-0 mb-2 w-64 p-2 bg-neutral-900 border border-amber-500/40 text-amber-300 rounded-xl text-[11px] shadow-2xl z-20 flex items-start gap-1.5 animate-fadeIn">
              <AlertCircle className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
              <span>Live bottle connection required to generate reports</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};


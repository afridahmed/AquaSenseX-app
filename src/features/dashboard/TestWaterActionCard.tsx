import React from 'react';
import { FlaskConical, ArrowRight, MapPin } from 'lucide-react';

interface TestWaterActionCardProps {
  onOpenTestModal: () => void;
}

export const TestWaterActionCard: React.FC<TestWaterActionCardProps> = ({ onOpenTestModal }) => {
  return (
    <div className="relative overflow-hidden rounded-[22px] sm:rounded-[26px] bg-gradient-to-r from-[#12161C] via-[#141B24] to-[#101720] border border-[#00D1FF]/25 shadow-xl hover:border-[#00D1FF]/40 transition-all group">
      {/* Ambient water glow */}
      <div className="absolute -right-12 -top-12 w-40 h-40 bg-[#00D1FF]/10 rounded-full blur-3xl pointer-events-none group-hover:bg-[#00D1FF]/15 transition-all duration-500" />

      <div className="relative z-10 p-3.5 xs:p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
        {/* Left icon + copy block */}
        <div className="flex items-center gap-3 sm:gap-3.5 min-w-0">
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-[#00D1FF]/15 border border-[#00D1FF]/30 flex items-center justify-center shrink-0 shadow-md shadow-[#00D1FF]/10 text-[#00D1FF] group-hover:scale-105 transition-transform duration-300">
            <FlaskConical className="w-4 h-4 sm:w-5 sm:h-5" />
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-0.5">
              <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-[#00D1FF] flex items-center gap-1">
                <MapPin className="w-3 h-3 text-[#00D1FF]" />
                <span>Test a New Source</span>
              </span>
            </div>

            {/* Mobile / Tablet / Desktop concise copy */}
            <p className="text-xs sm:text-sm text-neutral-200 leading-snug line-clamp-2 sm:line-clamp-none max-w-xl">
              Testing water from an unknown tap or fountain? Check purity before drinking & optionally share to the Community Map.
            </p>
          </div>
        </div>

        {/* Primary Action Button */}
        <div className="w-full sm:w-auto shrink-0 pt-0.5 sm:pt-0">
          <button
            onClick={onOpenTestModal}
            className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 sm:px-5 py-2.5 sm:py-2.5 rounded-xl bg-[#00D1FF] hover:bg-[#00B4D8] active:bg-[#0096B4] text-[#090B0E] text-xs sm:text-sm font-bold shadow-lg shadow-[#00D1FF]/20 active:scale-[0.98] transition-all touch-target sm:min-h-0 sm:min-w-0 cursor-pointer select-none"
          >
            <FlaskConical className="w-4 h-4 shrink-0" />
            <span className="whitespace-nowrap">Test & Report</span>
            <ArrowRight className="w-3.5 h-3.5 shrink-0 opacity-80 group-hover:translate-x-0.5 transition-transform" />
          </button>
        </div>
      </div>
    </div>
  );
};

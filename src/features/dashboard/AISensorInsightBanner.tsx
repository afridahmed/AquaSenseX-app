import React, { useState } from 'react';
import { Sparkles, RefreshCw, ChevronRight } from 'lucide-react';

interface AISensorInsightBannerProps {
  aiTip: string;
  onRefreshTip: () => Promise<void>;
  onNavigateToCoach?: () => void;
}

export const AISensorInsightBanner: React.FC<AISensorInsightBannerProps> = ({
  aiTip,
  onRefreshTip,
  onNavigateToCoach,
}) => {
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsRefreshing(true);
    try {
      await onRefreshTip();
    } finally {
      setTimeout(() => setIsRefreshing(false), 500);
    }
  };

  return (
    <div
      onClick={onNavigateToCoach}
      className={`group relative overflow-hidden rounded-2xl bg-gradient-to-r from-[#00D1FF]/10 via-[#12161C] to-[#0077FF]/10 border border-[#00D1FF]/20 hover:border-[#00D1FF]/35 px-3 xs:px-3.5 sm:px-4 py-2 sm:py-2.5 transition-all shadow-md flex items-center justify-between gap-2.5 sm:gap-3.5 ${
        onNavigateToCoach ? 'cursor-pointer' : ''
      }`}
    >
      {/* Icon + Small Label + 1-2 sentence Insight */}
      <div className="flex items-center gap-2.5 sm:gap-3 min-w-0 flex-1">
        <div className="w-6 h-6 rounded-lg bg-[#00D1FF]/15 border border-[#00D1FF]/30 flex items-center justify-center shrink-0 text-[#00D1FF]">
          <Sparkles className="w-3.5 h-3.5" />
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center gap-0.5 sm:gap-2.5 min-w-0 flex-1">
          <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-[#00D1FF] shrink-0">
            AI Insight
          </span>
          <span className="text-xs sm:text-sm text-neutral-200 truncate leading-tight">
            {aiTip}
          </span>
        </div>
      </div>

      {/* Action Area: Refresh icon & Coach view */}
      <div className="flex items-center gap-1.5 shrink-0">
        <button
          onClick={handleRefresh}
          disabled={isRefreshing}
          title="Refresh AI analysis"
          className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-white/5 transition-colors touch-target sm:min-h-0 sm:min-w-0"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-[#00D1FF]' : ''}`} />
        </button>

        {onNavigateToCoach && (
          <span className="inline-flex items-center gap-0.5 text-xs font-semibold text-[#00D1FF] group-hover:text-cyan-300 transition-colors pl-1">
            <span className="hidden xs:inline">Coach</span>
            <ChevronRight className="w-3.5 h-3.5 opacity-70 group-hover:translate-x-0.5 transition-transform" />
          </span>
        )}
      </div>
    </div>
  );
};

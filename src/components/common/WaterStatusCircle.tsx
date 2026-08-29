import React from 'react';
import { WaterQualityEvaluation } from '../../types';
import { motion } from 'motion/react';
import { ShieldCheck, AlertCircle, AlertTriangle, Sparkles, WifiOff } from 'lucide-react';

interface WaterStatusCircleProps {
  evaluation: WaterQualityEvaluation;
  online?: boolean;
}

export const WaterStatusCircle: React.FC<WaterStatusCircleProps> = ({ evaluation, online = true }) => {
  const { score, headline, category, badgeBg, badgeText, colorClass } = evaluation;

  const isOffline = !online || score === null || score === undefined;

  // SVG Gauge calculations
  const size = 260;
  const strokeWidth = 14;
  const center = size / 2;
  const radius = center - strokeWidth - 8;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = isOffline
    ? circumference
    : circumference - ((score ?? 0) / 100) * circumference;

  // Category Icon
  const renderCategoryIcon = () => {
    if (isOffline) {
      return <WifiOff className="w-3.5 h-3.5 text-neutral-400 shrink-0" />;
    }
    if (score >= 70) return <ShieldCheck className="w-3.5 h-3.5 text-cyan-400 shrink-0" />;
    if (score >= 50) return <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />;
    return <AlertCircle className="w-3.5 h-3.5 text-rose-400 shrink-0" />;
  };

  // Color stroke gradient
  const getStrokeColor = () => {
    if (isOffline) return '#262626';
    if (score >= 88) return '#00D1FF'; // Electric Cyan
    if (score >= 70) return '#10b981'; // Emerald
    if (score >= 50) return '#f59e0b'; // Amber
    return '#f43f5e'; // Rose
  };

  return (
    <div className="flex flex-col items-center justify-between p-4 xs:p-5 sm:p-6 lg:p-7 rounded-[28px] sm:rounded-[32px] bg-[#12161C] border border-white/5 relative overflow-hidden shadow-2xl transition-all h-full">
      {/* Subtle background radiant glow (disabled when offline) */}
      <div
        className={`absolute -top-24 left-1/2 -translate-x-1/2 w-48 sm:w-64 h-48 sm:h-64 rounded-full blur-3xl transition-all duration-700 pointer-events-none ${
          isOffline ? 'opacity-0' : 'opacity-20'
        }`}
        style={{ backgroundColor: isOffline ? 'transparent' : getStrokeColor() }}
      />

      {/* Top Status Header Badge */}
      <div className="flex items-center gap-2 mb-2 sm:mb-3 z-10">
        <span
          className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] sm:text-xs font-semibold uppercase tracking-wider border ${
            isOffline
              ? 'bg-neutral-800/80 border-neutral-700/60 text-neutral-300'
              : `${badgeBg} ${badgeText}`
          }`}
        >
          {renderCategoryIcon()}
          <span>{isOffline ? 'DEVICE OFFLINE' : headline}</span>
        </span>
      </div>

      {/* Circular Instrument Gauge - Responsive Diameter */}
      <div className="relative w-[180px] h-[180px] xs:w-[200px] xs:h-[200px] sm:w-[230px] sm:h-[230px] md:w-[240px] md:h-[240px] flex items-center justify-center my-1 sm:my-2">
        <svg className="w-full h-full -rotate-90 transform" viewBox={`0 0 ${size} ${size}`}>
          {/* Background track */}
          <circle
            cx={center}
            cy={center}
            r={radius}
            stroke="currentColor"
            strokeWidth={strokeWidth}
            fill="transparent"
            className="text-white/5"
          />

          {/* Animated score arc */}
          <motion.circle
            cx={center}
            cy={center}
            r={radius}
            stroke={getStrokeColor()}
            strokeWidth={strokeWidth}
            strokeDasharray={circumference}
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset }}
            transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
            strokeLinecap="round"
            fill="transparent"
          />
        </svg>

        {/* Inner Content - Typographic Cluster */}
        <div className="absolute flex flex-col items-center justify-center text-center select-none pointer-events-none">
          <span className="text-[10px] sm:text-xs uppercase tracking-widest text-neutral-400 font-medium mb-0.5">
            Purity Score
          </span>

          <motion.div
            key={isOffline ? 'offline' : score}
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.4 }}
            className="flex items-baseline justify-center"
          >
            {isOffline ? (
              <span className="text-4xl xs:text-5xl sm:text-6xl font-light tracking-tighter text-neutral-500 font-sans">
                --
              </span>
            ) : (
              <>
                <span className="text-4xl xs:text-5xl sm:text-6xl font-light tracking-tighter text-white font-sans">
                  {score}
                </span>
                <span className="text-sm sm:text-base font-light text-neutral-500 ml-1">/100</span>
              </>
            )}
          </motion.div>

          <span
            className={`text-xs sm:text-sm font-semibold tracking-wide mt-0.5 sm:mt-1 ${
              isOffline ? 'text-neutral-400' : colorClass
            }`}
          >
            {isOffline ? 'Offline' : category}
          </span>
        </div>
      </div>

      {/* Description */}
      <p className="text-[11px] sm:text-xs text-center text-neutral-400 max-w-xs sm:max-w-sm mt-1 leading-relaxed z-10 px-1">
        {isOffline
          ? 'AquaSense X is currently offline. Connect your bottle or stream telemetry to view active purity screening.'
          : evaluation.description}
      </p>

      {/* Safety Notice Footer */}
      <div className="mt-3 sm:mt-4 pt-2.5 sm:pt-3 border-t border-white/5 w-full flex items-center justify-center gap-1.5 text-[10px] sm:text-[11px] text-neutral-500">
        <Sparkles className={`w-3.5 h-3.5 shrink-0 ${isOffline ? 'text-neutral-500' : 'text-[#00D1FF]/70'}`} />
        <span className="truncate">
          {isOffline
            ? 'Standby mode • Waiting for hardware connection'
            : 'Multi-spectral optical & electrochemical screening'}
        </span>
      </div>
    </div>
  );
};


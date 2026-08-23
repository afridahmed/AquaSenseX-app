import React from 'react';
import { WaterQualityEvaluation } from '../../types';
import { motion } from 'motion/react';
import { ShieldCheck, AlertCircle, AlertTriangle, Sparkles } from 'lucide-react';

interface WaterStatusCircleProps {
  evaluation: WaterQualityEvaluation;
  online?: boolean;
}

export const WaterStatusCircle: React.FC<WaterStatusCircleProps> = ({ evaluation, online = true }) => {
  const { score, headline, category, badgeBg, badgeText, colorClass, safetyDisclaimer } = evaluation;

  // SVG Gauge calculations
  const size = 260;
  const strokeWidth = 14;
  const center = size / 2;
  const radius = center - strokeWidth - 8;
  const circumference = 2 * Math.PI * radius;
  // Use a 270-degree arc for Tesla-like instrument cluster style
  const strokeDashoffset = circumference - (score / 100) * circumference;

  // Category Icon
  const renderCategoryIcon = () => {
    if (score >= 70) return <ShieldCheck className="w-4 h-4 text-cyan-400" />;
    if (score >= 50) return <AlertTriangle className="w-4 h-4 text-amber-400" />;
    return <AlertCircle className="w-4 h-4 text-rose-400" />;
  };

  // Color stroke gradient
  const getStrokeColor = () => {
    if (score >= 88) return '#00D1FF'; // Electric Cyan
    if (score >= 70) return '#10b981'; // Emerald
    if (score >= 50) return '#f59e0b'; // Amber
    return '#f43f5e'; // Rose
  };

  return (
    <div className="flex flex-col items-center justify-center p-6 rounded-[32px] bg-[#141414] border border-[#222222] relative overflow-hidden shadow-2xl transition-all">
      {/* Subtle background radiant glow */}
      <div
        className="absolute -top-24 left-1/2 -translate-x-1/2 w-64 h-64 rounded-full blur-3xl opacity-20 pointer-events-none transition-colors duration-700"
        style={{ backgroundColor: getStrokeColor() }}
      />

      {/* Top Status Header */}
      <div className="flex items-center gap-2 mb-3 z-10">
        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider border ${badgeBg} ${badgeText}`}>
          {renderCategoryIcon()}
          {headline}
        </span>
      </div>

      {/* Circular Instrument Gauge */}
      <div className="relative w-[240px] h-[240px] flex items-center justify-center my-2">
        <svg className="w-full h-full -rotate-90 transform" viewBox={`0 0 ${size} ${size}`}>
          {/* Background track */}
          <circle
            cx={center}
            cy={center}
            r={radius}
            stroke="currentColor"
            strokeWidth={strokeWidth}
            fill="transparent"
            className="text-[#1E1E1E]"
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

        {/* Inner Content - Clean Typographic Cluster */}
        <div className="absolute flex flex-col items-center justify-center text-center select-none pointer-events-none">
          <span className="text-xs uppercase tracking-widest text-[#888888] font-medium mb-0.5">
            Water Purity
          </span>

          <motion.div
            key={score}
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.4 }}
            className="flex items-baseline justify-center"
          >
            <span className="text-6xl font-light tracking-tighter text-[#F5F5F5] font-sans">
              {score}
            </span>
            <span className="text-lg font-light text-[#888888] ml-1">/100</span>
          </motion.div>

          <span className={`text-sm font-semibold tracking-wide mt-1 ${colorClass}`}>
            {category}
          </span>
        </div>
      </div>

      {/* Description */}
      <p className="text-xs text-center text-[#888888] max-w-xs mt-1 leading-relaxed z-10">
        {evaluation.description}
      </p>

      {/* Safety Notice Footer */}
      <div className="mt-4 pt-3 border-t border-[#1E1E1E] w-full flex items-center justify-center gap-1.5 text-[11px] text-[#555555]">
        <Sparkles className="w-3.5 h-3.5 text-[#00D1FF]/70 shrink-0" />
        <span className="line-clamp-1">Multi-spectral optical & electrochemical screening</span>
      </div>
    </div>
  );
};

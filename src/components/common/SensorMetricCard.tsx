import React from 'react';
import { QualityParameterDetail } from '../../types';
import { Thermometer, Activity, Eye, Zap, Battery } from 'lucide-react';

interface SensorMetricCardProps {
  type: 'ph' | 'tds' | 'turbidity' | 'temperature' | 'battery';
  detail?: QualityParameterDetail;
  rawNumericValue?: number;
  unit?: string;
  sublabel?: string;
  online?: boolean;
}

export const SensorMetricCard: React.FC<SensorMetricCardProps> = ({
  type,
  detail,
  rawNumericValue,
  unit,
  sublabel,
  online = true,
}) => {
  const getIcon = () => {
    switch (type) {
      case 'temperature':
        return <Thermometer className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-sky-400" />;
      case 'tds':
        return <Activity className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-400" />;
      case 'turbidity':
        return <Eye className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-cyan-400" />;
      case 'ph':
        return <Zap className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-indigo-400" />;
      case 'battery':
        return <Battery className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-400" />;
    }
  };

  const getStatusPill = (status?: string) => {
    switch (status) {
      case 'optimal':
        return (
          <span className="text-[9px] sm:text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shrink-0">
            Optimal
          </span>
        );
      case 'acceptable':
        return (
          <span className="text-[9px] sm:text-[10px] font-semibold px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 shrink-0">
            Normal
          </span>
        );
      case 'warning':
        return (
          <span className="text-[9px] sm:text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 shrink-0">
            Caution
          </span>
        );
      case 'danger':
        return (
          <span className="text-[9px] sm:text-[10px] font-semibold px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/20 shrink-0">
            Alert
          </span>
        );
      default:
        return null;
    }
  };

  const value = detail ? detail.value : rawNumericValue ?? '--';
  const displayUnit = detail ? detail.unit : unit ?? '';
  const title = detail ? detail.name : type.toUpperCase();
  const range = detail?.idealRange || sublabel;

  return (
    <div className="p-3.5 xs:p-4 sm:p-5 rounded-[22px] sm:rounded-[26px] bg-[#12161C] border border-white/5 flex flex-col justify-between hover:border-[#00D1FF]/30 transition-all group shadow-lg min-w-0">
      {/* Top Header */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-white/[0.04] border border-white/10 flex items-center justify-center group-hover:scale-105 transition-transform shrink-0">
            {getIcon()}
          </div>
          <span className="text-[10px] sm:text-xs uppercase tracking-wider text-neutral-400 font-medium truncate">
            {title}
          </span>
        </div>
        {getStatusPill(detail?.status)}
      </div>

      {/* Primary Value Cluster */}
      <div className="my-2.5 sm:my-3">
        <div className="flex items-baseline min-w-0">
          <span className="text-2xl xs:text-3xl sm:text-4xl font-light tracking-tight text-white font-sans truncate">
            {value}
          </span>
          <span className="text-xs sm:text-sm font-normal text-neutral-400 ml-1.5 shrink-0">{displayUnit}</span>
        </div>
        {range && (
          <p className="text-[10px] sm:text-[11px] text-neutral-400 mt-0.5 truncate">
            Target: <span className="text-neutral-200">{range}</span>
          </p>
        )}
      </div>

      {/* Description or insight */}
      {detail?.description && (
        <p className="text-[10px] sm:text-[11px] text-neutral-400 border-t border-white/5 pt-2 sm:pt-2.5 line-clamp-2 leading-relaxed">
          {detail.description}
        </p>
      )}
    </div>
  );
};


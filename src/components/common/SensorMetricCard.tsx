import React from 'react';
import { QualityParameterDetail } from '../../types';
import { Thermometer, Activity, Eye, Zap, Battery, Wifi } from 'lucide-react';

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
        return <Thermometer className="w-4 h-4 text-sky-400" />;
      case 'tds':
        return <Activity className="w-4 h-4 text-emerald-400" />;
      case 'turbidity':
        return <Eye className="w-4 h-4 text-cyan-400" />;
      case 'ph':
        return <Zap className="w-4 h-4 text-indigo-400" />;
      case 'battery':
        return <Battery className="w-4 h-4 text-amber-400" />;
    }
  };

  const getStatusPill = (status?: string) => {
    switch (status) {
      case 'optimal':
        return <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">Optimal</span>;
      case 'acceptable':
        return <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">Normal</span>;
      case 'warning':
        return <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">Caution</span>;
      case 'danger':
        return <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/20">Alert</span>;
      default:
        return null;
    }
  };

  const value = detail ? detail.value : rawNumericValue ?? '--';
  const displayUnit = detail ? detail.unit : unit ?? '';
  const title = detail ? detail.name : type.toUpperCase();
  const range = detail?.idealRange || sublabel;

  return (
    <div className="p-5 rounded-[24px] bg-[#141414] border border-[#222222] flex flex-col justify-between hover:border-[#00D1FF]/40 transition-all group shadow-lg">
      {/* Top Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-[#1E1E1E] border border-white/5 flex items-center justify-center group-hover:scale-105 transition-transform">
            {getIcon()}
          </div>
          <span className="text-xs uppercase tracking-wider text-[#888888] font-medium">
            {title}
          </span>
        </div>
        {getStatusPill(detail?.status)}
      </div>

      {/* Primary Value Cluster */}
      <div className="my-3">
        <div className="flex items-baseline">
          <span className="text-3xl lg:text-4xl font-light tracking-tight text-[#F5F5F5] font-sans">
            {value}
          </span>
          <span className="text-sm font-normal text-[#888888] ml-1.5">{displayUnit}</span>
        </div>
        {range && (
          <p className="text-[11px] text-[#888888] mt-1 line-clamp-1">
            Target: <span className="text-neutral-300">{range}</span>
          </p>
        )}
      </div>

      {/* Description or insight */}
      {detail?.description && (
        <p className="text-[11px] text-[#888888] border-t border-[#1E1E1E] pt-2.5 line-clamp-2 leading-relaxed">
          {detail.description}
        </p>
      )}
    </div>
  );
};

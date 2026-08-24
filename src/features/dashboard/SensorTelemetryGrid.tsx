import React from 'react';
import { QualityParameterDetail } from '../../types';
import { Thermometer, Waves, Eye, FlaskConical } from 'lucide-react';
import { motion } from 'motion/react';

interface SensorTelemetryGridProps {
  parameters: {
    temperature: QualityParameterDetail;
    tds: QualityParameterDetail;
    turbidity: QualityParameterDetail;
    ph: QualityParameterDetail;
  };
  online?: boolean;
}

export const SensorTelemetryGrid: React.FC<SensorTelemetryGridProps> = ({
  parameters,
  online = true,
}) => {
  // Subtle normality indicator - only flags warning/alert states
  const renderStatusDot = (status?: string) => {
    if (status === 'warning') {
      return (
        <span className="flex items-center gap-1 shrink-0">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />
          <span className="text-[9px] font-medium text-amber-400/90 hidden xs:inline">Caution</span>
        </span>
      );
    }
    if (status === 'danger') {
      return (
        <span className="flex items-center gap-1 shrink-0">
          <span className="w-1.5 h-1.5 rounded-full bg-rose-400 shrink-0 animate-pulse" />
          <span className="text-[9px] font-medium text-rose-400/90 hidden xs:inline">Alert</span>
        </span>
      );
    }
    return null;
  };

  const sensors = [
    {
      id: 'temp',
      label: 'Temperature',
      detail: parameters.temperature,
      icon: <Thermometer className="w-3.5 h-3.5 text-[#00D1FF]/80" />,
      borderClass: 'border-r border-b md:border-b-0 border-white/5',
    },
    {
      id: 'tds',
      label: 'TDS',
      detail: parameters.tds,
      icon: <Waves className="w-3.5 h-3.5 text-[#00D1FF]/80" />,
      borderClass: 'border-b md:border-b-0 md:border-r border-white/5',
    },
    {
      id: 'turbidity',
      label: 'Turbidity',
      detail: parameters.turbidity,
      icon: <Eye className="w-3.5 h-3.5 text-[#00D1FF]/80" />,
      borderClass: 'border-r border-white/5',
    },
    {
      id: 'ph',
      label: 'pH Level',
      detail: parameters.ph,
      icon: <FlaskConical className="w-3.5 h-3.5 text-[#00D1FF]/80" />,
      borderClass: '',
    },
  ];

  return (
    <div className="rounded-2xl sm:rounded-[22px] bg-[#12161C] border border-white/5 shadow-lg overflow-hidden">
      {/* 2 × 2 on mobile/tablet, 4-column horizontal on laptop/desktop */}
      <div className="grid grid-cols-2 md:grid-cols-4">
        {sensors.map((sensor) => {
          const { id, label, detail, icon, borderClass } = sensor;
          return (
            <div
              key={id}
              className={`p-3 xs:p-3.5 sm:p-4 md:p-3.5 lg:p-4 flex flex-col justify-between min-w-0 bg-[#12161C] hover:bg-white/[0.01] transition-colors ${borderClass}`}
            >
              {/* Header: Subtle Icon + Muted Label + Status Dot if non-optimal */}
              <div className="flex items-center justify-between gap-1.5">
                <div className="flex items-center gap-1.5 min-w-0">
                  <div className="w-5 h-5 rounded-md bg-[#00D1FF]/10 flex items-center justify-center shrink-0">
                    {icon}
                  </div>
                  <span className="text-[10px] sm:text-[11px] uppercase tracking-wider text-neutral-400 font-medium truncate">
                    {label}
                  </span>
                </div>
                {renderStatusDot(detail.status)}
              </div>

              {/* Numerical Telemetry Value & Unit (Animated subtly on change) */}
              <div className="mt-1.5 sm:mt-2">
                <motion.div
                  key={detail.value}
                  initial={{ opacity: 0.7 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.2 }}
                  className="flex items-baseline min-w-0 gap-1"
                >
                  <span className="text-xl xs:text-2xl sm:text-2xl lg:text-3xl font-light tracking-tight text-white font-sans truncate">
                    {detail.value}
                  </span>
                  {detail.unit && (
                    <span className="text-[10px] sm:text-[11px] lg:text-xs font-normal text-neutral-400 shrink-0">
                      {detail.unit}
                    </span>
                  )}
                </motion.div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

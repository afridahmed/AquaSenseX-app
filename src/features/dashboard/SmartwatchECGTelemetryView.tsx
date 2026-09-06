import React, { useMemo } from 'react';
import { Activity, Sparkles, Zap, Waves, Droplets, Thermometer, Eye } from 'lucide-react';
import { motion } from 'motion/react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  AreaChart,
  Area,
} from 'recharts';
import { BottleData } from '../../types';

export interface SmartwatchECGTelemetryViewProps {
  scanProgress: number; // 0 to 100
  remainingSeconds: number;
  packetCount: number;
  readingBuffer?: BottleData[];
  currentPh?: number | null;
  currentTds?: number | null;
  currentTurbidity?: number | null;
  currentTemp?: number | null;
}

export const SmartwatchECGTelemetryView: React.FC<SmartwatchECGTelemetryViewProps> = ({
  scanProgress,
  remainingSeconds,
  packetCount,
  readingBuffer = [],
  currentPh = 7.2,
  currentTds = 145,
  currentTurbidity = 0.32,
  currentTemp = 21.4,
}) => {
  // Format live telemetry buffer into time-series chart data points
  const chartData = useMemo(() => {
    if (!readingBuffer || readingBuffer.length === 0) {
      // Seed with initial baseline point if buffer is initializing
      return [
        {
          point: 1,
          timeLabel: '0s',
          ph: currentPh ?? 7.2,
          tds: currentTds ?? 145,
          turbidity: currentTurbidity ?? 0.32,
          temperature: currentTemp ?? 21.4,
          // Normalized 0-100 values for cohesive multi-metric overlays
          phNorm: Math.min(100, Math.max(0, (((currentPh ?? 7.2) - 5) / (9 - 5)) * 100)),
          tdsNorm: Math.min(100, Math.max(0, ((currentTds ?? 145) / 500) * 100)),
          turbNorm: Math.min(100, Math.max(0, ((currentTurbidity ?? 0.32) / 5) * 100)),
          tempNorm: Math.min(100, Math.max(0, (((currentTemp ?? 21.4) - 10) / (35 - 10)) * 100)),
        },
      ];
    }

    return readingBuffer.map((packet, idx) => {
      const phVal = packet.ph ?? currentPh ?? 7.2;
      const tdsVal = packet.tds ?? currentTds ?? 145;
      const turbVal = packet.turbidity ?? currentTurbidity ?? 0.32;
      const tempVal = packet.temperature ?? currentTemp ?? 21.4;

      return {
        point: idx + 1,
        timeLabel: `${Math.round((idx / Math.max(readingBuffer.length - 1, 1)) * 15)}s`,
        ph: phVal,
        tds: tdsVal,
        turbidity: turbVal,
        temperature: tempVal,
        // Normalized 0-100 scale for multi-line telemetry view
        phNorm: Math.min(100, Math.max(0, ((phVal - 5) / (9 - 5)) * 100)),
        tdsNorm: Math.min(100, Math.max(0, (tdsVal / 500) * 100)),
        turbNorm: Math.min(100, Math.max(0, (turbVal / 5) * 100)),
        tempNorm: Math.min(100, Math.max(0, ((tempVal - 10) / (35 - 10)) * 100)),
      };
    });
  }, [readingBuffer, currentPh, currentTds, currentTurbidity, currentTemp]);

  return (
    <div className="flex flex-col gap-3 w-full">
      {/* 1. Top HUD Bar */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-[#00D1FF]/15 border border-[#00D1FF]/30 text-[#00D1FF] flex items-center justify-center shrink-0">
            <Activity className="w-4 h-4 animate-pulse text-[#00D1FF]" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="text-xs sm:text-sm font-bold text-white tracking-tight truncate">
                Live Sensor Telemetry Stream
              </span>
              <span className="w-2 h-2 rounded-full bg-[#00D1FF] animate-ping shrink-0" />
            </div>
            <p className="text-[10px] sm:text-[11px] text-neutral-400 font-mono truncate">
              Dynamic ESP32 telemetry · Multi-channel packet capture
            </p>
          </div>
        </div>

        {/* Smartwatch-style countdown & packet status */}
        <div className="flex items-center gap-1.5 shrink-0">
          <span className="text-[10px] sm:text-xs font-mono font-bold text-neutral-300 bg-white/5 px-2 py-1 rounded-xl border border-white/10 hidden xs:inline">
            {Math.max(packetCount, chartData.length)} pkts
          </span>
          <span className="text-xs font-mono font-bold text-[#00D1FF] bg-[#00D1FF]/10 px-2.5 py-1 rounded-xl border border-[#00D1FF]/30 flex items-center gap-1 shadow-sm shadow-[#00D1FF]/10">
            <Zap className="w-3 h-3 text-[#00D1FF] animate-pulse" />
            <span>{remainingSeconds}s left</span>
          </span>
        </div>
      </div>

      {/* 2. Main Live Dynamic Multi-Line Graph Frame (Recharts) */}
      <div className="relative w-full rounded-2xl bg-[#07090C] border border-white/10 overflow-hidden shadow-inner p-2.5 sm:p-3 flex flex-col gap-2">
        {/* Header HUD Overlays */}
        <div className="flex items-center justify-between text-[9px] font-mono text-neutral-400 uppercase tracking-wider px-1">
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-emerald-400 font-semibold">ESP32 STREAMING</span>
            <span className="text-neutral-600 hidden xs:inline">•</span>
            <span className="text-neutral-500 hidden xs:inline">15-SEC STABILIZATION WINDOW</span>
          </div>
          <span className="text-[#00D1FF] font-medium">
            {scanProgress}% STABILIZED
          </span>
        </div>

        {/* Dynamic Live-Updating Line Chart using Recharts */}
        <div className="w-full h-28 xs:h-32 sm:h-36 relative">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 5, right: 8, left: -25, bottom: 0 }}>
              <XAxis
                dataKey="timeLabel"
                stroke="#475569"
                fontSize={9}
                tickLine={false}
                axisLine={{ stroke: 'rgba(255,255,255,0.1)' }}
              />
              <YAxis
                domain={[0, 100]}
                stroke="#475569"
                fontSize={9}
                tickLine={false}
                axisLine={false}
                hide
              />
              <Tooltip
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const data = payload[0]?.payload;
                    return (
                      <div className="bg-[#0D1117]/95 border border-white/15 p-2 rounded-xl shadow-2xl text-[10px] font-mono space-y-1 backdrop-blur-md">
                        <div className="text-neutral-400 border-b border-white/10 pb-0.5">
                          Packet #{data?.point} ({data?.timeLabel})
                        </div>
                        <div className="flex items-center justify-between gap-3 text-[#00D1FF]">
                          <span>pH:</span>
                          <span className="font-bold">{data?.ph?.toFixed(2)}</span>
                        </div>
                        <div className="flex items-center justify-between gap-3 text-[#818CF8]">
                          <span>TDS:</span>
                          <span className="font-bold">{data?.tds} ppm</span>
                        </div>
                        <div className="flex items-center justify-between gap-3 text-amber-400">
                          <span>Turbidity:</span>
                          <span className="font-bold">{data?.turbidity?.toFixed(2)} NTU</span>
                        </div>
                        <div className="flex items-center justify-between gap-3 text-emerald-400">
                          <span>Temp:</span>
                          <span className="font-bold">{data?.temperature?.toFixed(1)}°C</span>
                        </div>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              {/* Color-Coded Live Telemetry Lines */}
              <Line
                type="monotone"
                dataKey="phNorm"
                name="pH"
                stroke="#00D1FF"
                strokeWidth={2}
                dot={chartData.length <= 15}
                isAnimationActive={false}
              />
              <Line
                type="monotone"
                dataKey="tdsNorm"
                name="TDS"
                stroke="#818CF8"
                strokeWidth={1.75}
                dot={chartData.length <= 15}
                isAnimationActive={false}
              />
              <Line
                type="monotone"
                dataKey="turbNorm"
                name="Turbidity"
                stroke="#F59E0B"
                strokeWidth={1.5}
                dot={chartData.length <= 15}
                isAnimationActive={false}
              />
              <Line
                type="monotone"
                dataKey="tempNorm"
                name="Temperature"
                stroke="#10B981"
                strokeWidth={1.5}
                dot={chartData.length <= 15}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* 3. Distinct Color-Coded Sensor Sparkline Badges (pH, TDS, Turbidity, Temp) */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 pt-1 border-t border-white/5">
          {/* Stream 1: pH (Cyan) */}
          <div className="flex items-center justify-between p-1.5 rounded-xl bg-[#00D1FF]/10 border border-[#00D1FF]/25">
            <div className="flex items-center gap-1.5 min-w-0">
              <div className="w-1.5 h-1.5 rounded-full bg-[#00D1FF] shadow-sm shadow-[#00D1FF] shrink-0" />
              <span className="text-[10px] text-neutral-400 font-mono">pH</span>
            </div>
            <div className="text-right">
              <span className="text-xs font-bold text-[#00D1FF] font-mono">
                {currentPh != null ? currentPh.toFixed(2) : '--'}
              </span>
            </div>
          </div>

          {/* Stream 2: TDS (Electric Indigo) */}
          <div className="flex items-center justify-between p-1.5 rounded-xl bg-[#818CF8]/10 border border-[#818CF8]/25">
            <div className="flex items-center gap-1.5 min-w-0">
              <div className="w-1.5 h-1.5 rounded-full bg-[#818CF8] shadow-sm shadow-[#818CF8] shrink-0" />
              <span className="text-[10px] text-neutral-400 font-mono">TDS</span>
            </div>
            <div className="text-right">
              <span className="text-xs font-bold text-[#818CF8] font-mono">
                {currentTds != null ? `${currentTds} ppm` : '--'}
              </span>
            </div>
          </div>

          {/* Stream 3: Turbidity / Clarity (Amber) */}
          <div className="flex items-center justify-between p-1.5 rounded-xl bg-amber-500/10 border border-amber-500/25">
            <div className="flex items-center gap-1.5 min-w-0">
              <div className="w-1.5 h-1.5 rounded-full bg-amber-400 shadow-sm shadow-amber-400 shrink-0" />
              <span className="text-[10px] text-neutral-400 font-mono">Clarity</span>
            </div>
            <div className="text-right">
              <span className="text-xs font-bold text-amber-400 font-mono">
                {currentTurbidity != null ? `${currentTurbidity} NTU` : '--'}
              </span>
            </div>
          </div>

          {/* Stream 4: Temperature (Emerald) */}
          <div className="flex items-center justify-between p-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/25">
            <div className="flex items-center gap-1.5 min-w-0">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-sm shadow-emerald-400 shrink-0" />
              <span className="text-[10px] text-neutral-400 font-mono">Temp</span>
            </div>
            <div className="text-right">
              <span className="text-xs font-bold text-emerald-400 font-mono">
                {currentTemp != null ? `${currentTemp}°C` : '--'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 4. High-tech Progress Track & Real-Time Convergence Indicator */}
      <div className="space-y-1.5">
        <div className="w-full bg-[#090B0E] h-2 rounded-full overflow-hidden border border-white/10 p-0.5">
          <motion.div
            className="bg-gradient-to-r from-[#00D1FF] via-[#818CF8] to-[#38BDF8] h-full rounded-full shadow-sm shadow-[#00D1FF]/50"
            style={{ width: `${scanProgress}%` }}
            transition={{ ease: 'linear' }}
          />
        </div>

        <div className="flex items-center justify-between text-[10px] sm:text-[11px] text-neutral-400 font-mono px-0.5">
          <span className="flex items-center gap-1 text-[#00D1FF]">
            <Sparkles className="w-3 h-3 text-[#00D1FF]" />
            <span>
              {scanProgress}% stabilized ({scanProgress >= 80 ? 'Harmonizing' : scanProgress >= 40 ? 'Calibrating' : 'Sampling'})
            </span>
          </span>
          <span className="text-neutral-500">
            Real-time buffer streaming ({chartData.length} samples)
          </span>
        </div>
      </div>
    </div>
  );
};

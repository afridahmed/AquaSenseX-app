import React, { useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { BottleData } from '../types';

export interface LiveSensorChartProps {
  readingBuffer: BottleData[];
  currentPh?: number | null;
  currentTds?: number | null;
  currentTurbidity?: number | null;
  currentTemp?: number | null;
}

export const LiveSensorChart: React.FC<LiveSensorChartProps> = ({
  readingBuffer = [],
  currentPh = 7.2,
  currentTds = 145,
  currentTurbidity = 0.32,
  currentTemp = 21.4,
}) => {
  const chartData = useMemo(() => {
    if (!readingBuffer || readingBuffer.length === 0) {
      return [
        {
          point: 1,
          timeLabel: '0s',
          ph: currentPh,
          tds: currentTds,
          turbidity: currentTurbidity,
          temperature: currentTemp,
          phNorm: Math.min(100, Math.max(0, ((currentPh - 5) / (9 - 5)) * 100)),
          tdsNorm: Math.min(100, Math.max(0, (currentTds / 500) * 100)),
          turbNorm: Math.min(100, Math.max(0, (currentTurbidity / 5) * 100)),
          tempNorm: Math.min(100, Math.max(0, ((currentTemp - 10) / (35 - 10)) * 100)),
        },
      ];
    }
    return readingBuffer.map((packet, idx) => {
      const phVal = packet.ph ?? currentPh;
      const tdsVal = packet.tds ?? currentTds;
      const turbVal = packet.turbidity ?? currentTurbidity;
      const tempVal = packet.temperature ?? currentTemp;
      return {
        point: idx + 1,
        timeLabel: `${Math.round((idx / Math.max(readingBuffer.length - 1, 1)) * 15)}s`,
        ph: phVal,
        tds: tdsVal,
        turbidity: turbVal,
        temperature: tempVal,
        phNorm: Math.min(100, Math.max(0, ((phVal - 5) / (9 - 5)) * 100)),
        tdsNorm: Math.min(100, Math.max(0, (tdsVal / 500) * 100)),
        turbNorm: Math.min(100, Math.max(0, (turbVal / 5) * 100)),
        tempNorm: Math.min(100, Math.max(0, ((tempVal - 10) / (35 - 10)) * 100)),
      };
    });
  }, [readingBuffer, currentPh, currentTds, currentTurbidity, currentTemp]);

  return (
    <ResponsiveContainer width="100%" height={240}>
      <LineChart data={chartData} margin={{ top: 5, right: 8, left: -25, bottom: 0 }}>
        <XAxis dataKey="timeLabel" stroke="#475569" fontSize={9} tickLine={false} axisLine={{ stroke: 'rgba(255,255,255,0.1)' }} />
        <YAxis domain={[0, 100]} stroke="#475569" fontSize={9} tickLine={false} axisLine={false} hide />
        <Tooltip
          content={({ active, payload }) => {
            if (active && payload && payload.length) {
              const data = payload[0]?.payload;
              return (
                <div className="bg-[#0D1117]/95 border border-white/15 p-2 rounded-xl shadow-2xl text-[10px] font-mono space-y-1 backdrop-blur-md">
                  <div className="text-neutral-400 border-b border-white/10 pb-0.5">Packet #{data?.point} ({data?.timeLabel})</div>
                  <div className="flex items-center justify-between gap-3 text-[#00D1FF]"><span>pH:</span><span className="font-bold">{data?.ph?.toFixed(2)}</span></div>
                  <div className="flex items-center justify-between gap-3 text-[#818CF8]"><span>TDS:</span><span className="font-bold">{data?.tds} ppm</span></div>
                  <div className="flex items-center justify-between gap-3 text-amber-400"><span>Turbidity:</span><span className="font-bold">{data?.turbidity?.toFixed(2)} NTU</span></div>
                  <div className="flex items-center justify-between gap-3 text-emerald-400"><span>Temp:</span><span className="font-bold">{data?.temperature?.toFixed(1)}°C</span></div>
                </div>
              );
            }
            return null;
          }}
        />
        <Line type="monotone" dataKey="phNorm" name="pH" stroke="#00D1FF" strokeWidth={2} dot={chartData.length <= 15} isAnimationActive={false} />
        <Line type="monotone" dataKey="tdsNorm" name="TDS" stroke="#818CF8" strokeWidth={1.75} dot={chartData.length <= 15} isAnimationActive={false} />
        <Line type="monotone" dataKey="turbNorm" name="Turbidity" stroke="#F59E0B" strokeWidth={1.5} dot={chartData.length <= 15} isAnimationActive={false} />
        <Line type="monotone" dataKey="tempNorm" name="Temperature" stroke="#10B981" strokeWidth={1.5} dot={chartData.length <= 15} isAnimationActive={false} />
      </LineChart>
    </ResponsiveContainer>
  );
};

import React, { useEffect, useRef } from 'react';
import { Activity, Sparkles, Zap } from 'lucide-react';
import { motion } from 'motion/react';

interface SmartwatchECGTelemetryViewProps {
  scanProgress: number; // 0 to 100
  remainingSeconds: number;
  packetCount: number;
  currentPh?: number | null;
  currentTds?: number | null;
  currentTurbidity?: number | null;
  currentTemp?: number | null;
}

export const SmartwatchECGTelemetryView: React.FC<SmartwatchECGTelemetryViewProps> = ({
  scanProgress,
  remainingSeconds,
  packetCount,
  currentPh = 7.2,
  currentTds = 145,
  currentTurbidity = 0.32,
  currentTemp = 21.4,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const phaseRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let width = (canvas.width = canvas.offsetWidth * window.devicePixelRatio || 600);
    let height = (canvas.height = canvas.offsetHeight * window.devicePixelRatio || 160);

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = canvas.offsetWidth * window.devicePixelRatio || 600;
      height = canvas.height = canvas.offsetHeight * window.devicePixelRatio || 160;
    };

    window.addEventListener('resize', handleResize);

    const render = () => {
      phaseRef.current += 0.045;
      const phase = phaseRef.current;
      const dpr = window.devicePixelRatio || 1;

      ctx.clearRect(0, 0, width, height);

      // 1. Draw subtle ECG medical grid
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.035)';
      ctx.lineWidth = 1 * dpr;
      const stepX = 28 * dpr;
      const stepY = 20 * dpr;

      ctx.beginPath();
      for (let x = 0; x < width; x += stepX) {
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
      }
      for (let y = 0; y < height; y += stepY) {
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
      }
      ctx.stroke();

      // Convergence factor: as scanProgress approaches 100%, random jitter dampens into pure smooth harmonic curve
      const jitterFactor = Math.max(0.15, 1 - scanProgress / 100);

      // Sweep head position (moves from left to right repeatedly, or follows progress)
      const sweepX = ((phase * 40 * dpr) % width);

      // Draw faint vertical sweep line
      const sweepGrad = ctx.createLinearGradient(sweepX - 25 * dpr, 0, sweepX, 0);
      sweepGrad.addColorStop(0, 'rgba(0, 209, 255, 0)');
      sweepGrad.addColorStop(1, 'rgba(0, 209, 255, 0.22)');
      ctx.fillStyle = sweepGrad;
      ctx.fillRect(sweepX - 25 * dpr, 0, 25 * dpr, height);

      ctx.strokeStyle = 'rgba(0, 209, 255, 0.6)';
      ctx.lineWidth = 1.5 * dpr;
      ctx.beginPath();
      ctx.moveTo(sweepX, 0);
      ctx.lineTo(sweepX, height);
      ctx.stroke();

      // 2. Multi-Sensor Waveform Streams
      // Stream A: pH Stream (Cyan `#00D1FF`) - ECG pulse waveform
      const drawEcgWave = (
        baseY: number,
        color: string,
        amplitude: number,
        freq: number,
        pulseOffset: number
      ) => {
        ctx.save();
        ctx.strokeStyle = color;
        ctx.lineWidth = 2 * dpr;
        ctx.shadowColor = color;
        ctx.shadowBlur = 6 * dpr;
        ctx.beginPath();

        for (let x = 0; x < width; x += 3 * dpr) {
          const t = (x / width) * 10 * freq + phase + pulseOffset;
          // ECG shape: regular sine ripple + periodic QRS spike
          const cycle = t % Math.PI;
          let spike = 0;
          if (cycle > 1.2 && cycle < 1.6) {
            // R-peak spike
            spike = Math.sin((cycle - 1.2) * (Math.PI / 0.4)) * amplitude * 2.2;
          } else if (cycle > 1.6 && cycle < 1.8) {
            // S-wave valley
            spike = -Math.sin((cycle - 1.6) * (Math.PI / 0.2)) * (amplitude * 0.9);
          } else {
            // subtle wave
            spike = Math.sin(t * 1.5) * (amplitude * 0.35);
          }

          // Micro jitter from live sensor sampling
          const jitter = (Math.sin(x * 0.2 + phase * 4) * 2 * jitterFactor) * dpr;
          const y = baseY - spike + jitter;

          if (x === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
        ctx.restore();
      };

      // Stream B: TDS Stream (Electric Indigo `#818CF8`) - High frequency conductivity telemetry
      const drawConductivityWave = (baseY: number, color: string, amplitude: number) => {
        ctx.save();
        ctx.strokeStyle = color;
        ctx.lineWidth = 1.5 * dpr;
        ctx.shadowColor = color;
        ctx.shadowBlur = 4 * dpr;
        ctx.beginPath();

        for (let x = 0; x < width; x += 4 * dpr) {
          const t = (x / width) * 16 + phase * 1.8;
          const harmonic = Math.sin(t * 2) * Math.cos(t * 0.5) * amplitude;
          const microNoise = Math.cos(x * 0.3 - phase * 3) * (1.5 * jitterFactor) * dpr;
          const y = baseY + harmonic + microNoise;

          if (x === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
        ctx.restore();
      };

      // Stream C: Turbidity / Clarity (Vibrant Amber `#F59E0B`) - Optical refraction scatter
      const drawOpticalWave = (baseY: number, color: string, amplitude: number) => {
        ctx.save();
        ctx.strokeStyle = color;
        ctx.lineWidth = 1.2 * dpr;
        ctx.shadowColor = color;
        ctx.shadowBlur = 3 * dpr;
        ctx.beginPath();

        for (let x = 0; x < width; x += 4 * dpr) {
          const t = (x / width) * 8 + phase * 0.9;
          const scatter = Math.sin(t) * amplitude + Math.sin(t * 3.5) * (amplitude * 0.4 * jitterFactor);
          const y = baseY + scatter;

          if (x === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
        ctx.restore();
      };

      // Stream D: Temperature (Emerald `#10B981`) - Thermal drift baseline
      const drawThermalWave = (baseY: number, color: string, amplitude: number) => {
        ctx.save();
        ctx.strokeStyle = color;
        ctx.lineWidth = 1.2 * dpr;
        ctx.shadowColor = color;
        ctx.shadowBlur = 3 * dpr;
        ctx.beginPath();

        for (let x = 0; x < width; x += 5 * dpr) {
          const t = (x / width) * 5 + phase * 0.5;
          const ripple = Math.sin(t) * amplitude;
          const y = baseY + ripple;

          if (x === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
        ctx.restore();
      };

      // Layer the 4 distinct sensor streams across the monitor height
      const midY = height * 0.5;
      drawThermalWave(midY + 28 * dpr, '#10B981', 4 * dpr);
      drawOpticalWave(midY - 24 * dpr, '#F59E0B', 6 * dpr);
      drawConductivityWave(midY + 10 * dpr, '#818CF8', 9 * dpr);
      // Main pH ECG wave in center
      drawEcgWave(midY - 4 * dpr, '#00D1FF', 14 * dpr, 1.0, 0);

      // Glowing dot at the sweep cursor for pH
      const curT = (sweepX / width) * 10 + phase;
      const curCycle = curT % Math.PI;
      let curSpike = 0;
      if (curCycle > 1.2 && curCycle < 1.6) {
        curSpike = Math.sin((curCycle - 1.2) * (Math.PI / 0.4)) * 14 * 2.2 * dpr;
      } else if (curCycle > 1.6 && curCycle < 1.8) {
        curSpike = -Math.sin((curCycle - 1.6) * (Math.PI / 0.2)) * (14 * 0.9) * dpr;
      }
      const curY = midY - 4 * dpr - curSpike;

      ctx.save();
      ctx.fillStyle = '#FFFFFF';
      ctx.shadowColor = '#00D1FF';
      ctx.shadowBlur = 10 * dpr;
      ctx.beginPath();
      ctx.arc(sweepX, curY, 3.5 * dpr, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      animFrameRef.current = requestAnimationFrame(render);
    };

    animFrameRef.current = requestAnimationFrame(render);

    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      window.removeEventListener('resize', handleResize);
    };
  }, [scanProgress]);

  return (
    <div className="flex flex-col gap-2.5 w-full">
      {/* 1. Top HUD Bar */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-[#00D1FF]/15 border border-[#00D1FF]/30 text-[#00D1FF] flex items-center justify-center shrink-0">
            <Activity className="w-4 h-4 animate-pulse text-[#00D1FF]" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="text-xs sm:text-sm font-bold text-white tracking-tight truncate">
                ECG Sensor Telemetry Stream
              </span>
              <span className="w-2 h-2 rounded-full bg-[#00D1FF] animate-ping shrink-0" />
            </div>
            <p className="text-[10px] sm:text-[11px] text-neutral-400 font-mono truncate">
              Stabilizing optical & electrochemical impedance (10 Hz)
            </p>
          </div>
        </div>

        {/* Smartwatch-style countdown pill */}
        <div className="flex items-center gap-1.5 shrink-0">
          <span className="text-xs font-mono font-bold text-[#00D1FF] bg-[#00D1FF]/10 px-2.5 py-1 rounded-xl border border-[#00D1FF]/30 flex items-center gap-1">
            <Zap className="w-3 h-3 text-[#00D1FF] animate-pulse" />
            <span>{remainingSeconds}s left</span>
          </span>
        </div>
      </div>

      {/* 2. Smartwatch ECG Monitor Frame */}
      <div className="relative w-full h-28 xs:h-32 sm:h-36 rounded-2xl bg-[#07090C] border border-white/10 overflow-hidden shadow-inner flex flex-col justify-between p-2">
        {/* Radar Corner accents */}
        <div className="absolute top-1.5 left-2 text-[9px] font-mono font-medium text-neutral-500 uppercase tracking-wider flex items-center gap-1 pointer-events-none select-none">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          <span>CH1-CH4 · ACTIVE SCAN</span>
        </div>
        <div className="absolute top-1.5 right-2 text-[9px] font-mono text-neutral-500 pointer-events-none select-none">
          {packetCount} PKTS BUFFERED
        </div>

        {/* Live Canvas Waveform */}
        <canvas
          ref={canvasRef}
          className="w-full h-full absolute inset-0 block"
        />

        {/* 3. Multi-Sensor Data Stream Legends with Live Values */}
        <div className="relative z-10 mt-auto pt-1 flex flex-wrap items-center justify-between gap-1 sm:gap-2 px-1">
          {/* pH stream (Cyan) */}
          <div className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#00D1FF]/10 border border-[#00D1FF]/30 text-[10px] sm:text-[11px] font-mono">
            <span className="w-1.5 h-1.5 rounded-full bg-[#00D1FF] shadow-sm shadow-[#00D1FF]" />
            <span className="text-neutral-400">pH:</span>
            <span className="font-bold text-[#00D1FF]">{currentPh != null ? currentPh.toFixed(2) : '--'}</span>
          </div>

          {/* TDS stream (Electric Indigo) */}
          <div className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#818CF8]/10 border border-[#818CF8]/30 text-[10px] sm:text-[11px] font-mono">
            <span className="w-1.5 h-1.5 rounded-full bg-[#818CF8] shadow-sm shadow-[#818CF8]" />
            <span className="text-neutral-400">TDS:</span>
            <span className="font-bold text-[#818CF8]">{currentTds != null ? `${currentTds} ppm` : '--'}</span>
          </div>

          {/* Turbidity stream (Amber) */}
          <div className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-500/10 border border-amber-500/30 text-[10px] sm:text-[11px] font-mono">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shadow-sm shadow-amber-400" />
            <span className="text-neutral-400">Clarity:</span>
            <span className="font-bold text-amber-400">{currentTurbidity != null ? `${currentTurbidity} NTU` : '--'}</span>
          </div>

          {/* Temperature stream (Emerald) */}
          <div className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-500/10 border border-emerald-500/30 text-[10px] sm:text-[11px] font-mono">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-sm shadow-emerald-400" />
            <span className="text-neutral-400">Temp:</span>
            <span className="font-bold text-emerald-400">{currentTemp != null ? `${currentTemp}°C` : '--'}</span>
          </div>
        </div>
      </div>

      {/* 4. High-tech Progress Track & Stabilization Summary */}
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
            <span>{scanProgress}% stabilized ({scanProgress >= 80 ? 'Harmonizing' : scanProgress >= 40 ? 'Calibrating' : 'Sampling'})</span>
          </span>
          <span className="text-neutral-500">
            Dampening sensor noise variance
          </span>
        </div>
      </div>
    </div>
  );
};

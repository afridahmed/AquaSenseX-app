import React, { useState, useRef, useEffect } from 'react';
import { useBottle } from '../../context/BottleContext';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import {
  Wifi,
  WifiOff,
  Sun,
  Moon,
  Droplets,
  ChevronDown,
  BatteryCharging,
  X,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface HeaderProps {
  title?: string;
  mobileTitle?: string;
  subtitle?: string;
}

export const Header: React.FC<HeaderProps> = ({ title = 'AquaSense X', mobileTitle, subtitle }) => {
  const { bottle, simulateRefill } = useBottle();
  const { user } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [isTelemetryOpen, setIsTelemetryOpen] = useState<boolean>(false);
  const popoverRef = useRef<HTMLDivElement>(null);

  // Close telemetry popup on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
        setIsTelemetryOpen(false);
      }
    };
    if (isTelemetryOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isTelemetryOpen]);

  const batteryPct = bottle?.battery ?? 92;
  const isOnline = bottle?.online ?? true;

  return (
    <header className="sticky top-0 z-30 bg-[#090B0E]/85 backdrop-blur-xl border-b border-white/5 px-3.5 xs:px-4 sm:px-6 lg:px-8 py-2.5 sm:py-3 flex items-center justify-between transition-colors safe-area-pt">
      {/* Brand & Page Info */}
      <div className="flex items-center gap-2.5 xs:gap-3 min-w-0 pr-2">
        <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-gradient-to-br from-[#00D1FF]/20 to-[#0077FF]/20 border border-[#00D1FF]/30 flex items-center justify-center shadow-sm shrink-0">
          <Droplets className="w-4 h-4 sm:w-5 sm:h-5 text-[#00D1FF]" />
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 sm:gap-2">
            <h1 className="text-sm sm:text-base font-semibold tracking-tight text-white truncate font-sans">
              {mobileTitle ? (
                <>
                  <span className="sm:hidden">{mobileTitle}</span>
                  <span className="hidden sm:inline">{title}</span>
                </>
              ) : (
                title
              )}
            </h1>
          </div>
          {subtitle && (
            <p className="hidden sm:block text-xs text-neutral-400 truncate max-w-md">
              {subtitle}
            </p>
          )}
        </div>
      </div>

      {/* Right Controls: Apple/Tesla Telemetry Capsule & Theme Toggle */}
      <div className="flex items-center gap-2 sm:gap-2.5 shrink-0" ref={popoverRef}>
        {/* Apple/Tesla-Style Live Status & Battery Capsule */}
        {bottle && (
          <div className="relative">
            <button
              onClick={() => setIsTelemetryOpen(!isTelemetryOpen)}
              className={`group flex items-center gap-1.5 xs:gap-2 sm:gap-2.5 px-2.5 xs:px-3 sm:px-3.5 py-2 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border transition-all active:scale-95 touch-target sm:min-h-0 sm:min-w-0 ${
                isTelemetryOpen
                  ? 'border-[#00D1FF]/50 bg-white/[0.08] shadow-[0_0_15px_rgba(0,209,255,0.15)]'
                  : 'border-white/10 hover:border-white/20'
              }`}
              title="AquaSense X Device Telemetry & Power Status"
              aria-label="Bottle Status & Battery Level"
            >
              {/* Online / Offline Status Indicator */}
              <div className="flex items-center gap-1.5">
                <span className="relative flex h-2 w-2">
                  {isOnline && (
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  )}
                  <span
                    className={`relative inline-flex rounded-full h-2 w-2 ${
                      isOnline ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]' : 'bg-neutral-500'
                    }`}
                  />
                </span>
                <span
                  className={`text-[11px] xs:text-xs font-medium tracking-tight ${
                    isOnline ? 'text-emerald-400' : 'text-neutral-400'
                  }`}
                >
                  {isOnline ? 'Online' : 'Offline'}
                </span>
              </div>

              {/* Minimal Divider */}
              <span className="w-px h-3 bg-white/15 shrink-0" />

              {/* Precision Apple-Style Battery Pill with Fill Bar */}
              <div className="flex items-center gap-1.5 text-[11px] xs:text-xs font-medium text-neutral-200">
                {/* Physical Battery Cell Graphic */}
                <div className="w-4 h-2.5 rounded-[3px] border border-neutral-400/90 p-[1px] flex items-center relative shrink-0">
                  <div
                    className={`h-full rounded-[1.5px] transition-all duration-500 ${
                      batteryPct <= 15 ? 'bg-rose-500' : batteryPct <= 30 ? 'bg-amber-400' : 'bg-emerald-400'
                    }`}
                    style={{ width: `${Math.max(12, Math.min(100, batteryPct))}%` }}
                  />
                  {/* Battery Terminal Tip */}
                  <div className="absolute -right-[2.5px] top-[2.5px] w-[1.5px] h-[3px] bg-neutral-400/90 rounded-r-[1px]" />
                </div>
                <span className="tabular-nums font-mono">{batteryPct}%</span>
              </div>

              {/* Short Device Tag on md+ screens */}
              <span className="hidden lg:inline w-px h-3 bg-white/15 shrink-0" />
              <span className="hidden lg:inline text-[11px] font-mono text-neutral-400">
                {bottle.bottleId.split('-').slice(0, 2).join('-')}
              </span>

              <ChevronDown
                className={`w-3.5 h-3.5 text-neutral-400 transition-transform duration-200 shrink-0 hidden xs:block ${
                  isTelemetryOpen ? 'rotate-180 text-[#00D1FF]' : ''
                }`}
              />
            </button>

            {/* Apple / Tesla Floating Telemetry Drawer / Popover */}
            <AnimatePresence>
              {isTelemetryOpen && (
                <motion.div
                  initial={{ opacity: 0, y: 8, scale: 0.96 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 6, scale: 0.96 }}
                  transition={{ duration: 0.15, ease: 'easeOut' }}
                  className="absolute right-0 top-full mt-2 w-[270px] xs:w-[290px] rounded-2xl bg-[#0F1318]/95 backdrop-blur-2xl border border-white/10 shadow-2xl p-3.5 z-50 text-white space-y-3"
                >
                  {/* Header Row */}
                  <div className="flex items-center justify-between border-b border-white/5 pb-2.5">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-lg bg-[#00D1FF]/15 border border-[#00D1FF]/30 flex items-center justify-center">
                        <Droplets className="w-3.5 h-3.5 text-[#00D1FF]" />
                      </div>
                      <div>
                        <h4 className="text-xs font-semibold text-white tracking-tight">
                          AquaSense X Smart Bottle
                        </h4>
                        <p className="text-[10px] font-mono text-neutral-400">{bottle.bottleId}</p>
                      </div>
                    </div>
                    <button
                      onClick={() => setIsTelemetryOpen(false)}
                      className="p-1 text-neutral-400 hover:text-white rounded-lg hover:bg-white/5"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Status Grid */}
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    {/* Connection */}
                    <div className="p-2.5 rounded-xl bg-white/[0.03] border border-white/5 space-y-1">
                      <div className="flex items-center justify-between text-[10px] text-neutral-400">
                        <span>Status</span>
                        {isOnline ? (
                          <Wifi className="w-3 h-3 text-emerald-400" />
                        ) : (
                          <WifiOff className="w-3 h-3 text-neutral-500" />
                        )}
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`w-2 h-2 rounded-full ${
                            isOnline ? 'bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.8)]' : 'bg-neutral-500'
                          }`}
                        />
                        <span className="text-xs font-semibold text-white">
                          {isOnline ? 'Active Sync' : 'Offline'}
                        </span>
                      </div>
                      <p className="text-[9px] text-neutral-400">BLE 5.2 / WiFi Telemetry</p>
                    </div>

                    {/* Battery Level */}
                    <div className="p-2.5 rounded-xl bg-white/[0.03] border border-white/5 space-y-1">
                      <div className="flex items-center justify-between text-[10px] text-neutral-400">
                        <span>Battery</span>
                        <BatteryCharging className="w-3 h-3 text-emerald-400" />
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-semibold text-white font-mono">{batteryPct}%</span>
                        <span className="text-[10px] text-emerald-400 font-medium">Good</span>
                      </div>
                      <p className="text-[9px] text-neutral-400">~4.5 days operational</p>
                    </div>
                  </div>

                  {/* Quick Bottom Action */}
                  <div className="pt-0.5 flex items-center justify-between text-[10px] text-neutral-400">
                    <span className="flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                      Continuous optical scan
                    </span>
                    <span className="text-neutral-500">Cap v2.4</span>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

        {/* Theme Toggle */}
        <button
          onClick={toggleTheme}
          title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} mode`}
          className="p-2 rounded-xl bg-white/[0.04] border border-white/10 text-neutral-400 hover:text-white hover:bg-white/[0.08] transition-colors touch-target sm:min-h-0 sm:min-w-0 flex items-center justify-center shrink-0"
        >
          {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </button>
      </div>
    </header>
  );
};



import React from 'react';
import { useBottle } from '../../context/BottleContext';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import {
  Wifi,
  WifiOff,
  BatteryCharging,
  BatteryMedium,
  BatteryLow,
  Sliders,
  Sun,
  Moon,
  Droplets,
  AlertTriangle,
} from 'lucide-react';

interface HeaderProps {
  title?: string;
  subtitle?: string;
}

export const Header: React.FC<HeaderProps> = ({ title = 'AquaSense X', subtitle }) => {
  const { bottle, isStale, isSimulatorOpen, setIsSimulatorOpen, isMockMode } = useBottle();
  const { user } = useAuth();
  const { theme, toggleTheme } = useTheme();

  // Battery icon helper
  const renderBatteryIcon = (pct: number = 85) => {
    if (pct <= 20) return <BatteryLow className="w-4 h-4 text-rose-400" />;
    return <BatteryMedium className="w-4 h-4 text-emerald-400" />;
  };

  return (
    <header className="sticky top-0 z-30 bg-[#0A0A0A]/90 backdrop-blur-xl border-b border-[#1E1E1E] px-4 lg:px-8 py-3.5 flex items-center justify-between transition-colors">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-2xl bg-gradient-to-br from-[#00D1FF]/20 to-[#0077FF]/20 border border-[#00D1FF]/30 flex items-center justify-center shadow-sm">
          <Droplets className="w-5 h-5 text-[#00D1FF]" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-base font-semibold tracking-tight text-white font-sans">
              {title}
            </h1>
            {isMockMode && (
              <span className="text-[10px] font-medium tracking-wide uppercase px-2 py-0.5 rounded-full bg-[#00D1FF]/10 text-[#00D1FF] border border-[#00D1FF]/20">
                Demo IoT
              </span>
            )}
          </div>
          {subtitle && (
            <p className="text-xs text-[#888888] line-clamp-1">{subtitle}</p>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 sm:gap-3">
        {/* Bottle Connection & Battery Pill */}
        {bottle && (
          <div className="hidden sm:flex items-center gap-2.5 px-3.5 py-1.5 rounded-full bg-[#141414] border border-[#222222] text-xs text-[#F5F5F5] shadow-sm">
            <div className="flex items-center gap-1.5">
              {bottle.online ? (
                <>
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="text-[11px] font-medium text-emerald-400">Online</span>
                </>
              ) : (
                <>
                  <span className="w-2 h-2 rounded-full bg-[#555555]" />
                  <span className="text-[11px] font-medium text-[#888888]">Offline</span>
                </>
              )}
            </div>

            <span className="w-px h-3 bg-white/10" />

            <div className="flex items-center gap-1 text-[11px] font-medium text-neutral-300">
              {renderBatteryIcon(bottle.battery)}
              <span>{bottle.battery}%</span>
            </div>

            <span className="w-px h-3 bg-white/10" />

            <span className="text-[11px] font-mono text-[#888888]">
              {bottle.bottleId.split('-').slice(0, 2).join('-')}
            </span>
          </div>
        )}

        {/* Stale Data Warning if offline */}
        {isStale && (
          <div className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs">
            <AlertTriangle className="w-3.5 h-3.5" />
            <span className="text-[11px] hidden md:inline">Last cached reading</span>
          </div>
        )}

        {/* IoT Simulator Trigger */}
        <button
          onClick={() => setIsSimulatorOpen(!isSimulatorOpen)}
          title="IoT Simulator Test Bench"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#141414] border border-[#222222] text-[#888888] hover:text-white hover:bg-[#1E1E1E] hover:border-[#00D1FF]/40 transition-all text-xs font-medium"
        >
          <Sliders className="w-4 h-4 text-[#00D1FF]" />
          <span className="hidden sm:inline">IoT Controls</span>
        </button>

        {/* Theme Toggle */}
        <button
          onClick={toggleTheme}
          title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} mode`}
          className="p-2 rounded-xl bg-[#141414] border border-[#222222] text-[#888888] hover:text-white hover:bg-[#1E1E1E] transition-colors"
        >
          {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </button>
      </div>
    </header>
  );
};

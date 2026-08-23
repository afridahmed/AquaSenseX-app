import React, { useState } from 'react';
import { useBottle } from '../../context/BottleContext';
import {
  X,
  RefreshCw,
  Sliders,
  Droplets,
  AlertTriangle,
  CheckCircle2,
  Wifi,
  WifiOff,
  Battery,
  Flame,
} from 'lucide-react';
import { defaultSensorProvider } from '../../services/sensor/SensorDataProvider';

export const SimulatorDrawer: React.FC = () => {
  const {
    bottle,
    isSimulatorOpen,
    setIsSimulatorOpen,
    simulateDrink,
    simulateRefill,
    simulateAbnormalWater,
    simulateToggleOnline,
  } = useBottle();

  const [customPh, setCustomPh] = useState<number>(bottle?.ph || 7.2);
  const [customTds, setCustomTds] = useState<number>(bottle?.tds || 180);
  const [customTurb, setCustomTurb] = useState<number>(bottle?.turbidity || 0.4);
  const [customTemp, setCustomTemp] = useState<number>(bottle?.temperature || 21);

  if (!isSimulatorOpen || !bottle) return null;

  const applyCustomValues = () => {
    defaultSensorProvider.updateBottleState(bottle.bottleId, {
      ph: customPh,
      tds: customTds,
      turbidity: customTurb,
      temperature: customTemp,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm transition-opacity">
      <div className="w-full max-w-md bg-neutral-950 border-l border-white/10 h-full overflow-y-auto p-6 flex flex-col justify-between shadow-2xl animate-in slide-in-from-right duration-300">
        <div>
          {/* Header */}
          <div className="flex items-center justify-between pb-4 border-b border-white/10">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-cyan-500/20 border border-cyan-500/30 flex items-center justify-center">
                <Sliders className="w-4 h-4 text-cyan-400" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-white">IoT Hardware Test Bench</h2>
                <p className="text-xs text-neutral-400">ESP32-S3 Sensor Telemetry Injection</p>
              </div>
            </div>
            <button
              onClick={() => setIsSimulatorOpen(false)}
              className="p-1.5 rounded-lg hover:bg-neutral-800 text-neutral-400 hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Bottle Status Badge */}
          <div className="mt-4 p-3 rounded-xl bg-neutral-900 border border-white/5 flex items-center justify-between text-xs">
            <span className="font-mono text-neutral-300">{bottle.bottleId}</span>
            <div className="flex items-center gap-2">
              <button
                onClick={simulateToggleOnline}
                className={`flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium border ${
                  bottle.online
                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                    : 'bg-neutral-800 text-neutral-400 border-white/10'
                }`}
              >
                {bottle.online ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
                <span>{bottle.online ? 'Online' : 'Offline'}</span>
              </button>
              <span className="text-neutral-400 font-medium">{bottle.battery}% Bat</span>
            </div>
          </div>

          {/* Quick Scenario Buttons */}
          <div className="mt-6">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-400 mb-3">
              Preset Water Scenarios
            </h3>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => simulateAbnormalWater('optimal')}
                className="p-2.5 rounded-xl bg-neutral-900 border border-white/5 hover:border-cyan-500/30 text-left transition-all hover:bg-neutral-850 group"
              >
                <div className="flex items-center gap-1.5 text-xs font-medium text-emerald-400">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Pristine Spring</span>
                </div>
                <p className="text-[10px] text-neutral-400 mt-1">pH 7.3 • 160 ppm • 0.3 NTU</p>
              </button>

              <button
                onClick={() => simulateAbnormalWater('acidic')}
                className="p-2.5 rounded-xl bg-neutral-900 border border-white/5 hover:border-amber-500/30 text-left transition-all hover:bg-neutral-850 group"
              >
                <div className="flex items-center gap-1.5 text-xs font-medium text-amber-400">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  <span>Acidic Deviation</span>
                </div>
                <p className="text-[10px] text-neutral-400 mt-1">pH 5.4 • Low Alkalinity</p>
              </button>

              <button
                onClick={() => simulateAbnormalWater('turbid')}
                className="p-2.5 rounded-xl bg-neutral-900 border border-white/5 hover:border-rose-500/30 text-left transition-all hover:bg-neutral-850 group"
              >
                <div className="flex items-center gap-1.5 text-xs font-medium text-rose-400">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  <span>High Turbidity</span>
                </div>
                <p className="text-[10px] text-neutral-400 mt-1">4.8 NTU • Particle Haze</p>
              </button>

              <button
                onClick={() => simulateAbnormalWater('mineral_overload')}
                className="p-2.5 rounded-xl bg-neutral-900 border border-white/5 hover:border-amber-500/30 text-left transition-all hover:bg-neutral-850 group"
              >
                <div className="flex items-center gap-1.5 text-xs font-medium text-amber-400">
                  <Flame className="w-3.5 h-3.5" />
                  <span>High Mineral Hardness</span>
                </div>
                <p className="text-[10px] text-neutral-400 mt-1">890 ppm TDS • pH 8.8</p>
              </button>
            </div>
          </div>

          {/* Fluid & Drink Simulator */}
          <div className="mt-6">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-400 mb-3">
              Physical Fluid & Consumption
            </h3>
            <div className="flex items-center gap-2">
              <button
                onClick={simulateRefill}
                className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-neutral-900 border border-white/10 hover:bg-neutral-800 text-xs font-medium text-cyan-400 hover:border-cyan-500/30 transition-all"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Refill 750 ml</span>
              </button>
              <button
                onClick={() => simulateDrink(200)}
                className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-neutral-900 border border-white/10 hover:bg-neutral-800 text-xs font-medium text-white hover:border-white/20 transition-all"
              >
                <Droplets className="w-3.5 h-3.5 text-cyan-400" />
                <span>Take 200ml Sip</span>
              </button>
            </div>
          </div>

          {/* Live Sensor Slider Adjustments */}
          <div className="mt-6 space-y-4">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-400">
              Manual Sensor Calibration
            </h3>

            {/* pH Slider */}
            <div>
              <div className="flex justify-between text-xs text-neutral-300 mb-1">
                <span>pH Level: {customPh}</span>
                <span className="text-neutral-500">6.5 - 8.5 Ideal</span>
              </div>
              <input
                type="range"
                min="4.0"
                max="10.0"
                step="0.1"
                value={customPh}
                onChange={(e) => setCustomPh(parseFloat(e.target.value))}
                className="w-full accent-cyan-400 bg-neutral-800"
              />
            </div>

            {/* TDS Slider */}
            <div>
              <div className="flex justify-between text-xs text-neutral-300 mb-1">
                <span>TDS (Dissolved Solids): {customTds} ppm</span>
                <span className="text-neutral-500">&lt; 300 Ideal</span>
              </div>
              <input
                type="range"
                min="10"
                max="1000"
                step="10"
                value={customTds}
                onChange={(e) => setCustomTds(parseInt(e.target.value))}
                className="w-full accent-cyan-400 bg-neutral-800"
              />
            </div>

            {/* Turbidity Slider */}
            <div>
              <div className="flex justify-between text-xs text-neutral-300 mb-1">
                <span>Turbidity (Clarity): {customTurb} NTU</span>
                <span className="text-neutral-500">&lt; 1.0 Ideal</span>
              </div>
              <input
                type="range"
                min="0.1"
                max="8.0"
                step="0.1"
                value={customTurb}
                onChange={(e) => setCustomTurb(parseFloat(e.target.value))}
                className="w-full accent-cyan-400 bg-neutral-800"
              />
            </div>

            {/* Temperature Slider */}
            <div>
              <div className="flex justify-between text-xs text-neutral-300 mb-1">
                <span>Temperature: {customTemp}°C</span>
                <span className="text-neutral-500">4°C - 20°C Ideal</span>
              </div>
              <input
                type="range"
                min="4"
                max="40"
                step="1"
                value={customTemp}
                onChange={(e) => setCustomTemp(parseInt(e.target.value))}
                className="w-full accent-cyan-400 bg-neutral-800"
              />
            </div>

            <button
              onClick={applyCustomValues}
              className="w-full mt-2 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-neutral-950 font-semibold text-xs transition-colors"
            >
              Push Telemetry to App
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="pt-4 border-t border-white/5 text-[11px] text-neutral-500 text-center">
          AquaSense X IoT Bridge • Simulated MQTT Broker v2.4
        </div>
      </div>
    </div>
  );
};

import React, { ReactNode } from 'react';
import { NavTab } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { useBottle } from '../../context/BottleContext';
import {
  LayoutDashboard,
  MapPin,
  Bot,
  User,
  Droplets,
  Wifi,
  WifiOff,
  BatteryMedium,
  BatteryLow,
  Sliders,
  LogOut,
} from 'lucide-react';
import { SimulatorDrawer } from '../common/SimulatorDrawer';

interface AppLayoutProps {
  currentTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  children: ReactNode;
}

export const AppLayout: React.FC<AppLayoutProps> = ({
  currentTab,
  onSelectTab,
  children,
}) => {
  const { user, signOut } = useAuth();
  const { bottle, isSimulatorOpen, setIsSimulatorOpen } = useBottle();

  const navItems = [
    { id: 'dashboard' as NavTab, label: 'Dashboard', icon: LayoutDashboard },
    { id: 'community' as NavTab, label: 'Community', icon: MapPin },
    { id: 'coach' as NavTab, label: 'AI Coach', icon: Bot },
    { id: 'profile' as NavTab, label: 'Profile', icon: User },
  ];

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-[#F5F5F5] flex flex-col md:flex-row antialiased selection:bg-[#00D1FF]/30 selection:text-[#00D1FF]">
      {/* Desktop Sidebar Navigation */}
      <aside className="hidden md:flex flex-col justify-between w-64 lg:w-72 bg-[#0A0A0A] border-r border-[#1E1E1E] p-6 shrink-0 h-screen sticky top-0">
        <div>
          {/* Logo Brand Header */}
          <div className="flex items-center gap-3 px-2 py-3 mb-8">
            <div className="w-10 h-10 rounded-[14px] bg-gradient-to-tr from-[#00D1FF] to-[#0077FF] flex items-center justify-center shadow-lg shadow-[#00D1FF]/20">
              <Droplets className="w-5 h-5 text-[#0A0A0A] font-bold" />
            </div>
            <div>
              <span className="text-base font-bold tracking-tight text-white block">
                AquaSense X
              </span>
              <span className="text-[11px] text-[#888888] font-medium">
                Smart Water Ecosystem
              </span>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="space-y-2">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = currentTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => onSelectTab(item.id)}
                  className={`w-full flex items-center gap-3.5 px-4 py-3 rounded-2xl text-sm font-medium transition-all ${
                    isActive
                      ? 'bg-[#181818] text-white shadow-sm border border-white/10'
                      : 'text-[#888888] hover:text-[#F5F5F5] hover:bg-[#141414]'
                  }`}
                >
                  <Icon
                    className={`w-5 h-5 transition-colors ${
                      isActive ? 'text-[#00D1FF]' : 'text-[#888888]'
                    }`}
                  />
                  <span>{item.label}</span>
                  {isActive && (
                    <span className="ml-auto w-1.5 h-1.5 rounded-full bg-[#00D1FF] shadow-sm shadow-[#00D1FF]" />
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Sidebar Footer - Bottle Status & User Card */}
        <div className="space-y-3 pt-4 border-t border-[#1E1E1E]">
          {bottle && (
            <div className="p-3.5 rounded-2xl bg-[#141414] border border-[#222222] text-xs">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[#888888] font-mono text-[11px] truncate">
                  {bottle.bottleId}
                </span>
                <span
                  className={`flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full ${
                    bottle.online
                      ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                      : 'bg-[#1E1E1E] text-[#888888]'
                  }`}
                >
                  {bottle.online ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
                  {bottle.online ? 'Connected' : 'Offline'}
                </span>
              </div>
              <div className="flex items-center justify-between text-[11px] text-[#888888]">
                <span>Battery: {bottle.battery}%</span>
                <span>{bottle.waterLevel} ml fluid</span>
              </div>
            </div>
          )}

          {/* User profile capsule */}
          <div className="flex items-center justify-between px-3 py-2 rounded-2xl bg-[#141414] border border-[#222222]">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-full bg-[#00D1FF]/10 border border-[#00D1FF]/30 flex items-center justify-center text-xs font-semibold text-[#00D1FF] shrink-0">
                {user?.name ? user.name[0].toUpperCase() : 'U'}
              </div>
              <div className="min-w-0">
                <p className="text-xs font-medium text-white truncate">{user?.name || 'User'}</p>
                <p className="text-[10px] text-[#888888] truncate">{user?.email}</p>
              </div>
            </div>

            <button
              onClick={() => signOut()}
              title="Sign Out"
              className="p-1.5 text-[#888888] hover:text-rose-400 rounded-lg hover:bg-[#1E1E1E] transition-colors"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-h-screen overflow-x-hidden pb-20 md:pb-6 bg-[#0A0A0A]">
        <main className="flex-1">{children}</main>
      </div>

      {/* Mobile Bottom Navigation Bar */}
      <div className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-[#0A0A0A]/95 backdrop-blur-xl border-t border-[#1E1E1E] px-4 py-2 flex items-center justify-around shadow-2xl safe-area-pb">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onSelectTab(item.id)}
              className={`flex flex-col items-center justify-center py-1 px-3 rounded-2xl transition-all relative ${
                isActive ? 'text-[#00D1FF]' : 'text-[#888888] hover:text-[#F5F5F5]'
              }`}
            >
              <Icon className="w-5 h-5 mb-1" />
              <span className="text-[10px] font-medium tracking-tight">{item.label}</span>
              {isActive && (
                <span className="absolute -bottom-1 w-5 h-0.5 rounded-full bg-[#00D1FF]" />
              )}
            </button>
          );
        })}
      </div>

      {/* IoT Simulator Drawer */}
      <SimulatorDrawer />
    </div>
  );
};

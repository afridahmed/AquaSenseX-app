import React, { ReactNode, useState } from 'react';
import { NavTab } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { useBottle } from '../../context/BottleContext';
import { useTheme } from '../../context/ThemeContext';
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
  LogOut,
  ChevronLeft,
  ChevronRight,
  Sun,
  Moon,
} from 'lucide-react';

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
  const { bottle } = useBottle();
  const { theme, toggleTheme } = useTheme();
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(false);

  const navItems = [
    { id: 'dashboard' as NavTab, label: 'Dashboard', icon: LayoutDashboard },
    { id: 'community' as NavTab, label: 'Community', icon: MapPin },
    { id: 'coach' as NavTab, label: 'AI Coach', icon: Bot },
    { id: 'profile' as NavTab, label: 'Profile', icon: User },
  ];

  return (
    <div className="min-h-screen min-h-[100dvh] bg-[#090B0E] dark:bg-[#090B0E] text-[#F8FAFC] flex flex-col md:flex-row antialiased selection:bg-[#00D1FF]/30 selection:text-[#00D1FF] transition-colors duration-200">
      {/* Tablet & Desktop Sidebar Navigation */}
      <aside
        className={`hidden md:flex flex-col justify-between shrink-0 h-screen sticky top-0 bg-[#0D1117]/95 backdrop-blur-xl border-r border-white/5 transition-all duration-300 z-30 ${
          isSidebarCollapsed ? 'w-20 p-4' : 'w-64 lg:w-72 p-5 lg:p-6'
        }`}
      >
        <div>
          {/* Logo & Brand Header */}
          <div className="flex items-center justify-between mb-8 px-1">
            <div
              onClick={() => onSelectTab('dashboard')}
              className="flex items-center gap-3 cursor-pointer group"
            >
              <div className="w-10 h-10 rounded-[14px] bg-gradient-to-tr from-[#00D1FF] to-[#0077FF] flex items-center justify-center shadow-lg shadow-[#00D1FF]/20 group-hover:scale-105 transition-transform shrink-0">
                <Droplets className="w-5 h-5 text-[#090B0E] font-bold" />
              </div>
              {!isSidebarCollapsed && (
                <div className="min-w-0 transition-opacity duration-200">
                  <span className="text-base font-bold tracking-tight text-white block truncate font-sans">
                    AquaSense X
                  </span>
                  <span className="text-[10px] text-neutral-400 font-medium tracking-wide uppercase">
                    Smart Water System
                  </span>
                </div>
              )}
            </div>

            {/* Collapse / Expand Toggle Button on Laptops/Desktops */}
            <button
              onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
              title={isSidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              className="hidden lg:flex p-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-neutral-400 hover:text-white transition-colors"
            >
              {isSidebarCollapsed ? (
                <ChevronRight className="w-4 h-4" />
              ) : (
                <ChevronLeft className="w-4 h-4" />
              )}
            </button>
          </div>

          {/* Navigation Items */}
          <nav className="space-y-1.5">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = currentTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => onSelectTab(item.id)}
                  title={isSidebarCollapsed ? item.label : undefined}
                  className={`w-full flex items-center gap-3.5 px-3.5 py-3 rounded-2xl text-sm font-medium transition-all ${
                    isActive
                      ? 'bg-white/[0.08] text-white shadow-sm border border-white/10'
                      : 'text-neutral-400 hover:text-white hover:bg-white/[0.04]'
                  } ${isSidebarCollapsed ? 'justify-center px-2' : ''}`}
                >
                  <Icon
                    className={`w-5 h-5 transition-colors shrink-0 ${
                      isActive ? 'text-[#00D1FF]' : 'text-neutral-400'
                    }`}
                  />
                  {!isSidebarCollapsed && <span className="truncate">{item.label}</span>}
                  {isActive && !isSidebarCollapsed && (
                    <span className="ml-auto w-1.5 h-1.5 rounded-full bg-[#00D1FF] shadow-sm shadow-[#00D1FF]" />
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Sidebar Footer - Bottle Status & User Card */}
        <div className="space-y-3 pt-4 border-t border-white/5">
          {bottle && !isSidebarCollapsed && (
            <div className="p-3.5 rounded-2xl bg-white/[0.03] border border-white/5 text-xs">
              <div className="flex items-center justify-between mb-2">
                <span className="text-neutral-400 font-mono text-[11px] truncate max-w-[120px]">
                  {bottle.bottleId}
                </span>
                <span
                  className={`flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full ${
                    bottle.online
                      ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                      : 'bg-neutral-800 text-neutral-400'
                  }`}
                >
                  {bottle.online ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
                  <span>{bottle.online ? 'Connected' : 'Offline'}</span>
                </span>
              </div>
              <div className="flex items-center justify-between text-[11px] text-neutral-400">
                <span className="flex items-center gap-1">
                  <BatteryMedium className="w-3 h-3 text-emerald-400" />
                  {bottle.battery}%
                </span>
                <span>{bottle.waterLevel} ml fluid</span>
              </div>
            </div>
          )}

          {/* User Profile / Logout */}
          <div
            className={`flex items-center rounded-2xl bg-white/[0.03] border border-white/5 ${
              isSidebarCollapsed ? 'p-2 justify-center' : 'p-2.5 justify-between'
            }`}
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-full bg-[#00D1FF]/15 border border-[#00D1FF]/30 flex items-center justify-center text-xs font-semibold text-[#00D1FF] shrink-0">
                {user?.name ? user.name[0].toUpperCase() : 'U'}
              </div>
              {!isSidebarCollapsed && (
                <div className="min-w-0">
                  <p className="text-xs font-medium text-white truncate">{user?.name || 'User'}</p>
                  <p className="text-[10px] text-neutral-400 truncate">{user?.email}</p>
                </div>
              )}
            </div>

            {!isSidebarCollapsed && (
              <button
                onClick={() => signOut()}
                title="Sign Out"
                className="p-1.5 text-neutral-400 hover:text-rose-400 rounded-xl hover:bg-white/5 transition-colors shrink-0"
              >
                <LogOut className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-h-screen min-h-[100dvh] overflow-x-hidden pb-24 md:pb-8 bg-[#090B0E] transition-colors duration-200">
        <main className="flex-1 w-full">{children}</main>
      </div>

      {/* Mobile Bottom Navigation Bar (Refined Safe-Area Aware) */}
      <nav
        aria-label="Mobile Navigation"
        className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-[#090B0E]/90 backdrop-blur-2xl border-t border-white/10 px-2 sm:px-6 pt-2 pb-[max(0.6rem,env(safe-area-inset-bottom))] flex items-center justify-around shadow-2xl safe-area-pb"
      >
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onSelectTab(item.id)}
              className={`flex-1 flex flex-col items-center justify-center py-1.5 px-2 rounded-2xl transition-all relative touch-target active:scale-95 ${
                isActive ? 'text-[#00D1FF]' : 'text-neutral-400 hover:text-neutral-200'
              }`}
            >
              <div className="relative">
                <Icon className={`w-5 h-5 transition-transform ${isActive ? 'scale-110' : ''}`} />
                {isActive && (
                  <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-[#00D1FF] shadow-sm shadow-[#00D1FF]" />
                )}
              </div>
              <span className={`text-[10px] font-medium tracking-tight mt-1 truncate ${isActive ? 'font-semibold text-white' : ''}`}>
                {item.label}
              </span>
            </button>
          );
        })}
      </nav>
    </div>
  );
};


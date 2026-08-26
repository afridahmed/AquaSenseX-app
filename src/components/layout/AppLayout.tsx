import React, { ReactNode, useState, useEffect } from 'react';
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
  LogOut,
  ChevronLeft,
} from 'lucide-react';

interface AppLayoutProps {
  currentTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  children: ReactNode;
}

const STORAGE_KEY = 'aquasense_sidebar_collapsed';

export const AppLayout: React.FC<AppLayoutProps> = ({
  currentTab,
  onSelectTab,
  children,
}) => {
  const { user, signOut } = useAuth();
  const { bottle } = useBottle();
  const { theme } = useTheme();

  // Session-persisted collapsed state for laptop/desktop sidebar
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved !== null ? JSON.parse(saved) : false;
    } catch {
      return false;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(isSidebarCollapsed));
    } catch {
      // Ignore storage errors
    }
  }, [isSidebarCollapsed]);

  const navItems = [
    { id: 'dashboard' as NavTab, label: 'Dashboard', icon: LayoutDashboard },
    { id: 'community' as NavTab, label: 'Community', icon: MapPin },
    { id: 'coach' as NavTab, label: 'AI Coach', icon: Bot },
    { id: 'profile' as NavTab, label: 'Profile', icon: User },
  ];

  return (
    <div className="min-h-screen min-h-[100dvh] bg-[#090B0E] dark:bg-[#090B0E] text-[#F8FAFC] flex flex-col md:flex-row antialiased selection:bg-[#00D1FF]/30 selection:text-[#00D1FF] transition-colors duration-200">
      {/* Laptop & Desktop Sidebar Navigation */}
      <aside
        id="desktop-sidebar"
        className={`hidden md:flex flex-col justify-between shrink-0 h-screen sticky top-0 bg-[#0D1117]/95 backdrop-blur-xl border-r border-white/5 transition-[width,padding] duration-200 ease-in-out motion-reduce:transition-none z-30 select-none ${
          isSidebarCollapsed ? 'w-20 p-3 lg:p-4' : 'w-64 lg:w-72 p-5 lg:p-6'
        }`}
      >
        <div>
          {/* Sidebar Header: Brand & Expand/Collapse Control */}
          <div className="mb-6">
            {isSidebarCollapsed ? (
              /* Collapsed State: Centered AquaSense X Logo is the Expand Button */
              <div className="relative group flex justify-center">
                <button
                  id="btn-sidebar-expand-logo"
                  type="button"
                  onClick={() => setIsSidebarCollapsed(false)}
                  title="Expand sidebar"
                  aria-label="Expand sidebar"
                  className="w-10 h-10 rounded-[14px] bg-gradient-to-tr from-[#00D1FF] to-[#0077FF] flex items-center justify-center shadow-md shadow-[#00D1FF]/15 hover:shadow-lg hover:shadow-[#00D1FF]/25 hover:scale-105 active:scale-95 focus:outline-none focus:ring-2 focus:ring-[#00D1FF]/50 transition-all duration-150 cursor-pointer shrink-0"
                >
                  <Droplets className="w-5 h-5 text-[#090B0E] font-bold" />
                </button>

                {/* Floating Tooltip on Hover/Focus */}
                <div
                  role="tooltip"
                  className="absolute left-full ml-3 top-1/2 -translate-y-1/2 px-2.5 py-1.5 rounded-lg bg-[#14181F] text-xs font-medium text-white border border-white/15 shadow-xl opacity-0 pointer-events-none group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity duration-150 whitespace-nowrap z-50"
                >
                  Expand sidebar
                </div>
              </div>
            ) : (
              /* Expanded State: Brand Identity + Dedicated Compact Collapse Control */
              <div className="flex items-center justify-between px-1">
                <div
                  onClick={() => onSelectTab('dashboard')}
                  className="flex items-center gap-3 cursor-pointer group min-w-0"
                  title="AquaSense X"
                >
                  <div className="w-10 h-10 rounded-[14px] bg-gradient-to-tr from-[#00D1FF] to-[#0077FF] flex items-center justify-center shadow-lg shadow-[#00D1FF]/20 group-hover:scale-105 transition-transform shrink-0">
                    <Droplets className="w-5 h-5 text-[#090B0E] font-bold" />
                  </div>
                  <div className="min-w-0 transition-opacity duration-200">
                    <span className="text-base font-bold tracking-tight text-white block truncate font-sans">
                      AquaSense X
                    </span>
                    <span className="text-[10px] text-neutral-400 font-medium tracking-wide uppercase">
                      Smart Water System
                    </span>
                  </div>
                </div>

                <button
                  id="btn-sidebar-collapse-toggle"
                  type="button"
                  onClick={() => setIsSidebarCollapsed(true)}
                  title="Collapse sidebar"
                  aria-label="Collapse sidebar"
                  className="flex items-center justify-center w-7 h-7 rounded-lg bg-white/[0.04] hover:bg-white/[0.09] active:bg-white/[0.14] text-neutral-400 hover:text-white border border-white/10 hover:border-white/20 transition-all duration-150 cursor-pointer shrink-0 shadow-sm"
                >
                  <ChevronLeft className="w-3.5 h-3.5 text-neutral-300" />
                </button>
              </div>
            )}
          </div>

          {/* Navigation Items */}
          <nav className="space-y-1.5" aria-label="Main Navigation">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = currentTab === item.id;
              return (
                <div key={item.id} className="relative group">
                  <button
                    id={`nav-item-${item.id}`}
                    onClick={() => onSelectTab(item.id)}
                    title={isSidebarCollapsed ? item.label : undefined}
                    aria-label={item.label}
                    className={`w-full flex items-center transition-all duration-150 cursor-pointer ${
                      isSidebarCollapsed
                        ? 'justify-center p-3 rounded-xl'
                        : 'gap-3.5 px-3.5 py-3 rounded-2xl text-sm font-medium'
                    } ${
                      isActive
                        ? 'bg-white/[0.08] text-white shadow-sm border border-white/10'
                        : 'text-neutral-400 hover:text-white hover:bg-white/[0.04]'
                    }`}
                  >
                    <Icon
                      className={`w-5 h-5 transition-colors shrink-0 ${
                        isActive ? 'text-[#00D1FF]' : 'text-neutral-400 group-hover:text-neutral-200'
                      }`}
                    />
                    {!isSidebarCollapsed && (
                      <span className="truncate font-sans">{item.label}</span>
                    )}
                    {isActive && !isSidebarCollapsed && (
                      <span className="ml-auto w-1.5 h-1.5 rounded-full bg-[#00D1FF] shadow-sm shadow-[#00D1FF]" />
                    )}
                    {isActive && isSidebarCollapsed && (
                      <span className="absolute right-1 top-1/2 -translate-y-1/2 w-1 h-3.5 rounded-full bg-[#00D1FF] shadow-sm shadow-[#00D1FF]/60" />
                    )}
                  </button>

                  {/* Accessible Hover Tooltip in Collapsed Mode */}
                  {isSidebarCollapsed && (
                    <div
                      role="tooltip"
                      className="absolute left-full ml-3 top-1/2 -translate-y-1/2 px-2.5 py-1.5 rounded-lg bg-[#14181F] text-xs font-medium text-white border border-white/15 shadow-xl opacity-0 pointer-events-none group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity duration-150 whitespace-nowrap z-50"
                    >
                      {item.label}
                    </div>
                  )}
                </div>
              );
            })}
          </nav>
        </div>

        {/* Sidebar Footer - Bottle Status & User Card */}
        <div className="space-y-2.5 pt-4 border-t border-white/5">
          {/* Bottle Status Section */}
          {bottle && (
            isSidebarCollapsed ? (
              <div className="relative group">
                <div
                  className="flex flex-col items-center justify-center p-2 rounded-xl bg-white/[0.03] border border-white/5 text-neutral-400 hover:text-white transition-colors cursor-pointer"
                  title={`AquaSense X (${bottle.bottleId}) · ${bottle.online ? 'Online' : 'Offline'} · ${bottle.battery}% battery · ${bottle.waterLevel} ml`}
                >
                  <div className="relative flex items-center justify-center">
                    <Droplets className="w-4 h-4 text-[#00D1FF]" />
                    <span
                      className={`absolute -top-1 -right-1 w-2 h-2 rounded-full ${
                        bottle.online ? 'bg-emerald-400 ring-2 ring-[#0D1117]' : 'bg-neutral-500'
                      }`}
                    />
                  </div>
                  <span className="text-[10px] font-mono mt-1 text-neutral-300 font-semibold">
                    {bottle.battery}%
                  </span>
                </div>

                {/* Collapsed Bottle Floating Tooltip */}
                <div
                  role="tooltip"
                  className="absolute left-full ml-3 bottom-0 px-3 py-2 rounded-xl bg-[#14181F] text-xs text-white border border-white/15 shadow-2xl opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity duration-150 whitespace-nowrap z-50"
                >
                  <div className="flex items-center gap-1.5 font-semibold text-[#00D1FF]">
                    <span>AquaSense X</span>
                    <span className="text-[10px] text-neutral-400 font-mono">({bottle.bottleId})</span>
                  </div>
                  <div className="flex items-center gap-2 mt-1 text-[11px] text-neutral-300">
                    <span className={bottle.online ? 'text-emerald-400' : 'text-neutral-400'}>
                      {bottle.online ? '● Connected' : '○ Offline'}
                    </span>
                    <span>•</span>
                    <span>{bottle.battery}% Battery</span>
                    <span>•</span>
                    <span>{bottle.waterLevel} ml</span>
                  </div>
                </div>
              </div>
            ) : (
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
            )
          )}

          {/* User Profile / Logout Card */}
          <div
            className={`flex items-center rounded-2xl bg-white/[0.03] border border-white/5 transition-all ${
              isSidebarCollapsed
                ? 'p-2 flex-col gap-2 justify-center'
                : 'p-2.5 justify-between'
            }`}
          >
            <div className="relative group">
              <div
                className="w-8 h-8 rounded-full bg-[#00D1FF]/15 border border-[#00D1FF]/30 flex items-center justify-center text-xs font-semibold text-[#00D1FF] shrink-0 cursor-pointer"
                title={`${user?.name || 'User'} (${user?.email || ''})`}
              >
                {user?.name ? user.name[0].toUpperCase() : 'U'}
              </div>

              {isSidebarCollapsed && (
                <div
                  role="tooltip"
                  className="absolute left-full ml-3 bottom-0 px-2.5 py-1.5 rounded-xl bg-[#14181F] text-xs text-white border border-white/15 shadow-xl opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity duration-150 whitespace-nowrap z-50"
                >
                  <p className="font-medium text-white">{user?.name || 'User'}</p>
                  <p className="text-[10px] text-neutral-400">{user?.email}</p>
                </div>
              )}
            </div>

            {!isSidebarCollapsed && (
              <div className="min-w-0 flex-1 px-2">
                <p className="text-xs font-medium text-white truncate">{user?.name || 'User'}</p>
                <p className="text-[10px] text-neutral-400 truncate">{user?.email}</p>
              </div>
            )}

            <button
              id="btn-sidebar-signout"
              onClick={() => signOut()}
              title="Sign Out"
              aria-label="Sign Out"
              className="p-1.5 text-neutral-400 hover:text-rose-400 rounded-xl hover:bg-white/5 transition-colors shrink-0 cursor-pointer"
            >
              <LogOut className={isSidebarCollapsed ? 'w-3.5 h-3.5' : 'w-4 h-4'} />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-h-screen min-h-[100dvh] overflow-x-hidden pb-24 md:pb-8 bg-[#090B0E] transition-colors duration-200">
        <main className="flex-1 w-full">{children}</main>
      </div>

      {/* Mobile Bottom Navigation Bar (Preserved and Unchanged) */}
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


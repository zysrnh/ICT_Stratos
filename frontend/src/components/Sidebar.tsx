import React from 'react';
import {
  LayoutDashboard,
  ShieldAlert,
  Bot,
  Users2,
  Settings,
  KeyRound,
  LogOut,
} from 'lucide-react';

interface NavProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  alertCount: number;
  onOpenAuth?: () => void;
  onLogout?: () => void;
}

// 1. Sidebar Khusus Layar Tablet & Desktop (>= md) - Flat Minimalist
export const Sidebar: React.FC<NavProps> = ({
  activeTab,
  setActiveTab,
  alertCount,
  onOpenAuth,
  onLogout,
}) => {
  const navItems = [
    { id: 'dashboard', icon: LayoutDashboard, label: 'Health Biometrics' },
    { id: 'home', icon: ShieldAlert, label: 'Home Safety & Events', badge: alertCount },
    { id: 'companion', icon: Bot, label: 'AI Companion' },
    { id: 'family', icon: Users2, label: 'Family & Consent' },
    { id: 'settings', icon: Settings, label: 'Pengaturan Sistem' },
  ];

  return (
    <aside className="hidden md:flex w-20 lg:w-22 flex-col items-center py-6 px-2 bg-[#111111] text-white rounded-none border-r border-neutral-800 shrink-0 select-none">
      {/* Brand Icon / Logo Huawei Health Ecosystem */}
      <div className="mb-8 flex flex-col items-center">
        <div className="w-11 h-11 rounded-none bg-white text-[#111111] flex items-center justify-center font-extrabold text-xl tracking-tighter shadow-xs">
          H.
        </div>
        <span className="text-[9px] font-bold tracking-wider text-neutral-400 mt-1.5 uppercase">ECA</span>
      </div>

      {/* Nav Menu Icons */}
      <nav className="flex-1 flex flex-col items-center gap-3 w-full">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              title={item.label}
              className={`relative w-12 h-12 rounded-none flex items-center justify-center transition-colors cursor-pointer border ${
                isActive
                  ? 'bg-white text-[#111111] border-white font-bold'
                  : 'text-neutral-400 border-transparent hover:text-white hover:bg-neutral-900'
              }`}
            >
              <Icon className="w-5 h-5 stroke-[2]" />
              {item.badge && item.badge > 0 ? (
                <span className="absolute top-1 right-1 w-4 h-4 bg-red-600 text-white text-[9px] font-bold rounded-none flex items-center justify-center">
                  {item.badge}
                </span>
              ) : null}
            </button>
          );
        })}
      </nav>

      {/* Bottom Profile / Pairing Token Access & Disconnect */}
      <div className="mt-auto pt-4 border-t border-neutral-800 w-full flex flex-col items-center gap-2">
        <button
          onClick={onOpenAuth}
          title="Ganti Jam Tangan / Token ID"
          className="w-10 h-10 rounded-none flex items-center justify-center text-neutral-400 hover:text-white hover:bg-neutral-900 transition-colors cursor-pointer"
        >
          <KeyRound className="w-4 h-4" />
        </button>

        {onLogout && (
          <button
            onClick={onLogout}
            title="Putuskan Jam / Keluar"
            className="w-10 h-10 rounded-none flex items-center justify-center text-red-400 hover:text-red-300 hover:bg-neutral-900 transition-colors cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
          </button>
        )}
      </div>
    </aside>
  );
};

// 2. Docked Bottom Navigation Bar Khusus Mobile (< md) - Flat Docked Bar Anti Menutupi Konten
export const BottomNav: React.FC<NavProps> = ({
  activeTab,
  setActiveTab,
  alertCount,
  onOpenAuth,
  onLogout,
}) => {
  const navItems = [
    { id: 'dashboard', icon: LayoutDashboard, label: 'Health' },
    { id: 'home', icon: ShieldAlert, label: 'Safety', badge: alertCount },
    { id: 'companion', icon: Bot, label: 'AI' },
    { id: 'family', icon: Users2, label: 'Family' },
    { id: 'settings', icon: Settings, label: 'Config' },
  ];

  return (
    <nav className="md:hidden fixed bottom-0 inset-x-0 bg-[#111111] text-white rounded-none py-1.5 px-1 z-50 border-t border-neutral-800 flex items-center justify-around select-none">
      {navItems.map((item) => {
        const Icon = item.icon;
        const isActive = activeTab === item.id;
        return (
          <button
            key={item.id}
            onClick={() => setActiveTab(item.id)}
            className={`relative flex flex-col items-center justify-center py-1 px-2.5 rounded-none transition-colors cursor-pointer ${
              isActive
                ? 'text-white font-bold bg-neutral-900 border-b-2 border-white'
                : 'text-neutral-400 hover:text-white'
            }`}
          >
            <Icon className="w-4 h-4" />
            <span className="text-[10px] mt-0.5 tracking-tight">{item.label}</span>
            {item.badge && item.badge > 0 ? (
              <span className="absolute top-0 right-1 w-3.5 h-3.5 bg-red-600 text-white text-[8px] font-bold rounded-none flex items-center justify-center">
                {item.badge}
              </span>
            ) : null}
          </button>
        );
      })}

      {/* Tombol Pairing Mobile */}
      <button
        onClick={onOpenAuth}
        title="Ganti Jam"
        className="flex flex-col items-center justify-center py-1 px-2 rounded-none text-neutral-400 hover:text-white transition-colors cursor-pointer"
      >
        <KeyRound className="w-4 h-4" />
        <span className="text-[10px] mt-0.5 tracking-tight">Token</span>
      </button>

      {onLogout && (
        <button
          onClick={onLogout}
          title="Keluar"
          className="flex flex-col items-center justify-center py-1 px-2 rounded-none text-red-400 hover:text-red-300 transition-colors cursor-pointer"
        >
          <LogOut className="w-4 h-4" />
          <span className="text-[10px] mt-0.5 tracking-tight">Keluar</span>
        </button>
      )}
    </nav>
  );
};

export default Sidebar;

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

// 1. Sidebar Khusus Layar Tablet & Desktop (>= md)
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
    { id: 'companion', icon: Bot, label: 'AI Companion & Reminders' },
    { id: 'family', icon: Users2, label: 'Family & Data Privacy' },
    { id: 'settings', icon: Settings, label: 'Pengaturan Sistem' },
  ];

  return (
    <aside className="hidden md:flex w-20 lg:w-22 flex-col items-center py-6 px-3 bg-[#111111] text-white rounded-[32px] my-3 ml-3 shadow-xl shrink-0 select-none">
      {/* Brand Icon / Logo Huawei Health Ecosystem */}
      <div className="mb-8 flex flex-col items-center">
        <div className="w-12 h-12 rounded-2xl bg-white text-[#111111] flex items-center justify-center font-extrabold text-2xl tracking-tighter shadow-md">
          H.
        </div>
        <span className="text-[9px] font-semibold tracking-wider text-neutral-400 mt-1 uppercase">ECA</span>
      </div>

      {/* Nav Menu Icons */}
      <nav className="flex-1 flex flex-col items-center gap-4 w-full">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              title={item.label}
              className={`relative w-12 h-12 rounded-2xl flex items-center justify-center transition-all duration-200 cursor-pointer ${
                isActive
                  ? 'bg-white text-[#111111] shadow-md scale-105'
                  : 'text-neutral-400 hover:text-white hover:bg-neutral-800/60'
              }`}
            >
              <Icon className="w-5 h-5 stroke-[2.2]" />
              {item.badge && item.badge > 0 ? (
                <span className="absolute -top-1 -right-1 w-5 h-5 bg-[#DC2626] text-white text-[10px] font-bold rounded-full flex items-center justify-center border-2 border-[#111111] animate-pulse">
                  {item.badge}
                </span>
              ) : null}
            </button>
          );
        })}
      </nav>

      {/* Bottom Profile / Pairing Token Access & Disconnect */}
      <div className="mt-auto pt-4 border-t border-neutral-800/80 w-full flex flex-col items-center gap-2">
        <button
          onClick={onOpenAuth}
          title="Ganti Jam Tangan / Token ID"
          className="w-10 h-10 rounded-xl flex items-center justify-center text-neutral-400 hover:text-white hover:bg-neutral-800/60 transition-colors cursor-pointer"
        >
          <KeyRound className="w-4 h-4 stroke-[2]" />
        </button>

        {onLogout && (
          <button
            onClick={onLogout}
            title="Putuskan Jam / Keluar"
            className="w-10 h-10 rounded-xl flex items-center justify-center text-red-400 hover:text-red-300 hover:bg-red-950/40 transition-colors cursor-pointer"
          >
            <LogOut className="w-4 h-4 stroke-[2]" />
          </button>
        )}
      </div>
    </aside>
  );
};

// 2. Bottom Navigation Bar Khusus Mobile (< md)
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
    { id: 'settings', icon: Settings, label: 'Settings' },
  ];

  return (
    <nav className="md:hidden fixed bottom-4 left-4 right-4 bg-[#111111] text-white rounded-3xl p-2.5 shadow-2xl flex items-center justify-around z-50 border border-neutral-800/80">
      {navItems.map((item) => {
        const Icon = item.icon;
        const isActive = activeTab === item.id;
        return (
          <button
            key={item.id}
            onClick={() => setActiveTab(item.id)}
            className={`relative flex flex-col items-center justify-center py-1.5 px-3 rounded-2xl transition-all duration-200 cursor-pointer ${
              isActive ? 'bg-white text-[#111111] font-semibold' : 'text-neutral-400 hover:text-white'
            }`}
          >
            <Icon className="w-5 h-5 stroke-[2.2]" />
            <span className="text-[10px] mt-0.5 tracking-tight">{item.label}</span>
            {item.badge && item.badge > 0 ? (
              <span className="absolute -top-1 right-1 w-4 h-4 bg-[#DC2626] text-white text-[9px] font-bold rounded-full flex items-center justify-center border-2 border-[#111111] animate-pulse">
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
        className="flex flex-col items-center justify-center py-1.5 px-3 rounded-2xl text-neutral-400 hover:text-white transition-all cursor-pointer"
      >
        <KeyRound className="w-5 h-5 stroke-[2.2]" />
        <span className="text-[10px] mt-0.5 tracking-tight">Token</span>
      </button>

      {onLogout && (
        <button
          onClick={onLogout}
          title="Keluar"
          className="flex flex-col items-center justify-center py-1.5 px-3 rounded-2xl text-red-400 hover:text-red-300 transition-all cursor-pointer"
        >
          <LogOut className="w-5 h-5 stroke-[2.2]" />
          <span className="text-[10px] mt-0.5 tracking-tight">Exit</span>
        </button>
      )}
    </nav>
  );
};

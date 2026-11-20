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
    { id: 'dashboard', icon: LayoutDashboard, label: 'Ringkasan kesehatan' },
    { id: 'home', icon: ShieldAlert, label: 'Keamanan rumah', badge: alertCount },
    { id: 'companion', icon: Bot, label: 'Pendamping' },
    { id: 'family', icon: Users2, label: 'Keluarga & izin' },
    { id: 'settings', icon: Settings, label: 'Pengaturan' },
  ];

  return (
    <aside
      aria-label="Navigasi utama"
      className="hidden md:flex w-20 flex-col items-center py-6 px-2.5 bg-[#1C1C1F] text-white shrink-0 select-none z-20 sticky top-0 h-screen"
    >
      {/* Satu Logo Tunggal */}
      <div className="mb-8 flex items-center justify-center">
        <div
          className="w-11 h-11 rounded-[14px] bg-white/12 border border-white/15 text-white flex items-center justify-center font-semibold text-lg"
          aria-label="ELDERA"
        >
          E.
        </div>
      </div>

      {/* Menu Navigasi */}
      <nav className="flex-1 flex flex-col items-center gap-2.5 w-full">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <div key={item.id} className="relative group flex items-center justify-center w-full">
              <button
                type="button"
                onClick={() => setActiveTab(item.id)}
                aria-label={item.label}
                aria-current={isActive ? 'page' : undefined}
                className={`relative w-12 h-12 rounded-[14px] flex items-center justify-center transition-all duration-180 ease-out cursor-pointer ${
                  isActive
                    ? 'bg-white text-[#18181B] shadow-sm'
                    : 'text-neutral-400 hover:text-white hover:bg-white/10'
                }`}
              >
                <Icon className="w-5 h-5 stroke-[1.9]" />
                {item.badge && item.badge > 0 ? (
                  <span
                    aria-label={`${item.badge} peringatan aktif`}
                    className="absolute -top-1 -right-1 min-w-[20px] h-5 px-1 bg-[#DC2626] text-white text-[11px] font-semibold rounded-full flex items-center justify-center ring-2 ring-[#1C1C1F]"
                  >
                    {item.badge}
                  </span>
                ) : null}
              </button>

              {/* Tooltip Label saat Hover */}
              <span
                role="tooltip"
                className="pointer-events-none opacity-0 group-hover:opacity-100 translate-x-1 group-hover:translate-x-0 transition-all duration-150 ease-out absolute left-[calc(100%+10px)] whitespace-nowrap px-3 py-1.5 rounded-full bg-[#18181B] text-white text-[13px] font-medium shadow-md border border-white/10 z-40"
              >
                {item.label}
              </span>
            </div>
          );
        })}
      </nav>

      {/* Kontrol Bawah: Ganti Jam & Keluar */}
      <div className="mt-auto pt-4 border-t border-white/10 w-full flex flex-col items-center gap-2">
        <div className="relative group flex items-center justify-center">
          <button
            type="button"
            onClick={onOpenAuth}
            aria-label="Ganti jam tangan"
            className="w-11 h-11 rounded-[14px] flex items-center justify-center text-neutral-400 hover:text-white hover:bg-white/10 transition-colors duration-180 cursor-pointer"
          >
            <KeyRound className="w-[18px] h-[18px]" />
          </button>
          <span
            role="tooltip"
            className="pointer-events-none opacity-0 group-hover:opacity-100 translate-x-1 group-hover:translate-x-0 transition-all duration-150 ease-out absolute left-[calc(100%+10px)] whitespace-nowrap px-3 py-1.5 rounded-full bg-[#18181B] text-white text-[13px] font-medium shadow-md border border-white/10 z-40"
          >
            Ganti jam tangan
          </span>
        </div>

        {onLogout && (
          <div className="relative group flex items-center justify-center">
            <button
              type="button"
              onClick={onLogout}
              aria-label="Putuskan koneksi"
              className="w-11 h-11 rounded-[14px] flex items-center justify-center text-red-300 hover:text-red-200 hover:bg-red-500/15 transition-colors duration-180 cursor-pointer"
            >
              <LogOut className="w-[18px] h-[18px]" />
            </button>
            <span
              role="tooltip"
              className="pointer-events-none opacity-0 group-hover:opacity-100 translate-x-1 group-hover:translate-x-0 transition-all duration-150 ease-out absolute left-[calc(100%+10px)] whitespace-nowrap px-3 py-1.5 rounded-full bg-[#18181B] text-white text-[13px] font-medium shadow-md border border-white/10 z-40"
            >
              Putuskan koneksi
            </span>
          </div>
        )}
      </div>
    </aside>
  );
};

// 2. Navigasi Bawah Khusus Mobile (< md)
export const BottomNav: React.FC<NavProps> = ({
  activeTab,
  setActiveTab,
  alertCount,
}) => {
  const navItems = [
    { id: 'dashboard', icon: LayoutDashboard, label: 'Beranda' },
    { id: 'home', icon: ShieldAlert, label: 'Rumah', badge: alertCount },
    { id: 'companion', icon: Bot, label: 'Sahabat' },
    { id: 'family', icon: Users2, label: 'Keluarga' },
    { id: 'settings', icon: Settings, label: 'Atur' },
  ];

  return (
    <nav
      aria-label="Navigasi seluler"
      className="md:hidden fixed bottom-0 inset-x-0 bg-[#1C1C1F] text-white py-2 px-2 z-40 border-t border-white/10 flex items-center justify-around gap-1 select-none"
    >
      {navItems.map((item) => {
        const Icon = item.icon;
        const isActive = activeTab === item.id;
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => setActiveTab(item.id)}
            aria-label={item.label}
            aria-current={isActive ? 'page' : undefined}
            className={`relative flex-1 min-h-[44px] flex flex-col items-center justify-center py-1.5 px-1 rounded-[12px] transition-colors duration-180 cursor-pointer ${
              isActive
                ? 'bg-white/15 text-white font-medium'
                : 'text-neutral-400 hover:text-white'
            }`}
          >
            <Icon className="w-[18px] h-[18px]" />
            <span className="text-xs mt-0.5 leading-tight">{item.label}</span>
            {item.badge && item.badge > 0 ? (
              <span
                aria-label={`${item.badge} peringatan`}
                className="absolute top-1 right-2 min-w-[16px] h-4 px-1 bg-[#DC2626] text-white text-[10px] font-semibold rounded-full flex items-center justify-center"
              >
                {item.badge}
              </span>
            ) : null}
          </button>
        );
      })}
    </nav>
  );
};

export default Sidebar;

import React from 'react';
import { LayoutDashboard, Activity, Bell, Users, Settings, LogOut } from 'lucide-react';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  alertCount: number;
}

export const Sidebar: React.FC<SidebarProps> = ({ activeTab, setActiveTab, alertCount }) => {
  const navItems = [
    { id: 'dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    { id: 'telemetry', icon: Activity, label: 'Live Telemetry' },
    { id: 'alerts', icon: Bell, label: 'Alerts', badge: alertCount },
    { id: 'patients', icon: Users, label: 'Patients' },
    { id: 'settings', icon: Settings, label: 'Settings' },
  ];

  return (
    <aside className="w-20 lg:w-22 flex flex-col items-center py-6 px-3 bg-[#111111] text-white rounded-[32px] my-3 ml-3 shadow-xl shrink-0 select-none">
      {/* Brand Icon / Logo */}
      <div className="mb-8 flex flex-col items-center">
        <div className="w-12 h-12 rounded-2xl bg-white text-[#111111] flex items-center justify-center font-extrabold text-2xl tracking-tighter shadow-md">
          H.
        </div>
        <span className="text-[9px] font-semibold tracking-wider text-neutral-400 mt-1 uppercase">Health</span>
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
                <span className="absolute -top-1 -right-1 w-5 h-5 bg-[#DC2626] text-white text-[10px] font-bold rounded-full flex items-center justify-center border-2 border-[#111111]">
                  {item.badge}
                </span>
              ) : null}
            </button>
          );
        })}
      </nav>

      {/* Bottom Logout / Exit */}
      <div className="mt-auto pt-4 border-t border-neutral-800/80 w-full flex justify-center">
        <button
          title="Sign Out"
          className="w-11 h-11 rounded-2xl text-neutral-400 hover:text-white hover:bg-neutral-800/60 flex items-center justify-center transition-colors cursor-pointer"
        >
          <LogOut className="w-5 h-5 stroke-[2]" />
        </button>
      </div>
    </aside>
  );
};

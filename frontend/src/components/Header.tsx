import React from 'react';
import { Bell, Search } from 'lucide-react';

interface HeaderProps {
  alertCount: number;
}

export const Header: React.FC<HeaderProps> = ({ alertCount }) => {
  return (
    <header className="flex items-center justify-between gap-4 mb-6 pt-1 select-none">
      {/* Title & Clean Subtitle */}
      <div>
        <h1 className="text-2xl lg:text-3xl font-extrabold tracking-tight text-[#111111]">
          Patient Monitoring
        </h1>
        <p className="text-xs text-neutral-400 font-medium mt-1">
          Real-time Biometrics & Early Warning System
        </p>
      </div>

      {/* Right Controls: Minimal Search, Alert Bell & Clean Avatar */}
      <div className="flex items-center gap-3">
        {/* Search Box (Desktop) */}
        <div className="relative hidden md:block">
          <Search className="w-4 h-4 text-neutral-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search metric..."
            className="pl-10 pr-4 py-2 text-xs bg-white border border-neutral-200 rounded-full w-48 lg:w-56 focus:outline-none focus:ring-2 focus:ring-[#111111] transition-all shadow-xs"
          />
        </div>

        {/* Notification Icon */}
        <button
          className="relative w-10 h-10 rounded-full bg-white border border-neutral-200 flex items-center justify-center text-neutral-700 hover:bg-neutral-50 transition-colors shadow-xs cursor-pointer"
          title="Active Alerts"
        >
          <Bell className="w-4 h-4" />
          {alertCount > 0 && (
            <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 bg-red-600 rounded-full ring-2 ring-white" />
          )}
        </button>

        {/* Minimalist User Avatar */}
        <div
          title="Duty Doctor"
          className="w-10 h-10 rounded-full bg-[#111111] text-white flex items-center justify-center font-bold text-xs shadow-xs shrink-0 cursor-default"
        >
          DJ
        </div>
      </div>
    </header>
  );
};

import React from 'react';
import { Search, Bell, Radio, ShieldCheck } from 'lucide-react';

interface HeaderProps {
  isOnline: boolean;
  alertCount: number;
  patientName: string;
  roomNumber: string;
}

export const Header: React.FC<HeaderProps> = ({
  isOnline,
  alertCount,
  patientName,
  roomNumber,
}) => {
  return (
    <header className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-6 pt-2">
      {/* Welcome Greeting */}
      <div>
        <div className="flex items-center gap-2">
          <h1 className="text-2xl lg:text-3xl font-extrabold tracking-tight text-[#111111]">
            Hello Dr. Josh!
          </h1>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <Radio className={`w-3 h-3 ${isOnline ? 'animate-pulse text-emerald-600' : 'text-neutral-400'}`} />
            {isOnline ? 'IoT Cloud Connected' : 'Connecting RDS...'}
          </span>
        </div>
        <p className="text-sm text-neutral-500 font-medium mt-0.5">
          Patient Monitoring & Early Warning System • <strong className="text-neutral-800">{patientName}</strong> ({roomNumber})
        </p>
      </div>

      {/* Right Controls: Search, Notifications, Profile */}
      <div className="flex items-center gap-3 w-full md:w-auto justify-end">
        {/* Search Box */}
        <div className="relative hidden sm:block">
          <Search className="w-4 h-4 text-neutral-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search telemetry or alert..."
            className="pl-10 pr-4 py-2 text-sm bg-white border border-neutral-200 rounded-full w-56 lg:w-64 focus:outline-none focus:ring-2 focus:ring-[#111111] transition-all shadow-xs"
          />
        </div>

        {/* Notification Button */}
        <button
          className="relative w-10 h-10 rounded-full bg-white border border-neutral-200 flex items-center justify-center text-neutral-700 hover:bg-neutral-50 transition-colors shadow-xs cursor-pointer"
          title="Medical Alerts"
        >
          <Bell className="w-4 h-4" />
          {alertCount > 0 && (
            <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 bg-red-600 rounded-full ring-2 ring-white animate-ping" />
          )}
        </button>

        {/* Doctor / User Profile */}
        <div className="flex items-center gap-3 pl-2 border-l border-neutral-200">
          <div className="w-10 h-10 rounded-full bg-[#111111] text-white flex items-center justify-center font-bold text-sm shadow-xs">
            DJ
          </div>
          <div className="hidden lg:block text-left text-xs">
            <div className="font-bold text-neutral-900 flex items-center gap-1">
              Dr. Joshua S.
              <ShieldCheck className="w-3.5 h-3.5 text-blue-600" />
            </div>
            <div className="text-neutral-400 font-medium">Head of ICU Duty</div>
          </div>
        </div>
      </div>
    </header>
  );
};

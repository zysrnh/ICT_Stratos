import React from 'react';
import { Bell, Search, Watch, RefreshCw } from 'lucide-react';
import type { AuthSession } from '../types/telemetry';

interface HeaderProps {
  alertCount: number;
  session: AuthSession | null;
  onOpenAuth: () => void;
}

export const Header: React.FC<HeaderProps> = ({ alertCount, session, onOpenAuth }) => {
  return (
    <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 pt-1 select-none">
      {/* Title & Patient Information */}
      <div>
        <div className="flex items-center gap-2">
          <h1 className="text-2xl lg:text-3xl font-extrabold tracking-tight text-[#111111]">
            Patient Monitoring
          </h1>
          {session && (
            <span className="hidden sm:inline-block px-2.5 py-0.5 text-[11px] font-bold bg-neutral-900 text-white rounded-none">
              {session.patient_name}
            </span>
          )}
        </div>
        <p className="text-xs text-neutral-400 font-medium mt-1">
          Real-time Biometrics & Early Warning System — Huawei Ecosystem
        </p>
      </div>

      {/* Right Controls: Token Pairing Status, Search, Alert Bell & Avatar */}
      <div className="flex items-center gap-3 self-end sm:self-auto">
        {/* Token Pairing Pill */}
        <button
          onClick={onOpenAuth}
          title="Klik untuk mengganti token perangkat / ID Jam"
          className="flex items-center gap-2 px-3 py-1.5 bg-white border-2 border-neutral-300 hover:border-neutral-900 transition-all text-xs font-mono shadow-xs cursor-pointer group"
        >
          <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <Watch className="w-3.5 h-3.5 text-neutral-600 group-hover:text-neutral-900" />
          <span className="font-bold text-neutral-900">
            {session ? session.token : 'Belum Dipasangkan'}
          </span>
          <RefreshCw className="w-3 h-3 text-neutral-400 group-hover:rotate-180 transition-transform duration-300" />
        </button>

        {/* Search Box (Desktop) */}
        <div className="relative hidden md:block">
          <Search className="w-4 h-4 text-neutral-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search metric..."
            className="pl-10 pr-4 py-2 text-xs bg-white border border-neutral-200 rounded-none w-44 lg:w-52 focus:outline-none focus:ring-2 focus:ring-[#111111] transition-all shadow-xs"
          />
        </div>

        {/* Notification Icon */}
        <button
          className="relative w-10 h-10 bg-white border border-neutral-200 flex items-center justify-center text-neutral-700 hover:bg-neutral-50 transition-colors shadow-xs cursor-pointer"
          title="Active Alerts"
        >
          <Bell className="w-4 h-4" />
          {alertCount > 0 && (
            <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 bg-red-600 ring-2 ring-white" />
          )}
        </button>

        {/* User Role Avatar */}
        <button
          onClick={onOpenAuth}
          title={`Masuk sebagai: ${session?.user?.full_name || 'Keluarga'}`}
          className="w-10 h-10 bg-[#111111] text-white flex items-center justify-center font-bold text-xs shadow-xs shrink-0 cursor-pointer hover:bg-neutral-800 transition-colors"
        >
          {session?.user?.role === 'FAMILY_PRIMARY' ? 'FAM' : 'ECA'}
        </button>
      </div>
    </header>
  );
};

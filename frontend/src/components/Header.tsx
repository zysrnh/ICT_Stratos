import React from 'react';
import { Bell, Search, Watch, RefreshCw, LogOut } from 'lucide-react';
import type { AuthSession } from '../types/telemetry';

interface HeaderProps {
  alertCount: number;
  session: AuthSession | null;
  onOpenAuth: () => void;
  onLogout?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  alertCount,
  session,
  onOpenAuth,
  onLogout,
}) => {
  return (
    <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5 select-none">
      {/* Title & Patient Information */}
      <div>
        <div className="flex items-center gap-2">
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-black tracking-tight text-[#111111]">
            Patient Monitoring
          </h1>
          {session && (
            <span className="px-2 py-0.5 text-[11px] font-bold bg-[#111111] text-white rounded-none">
              {session.patient_name}
            </span>
          )}
        </div>
        <p className="text-[11px] sm:text-xs text-neutral-500 font-medium mt-0.5">
          Real-time Biometrics &amp; Early Warning System — Huawei Ecosystem
        </p>
      </div>

      {/* Right Controls: Token Pairing, Alert Bell & Controls */}
      <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
        {/* Token Pairing Status Button */}
        <button
          onClick={onOpenAuth}
          title="Klik untuk mengganti token perangkat / ID Jam"
          className="flex items-center gap-1.5 px-2.5 py-1.5 bg-white border border-neutral-300 hover:border-neutral-900 transition-colors text-xs font-mono shadow-xs cursor-pointer rounded-none"
        >
          <span className="w-2 h-2 rounded-none bg-emerald-500 shrink-0" />
          <Watch className="w-3.5 h-3.5 text-neutral-600 shrink-0" />
          <span className="font-bold text-neutral-900 truncate max-w-[150px]">
            {session ? session.token : 'Belum Dipasangkan'}
          </span>
          <RefreshCw className="w-3 h-3 text-neutral-400 shrink-0" />
        </button>

        {/* Search Box (Desktop only) */}
        <div className="relative hidden lg:block">
          <Search className="w-3.5 h-3.5 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Cari metrik..."
            className="pl-8 pr-3 py-1.5 text-xs bg-white border border-neutral-200 rounded-none w-36 focus:outline-none focus:border-neutral-900 shadow-xs"
          />
        </div>

        {/* Notification Icon */}
        <button
          className="relative w-8 h-8 sm:w-9 sm:h-9 bg-white border border-neutral-300 flex items-center justify-center text-neutral-700 hover:bg-neutral-100 transition-colors shadow-xs cursor-pointer rounded-none"
          title="Notifikasi Kejadian"
        >
          <Bell className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          {alertCount > 0 && (
            <span className="absolute top-1 right-1 w-2 h-2 bg-red-600 rounded-none" />
          )}
        </button>

        {/* User Role Avatar */}
        <button
          onClick={onOpenAuth}
          title={`Masuk sebagai: ${session?.user?.full_name || 'Keluarga'}`}
          className="w-8 h-8 sm:w-9 sm:h-9 bg-[#111111] text-white flex items-center justify-center font-bold text-xs shadow-xs shrink-0 cursor-pointer hover:bg-neutral-800 transition-colors rounded-none"
        >
          {session?.user?.role === 'FAMILY_PRIMARY' ? 'FAM' : 'ECA'}
        </button>

        {/* Disconnect Button */}
        {onLogout && (
          <button
            onClick={onLogout}
            title="Putuskan Koneksi / Logout"
            className="w-8 h-8 sm:w-9 sm:h-9 bg-white border border-neutral-300 text-neutral-600 hover:text-red-600 hover:border-red-500 transition-colors flex items-center justify-center shadow-xs cursor-pointer rounded-none"
          >
            <LogOut className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          </button>
        )}
      </div>
    </header>
  );
};

export default Header;

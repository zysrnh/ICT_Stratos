import React, { useState, useRef, useEffect } from 'react';
import {
  Bell,
  Watch,
  SlidersHorizontal,
  X,
  Activity,
  ShieldAlert,
  Flame,
  RotateCcw,
  KeyRound,
  Settings,
  LogOut,
  Check,
} from 'lucide-react';
import type { AuthSession } from '../types/telemetry';

interface HeaderProps {
  alertCount: number;
  session: AuthSession | null;
  onOpenAuth: () => void;
  onLogout?: () => void;
  onTriggerSim?: (type: 'FALL' | 'SOS' | 'SMOKE') => Promise<void> | void;
  onResetNormal?: () => Promise<void> | void;
  onGoToSettings?: () => void;
  onGoToSafety?: () => void;
  lastUpdatedText?: string;
}

export const Header: React.FC<HeaderProps> = ({
  alertCount,
  session,
  onOpenAuth,
  onLogout,
  onTriggerSim,
  onResetNormal,
  onGoToSettings,
  onGoToSafety,
  lastUpdatedText = 'Diperbarui 1 detik lalu',
}) => {
  const [isSimOpen, setIsSimOpen] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [simFeedback, setSimFeedback] = useState<string | null>(null);
  const simRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Tutup popover saat klik di luar atau tekan Escape
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (simRef.current && !simRef.current.contains(e.target as Node)) {
        setIsSimOpen(false);
      }
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsMenuOpen(false);
      }
    };
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsSimOpen(false);
        setIsMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEsc);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEsc);
    };
  }, []);

  const handleSimAction = async (label: string, action?: () => Promise<void> | void) => {
    if (!action) return;
    await action();
    setSimFeedback(label);
    setTimeout(() => setSimFeedback(null), 1800);
  };

  // Inisial ramah untuk avatar bulat
  const rawName = session?.user?.full_name || session?.patient_name || 'Keluarga';
  const initials = rawName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() || '')
    .join('') || 'K';

  return (
    <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
      {/* Judul Ramah & Waktu Pembaruan */}
      <div className="min-w-0">
        <h1 className="text-xl sm:text-2xl font-semibold text-[#18181B] leading-snug truncate">
          Kondisi {session?.patient_name || 'Lansia'}
        </h1>
        <p className="text-[13px] text-[#52525B] mt-0.5">{lastUpdatedText}</p>
      </div>

      {/* Kontrol Kanan */}
      <div className="flex items-center gap-2.5 flex-wrap sm:flex-nowrap">
        {/* Pill Status Jam Tangan */}
        <button
          type="button"
          onClick={onOpenAuth}
          aria-label="Status jam tangan terhubung, klik untuk mengganti perangkat"
          className="hc-chip min-h-[44px] bg-white border border-[#E5E3DD] hover:bg-[#F3F2EE] text-[#18181B] cursor-pointer px-3.5"
        >
          <span
            className={`w-2 h-2 rounded-full shrink-0 ${
              session ? 'bg-[#15803D]' : 'bg-[#71717A]'
            }`}
          />
          <Watch className="w-4 h-4 text-[#52525B] shrink-0" aria-hidden="true" />
          <span className="text-[13px] font-medium whitespace-nowrap">
            {session ? 'Jam terhubung' : 'Belum terhubung'}
          </span>
        </button>

        {/* Tombol & Popover Mode Simulasi */}
        {(onTriggerSim || onResetNormal) && (
          <div className="relative" ref={simRef}>
            <button
              type="button"
              onClick={() => {
                setIsSimOpen((prev) => !prev);
                setIsMenuOpen(false);
              }}
              aria-expanded={isSimOpen}
              aria-haspopup="dialog"
              className={`hc-btn-secondary px-3.5 py-2 text-[13px] flex items-center gap-2 cursor-pointer ${
                isSimOpen ? 'bg-[#F3F2EE] border-[#D4D1C9]' : ''
              }`}
            >
              <SlidersHorizontal className="w-4 h-4 text-[#52525B]" aria-hidden="true" />
              <span className="whitespace-nowrap">Mode simulasi</span>
            </button>

            {isSimOpen && (
              <div
                role="dialog"
                aria-label="Mode simulasi"
                className="fixed inset-x-4 top-20 sm:inset-auto sm:absolute sm:right-0 sm:top-[calc(100%+10px)] sm:w-80 bg-white border border-[#E5E3DD] rounded-[20px] p-5 z-50 hc-fade-soft"
                style={{ boxShadow: 'var(--shadow-popover)' }}
              >
                <div className="flex items-center justify-between gap-2 mb-2">
                  <h2 className="text-base font-semibold text-[#18181B]">Mode simulasi</h2>
                  <button
                    type="button"
                    onClick={() => setIsSimOpen(false)}
                    aria-label="Tutup mode simulasi"
                    className="w-9 h-9 rounded-full flex items-center justify-center text-[#52525B] hover:bg-[#F3F2EE] cursor-pointer transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <p className="text-[13px] text-[#52525B] mb-4 leading-relaxed">
                  Uji respons darurat langsung dari dasbor ke jam tangan.
                </p>

                <div className="grid grid-cols-1 gap-2.5">
                  <button
                    type="button"
                    onClick={() => handleSimAction('Uji jatuh aktif', () => onTriggerSim?.('FALL'))}
                    className="min-h-[44px] w-full px-3.5 py-2.5 rounded-[12px] bg-[#FFFBEB] hover:bg-amber-100/70 border border-[#FDE68A] text-[#92400E] text-[14px] font-medium flex items-center gap-2.5 cursor-pointer transition-colors text-left"
                  >
                    <Activity className="w-4 h-4 shrink-0 text-[#D97706]" aria-hidden="true" />
                    <span>Uji jatuh</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleSimAction('Tombol SOS aktif', () => onTriggerSim?.('SOS'))}
                    className="min-h-[44px] w-full px-3.5 py-2.5 rounded-[12px] bg-[#FEF2F2] hover:bg-red-100/70 border border-[#FECACA] text-[#991B1B] text-[14px] font-medium flex items-center gap-2.5 cursor-pointer transition-colors text-left"
                  >
                    <ShieldAlert className="w-4 h-4 shrink-0 text-[#DC2626]" aria-hidden="true" />
                    <span>Tombol SOS</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleSimAction('Bahaya asap aktif', () => onTriggerSim?.('SMOKE'))}
                    className="min-h-[44px] w-full px-3.5 py-2.5 rounded-[12px] bg-[#FFFBEB] hover:bg-amber-100/70 border border-[#FDE68A] text-[#92400E] text-[14px] font-medium flex items-center gap-2.5 cursor-pointer transition-colors text-left"
                  >
                    <Flame className="w-4 h-4 shrink-0 text-[#D97706]" aria-hidden="true" />
                    <span>Bahaya asap</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleSimAction('Status kembali normal', onResetNormal)}
                    className="min-h-[44px] w-full px-3.5 py-2.5 rounded-[12px] bg-[#F0FDF4] hover:bg-green-100/70 border border-[#BBF7D0] text-[#166534] text-[14px] font-semibold flex items-center gap-2.5 cursor-pointer transition-colors text-left"
                  >
                    <RotateCcw className="w-4 h-4 shrink-0 text-[#15803D]" aria-hidden="true" />
                    <span>Reset</span>
                  </button>
                </div>

                {simFeedback && (
                  <div className="mt-3 px-3 py-2 rounded-[12px] bg-[#F3F2EE] text-[13px] text-[#18181B] flex items-center gap-2 hc-fade-soft">
                    <Check className="w-4 h-4 text-[#15803D]" aria-hidden="true" />
                    <span>{simFeedback}</span>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Tombol Notifikasi */}
        <button
          type="button"
          onClick={onGoToSafety}
          aria-label={alertCount > 0 ? `${alertCount} peringatan aktif, buka keamanan rumah` : 'Notifikasi keamanan rumah'}
          className="relative w-11 h-11 rounded-full bg-white border border-[#E5E3DD] hover:bg-[#F3F2EE] flex items-center justify-center text-[#18181B] transition-colors cursor-pointer shrink-0"
        >
          <Bell className="w-[18px] h-[18px]" aria-hidden="true" />
          {alertCount > 0 && (
            <span className="absolute top-2.5 right-2.5 w-2.5 h-2.5 bg-[#DC2626] rounded-full ring-2 ring-white hc-pulse-critical" />
          )}
        </button>

        {/* Avatar Bulat dengan Menu */}
        <div className="relative" ref={menuRef}>
          <button
            type="button"
            onClick={() => {
              setIsMenuOpen((prev) => !prev);
              setIsSimOpen(false);
            }}
            aria-label={`Menu akun ${rawName}`}
            aria-expanded={isMenuOpen}
            aria-haspopup="menu"
            className="w-11 h-11 rounded-full bg-[#18181B] hover:bg-[#27272A] text-white flex items-center justify-center font-medium text-sm shrink-0 cursor-pointer transition-colors"
          >
            {initials}
          </button>

          {isMenuOpen && (
            <div
              role="menu"
              className="fixed inset-x-4 top-20 sm:inset-auto sm:right-0 sm:top-[calc(100%+10px)] sm:w-64 bg-white border border-[#E5E3DD] rounded-[20px] p-3 z-50 hc-fade-soft"
              style={{ boxShadow: 'var(--shadow-popover)' }}
            >
              <div className="px-3 py-2.5 border-b border-[#E5E3DD] mb-1.5">
                <p className="text-[15px] font-semibold text-[#18181B] truncate">{rawName}</p>
                <p className="text-[13px] text-[#52525B] truncate">
                  Memantau {session?.patient_name || 'Lansia'}
                </p>
                {session?.token && (
                  <p className="text-[12px] font-mono text-[#71717A] mt-1 truncate">
                    {session.token}
                  </p>
                )}
              </div>

              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setIsMenuOpen(false);
                  onOpenAuth();
                }}
                className="w-full min-h-[44px] px-3 py-2 rounded-[12px] text-[14px] text-[#18181B] hover:bg-[#F3F2EE] flex items-center gap-2.5 cursor-pointer transition-colors text-left"
              >
                <KeyRound className="w-4 h-4 text-[#52525B]" aria-hidden="true" />
                <span>Ganti jam tangan</span>
              </button>

              {onGoToSettings && (
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setIsMenuOpen(false);
                    onGoToSettings();
                  }}
                  className="w-full min-h-[44px] px-3 py-2 rounded-[12px] text-[14px] text-[#18181B] hover:bg-[#F3F2EE] flex items-center gap-2.5 cursor-pointer transition-colors text-left"
                >
                  <Settings className="w-4 h-4 text-[#52525B]" aria-hidden="true" />
                  <span>Pengaturan</span>
                </button>
              )}

              {onLogout && (
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setIsMenuOpen(false);
                    onLogout();
                  }}
                  className="w-full min-h-[44px] px-3 py-2 rounded-[12px] text-[14px] text-[#991B1B] hover:bg-[#FEF2F2] flex items-center gap-2.5 cursor-pointer transition-colors text-left mt-1"
                >
                  <LogOut className="w-4 h-4 text-[#DC2626]" aria-hidden="true" />
                  <span>Putuskan koneksi</span>
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

export default Header;

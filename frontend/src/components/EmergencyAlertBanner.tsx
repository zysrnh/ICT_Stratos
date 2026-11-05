import React from 'react';
import { AlertCircle, PhoneCall, ShieldAlert, CheckCircle2 } from 'lucide-react';
import type { EmergencyEvent, EmergencyContact } from '../types/telemetry';

interface AlertBannerProps {
  events: EmergencyEvent[];
  primaryContact?: EmergencyContact | null;
  onResolve?: (eventId: string) => void;
}

export const EmergencyAlertBanner: React.FC<AlertBannerProps> = ({
  events,
  primaryContact,
  onResolve,
}) => {
  // Cari event aktif yang belum resolved/cancelled
  const activeEvent = events.find(
    (e) => e.status === 'PENDING' || e.status === 'ESCALATED'
  );

  if (!activeEvent) return null;

  const isEscalated = activeEvent.status === 'ESCALATED';

  return (
    <div
      className={`w-full mb-5 p-4 sm:p-5 rounded-none border-2 transition-all shadow-xs ${
        isEscalated
          ? 'bg-rose-50 border-rose-600 text-rose-950'
          : 'bg-amber-50 border-amber-500 text-amber-950'
      }`}
    >
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        {/* Left: Event Details */}
        <div className="flex items-start gap-3">
          <div
            className={`w-10 h-10 rounded-none flex items-center justify-center shrink-0 ${
              isEscalated
                ? 'bg-rose-600 text-white animate-pulse'
                : 'bg-amber-500 text-white'
            }`}
          >
            {isEscalated ? (
              <ShieldAlert className="w-5 h-5" />
            ) : (
              <AlertCircle className="w-5 h-5" />
            )}
          </div>
          <div>
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[11px] font-black uppercase tracking-wider px-2 py-0.5 rounded-none bg-white border border-current">
                {activeEvent.event_type} • {activeEvent.severity}
              </span>
              <span
                className={`text-[11px] font-bold px-2 py-0.5 rounded-none ${
                  isEscalated
                    ? 'bg-rose-600 text-white'
                    : 'bg-amber-500 text-white'
                }`}
              >
                {isEscalated ? 'ESKALASI DARURAT KELUARGA' : 'VERIFIKASI DI JAM TANGAN'}
              </span>
              {activeEvent.sim && (
                <span className="text-[10px] font-mono bg-neutral-200 text-neutral-800 px-1.5 py-0.5 rounded-none">
                  SIM
                </span>
              )}
            </div>
            <h3 className="text-base sm:text-lg font-black mt-1">
              {activeEvent.event_type === 'FALL' && 'Lansia Terdeteksi Jatuh!'}
              {activeEvent.event_type === 'SOS' && 'Tombol Darurat SOS Ditekan!'}
              {activeEvent.event_type === 'SMOKE' && 'Peringatan Asap / Potensi Kebakaran!'}
              {activeEvent.event_type === 'HR_ABNORMAL' && 'Detak Jantung Tidak Normal Bertahan!'}
            </h3>
            <p className="text-xs text-neutral-700 mt-0.5">
              {isEscalated
                ? activeEvent.escalated_to ||
                  'Lansia tidak merespons jam tangan. Notifikasi darurat diteruskan ke keluarga utama.'
                : 'Layar jam tangan sedang meminta konfirmasi lansia (Tekan OK jika aman). Menunggu respons...'}
            </p>
          </div>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-2 w-full sm:w-auto shrink-0 justify-end pt-2 sm:pt-0">
          {primaryContact && (
            <a
              href={`tel:${primaryContact.phone_number}`}
              className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-3.5 py-2 bg-[#111111] text-white rounded-none text-xs font-bold hover:bg-neutral-800 transition-colors cursor-pointer shadow-xs"
            >
              <PhoneCall className="w-3.5 h-3.5" />
              <span>Hubungi {primaryContact.name.split(' ')[0]}</span>
            </a>
          )}
          {onResolve && (
            <button
              onClick={() => onResolve(activeEvent.event_id)}
              className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1 px-3.5 py-2 bg-white text-neutral-900 border border-neutral-300 rounded-none text-xs font-bold hover:bg-neutral-100 transition-colors cursor-pointer shadow-xs"
            >
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>Selesaikan</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default EmergencyAlertBanner;

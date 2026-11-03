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
      className={`w-full mb-6 p-4.5 sm:p-5 rounded-3xl border transition-all shadow-md ${
        isEscalated
          ? 'bg-rose-50 border-rose-200 text-rose-950'
          : 'bg-amber-50 border-amber-200 text-amber-950'
      }`}
    >
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        {/* Left: Event Details */}
        <div className="flex items-start gap-3.5">
          <div
            className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 ${
              isEscalated
                ? 'bg-rose-600 text-white animate-bounce'
                : 'bg-amber-500 text-white'
            }`}
          >
            {isEscalated ? (
              <ShieldAlert className="w-6 h-6 stroke-[2.2]" />
            ) : (
              <AlertCircle className="w-6 h-6 stroke-[2.2]" />
            )}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-white/80 border border-current">
                {activeEvent.event_type} • {activeEvent.severity}
              </span>
              <span
                className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                  isEscalated
                    ? 'bg-rose-200 text-rose-900 font-bold'
                    : 'bg-amber-200 text-amber-900'
                }`}
              >
                {isEscalated ? 'ESKALASI DARURAT KELUARGA' : 'VERIFIKASI DI JAM TANGAN'}
              </span>
              {activeEvent.sim && (
                <span className="text-[10px] font-medium bg-neutral-200 text-neutral-700 px-1.5 py-0.5 rounded">
                  Simulasi
                </span>
              )}
            </div>
            <h3 className="text-base sm:text-lg font-bold mt-1">
              {activeEvent.event_type === 'FALL' && 'Lansia Terdeteksi Jatuh!'}
              {activeEvent.event_type === 'SOS' && 'Tombol Darurat SOS Ditekan!'}
              {activeEvent.event_type === 'SMOKE' && 'Peringatan Asap / Potensi Kebakaran!'}
              {activeEvent.event_type === 'HR_ABNORMAL' && 'Detak Jantung Tidak Normal Bertahan!'}
            </h3>
            <p className="text-xs sm:text-sm text-neutral-700 mt-0.5">
              {isEscalated
                ? activeEvent.escalated_to ||
                  'Lansia tidak merespons jam tangan. Notifikasi darurat diteruskan ke keluarga utama.'
                : 'Layar jam tangan sedang meminta konfirmasi lansia (Tekan OK jika aman). Menunggu respons...'}
            </p>
          </div>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-2.5 w-full sm:w-auto shrink-0 justify-end">
          {primaryContact && (
            <a
              href={`tel:${primaryContact.phone_number}`}
              className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-neutral-900 text-white rounded-2xl text-xs font-bold hover:bg-neutral-800 transition-colors cursor-pointer shadow-xs"
            >
              <PhoneCall className="w-3.5 h-3.5" />
              <span>Hubungi {primaryContact.name.split(' ')[0]}</span>
            </a>
          )}
          {onResolve && (
            <button
              onClick={() => onResolve(activeEvent.event_id)}
              className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-4 py-2.5 bg-white text-neutral-800 border border-neutral-300 rounded-2xl text-xs font-bold hover:bg-neutral-50 transition-colors cursor-pointer"
            >
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>Tandai Aman</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

import React from 'react';
import { AlertCircle, Clock, PhoneCall, ShieldAlert, CheckCircle2 } from 'lucide-react';
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
  // Tampilkan hanya saat ada kejadian darurat aktif
  const activeEvent = events.find(
    (e) => e.status === 'PENDING' || e.status === 'ESCALATED'
  );

  if (!activeEvent) return null;

  const isEscalated = activeEvent.status === 'ESCALATED';

  const getEventTitle = (eventType: string) => {
    switch (eventType) {
      case 'FALL':
        return 'Lansia terdeteksi jatuh';
      case 'SOS':
        return 'Tombol SOS ditekan';
      case 'SMOKE':
        return 'Peringatan asap di rumah';
      case 'HR_ABNORMAL':
        return 'Detak jantung tidak normal';
      default:
        return 'Kondisi perlu perhatian';
    }
  };

  return (
    <section
      role="alert"
      aria-live="assertive"
      className={`w-full mb-8 p-5 sm:p-6 rounded-[20px] border transition-all duration-200 ease-out hc-fade-soft ${
        isEscalated
          ? 'bg-[#FEF2F2] border-[#FECACA] text-[#18181B]'
          : 'bg-[#FFFBEB] border-[#FDE68A] text-[#18181B]'
      }`}
      style={{ boxShadow: 'var(--shadow-card)' }}
    >
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        {/* Kiri: Ikon + Ringkasan Kejadian */}
        <div className="flex items-start sm:items-center gap-4 min-w-0">
          <div
            className={`w-11 h-11 rounded-full flex items-center justify-center shrink-0 ${
              isEscalated
                ? 'bg-[#DC2626] text-white hc-pulse-critical'
                : 'bg-[#D97706] text-white'
            }`}
          >
            {isEscalated ? (
              <ShieldAlert className="w-5 h-5" aria-hidden="true" />
            ) : (
              <AlertCircle className="w-5 h-5" aria-hidden="true" />
            )}
          </div>

          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2.5">
              <h2 className="text-base sm:text-lg font-semibold text-[#18181B]">
                {getEventTitle(activeEvent.event_type)}
              </h2>
              <span
                className={`hc-chip ${
                  isEscalated
                    ? 'bg-white text-[#991B1B] border border-[#FECACA]'
                    : 'bg-white text-[#92400E] border border-[#FDE68A]'
                }`}
              >
                {isEscalated ? (
                  <AlertCircle className="w-3.5 h-3.5 text-[#DC2626]" aria-hidden="true" />
                ) : (
                  <Clock className="w-3.5 h-3.5 text-[#D97706]" aria-hidden="true" />
                )}
                <span>{isEscalated ? 'Kritis' : 'Menunggu respons'}</span>
              </span>
            </div>

            <p className="text-[14px] sm:text-[15px] text-[#52525B] mt-1">
              {isEscalated
                ? 'Belum ada respons di jam tangan; keluarga dimohon segera memastikan kondisi lansia.'
                : 'Layar jam tangan sedang meminta konfirmasi aman dari lansia.'}
            </p>
          </div>
        </div>

        {/* Kanan: Aksi Cepat */}
        <div className="flex flex-wrap items-center gap-3 shrink-0 w-full lg:w-auto">
          {primaryContact && (
            <a
              href={`tel:${primaryContact.phone_number}`}
              className="flex-1 sm:flex-initial hc-btn-primary inline-flex items-center justify-center gap-2 px-4 py-2.5 text-[15px] cursor-pointer"
            >
              <PhoneCall className="w-4 h-4" aria-hidden="true" />
              <span>Hubungi {primaryContact.name.split(' ')[0]}</span>
            </a>
          )}

          {onResolve && (
            <button
              type="button"
              onClick={() => onResolve(activeEvent.event_id)}
              className="flex-1 sm:flex-initial hc-btn-secondary inline-flex items-center justify-center gap-2 px-4 py-2.5 text-[15px] cursor-pointer"
            >
              <CheckCircle2 className="w-4 h-4 text-[#15803D]" aria-hidden="true" />
              <span>Selesaikan</span>
            </button>
          )}
        </div>
      </div>
    </section>
  );
};

export default EmergencyAlertBanner;

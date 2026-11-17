import React from 'react';
import { Heart, Footprints, Thermometer, CheckCircle2, AlertTriangle, Clock } from 'lucide-react';
import type { HealthMetric, EmergencyEvent } from '../types/telemetry';

interface StatCardsProps {
  latestMetric: HealthMetric | null;
  homeMetric?: HealthMetric | null;
  activeEvents?: EmergencyEvent[];
}

export const StatCards: React.FC<StatCardsProps> = ({
  latestMetric,
  homeMetric,
  activeEvents = [],
}) => {
  const hasWatchData = Boolean(
    latestMetric && latestMetric.heart_rate !== null && latestMetric.heart_rate !== undefined
  );
  const hr = hasWatchData ? latestMetric!.heart_rate : null;
  const steps = hasWatchData ? (latestMetric!.steps ?? 0) : null;
  const activity = hasWatchData ? (latestMetric!.activity ?? 'REST') : 'OFFLINE';

  const activeEmerg = activeEvents.find(
    (e) => e.status === 'PENDING' || e.status === 'ESCALATED'
  );

  // Data lingkungan rumah
  const hasHomeData = Boolean(
    (homeMetric && homeMetric.room_temp !== null && homeMetric.room_temp !== undefined) ||
      (latestMetric && latestMetric.room_temp !== null && latestMetric.room_temp !== undefined)
  );
  const roomTemp = homeMetric?.room_temp ?? latestMetric?.room_temp ?? null;
  const rawSmokeStatus = homeMetric?.smoke_status ?? latestMetric?.smoke_status ?? 'NORMAL';
  const smokeStatus = activeEmerg?.event_type === 'SMOKE' ? 'ALERT' : rawSmokeStatus;

  // Status Detak Jantung
  const hrHigh = hasWatchData && hr! > 100;
  const hrLow = hasWatchData && hr! < 50;

  // Status Aktivitas
  const isFallActivity = activeEmerg?.event_type === 'FALL' || activity === 'FALL';
  const isMoving = activity === 'ACTIVE' || activity === 'WALKING';

  // Status Udara
  const isSmokeAlert = smokeStatus === 'ALERT';

  return (
    <section
      aria-label="Ringkasan kondisi vital"
      className="grid grid-cols-1 sm:grid-cols-3 gap-5 sm:gap-6 mb-8"
    >
      {/* 1. Detak jantung */}
      <div className="hc-card p-6 flex flex-col justify-between gap-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-[15px] font-medium text-[#52525B]">Detak jantung</h2>
          <div className="w-11 h-11 rounded-full bg-[#FEF2F2] text-[#DC2626] flex items-center justify-center shrink-0">
            <Heart className="w-5 h-5" aria-hidden="true" />
          </div>
        </div>

        <div className="flex items-baseline gap-2 transition-opacity duration-200">
          {hasWatchData ? (
            <>
              <span className="text-3xl sm:text-4xl font-semibold text-[#18181B] tabular-nums">
                {hr}
              </span>
              <span className="text-[15px] font-medium text-[#52525B]">BPM</span>
            </>
          ) : (
            <span className="text-3xl sm:text-4xl font-semibold text-[#71717A]">--</span>
          )}
        </div>

        <div>
          {!hasWatchData ? (
            <span className="hc-chip bg-[#F3F2EE] text-[#52525B] border border-[#E5E3DD]">
              <Clock className="w-3.5 h-3.5 text-[#71717A]" aria-hidden="true" />
              <span>Menunggu</span>
            </span>
          ) : hrHigh ? (
            <span className="hc-chip bg-[#FEF2F2] text-[#991B1B] border border-[#FECACA]">
              <AlertTriangle className="w-3.5 h-3.5 text-[#DC2626]" aria-hidden="true" />
              <span>Detak cepat</span>
            </span>
          ) : hrLow ? (
            <span className="hc-chip bg-[#FFFBEB] text-[#92400E] border border-[#FDE68A]">
              <AlertTriangle className="w-3.5 h-3.5 text-[#D97706]" aria-hidden="true" />
              <span>Detak lambat</span>
            </span>
          ) : (
            <span className="hc-chip bg-[#F0FDF4] text-[#166534] border border-[#BBF7D0]">
              <CheckCircle2 className="w-3.5 h-3.5 text-[#15803D]" aria-hidden="true" />
              <span>Normal</span>
            </span>
          )}
        </div>
      </div>

      {/* 2. Aktivitas */}
      <div className="hc-card p-6 flex flex-col justify-between gap-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-[15px] font-medium text-[#52525B]">Aktivitas</h2>
          <div className="w-11 h-11 rounded-full bg-[#F0FDF4] text-[#15803D] flex items-center justify-center shrink-0">
            <Footprints className="w-5 h-5" aria-hidden="true" />
          </div>
        </div>

        <div className="flex items-baseline gap-2 transition-opacity duration-200">
          {hasWatchData ? (
            <>
              <span className="text-3xl sm:text-4xl font-semibold text-[#18181B] tabular-nums">
                {steps!.toLocaleString('id-ID')}
              </span>
              <span className="text-[15px] font-medium text-[#52525B]">langkah</span>
            </>
          ) : (
            <span className="text-3xl sm:text-4xl font-semibold text-[#71717A]">--</span>
          )}
        </div>

        <div>
          {!hasWatchData ? (
            <span className="hc-chip bg-[#F3F2EE] text-[#52525B] border border-[#E5E3DD]">
              <Clock className="w-3.5 h-3.5 text-[#71717A]" aria-hidden="true" />
              <span>Menunggu</span>
            </span>
          ) : isFallActivity ? (
            <span className="hc-chip bg-[#FEF2F2] text-[#991B1B] border border-[#FECACA]">
              <AlertTriangle className="w-3.5 h-3.5 text-[#DC2626]" aria-hidden="true" />
              <span>Jatuh</span>
            </span>
          ) : isMoving ? (
            <span className="hc-chip bg-[#F0FDF4] text-[#166534] border border-[#BBF7D0]">
              <CheckCircle2 className="w-3.5 h-3.5 text-[#15803D]" aria-hidden="true" />
              <span>Bergerak</span>
            </span>
          ) : (
            <span className="hc-chip bg-[#F0FDF4] text-[#166534] border border-[#BBF7D0]">
              <CheckCircle2 className="w-3.5 h-3.5 text-[#15803D]" aria-hidden="true" />
              <span>Normal</span>
            </span>
          )}
        </div>
      </div>

      {/* 3. Suhu & udara */}
      <div className="hc-card p-6 flex flex-col justify-between gap-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-[15px] font-medium text-[#52525B]">Suhu &amp; udara</h2>
          <div
            className={`w-11 h-11 rounded-full flex items-center justify-center shrink-0 ${
              isSmokeAlert
                ? 'bg-[#FEF2F2] text-[#DC2626]'
                : 'bg-[#FFFBEB] text-[#D97706]'
            }`}
          >
            <Thermometer className="w-5 h-5" aria-hidden="true" />
          </div>
        </div>

        <div className="flex items-baseline gap-2 transition-opacity duration-200">
          {hasHomeData && roomTemp !== null ? (
            <>
              <span className="text-3xl sm:text-4xl font-semibold text-[#18181B] tabular-nums">
                {Number(roomTemp).toFixed(1)}
              </span>
              <span className="text-[15px] font-medium text-[#52525B]">°C</span>
            </>
          ) : (
            <span className="text-3xl sm:text-4xl font-semibold text-[#71717A]">--</span>
          )}
        </div>

        <div>
          {!hasHomeData ? (
            <span className="hc-chip bg-[#F3F2EE] text-[#52525B] border border-[#E5E3DD]">
              <Clock className="w-3.5 h-3.5 text-[#71717A]" aria-hidden="true" />
              <span>Menunggu</span>
            </span>
          ) : isSmokeAlert ? (
            <span className="hc-chip bg-[#FEF2F2] text-[#991B1B] border border-[#FECACA]">
              <AlertTriangle className="w-3.5 h-3.5 text-[#DC2626]" aria-hidden="true" />
              <span>Bahaya asap</span>
            </span>
          ) : (
            <span className="hc-chip bg-[#F0FDF4] text-[#166534] border border-[#BBF7D0]">
              <CheckCircle2 className="w-3.5 h-3.5 text-[#15803D]" aria-hidden="true" />
              <span>Normal</span>
            </span>
          )}
        </div>
      </div>
    </section>
  );
};

export default StatCards;

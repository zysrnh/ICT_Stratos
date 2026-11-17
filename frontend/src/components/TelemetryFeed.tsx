import React from 'react';
import { AlertCircle, CheckCircle2, Clock } from 'lucide-react';
import type { HealthMetric } from '../types/telemetry';

interface TelemetryFeedProps {
  metrics: HealthMetric[];
}

export const TelemetryFeed: React.FC<TelemetryFeedProps> = ({ metrics }) => {
  return (
    <section aria-label="Riwayat pembacaan sensor terbaru" className="hc-card p-6 flex flex-col">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <div>
          <h2 className="text-lg font-semibold text-[#18181B]">Pembacaan terbaru</h2>
          <p className="text-[13px] text-[#52525B] mt-0.5">
            Tersinkron otomatis dari jam tangan dan sensor rumah
          </p>
        </div>
        <span className="hc-chip bg-[#F3F2EE] text-[#52525B] border border-[#E5E3DD]">
          {metrics.length} data
        </span>
      </div>

      {/* Daftar Pembacaan */}
      <div className="space-y-3 overflow-y-auto max-h-[360px] pr-1">
        {metrics.length === 0 ? (
          <div className="py-10 text-center text-[#71717A] text-[15px]">
            Belum ada data pembacaan. Pastikan jam tangan dalam kondisi aktif.
          </div>
        ) : (
          metrics.map((item) => {
            const isCrit = item.health_status === 'CRITICAL';
            const isWarn = item.health_status === 'WARNING';
            const timeStr = new Date(item.recorded_at).toLocaleTimeString('id-ID', {
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit',
            });
            const tempValue = item.temperature ?? item.room_temp;
            const sourceLabel = item.device_type === 'home' ? 'Sensor rumah' : 'Jam tangan';

            return (
              <div
                key={item.id}
                className={`flex flex-wrap sm:flex-nowrap items-center justify-between gap-3 p-4 rounded-[16px] border transition-colors duration-180 ${
                  isCrit
                    ? 'border-[#FECACA] bg-[#FEF2F2]'
                    : isWarn
                    ? 'border-[#FDE68A] bg-[#FFFBEB]'
                    : 'border-[#E5E3DD] bg-[#FAF9F7] hover:bg-[#F3F2EE]'
                }`}
              >
                {/* Kiri: Ikon & Nilai */}
                <div className="flex items-center gap-3.5 min-w-0">
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
                      isCrit
                        ? 'bg-red-100 text-[#DC2626]'
                        : isWarn
                        ? 'bg-amber-100 text-[#D97706]'
                        : 'bg-[#F0FDF4] text-[#15803D]'
                    }`}
                  >
                    {isCrit || isWarn ? (
                      <AlertCircle className="w-5 h-5" aria-hidden="true" />
                    ) : (
                      <CheckCircle2 className="w-5 h-5" aria-hidden="true" />
                    )}
                  </div>

                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-[15px] font-semibold text-[#18181B]">
                      {item.heart_rate !== null && item.heart_rate !== undefined && (
                        <span>
                          {item.heart_rate}{' '}
                          <span className="text-[13px] font-normal text-[#52525B]">BPM</span>
                        </span>
                      )}
                      {item.heart_rate !== null &&
                        item.heart_rate !== undefined &&
                        tempValue !== null &&
                        tempValue !== undefined && (
                          <span className="text-[#D4D1C9]" aria-hidden="true">
                            ·
                          </span>
                        )}
                      {tempValue !== null && tempValue !== undefined && (
                        <span>
                          {Number(tempValue).toFixed(1)}{' '}
                          <span className="text-[13px] font-normal text-[#52525B]">°C</span>
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5 text-[13px] text-[#52525B] mt-0.5">
                      <Clock className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                      <span>{timeStr}</span>
                      <span aria-hidden="true">·</span>
                      <span className="truncate">{sourceLabel}</span>
                    </div>
                  </div>
                </div>

                {/* Kanan: Pill Status Warna + Ikon + Teks */}
                <div className="shrink-0">
                  {isCrit ? (
                    <span className="hc-chip bg-white text-[#991B1B] border border-[#FECACA]">
                      <AlertCircle className="w-3.5 h-3.5 text-[#DC2626]" aria-hidden="true" />
                      <span>Kritis</span>
                    </span>
                  ) : isWarn ? (
                    <span className="hc-chip bg-white text-[#92400E] border border-[#FDE68A]">
                      <AlertCircle className="w-3.5 h-3.5 text-[#D97706]" aria-hidden="true" />
                      <span>Peringatan</span>
                    </span>
                  ) : (
                    <span className="hc-chip bg-[#F0FDF4] text-[#166534] border border-[#BBF7D0]">
                      <CheckCircle2 className="w-3.5 h-3.5 text-[#15803D]" aria-hidden="true" />
                      <span>Normal</span>
                    </span>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </section>
  );
};

export default TelemetryFeed;

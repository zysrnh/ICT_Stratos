import React, { useState } from 'react';
import {
  Flame,
  Thermometer,
  Activity,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Info,
  ChevronDown,
  RefreshCw,
} from 'lucide-react';
import type { EmergencyEvent, HealthMetric } from '../types/telemetry';

interface HomeSafetyProps {
  events: EmergencyEvent[];
  latestMetric: HealthMetric | null;
  homeMetric: HealthMetric | null;
  onRefresh: () => void;
}

export const HomeSafetyView: React.FC<HomeSafetyProps> = ({
  events,
  latestMetric,
  homeMetric,
  onRefresh,
}) => {
  const [showTechInfo, setShowTechInfo] = useState(false);

  const roomTemp = Number(homeMetric?.room_temp ?? latestMetric?.room_temp ?? 27.0);
  const humidity = Number(homeMetric?.humidity ?? latestMetric?.humidity ?? 62.0);
  const smokeAdc = Number(homeMetric?.smoke_adc ?? latestMetric?.smoke_adc ?? 310);
  const smokeStatus = homeMetric?.smoke_status ?? latestMetric?.smoke_status ?? 'NORMAL';
  const accelG = Number(latestMetric?.accel_g ?? 1.0);

  const activeEmerg = events.find(
    (e) => e.status === 'PENDING' || e.status === 'ESCALATED'
  );
  const isSmokeAlert = smokeStatus === 'ALERT' || activeEmerg?.event_type === 'SMOKE';
  const isFallAlert = accelG > 2.5 || activeEmerg?.event_type === 'FALL';

  const getEventLabel = (eventType: string) => {
    switch (eventType) {
      case 'FALL':
        return 'Terdeteksi jatuh';
      case 'SOS':
        return 'Tombol SOS ditekan';
      case 'SMOKE':
        return 'Terdeteksi asap';
      case 'HR_ABNORMAL':
        return 'Detak jantung tidak normal';
      default:
        return eventType;
    }
  };

  return (
    <div className="space-y-8 pb-6">
      {/* 1. Ringkasan Kondisi Rumah & Sensor (Bahasa Awam) */}
      <section aria-label="Pemantauan keamanan rumah" className="hc-card p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h2 className="text-lg sm:text-xl font-semibold text-[#18181B]">
              Keamanan rumah
            </h2>
            <p className="text-[14px] sm:text-[15px] text-[#52525B] mt-1">
              Memantau udara ruangan, kenyamanan suhu, dan deteksi gerakan jatuh secara terus-menerus.
            </p>
          </div>

          <button
            type="button"
            onClick={() => setShowTechInfo((prev) => !prev)}
            aria-expanded={showTechInfo}
            className="hc-btn-secondary px-3.5 py-2 text-[13px] inline-flex items-center gap-2 self-start sm:self-auto cursor-pointer shrink-0"
          >
            <Info className="w-4 h-4 text-[#52525B]" aria-hidden="true" />
            <span>Info teknis</span>
            <ChevronDown
              className={`w-4 h-4 text-[#52525B] transition-transform duration-180 ${
                showTechInfo ? 'rotate-180' : ''
              }`}
              aria-hidden="true"
            />
          </button>
        </div>

        {/* 3 Kartu Sensor dalam Bahasa Awam */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 sm:gap-6">
          {/* Sensor Asap & Gas */}
          <div
            className={`p-5 rounded-[20px] border transition-colors ${
              isSmokeAlert
                ? 'bg-[#FEF2F2] border-[#FECACA]'
                : 'bg-[#FAF9F7] border-[#E5E3DD]'
            }`}
          >
            <div className="flex items-center justify-between gap-3 mb-4">
              <div
                className={`w-11 h-11 rounded-full flex items-center justify-center ${
                  isSmokeAlert
                    ? 'bg-red-100 text-[#DC2626]'
                    : 'bg-[#F0FDF4] text-[#15803D]'
                }`}
              >
                <Flame className="w-5 h-5" aria-hidden="true" />
              </div>
              <span
                className={`hc-chip ${
                  isSmokeAlert
                    ? 'bg-white text-[#991B1B] border border-[#FECACA]'
                    : 'bg-white text-[#166534] border border-[#BBF7D0]'
                }`}
              >
                {isSmokeAlert ? (
                  <AlertTriangle className="w-3.5 h-3.5 text-[#DC2626]" aria-hidden="true" />
                ) : (
                  <CheckCircle2 className="w-3.5 h-3.5 text-[#15803D]" aria-hidden="true" />
                )}
                <span>{isSmokeAlert ? 'Bahaya' : 'Aman'}</span>
              </span>
            </div>
            <h3 className="text-[16px] font-semibold text-[#18181B]">
              Asap &amp; gas: {isSmokeAlert ? 'Terdeteksi asap' : 'Aman'}
            </h3>
            <p className="text-[13px] text-[#52525B] mt-1">
              {isSmokeAlert
                ? 'Segera periksa dapur dan ventilasi rumah.'
                : 'Kualitas udara di dalam rumah dalam kondisi bersih.'}
            </p>
          </div>

          {/* Suhu & Kelembapan */}
          <div className="p-5 rounded-[20px] bg-[#FAF9F7] border border-[#E5E3DD]">
            <div className="flex items-center justify-between gap-3 mb-4">
              <div className="w-11 h-11 rounded-full bg-[#FFFBEB] text-[#D97706] flex items-center justify-center">
                <Thermometer className="w-5 h-5" aria-hidden="true" />
              </div>
              <span className="hc-chip bg-white text-[#166534] border border-[#BBF7D0]">
                <CheckCircle2 className="w-3.5 h-3.5 text-[#15803D]" aria-hidden="true" />
                <span>Nyaman</span>
              </span>
            </div>
            <h3 className="text-[16px] font-semibold text-[#18181B]">
              Suhu {Math.round(roomTemp)}°C - Lembap {Math.round(humidity)}%
            </h3>
            <p className="text-[13px] text-[#52525B] mt-1">
              Suhu ruangan nyaman dan stabil untuk istirahat lansia.
            </p>
          </div>

          {/* Deteksi Gerakan & Jatuh */}
          <div
            className={`p-5 rounded-[20px] border transition-colors ${
              isFallAlert
                ? 'bg-[#FEF2F2] border-[#FECACA]'
                : 'bg-[#FAF9F7] border-[#E5E3DD]'
            }`}
          >
            <div className="flex items-center justify-between gap-3 mb-4">
              <div
                className={`w-11 h-11 rounded-full flex items-center justify-center ${
                  isFallAlert
                    ? 'bg-red-100 text-[#DC2626]'
                    : 'bg-[#F0FDF4] text-[#15803D]'
                }`}
              >
                <Activity className="w-5 h-5" aria-hidden="true" />
              </div>
              <span
                className={`hc-chip ${
                  isFallAlert
                    ? 'bg-white text-[#991B1B] border border-[#FECACA]'
                    : 'bg-white text-[#166534] border border-[#BBF7D0]'
                }`}
              >
                {isFallAlert ? (
                  <AlertTriangle className="w-3.5 h-3.5 text-[#DC2626]" aria-hidden="true" />
                ) : (
                  <CheckCircle2 className="w-3.5 h-3.5 text-[#15803D]" aria-hidden="true" />
                )}
                <span>{isFallAlert ? 'Waspada' : 'Normal'}</span>
              </span>
            </div>
            <h3 className="text-[16px] font-semibold text-[#18181B]">
              Gerakan: {isFallAlert ? 'Terdeteksi benturan' : 'Normal'}
            </h3>
            <p className="text-[13px] text-[#52525B] mt-1">
              {isFallAlert
                ? 'Terjadi perubahan posisi mendadak pada jam tangan.'
                : 'Tidak ada indikasi benturan atau jatuh.'}
            </p>
          </div>
        </div>

        {/* Detail Info Teknis (Lipat / Opsional) */}
        {showTechInfo && (
          <div className="mt-5 p-4 rounded-[16px] bg-[#F3F2EE] border border-[#E5E3DD] text-[13px] text-[#52525B] grid grid-cols-1 sm:grid-cols-3 gap-3 hc-fade-soft">
            <div>
              <span className="font-semibold text-[#18181B] block">Sensor asap (MQ-2)</span>
              <span>Nilai pembacaan: {smokeAdc} ADC (ambang batas bahaya &ge; 2500 ADC)</span>
            </div>
            <div>
              <span className="font-semibold text-[#18181B] block">Sensor ruangan (DHT22)</span>
              <span>
                Suhu {roomTemp.toFixed(1)} °C · Kelembapan {humidity.toFixed(1)}% RH
              </span>
            </div>
            <div>
              <span className="font-semibold text-[#18181B] block">Akselerometer (MPU6050)</span>
              <span>
                Resultan {accelG.toFixed(2)} G (ambang threshold jatuh &gt; 2.5 G + diam)
              </span>
            </div>
          </div>
        )}
      </section>

      {/* 2. Tabel Riwayat Kejadian */}
      <section aria-label="Riwayat kejadian" className="hc-card p-6 min-w-0 w-full">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
          <div>
            <h3 className="text-lg font-semibold text-[#18181B]">Riwayat kejadian</h3>
            <p className="text-[13px] text-[#52525B] mt-0.5">
              Catatan peringatan keselamatan dan status penanganannya
            </p>
          </div>

          <button
            type="button"
            onClick={onRefresh}
            aria-label="Muat ulang riwayat kejadian"
            className="hc-btn-secondary px-3.5 py-2 text-[13px] inline-flex items-center gap-2 cursor-pointer"
          >
            <RefreshCw className="w-4 h-4 text-[#52525B]" aria-hidden="true" />
            <span>Perbarui</span>
          </button>
        </div>

        {events.length === 0 ? (
          <div className="py-10 text-center text-[#71717A] text-[15px]">
            Belum ada catatan kejadian. Kondisi rumah terpantau aman.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[#E5E3DD] text-[13px] font-medium text-[#52525B]">
                  <th className="py-3.5 px-4 font-medium">Waktu</th>
                  <th className="py-3.5 px-4 font-medium">Kejadian</th>
                  <th className="py-3.5 px-4 font-medium">Status</th>
                  <th className="py-3.5 px-4 font-medium">Ditangani oleh</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E5E3DD] text-[15px]">
                {events.map((ev) => {
                  const timeStr = new Date(ev.created_at).toLocaleTimeString('id-ID', {
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit',
                  });

                  const isEscalated = ev.status === 'ESCALATED';
                  const isPending = ev.status === 'PENDING';
                  const isCancelled = ev.status === 'CANCELLED';

                  return (
                    <tr
                      key={ev.id || ev.event_id}
                      className="hover:bg-[#FAF9F7] transition-colors"
                    >
                      <td className="py-4 px-4 text-[#52525B] whitespace-nowrap">{timeStr}</td>
                      <td className="py-4 px-4 font-medium text-[#18181B]">
                        {getEventLabel(ev.event_type)}
                      </td>
                      <td className="py-4 px-4 whitespace-nowrap">
                        {isEscalated ? (
                          <span className="hc-chip bg-[#FEF2F2] text-[#991B1B] border border-[#FECACA]">
                            <AlertTriangle className="w-3.5 h-3.5 text-[#DC2626]" aria-hidden="true" />
                            <span>Kritis</span>
                          </span>
                        ) : isPending ? (
                          <span className="hc-chip bg-[#FFFBEB] text-[#92400E] border border-[#FDE68A]">
                            <Clock className="w-3.5 h-3.5 text-[#D97706]" aria-hidden="true" />
                            <span>Menunggu</span>
                          </span>
                        ) : isCancelled ? (
                          <span className="hc-chip bg-[#F3F2EE] text-[#52525B] border border-[#E5E3DD]">
                            <CheckCircle2 className="w-3.5 h-3.5 text-[#71717A]" aria-hidden="true" />
                            <span>Dibatalkan</span>
                          </span>
                        ) : (
                          <span className="hc-chip bg-[#F0FDF4] text-[#166534] border border-[#BBF7D0]">
                            <CheckCircle2 className="w-3.5 h-3.5 text-[#15803D]" aria-hidden="true" />
                            <span>Selesai</span>
                          </span>
                        )}
                      </td>
                      <td className="py-4 px-4 text-[#52525B]">
                        {ev.escalated_to || 'Jam tangan lansia'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
};

export default HomeSafetyView;

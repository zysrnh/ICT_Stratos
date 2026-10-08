import React from 'react';
import { Activity, AlertOctagon } from 'lucide-react';
import type { HealthMetric } from '../types/telemetry';

interface PatientProfileCardProps {
  latestMetric: HealthMetric | null;
}

export const PatientProfileCard: React.FC<PatientProfileCardProps> = ({ latestMetric }) => {
  const isCritical = latestMetric?.health_status === 'CRITICAL';
  const isWarning = latestMetric?.health_status === 'WARNING';

  return (
    <div className="bg-white rounded-3xl p-6 border border-neutral-200/80 shadow-xs flex flex-col justify-between">
      {/* Patient Header */}
      <div className="flex items-center gap-4 mb-4">
        <div className="w-14 h-14 rounded-2xl bg-neutral-100 border border-neutral-200 flex items-center justify-center text-neutral-800 shrink-0 font-extrabold text-xl shadow-xs">
          BS
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-base font-extrabold text-[#111111]">Budi Santoso</h3>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-neutral-100 text-neutral-600">
              45 y.o
            </span>
          </div>
          <p className="text-xs text-neutral-400 font-medium">Record ID: P-001 • ICU Room 03</p>
        </div>
      </div>

      {/* Medical Condition Banner */}
      <div
        className={`p-4 rounded-2xl border transition-all mb-4 ${
          isCritical
            ? 'bg-red-50 border-red-200 text-red-900'
            : isWarning
            ? 'bg-amber-50 border-amber-200 text-amber-900'
            : 'bg-emerald-50/60 border-emerald-200/80 text-emerald-900'
        }`}
      >
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs font-bold uppercase tracking-wider flex items-center gap-1.5">
            {isCritical ? (
              <AlertOctagon className="w-4 h-4 text-red-600" />
            ) : (
              <Activity className="w-4 h-4 text-emerald-600" />
            )}
            Condition: {latestMetric?.health_status || 'STABLE'}
          </span>
          <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-white shadow-xs">
            EWS Protocol
          </span>
        </div>
        <p className="text-xs font-medium leading-relaxed opacity-90">
          {isCritical
            ? 'Peringatan Anomali! Terdeteksi parameter vital di luar batas normal. Periksa segera kondisi pasien di ruang rawat.'
            : isWarning
            ? 'Perhatian: Fluktuasi suhu atau denyut jantung terdeteksi. Pertahankan pemantauan berkala.'
            : 'Pasien dalam kondisi fisiologis stabil. Parameter denyut jantung dan suhu tubuh dalam rentang normal.'}
        </p>
      </div>

      {/* Quick Details Grid */}
      <div className="grid grid-cols-2 gap-3 text-xs pt-2 border-t border-neutral-100">
        <div>
          <span className="text-neutral-400 block font-medium">Dokter Penanggung Jawab</span>
          <span className="font-bold text-neutral-800">Dr. Joshua S., Sp.JP</span>
        </div>
        <div>
          <span className="text-neutral-400 block font-medium">Protokol AI Inference</span>
          <span className="font-bold text-neutral-800">Huawei Cloud Model v2</span>
        </div>
      </div>
    </div>
  );
};

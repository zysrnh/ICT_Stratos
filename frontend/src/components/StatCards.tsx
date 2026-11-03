import React from 'react';
import { Heart, Footprints, Flame, ShieldCheck, AlertTriangle } from 'lucide-react';
import type { HealthMetric } from '../types/telemetry';

interface StatCardsProps {
  latestMetric: HealthMetric | null;
  homeMetric?: HealthMetric | null;
}

export const StatCards: React.FC<StatCardsProps> = ({ latestMetric, homeMetric }) => {
  const hr = latestMetric?.heart_rate ?? 74;
  const steps = latestMetric?.steps ?? 1420;
  const activity = latestMetric?.activity ?? 'REST';
  const status = latestMetric?.health_status ?? 'NORMAL';
  const cancelledAlerts = latestMetric?.fall_cancelled ?? 0;

  // Nilai node keselamatan rumah
  const roomTemp = homeMetric?.room_temp ?? latestMetric?.room_temp ?? 27.2;
  const smokeAdc = homeMetric?.smoke_adc ?? latestMetric?.smoke_adc ?? 480;
  const smokeStatus = homeMetric?.smoke_status ?? latestMetric?.smoke_status ?? 'NORMAL';

  const isCritical = status === 'CRITICAL' || smokeStatus === 'ALERT';
  const isWarning = status === 'WARNING';

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      {/* 1. Heart Rate (Pilar 1: Health Monitoring) */}
      <div className="bg-white rounded-3xl p-5 border border-neutral-200/80 shadow-xs flex flex-col justify-between hover:border-neutral-300 transition-all">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-semibold text-neutral-400 uppercase tracking-wider">Detak Jantung</span>
          <div className="w-8 h-8 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center">
            <Heart className="w-4 h-4 fill-rose-500 stroke-rose-600" />
          </div>
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-3xl lg:text-4xl font-extrabold text-[#111111] tracking-tight">{hr}</span>
          <span className="text-xs font-bold text-neutral-400 uppercase">BPM</span>
        </div>
        <div className="mt-3 pt-3 border-t border-neutral-100 flex items-center justify-between text-xs text-neutral-500">
          <span>Target: 60 - 100</span>
          <span className={`font-bold ${hr > 100 ? 'text-rose-600' : hr < 50 ? 'text-amber-600' : 'text-emerald-600'}`}>
            {hr > 100 ? 'Takikardia' : hr < 50 ? 'Bradikardia' : 'Irama Normal'}
          </span>
        </div>
      </div>

      {/* 2. Langkah & Aktivitas Fisik (Pedometer MPU6050) */}
      <div className="bg-white rounded-3xl p-5 border border-neutral-200/80 shadow-xs flex flex-col justify-between hover:border-neutral-300 transition-all">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-semibold text-neutral-400 uppercase tracking-wider">Aktivitas Gerak</span>
          <div className="w-8 h-8 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center">
            <Footprints className="w-4 h-4" />
          </div>
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-3xl lg:text-4xl font-extrabold text-[#111111] tracking-tight">
            {steps.toLocaleString('id-ID')}
          </span>
          <span className="text-xs font-bold text-neutral-400 uppercase">Langkah</span>
        </div>
        <div className="mt-3 pt-3 border-t border-neutral-100 flex items-center justify-between text-xs text-neutral-500">
          <span>Status Gerak</span>
          <span className={`font-bold px-2 py-0.5 rounded-full text-[10px] ${
            activity === 'ACTIVE' ? 'bg-blue-100 text-blue-700' : 'bg-neutral-100 text-neutral-600'
          }`}>
            {activity === 'ACTIVE' ? 'Sedang Bergerak' : 'Istirahat / Duduk'}
          </span>
        </div>
      </div>

      {/* 3. Node Keamanan Rumah (Pilar 2: Home Safety - MQ2 & Temp) */}
      <div className="bg-white rounded-3xl p-5 border border-neutral-200/80 shadow-xs flex flex-col justify-between hover:border-neutral-300 transition-all">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-semibold text-neutral-400 uppercase tracking-wider">Rumah: Udara & Suhu</span>
          <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
            smokeStatus === 'ALERT' ? 'bg-rose-100 text-rose-600' : 'bg-amber-50 text-amber-600'
          }`}>
            <Flame className="w-4 h-4" />
          </div>
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-3xl lg:text-4xl font-extrabold text-[#111111] tracking-tight">{roomTemp}°C</span>
          <span className="text-xs font-bold text-neutral-400">Gas: {smokeAdc}</span>
        </div>
        <div className="mt-3 pt-3 border-t border-neutral-100 flex items-center justify-between text-xs text-neutral-500">
          <span>Sensor Asap MQ-2</span>
          <span className={`font-bold ${smokeStatus === 'ALERT' ? 'text-rose-600 animate-pulse' : 'text-emerald-600'}`}>
            {smokeStatus === 'ALERT' ? 'BAHAYA ASAP!' : 'Udara Bersih'}
          </span>
        </div>
      </div>

      {/* 4. Status Sistem & False Alarm Tracker (Juknis 6.3) */}
      <div className="bg-white rounded-3xl p-5 border border-neutral-200/80 shadow-xs flex flex-col justify-between hover:border-neutral-300 transition-all">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-semibold text-neutral-400 uppercase tracking-wider">Status EWS</span>
          <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
            isCritical ? 'bg-rose-100 text-rose-600 animate-pulse' : isWarning ? 'bg-amber-100 text-amber-600' : 'bg-emerald-50 text-emerald-600'
          }`}>
            {isCritical || isWarning ? <AlertTriangle className="w-4 h-4" /> : <ShieldCheck className="w-4 h-4" />}
          </div>
        </div>
        <div className="flex items-baseline gap-2">
          <span className={`text-2xl lg:text-3xl font-extrabold tracking-tight ${
            isCritical ? 'text-rose-600' : isWarning ? 'text-amber-600' : 'text-emerald-600'
          }`}>
            {status}
          </span>
        </div>
        <div className="mt-3 pt-3 border-t border-neutral-100 flex items-center justify-between text-xs text-neutral-500">
          <span>False Alarm Dibendung</span>
          <span className="font-semibold text-neutral-700">{cancelledAlerts}x dibatalkan lansia</span>
        </div>
      </div>
    </div>
  );
};

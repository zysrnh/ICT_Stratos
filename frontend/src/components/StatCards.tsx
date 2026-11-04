import React from 'react';
import { Heart, Footprints, Flame, ShieldCheck, AlertTriangle, Radio } from 'lucide-react';
import type { HealthMetric } from '../types/telemetry';

interface StatCardsProps {
  latestMetric: HealthMetric | null;
  homeMetric?: HealthMetric | null;
}

export const StatCards: React.FC<StatCardsProps> = ({ latestMetric, homeMetric }) => {
  const hasWatchData = Boolean(latestMetric && latestMetric.heart_rate !== null && latestMetric.heart_rate !== undefined);
  const hr = hasWatchData ? latestMetric!.heart_rate : null;
  const steps = hasWatchData ? (latestMetric!.steps ?? 0) : null;
  const activity = hasWatchData ? (latestMetric!.activity ?? 'REST') : 'OFFLINE';
  const status = hasWatchData ? (latestMetric!.health_status ?? 'NORMAL') : 'STANDBY';
  const cancelledAlerts = hasWatchData ? (latestMetric!.fall_cancelled ?? 0) : 0;

  // Node keselamatan rumah
  const hasHomeData = Boolean(
    (homeMetric && homeMetric.room_temp !== null && homeMetric.room_temp !== undefined) ||
    (latestMetric && latestMetric.room_temp !== null && latestMetric.room_temp !== undefined)
  );
  const roomTemp = homeMetric?.room_temp ?? latestMetric?.room_temp ?? null;
  const smokeAdc = homeMetric?.smoke_adc ?? latestMetric?.smoke_adc ?? null;
  const smokeStatus = homeMetric?.smoke_status ?? latestMetric?.smoke_status ?? 'NORMAL';

  const isCritical = status === 'CRITICAL' || smokeStatus === 'ALERT';
  const isWarning = status === 'WARNING';

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      {/* 1. Heart Rate (Health Monitoring) */}
      <div className="bg-white rounded-none p-5 border-2 border-neutral-900 shadow-xs flex flex-col justify-between hover:border-neutral-800 transition-all">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-bold text-neutral-600 uppercase tracking-wider">Detak Jantung</span>
          <div className="w-8 h-8 rounded-none bg-rose-50 text-rose-600 flex items-center justify-center border border-rose-200">
            <Heart className={`w-4 h-4 ${hasWatchData ? 'fill-rose-500 stroke-rose-600' : 'text-neutral-400'}`} />
          </div>
        </div>
        <div className="flex items-baseline gap-2">
          {hasWatchData ? (
            <>
              <span className="text-3xl lg:text-4xl font-extrabold text-[#111111] tracking-tight">{hr}</span>
              <span className="text-xs font-bold text-neutral-500 uppercase">BPM</span>
            </>
          ) : (
            <div className="flex items-center gap-2">
              <span className="text-3xl font-extrabold text-neutral-300">--</span>
              <span className="text-[11px] font-bold text-neutral-400 uppercase tracking-wide">Menunggu Jam</span>
            </div>
          )}
        </div>
        <div className="mt-3 pt-3 border-t border-neutral-200 flex items-center justify-between text-xs text-neutral-600">
          <span>Target: 60 - 100</span>
          {hasWatchData ? (
            <span className={`font-bold ${hr! > 100 ? 'text-rose-600' : hr! < 50 ? 'text-amber-600' : 'text-emerald-700'}`}>
              {hr! > 100 ? 'Takikardia' : hr! < 50 ? 'Bradikardia' : 'Irama Normal'}
            </span>
          ) : (
            <span className="text-neutral-400 font-medium italic">Belum terkoneksi</span>
          )}
        </div>
      </div>

      {/* 2. Langkah & Aktivitas Fisik (Pedometer) */}
      <div className="bg-white rounded-none p-5 border-2 border-neutral-900 shadow-xs flex flex-col justify-between hover:border-neutral-800 transition-all">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-bold text-neutral-600 uppercase tracking-wider">Aktivitas Gerak</span>
          <div className="w-8 h-8 rounded-none bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-200">
            <Footprints className="w-4 h-4" />
          </div>
        </div>
        <div className="flex items-baseline gap-2">
          {hasWatchData ? (
            <>
              <span className="text-3xl lg:text-4xl font-extrabold text-[#111111] tracking-tight">
                {steps!.toLocaleString('id-ID')}
              </span>
              <span className="text-xs font-bold text-neutral-500 uppercase">Langkah</span>
            </>
          ) : (
            <div className="flex items-center gap-2">
              <span className="text-3xl font-extrabold text-neutral-300">--</span>
              <span className="text-[11px] font-bold text-neutral-400 uppercase tracking-wide">0 Langkah</span>
            </div>
          )}
        </div>
        <div className="mt-3 pt-3 border-t border-neutral-200 flex items-center justify-between text-xs text-neutral-600">
          <span>Status Gerak</span>
          {hasWatchData ? (
            <span className={`font-bold px-2 py-0.5 rounded-none text-[10px] ${
              activity === 'ACTIVE' ? 'bg-blue-100 text-blue-800 border border-blue-300' : 'bg-neutral-100 text-neutral-700 border border-neutral-300'
            }`}>
              {activity === 'ACTIVE' ? 'Sedang Bergerak' : 'Istirahat / Duduk'}
            </span>
          ) : (
            <span className="text-neutral-400 font-medium italic">Offline</span>
          )}
        </div>
      </div>

      {/* 3. Node Keamanan Rumah (Home Safety - MQ2 & DHT22) */}
      <div className="bg-white rounded-none p-5 border-2 border-neutral-900 shadow-xs flex flex-col justify-between hover:border-neutral-800 transition-all">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-bold text-neutral-600 uppercase tracking-wider">Rumah: Udara & Suhu</span>
          <div className={`w-8 h-8 rounded-none flex items-center justify-center border ${
            smokeStatus === 'ALERT' ? 'bg-rose-100 text-rose-700 border-rose-300' : 'bg-amber-50 text-amber-700 border-amber-200'
          }`}>
            <Flame className="w-4 h-4" />
          </div>
        </div>
        <div className="flex items-baseline gap-2">
          {hasHomeData && roomTemp !== null ? (
            <>
              <span className="text-3xl lg:text-4xl font-extrabold text-[#111111] tracking-tight">{roomTemp}°C</span>
              {smokeAdc !== null && <span className="text-xs font-bold text-neutral-500">Gas: {smokeAdc}</span>}
            </>
          ) : (
            <div className="flex items-center gap-2">
              <span className="text-3xl font-extrabold text-neutral-300">--</span>
              <span className="text-[11px] font-bold text-neutral-400 uppercase tracking-wide">Sensor Siaga</span>
            </div>
          )}
        </div>
        <div className="mt-3 pt-3 border-t border-neutral-200 flex items-center justify-between text-xs text-neutral-600">
          <span>Sensor Asap MQ-2</span>
          {hasHomeData ? (
            <span className={`font-bold ${smokeStatus === 'ALERT' ? 'text-rose-600 animate-pulse' : 'text-emerald-700'}`}>
              {smokeStatus === 'ALERT' ? 'BAHAYA ASAP!' : 'Udara Bersih'}
            </span>
          ) : (
            <span className="text-neutral-400 font-medium italic">Siaga</span>
          )}
        </div>
      </div>

      {/* 4. Status Sistem & EWS */}
      <div className="bg-white rounded-none p-5 border-2 border-neutral-900 shadow-xs flex flex-col justify-between hover:border-neutral-800 transition-all">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-bold text-neutral-600 uppercase tracking-wider">Status EWS</span>
          <div className={`w-8 h-8 rounded-none flex items-center justify-center border ${
            !hasWatchData ? 'bg-neutral-100 text-neutral-500 border-neutral-300' :
            isCritical ? 'bg-rose-100 text-rose-700 border-rose-300 animate-pulse' :
            isWarning ? 'bg-amber-100 text-amber-700 border-amber-300' :
            'bg-emerald-50 text-emerald-700 border-emerald-300'
          }`}>
            {!hasWatchData ? <Radio className="w-4 h-4" /> :
             isCritical || isWarning ? <AlertTriangle className="w-4 h-4" /> :
             <ShieldCheck className="w-4 h-4" />}
          </div>
        </div>
        <div className="flex items-baseline gap-2">
          <span className={`text-2xl lg:text-3xl font-extrabold tracking-tight ${
            !hasWatchData ? 'text-neutral-500' :
            isCritical ? 'text-rose-600' :
            isWarning ? 'text-amber-600' :
            'text-emerald-700'
          }`}>
            {status}
          </span>
        </div>
        <div className="mt-3 pt-3 border-t border-neutral-200 flex items-center justify-between text-xs text-neutral-600">
          <span>False Alarm Dibendung</span>
          <span className="font-semibold text-neutral-700">
            {hasWatchData ? `${cancelledAlerts}x dibatalkan` : 'Menunggu sinyal'}
          </span>
        </div>
      </div>
    </div>
  );
};

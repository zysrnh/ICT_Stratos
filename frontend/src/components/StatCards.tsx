import React from 'react';
import { Heart, Footprints, Flame, ShieldCheck, AlertTriangle, Radio } from 'lucide-react';
import type { HealthMetric, EmergencyEvent } from '../types/telemetry';

interface StatCardsProps {
  latestMetric: HealthMetric | null;
  homeMetric?: HealthMetric | null;
  activeEvents?: EmergencyEvent[];
}

export const StatCards: React.FC<StatCardsProps> = ({ latestMetric, homeMetric, activeEvents = [] }) => {
  const hasWatchData = Boolean(latestMetric && latestMetric.heart_rate !== null && latestMetric.heart_rate !== undefined);
  const hr = hasWatchData ? latestMetric!.heart_rate : null;
  const steps = hasWatchData ? (latestMetric!.steps ?? 0) : null;
  const activity = hasWatchData ? (latestMetric!.activity ?? 'REST') : 'OFFLINE';
  const metricStatus = hasWatchData ? (latestMetric!.health_status ?? 'NORMAL') : 'STANDBY';
  const cancelledAlerts = hasWatchData ? (latestMetric!.fall_cancelled ?? 0) : 0;

  // Cek apakah ada kejadian darurat aktif (PENDING atau ESCALATED)
  const activeEmerg = activeEvents.find((e) => e.status === 'PENDING' || e.status === 'ESCALATED');

  // Node keselamatan rumah
  const hasHomeData = Boolean(
    (homeMetric && homeMetric.room_temp !== null && homeMetric.room_temp !== undefined) ||
    (latestMetric && latestMetric.room_temp !== null && latestMetric.room_temp !== undefined)
  );
  const roomTemp = homeMetric?.room_temp ?? latestMetric?.room_temp ?? null;
  const smokeAdc = homeMetric?.smoke_adc ?? latestMetric?.smoke_adc ?? null;
  const rawSmokeStatus = homeMetric?.smoke_status ?? latestMetric?.smoke_status ?? 'NORMAL';
  const smokeStatus = activeEmerg?.event_type === 'SMOKE' ? 'ALERT' : rawSmokeStatus;

  const isCritical = Boolean(activeEmerg) || metricStatus === 'CRITICAL' || smokeStatus === 'ALERT';
  const isWarning = !isCritical && metricStatus === 'WARNING';

  // Label status EWS yang dinamis & jelas saat simulasi aktif
  const displayStatus = activeEmerg
    ? activeEmerg.event_type === 'FALL'
      ? 'JATUH (DARURAT)'
      : activeEmerg.event_type === 'SOS'
      ? 'SOS (PANIK)'
      : activeEmerg.event_type === 'SMOKE'
      ? 'ASAP (BAHAYA)'
      : 'DARURAT'
    : metricStatus;

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4 mb-6">
      {/* 1. Heart Rate (Health Monitoring) */}
      <div className="bg-white rounded-none p-3.5 sm:p-5 border border-neutral-200 hover:border-neutral-400 shadow-xs flex flex-col justify-between transition-colors">
        <div className="flex items-center justify-between mb-2 sm:mb-3">
          <span className="text-[11px] sm:text-xs font-bold text-neutral-500 uppercase tracking-wider">
            Detak Jantung
          </span>
          <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-none bg-neutral-100 text-rose-600 flex items-center justify-center border border-neutral-200">
            <Heart className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${hasWatchData ? 'fill-rose-500 stroke-rose-600' : 'text-neutral-400'}`} />
          </div>
        </div>
        <div className="flex items-baseline gap-1.5 sm:gap-2">
          {hasWatchData ? (
            <>
              <span className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-[#111111] tracking-tight">{hr}</span>
              <span className="text-[10px] sm:text-xs font-bold text-neutral-500 uppercase">BPM</span>
            </>
          ) : (
            <div className="flex items-center gap-1.5">
              <span className="text-2xl sm:text-3xl font-extrabold text-neutral-300">--</span>
              <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wide">Menunggu</span>
            </div>
          )}
        </div>
        <div className="mt-2.5 sm:mt-3 pt-2.5 border-t border-neutral-100 flex flex-col sm:flex-row sm:items-center justify-between gap-0.5 text-[11px] sm:text-xs text-neutral-500">
          <span className="truncate">Target: 60-100</span>
          {hasWatchData ? (
            <span className={`font-bold shrink-0 ${hr! > 100 ? 'text-rose-600' : hr! < 50 ? 'text-amber-600' : 'text-emerald-700'}`}>
              {hr! > 100 ? 'Takikardia' : hr! < 50 ? 'Bradikardia' : 'Normal'}
            </span>
          ) : (
            <span className="text-neutral-400 italic">Standby</span>
          )}
        </div>
      </div>

      {/* 2. Langkah & Aktivitas Fisik (Pedometer) */}
      <div className="bg-white rounded-none p-3.5 sm:p-5 border border-neutral-200 hover:border-neutral-400 shadow-xs flex flex-col justify-between transition-colors">
        <div className="flex items-center justify-between mb-2 sm:mb-3">
          <span className="text-[11px] sm:text-xs font-bold text-neutral-500 uppercase tracking-wider">
            Aktivitas Gerak
          </span>
          <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-none bg-neutral-100 text-blue-600 flex items-center justify-center border border-neutral-200">
            <Footprints className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          </div>
        </div>
        <div className="flex items-baseline gap-1.5 sm:gap-2">
          {hasWatchData ? (
            <>
              <span className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-[#111111] tracking-tight">
                {steps!.toLocaleString('id-ID')}
              </span>
              <span className="text-[10px] sm:text-xs font-bold text-neutral-500 uppercase">Langkah</span>
            </>
          ) : (
            <div className="flex items-center gap-1.5">
              <span className="text-2xl sm:text-3xl font-extrabold text-neutral-300">--</span>
              <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wide">0 Langkah</span>
            </div>
          )}
        </div>
        <div className="mt-2.5 sm:mt-3 pt-2.5 border-t border-neutral-100 flex flex-col sm:flex-row sm:items-center justify-between gap-0.5 text-[11px] sm:text-xs text-neutral-500">
          <span className="truncate">Status Gerak</span>
          {hasWatchData ? (
            <span className="font-bold text-neutral-800 shrink-0">
              {activity === 'ACTIVE' || activity === 'WALKING' ? 'Bergerak' : 'Istirahat'}
            </span>
          ) : (
            <span className="text-neutral-400 italic">Standby</span>
          )}
        </div>
      </div>

      {/* 3. Node Keamanan Rumah (Home Safety - MQ2 & DHT22) */}
      <div className="bg-white rounded-none p-3.5 sm:p-5 border border-neutral-200 hover:border-neutral-400 shadow-xs flex flex-col justify-between transition-colors">
        <div className="flex items-center justify-between mb-2 sm:mb-3">
          <span className="text-[11px] sm:text-xs font-bold text-neutral-500 uppercase tracking-wider">
            Suhu & Udara
          </span>
          <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-none bg-neutral-100 text-amber-600 flex items-center justify-center border border-neutral-200">
            <Flame className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          </div>
        </div>
        <div className="flex items-baseline gap-1.5 sm:gap-2 flex-wrap">
          {hasHomeData && roomTemp !== null ? (
            <>
              <span className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-[#111111] tracking-tight">{roomTemp}°C</span>
              {smokeAdc !== null && (
                <span className="text-[10px] sm:text-xs font-bold text-neutral-500">
                  Gas: {smokeAdc}
                </span>
              )}
            </>
          ) : (
            <div className="flex items-center gap-1.5">
              <span className="text-2xl sm:text-3xl font-extrabold text-neutral-300">--</span>
              <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wide">Siaga</span>
            </div>
          )}
        </div>
        <div className="mt-2.5 sm:mt-3 pt-2.5 border-t border-neutral-100 flex flex-col sm:flex-row sm:items-center justify-between gap-0.5 text-[11px] sm:text-xs text-neutral-500">
          <span className="truncate">Sensor MQ-2</span>
          {hasHomeData ? (
            <span className={`font-bold shrink-0 ${smokeStatus === 'ALERT' ? 'text-rose-600 animate-pulse' : 'text-emerald-700'}`}>
              {smokeStatus === 'ALERT' ? 'BAHAYA!' : 'Udara Bersih'}
            </span>
          ) : (
            <span className="text-neutral-400 italic">Siaga</span>
          )}
        </div>
      </div>

      {/* 4. Status Sistem & EWS */}
      <div className="bg-white rounded-none p-3.5 sm:p-5 border border-neutral-200 hover:border-neutral-400 shadow-xs flex flex-col justify-between transition-colors">
        <div className="flex items-center justify-between mb-2 sm:mb-3">
          <span className="text-[11px] sm:text-xs font-bold text-neutral-500 uppercase tracking-wider">
            Status EWS
          </span>
          <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-none bg-neutral-100 text-emerald-600 flex items-center justify-center border border-neutral-200">
            {!hasWatchData ? <Radio className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-neutral-400" /> :
             isCritical || isWarning ? <AlertTriangle className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-rose-600" /> :
             <ShieldCheck className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-600" />}
          </div>
        </div>
        <div className="flex items-baseline gap-1.5 sm:gap-2">
          <span className={`text-lg sm:text-2xl lg:text-2xl font-extrabold tracking-tight ${
            !hasWatchData ? 'text-neutral-400' :
            isCritical ? 'text-rose-600 animate-pulse' :
            isWarning ? 'text-amber-600' :
            'text-emerald-700'
          }`}>
            {displayStatus}
          </span>
        </div>
        <div className="mt-2.5 sm:mt-3 pt-2.5 border-t border-neutral-100 flex flex-col sm:flex-row sm:items-center justify-between gap-0.5 text-[11px] sm:text-xs text-neutral-500">
          <span className="truncate">Sistem EWS</span>
          <span className={`font-semibold shrink-0 ${activeEmerg ? 'text-rose-600 font-black' : 'text-neutral-700'}`}>
            {activeEmerg ? 'Eskalasi Darurat' : hasWatchData ? (cancelledAlerts > 0 ? `${cancelledAlerts}x Batal` : 'Siaga Aktif') : 'Menunggu'}
          </span>
        </div>
      </div>
    </div>
  );
};

export default StatCards;

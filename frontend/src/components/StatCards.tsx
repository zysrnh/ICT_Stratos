import React from 'react';
import { Heart, Thermometer, Activity, Clock } from 'lucide-react';
import type { HealthMetric } from '../types/telemetry';

interface StatCardsProps {
  latestMetric: HealthMetric | null;
}

export const StatCards: React.FC<StatCardsProps> = ({ latestMetric }) => {
  const hr = latestMetric ? latestMetric.heart_rate : 72;
  const temp = latestMetric ? Number(latestMetric.temperature).toFixed(1) : '36.6';
  const status = latestMetric ? latestMetric.health_status : 'NORMAL';

  // Format Waktu Terakhir
  const lastTime = latestMetric?.recorded_at
    ? new Date(latestMetric.recorded_at).toLocaleTimeString('id-ID', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      })
    : '--:--:--';

  const isCritical = status === 'CRITICAL';
  const isWarning = status === 'WARNING';

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      {/* 1. Heart Rate Card */}
      <div className="bg-white rounded-3xl p-5 border border-neutral-200/80 shadow-xs flex flex-col justify-between hover:border-neutral-300 transition-all">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-semibold text-neutral-400 uppercase tracking-wider">Heart Rate</span>
          <div className="w-8 h-8 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center">
            <Heart className="w-4 h-4 fill-rose-500 stroke-rose-600" />
          </div>
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-3xl lg:text-4xl font-extrabold text-[#111111] tracking-tight">{hr}</span>
          <span className="text-xs font-bold text-neutral-400 uppercase">BPM</span>
        </div>
        <div className="mt-3 pt-3 border-t border-neutral-100 flex items-center justify-between text-xs text-neutral-500">
          <span>Range: 45 - 150</span>
          <span className={`font-bold ${hr > 100 ? 'text-rose-600' : hr < 60 ? 'text-amber-600' : 'text-emerald-600'}`}>
            {hr > 100 ? 'Tachycardia' : hr < 60 ? 'Bradycardia' : 'Normal Rhythm'}
          </span>
        </div>
      </div>

      {/* 2. Skin Temperature Card */}
      <div className="bg-white rounded-3xl p-5 border border-neutral-200/80 shadow-xs flex flex-col justify-between hover:border-neutral-300 transition-all">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-semibold text-neutral-400 uppercase tracking-wider">Body Temp</span>
          <div className="w-8 h-8 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center">
            <Thermometer className="w-4 h-4" />
          </div>
        </div>
        <div className="flex items-baseline gap-1.5">
          <span className="text-3xl lg:text-4xl font-extrabold text-[#111111] tracking-tight">{temp}</span>
          <span className="text-sm font-bold text-neutral-400">°C</span>
        </div>
        <div className="mt-3 pt-3 border-t border-neutral-100 flex items-center justify-between text-xs text-neutral-500">
          <span>Normal: 36.5 - 37.5</span>
          <span className={`font-bold ${Number(temp) >= 37.6 ? 'text-rose-600' : 'text-emerald-600'}`}>
            {Number(temp) >= 37.6 ? 'Hyperthermia' : 'Optimal'}
          </span>
        </div>
      </div>

      {/* 3. EWS Condition Status */}
      <div className="bg-white rounded-3xl p-5 border border-neutral-200/80 shadow-xs flex flex-col justify-between hover:border-neutral-300 transition-all">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-semibold text-neutral-400 uppercase tracking-wider">EWS Status</span>
          <div
            className={`w-8 h-8 rounded-full flex items-center justify-center ${
              isCritical
                ? 'bg-red-100 text-red-600'
                : isWarning
                ? 'bg-amber-100 text-amber-600'
                : 'bg-emerald-100 text-emerald-600'
            }`}
          >
            <Activity className="w-4 h-4" />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={`px-3 py-1 rounded-full text-xs font-extrabold tracking-wide uppercase ${
              isCritical
                ? 'bg-red-600 text-white'
                : isWarning
                ? 'bg-amber-500 text-white'
                : 'bg-[#111111] text-white'
            }`}
          >
            {status}
          </span>
        </div>
        <div className="mt-3 pt-3 border-t border-neutral-100 flex items-center justify-between text-xs text-neutral-500">
          <span>Haptic Alarm</span>
          <span className="font-semibold text-neutral-700">{isCritical ? 'Beep Alert Active' : 'Silent / Standby'}</span>
        </div>
      </div>

      {/* 4. Device & Telemetry Clock */}
      <div className="bg-white rounded-3xl p-5 border border-neutral-200/80 shadow-xs flex flex-col justify-between hover:border-neutral-300 transition-all">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-semibold text-neutral-400 uppercase tracking-wider">Device Info</span>
          <div className="w-8 h-8 rounded-full bg-neutral-100 text-neutral-700 flex items-center justify-center">
            <Clock className="w-4 h-4" />
          </div>
        </div>
        <div>
          <div className="text-sm font-bold text-neutral-900 truncate">
            {latestMetric?.device_id || 'HUAWEI-WATCH-001'}
          </div>
          <div className="text-xs text-neutral-400 font-medium mt-0.5">ESP32 DevKit Wokwi Node</div>
        </div>
        <div className="mt-3 pt-3 border-t border-neutral-100 flex items-center justify-between text-xs text-neutral-500">
          <span>Last Recorded</span>
          <span className="font-bold text-neutral-900">{lastTime}</span>
        </div>
      </div>
    </div>
  );
};

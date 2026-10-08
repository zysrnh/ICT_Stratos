import React from 'react';
import { AlertCircle, CheckCircle, Clock } from 'lucide-react';
import type { HealthMetric } from '../types/telemetry';

interface TelemetryFeedProps {
  metrics: HealthMetric[];
}

export const TelemetryFeed: React.FC<TelemetryFeedProps> = ({ metrics }) => {
  return (
    <div className="bg-white rounded-3xl p-6 border border-neutral-200/80 shadow-xs flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-extrabold text-[#111111] tracking-tight">Recent Telemetry Stream</h2>
          <p className="text-xs text-neutral-400 font-medium">Auto-synced from Huawei Watch ESP32</p>
        </div>
        <span className="text-xs font-bold text-neutral-600 bg-neutral-100 px-3 py-1 rounded-full">
          Total: {metrics.length} records
        </span>
      </div>

      {/* List Feed */}
      <div className="space-y-2.5 overflow-y-auto max-h-[380px] pr-1">
        {metrics.length === 0 ? (
          <div className="py-12 text-center text-neutral-400 text-sm">
            Belum ada data telemetri. Pastikan ESP32 Wokwi sedang berjalan!
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

            return (
              <div
                key={item.id}
                className={`flex items-center justify-between p-3.5 rounded-2xl border transition-all ${
                  isCrit
                    ? 'border-red-200 bg-red-50/40 hover:bg-red-50/70'
                    : isWarn
                    ? 'border-amber-200 bg-amber-50/40 hover:bg-amber-50/70'
                    : 'border-neutral-100 bg-[#FAFAFA] hover:bg-neutral-100/70'
                }`}
              >
                {/* Left: Icon & Metric Values */}
                <div className="flex items-center gap-3">
                  <div
                    className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                      isCrit
                        ? 'bg-red-100 text-red-600'
                        : isWarn
                        ? 'bg-amber-100 text-amber-600'
                        : 'bg-neutral-200 text-neutral-700'
                    }`}
                  >
                    {isCrit || isWarn ? (
                      <AlertCircle className="w-5 h-5" />
                    ) : (
                      <CheckCircle className="w-5 h-5 text-emerald-600" />
                    )}
                  </div>

                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-neutral-900">
                        {item.heart_rate} <span className="text-xs font-medium text-neutral-400">BPM</span>
                      </span>
                      <span className="text-neutral-300">•</span>
                      <span className="text-sm font-bold text-neutral-900">
                        {Number(item.temperature).toFixed(1)} <span className="text-xs font-medium text-neutral-400">°C</span>
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-neutral-400 font-medium mt-0.5">
                      <Clock className="w-3 h-3" />
                      <span>{timeStr}</span>
                      <span>•</span>
                      <span>{item.device_id}</span>
                    </div>
                  </div>
                </div>

                {/* Right: Status Pill Badge & Action */}
                <div className="flex items-center gap-2">
                  <span
                    className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wide ${
                      isCrit
                        ? 'bg-red-600 text-white'
                        : isWarn
                        ? 'bg-amber-500 text-white'
                        : 'bg-neutral-900 text-white'
                    }`}
                  >
                    {item.health_status}
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

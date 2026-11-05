import React, { useState } from 'react';
import {
  Flame,
  Thermometer,
  Droplets,
  Activity,
  Play,
  RotateCcw,
  Sparkles,
} from 'lucide-react';
import type { EmergencyEvent, HealthMetric } from '../types/telemetry';
import { triggerSimulatedEvent } from '../services/api';

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
  const [isTriggering, setIsTriggering] = useState<string | null>(null);

  const roomTemp = homeMetric?.room_temp ?? 27.2;
  const humidity = homeMetric?.humidity ?? 60.0;
  const smokeAdc = homeMetric?.smoke_adc ?? 480;
  const smokeStatus = homeMetric?.smoke_status ?? 'NORMAL';
  const accelG = latestMetric?.accel_g ?? 1.0;

  const handleSimulate = async (
    type: 'FALL' | 'SOS' | 'SMOKE' | 'HR_ABNORMAL',
    status: 'PENDING' | 'ESCALATED' | 'RESOLVED' = 'PENDING',
    value = 3.2
  ) => {
    setIsTriggering(type);
    try {
      await triggerSimulatedEvent(type, status, value);
      onRefresh();
    } finally {
      setTimeout(() => setIsTriggering(null), 600);
    }
  };

  return (
    <div className="space-y-5 pb-6">
      {/* 1. Header Ringkasan Pilar 2 */}
      <div className="bg-white rounded-none p-4 sm:p-6 border border-neutral-200 shadow-xs">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-none bg-neutral-100 text-[#111111] text-[11px] font-bold uppercase tracking-wider mb-2">
              <Sparkles className="w-3.5 h-3.5 text-neutral-800" />
              <span>Pilar 2: Home Safety &amp; Environmental Node</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-extrabold text-[#111111] tracking-tight">
              Pemantauan Keamanan Rumah &amp; Deteksi Jatuh
            </h2>
            <p className="text-xs sm:text-sm text-neutral-500 mt-1 max-w-2xl">
              Node keamanan mandiri (ECA-HOME-001) memantau sensor asap gas MQ-2 dan suhu/kelembaban ruangan,
              terintegrasi dengan sensor inersia MPU6050 pada jam tangan untuk deteksi jatuh.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-none bg-emerald-500"></span>
            <span className="text-xs font-bold text-neutral-600">Dual Node Online</span>
          </div>
        </div>

        {/* 3 Metric Cards Rumah */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 mt-5">
          {/* Sensor Asap MQ-2 */}
          <div className="p-4 rounded-none bg-white border border-neutral-200 shadow-xs">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-neutral-500">Sensor Gas/Asap (MQ-2)</span>
              <Flame className={`w-4 h-4 ${smokeStatus === 'ALERT' ? 'text-rose-600' : 'text-neutral-400'}`} />
            </div>
            <div className="text-2xl font-black text-[#111111]">{smokeAdc} ADC</div>
            <div className="mt-2 text-xs font-semibold">
              Status:{' '}
              <span className={smokeStatus === 'ALERT' ? 'text-rose-600 font-bold' : 'text-emerald-600'}>
                {smokeStatus === 'ALERT' ? 'KONSENTRASI TINGGI' : 'Aman / Normal'}
              </span>
            </div>
          </div>

          {/* Suhu Ruangan & Kelembaban */}
          <div className="p-4 rounded-none bg-white border border-neutral-200 shadow-xs">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-neutral-500">Iklim Ruangan (DHT22)</span>
              <Thermometer className="w-4 h-4 text-neutral-400" />
            </div>
            <div className="text-2xl font-black text-[#111111]">{roomTemp}°C</div>
            <div className="mt-2 text-xs text-neutral-600 flex items-center gap-1 font-medium">
              <Droplets className="w-3.5 h-3.5 text-blue-500" />
              <span>Kelembaban {humidity}% RH</span>
            </div>
          </div>

          {/* Akselerometer Jatuh MPU6050 */}
          <div className="p-4 rounded-none bg-white border border-neutral-200 shadow-xs">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-neutral-500">Akselerasi Gerak (MPU6050)</span>
              <Activity className="w-4 h-4 text-neutral-400" />
            </div>
            <div className="text-2xl font-black text-[#111111]">{accelG} G</div>
            <div className="mt-2 text-xs text-neutral-600 font-medium">
              Threshold Jatuh: &gt; 2.5G + Diam
            </div>
          </div>
        </div>
      </div>

      {/* 2. Interactive Demonstration Panel */}
      <div className="bg-[#111111] text-white rounded-none p-4 sm:p-6 shadow-xs border border-neutral-800">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 mb-3">
          <div>
            <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest">
              Live Evaluation Tool
            </span>
            <h3 className="text-base sm:text-lg font-bold">Simulator &amp; Uji Respons Darurat</h3>
          </div>
          <span className="text-[11px] bg-neutral-900 text-neutral-300 px-2.5 py-0.5 rounded-none border border-neutral-700">
            Emergency Simulator Tool
          </span>
        </div>
        <p className="text-xs text-neutral-400 mb-4 max-w-xl">
          Gunakan tombol di bawah ini untuk mensimulasikan kejadian darurat secara terkontrol.
          Sistem akan mendemonstrasikan alur verifikasi jam tangan hingga eskalasi ke kontak keluarga.
        </p>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          <button
            onClick={() => handleSimulate('FALL', 'PENDING', 3.4)}
            disabled={isTriggering !== null}
            className="flex flex-col items-center justify-center p-3 rounded-none bg-neutral-900 border border-neutral-700 hover:border-neutral-400 hover:bg-neutral-800 transition-colors cursor-pointer text-center"
          >
            <Play className="w-4 h-4 text-amber-400 mb-1" />
            <span className="text-xs font-bold">Picu Jatuh</span>
            <span className="text-[10px] text-neutral-400">Verifikasi 15 detik</span>
          </button>

          <button
            onClick={() => handleSimulate('SOS', 'ESCALATED', 0)}
            disabled={isTriggering !== null}
            className="flex flex-col items-center justify-center p-3 rounded-none bg-neutral-900 border border-neutral-700 hover:border-neutral-400 hover:bg-neutral-800 transition-colors cursor-pointer text-center"
          >
            <Play className="w-4 h-4 text-rose-500 mb-1" />
            <span className="text-xs font-bold">Tombol SOS</span>
            <span className="text-[10px] text-neutral-400">Langsung Eskalasi</span>
          </button>

          <button
            onClick={() => handleSimulate('SMOKE', 'ESCALATED', 3200)}
            disabled={isTriggering !== null}
            className="flex flex-col items-center justify-center p-3 rounded-none bg-neutral-900 border border-neutral-700 hover:border-neutral-400 hover:bg-neutral-800 transition-colors cursor-pointer text-center"
          >
            <Play className="w-4 h-4 text-orange-400 mb-1" />
            <span className="text-xs font-bold">Bahaya Asap MQ2</span>
            <span className="text-[10px] text-neutral-400">Alarm Rumah 3000Hz</span>
          </button>

          <button
            onClick={() => handleSimulate('FALL', 'RESOLVED', 0)}
            disabled={isTriggering !== null}
            className="flex flex-col items-center justify-center p-3 rounded-none bg-neutral-900 border border-neutral-700 hover:border-neutral-400 hover:bg-neutral-800 transition-colors cursor-pointer text-center"
          >
            <RotateCcw className="w-4 h-4 text-emerald-400 mb-1" />
            <span className="text-xs font-bold">Reset Status</span>
            <span className="text-[10px] text-neutral-400">Kembalikan Normal</span>
          </button>
        </div>
      </div>

      {/* 3. Log Riwayat Kejadian Darurat */}
      <div className="bg-white rounded-none p-4 sm:p-6 border border-neutral-200 shadow-xs">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-bold text-[#111111]">Riwayat Kejadian &amp; Siklus Eskalasi</h3>
          <span className="text-xs font-semibold text-neutral-400">Total: {events.length} Kejadian</span>
        </div>

        {events.length === 0 ? (
          <div className="py-10 text-center text-neutral-400 text-xs">
            Belum ada catatan kejadian darurat. Sistem dalam keadaan kondusif.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-neutral-200 text-neutral-500 uppercase tracking-wider font-semibold">
                  <th className="py-2.5 px-3">Waktu</th>
                  <th className="py-2.5 px-3">Tipe Event</th>
                  <th className="py-2.5 px-3">Perangkat</th>
                  <th className="py-2.5 px-3">Keparahan</th>
                  <th className="py-2.5 px-3">Status Penanganan</th>
                  <th className="py-2.5 px-3">Eskalasi Penerima</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {events.map((ev) => (
                  <tr key={ev.id || ev.event_id} className="hover:bg-neutral-50 transition-colors">
                    <td className="py-2.5 px-3 text-neutral-500 font-medium">
                      {new Date(ev.created_at).toLocaleTimeString('id-ID', {
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit',
                      })}
                    </td>
                    <td className="py-2.5 px-3 font-bold text-neutral-900">
                      {ev.event_type}
                      {ev.sim ? (
                        <span className="ml-1.5 text-[9px] font-semibold bg-neutral-100 text-neutral-600 px-1 py-0.2 rounded-none">
                          SIM
                        </span>
                      ) : null}
                    </td>
                    <td className="py-2.5 px-3 text-neutral-600 font-mono text-[11px]">{ev.device_id}</td>
                    <td className="py-2.5 px-3">
                      <span
                        className={`font-bold px-2 py-0.5 rounded-none text-[10px] ${
                          ev.severity === 'CRITICAL'
                            ? 'bg-rose-100 text-rose-700'
                            : 'bg-amber-100 text-amber-700'
                        }`}
                      >
                        {ev.severity}
                      </span>
                    </td>
                    <td className="py-2.5 px-3">
                      <span
                        className={`font-bold px-2 py-0.5 rounded-none text-[10px] ${
                          ev.status === 'ESCALATED'
                            ? 'bg-rose-100 text-rose-800'
                            : ev.status === 'PENDING'
                            ? 'bg-amber-100 text-amber-800'
                            : ev.status === 'CANCELLED'
                            ? 'bg-neutral-200 text-neutral-800'
                            : 'bg-emerald-100 text-emerald-800'
                        }`}
                      >
                        {ev.status}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-neutral-600 font-medium">
                      {ev.escalated_to || 'Level 1: Jam Tangan'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default HomeSafetyView;

import React, { useState, useEffect } from 'react';
import { Sidebar, BottomNav } from './components/Sidebar';
import { Header } from './components/Header';
import { StatCards } from './components/StatCards';
import { SmoothBiometricChart } from './components/SmoothBiometricChart';
import { TelemetryFeed } from './components/TelemetryFeed';
import { fetchLatestTelemetry, fetchActiveAlerts, fetchPatients, checkServerHealth } from './services/api';
import type { HealthMetric, HealthAlert, PatientInfo } from './types/telemetry';

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [metrics, setMetrics] = useState<HealthMetric[]>([]);
  const [alerts, setAlerts] = useState<HealthAlert[]>([]);
  const [patients, setPatients] = useState<PatientInfo[]>([]);
  const [selectedPatientId, setSelectedPatientId] = useState<number>(1);
  const [isOnline, setIsOnline] = useState<boolean>(true);

  // Ambil data master pasien sekali saat pertama kali mount
  useEffect(() => {
    fetchPatients().then((data) => {
      if (data.length > 0) {
        setPatients(data);
      }
    });
  }, []);

  // Auto-polling telemetry & alerts tiap 2 detik untuk pasien yang dipilih
  useEffect(() => {
    let isMounted = true;

    const loadData = async () => {
      try {
        const [latestMetrics, activeAlerts, healthy] = await Promise.all([
          fetchLatestTelemetry(selectedPatientId),
          fetchActiveAlerts(),
          checkServerHealth(),
        ]);

        if (isMounted) {
          setMetrics(latestMetrics);
          setAlerts(activeAlerts);
          setIsOnline(healthy);
        }
      } catch (err) {
        if (isMounted) {
          setIsOnline(false);
        }
      }
    };

    // Load data pertama kali
    loadData();

    // Polling interval tiap 2 detik
    const timer = setInterval(loadData, 2000);

    return () => {
      isMounted = false;
      clearInterval(timer);
    };
  }, [selectedPatientId]);

  const latestMetric = metrics.length > 0 ? metrics[0] : null;

  return (
    <div className="min-h-screen bg-[#F6F7F9] flex flex-col md:flex-row overflow-x-hidden">
      {/* 1. Sleek Black Pill Sidebar (Tampil di Desktop >= md) */}
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        alertCount={alerts.length}
      />

      {/* 2. Main Dashboard Content (Clean & Full-Width) */}
      <main className="flex-1 p-3.5 sm:p-5 lg:p-6 max-w-[1440px] mx-auto w-full pb-24 md:pb-6 overflow-y-auto">
        {/* Header Bar yang Bersih dengan Pemilih Pasien Asli dari DB */}
        <Header
          isOnline={isOnline}
          alertCount={alerts.length}
          patients={patients}
          selectedPatientId={selectedPatientId}
          onSelectPatient={(id) => setSelectedPatientId(id)}
        />

        {/* Top 4 Stat Metric Cards */}
        <StatCards latestMetric={latestMetric} />

        {/* Biometric Chart Full-Width (Sangat Bersih & Lega) */}
        <div className="w-full mb-6">
          <SmoothBiometricChart metrics={metrics} />
        </div>

        {/* Bottom Section: Live Telemetry Stream Feed */}
        <div className="w-full">
          <TelemetryFeed metrics={metrics} />
        </div>
      </main>

      {/* 3. Floating Bottom Navigation Bar (Layar HP < md) */}
      <BottomNav
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        alertCount={alerts.length}
      />
    </div>
  );
};

export default App;

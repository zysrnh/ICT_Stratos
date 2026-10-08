import React, { useState, useEffect } from 'react';
import { Sidebar, BottomNav } from './components/Sidebar';
import { Header } from './components/Header';
import { StatCards } from './components/StatCards';
import { SmoothBiometricChart } from './components/SmoothBiometricChart';
import { TelemetryFeed } from './components/TelemetryFeed';
import { fetchLatestTelemetry, fetchActiveAlerts } from './services/api';
import type { HealthMetric, HealthAlert } from './types/telemetry';

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [metrics, setMetrics] = useState<HealthMetric[]>([]);
  const [alerts, setAlerts] = useState<HealthAlert[]>([]);

  // Auto-polling telemetry & alerts tiap 2 detik
  useEffect(() => {
    let isMounted = true;

    const loadData = async () => {
      try {
        const [latestMetrics, activeAlerts] = await Promise.all([
          fetchLatestTelemetry(1),
          fetchActiveAlerts(),
        ]);

        if (isMounted) {
          setMetrics(latestMetrics);
          setAlerts(activeAlerts);
        }
      } catch (err) {
        console.error('[Telemetry Polling Error]:', err);
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
  }, []);

  const latestMetric = metrics.length > 0 ? metrics[0] : null;

  return (
    <div className="min-h-screen bg-[#F6F7F9] flex flex-col md:flex-row overflow-x-hidden">
      {/* 1. Sleek Black Pill Sidebar (Tampil di Desktop >= md) */}
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        alertCount={alerts.length}
      />

      {/* 2. Main Dashboard Content (Diberi pb-32 agar seluruh konten bawah tuntas tanpa tertutup toolbar) */}
      <main className="flex-1 p-3.5 sm:p-5 lg:p-6 max-w-[1440px] mx-auto w-full pb-32 md:pb-8 overflow-y-auto">
        {/* Header Bar Super Clean & Minimalist */}
        <Header alertCount={alerts.length} />

        {/* Top 4 Stat Metric Cards */}
        <StatCards latestMetric={latestMetric} />

        {/* Biometric Chart Full-Width (Lega & Fokus Visual) */}
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

import React, { useState, useEffect } from 'react';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { StatCards } from './components/StatCards';
import { SmoothBiometricChart } from './components/SmoothBiometricChart';
import { TelemetryFeed } from './components/TelemetryFeed';
import { PatientProfileCard } from './components/PatientProfileCard';
import { fetchLatestTelemetry, fetchActiveAlerts, checkServerHealth } from './services/api';
import type { HealthMetric, HealthAlert } from './types/telemetry';

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [metrics, setMetrics] = useState<HealthMetric[]>([]);
  const [alerts, setAlerts] = useState<HealthAlert[]>([]);
  const [isOnline, setIsOnline] = useState<boolean>(true);

  // Auto-polling telemetry & alerts tiap 2 detik
  useEffect(() => {
    let isMounted = true;

    const loadData = async () => {
      try {
        const [latestMetrics, activeAlerts, healthy] = await Promise.all([
          fetchLatestTelemetry(1),
          fetchActiveAlerts(),
          checkServerHealth(),
        ]);

        if (isMounted) {
          if (latestMetrics.length > 0) {
            setMetrics(latestMetrics);
          }
          setAlerts(activeAlerts);
          setIsOnline(healthy);
        }
      } catch (err) {
        if (isMounted) {
          setIsOnline(false);
        }
      }
    };

    // Load pertama kali
    loadData();

    // Interval polling tiap 2 detik
    const timer = setInterval(loadData, 2000);

    return () => {
      isMounted = false;
      clearInterval(timer);
    };
  }, []);

  const latestMetric = metrics.length > 0 ? metrics[0] : null;

  return (
    <div className="min-h-screen bg-[#F6F7F9] flex overflow-x-hidden">
      {/* 1. Sleek Black Pill Sidebar (Style ref.png) */}
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        alertCount={alerts.length}
      />

      {/* 2. Main Dashboard Content */}
      <main className="flex-1 p-4 lg:p-6 max-w-[1440px] mx-auto overflow-y-auto">
        {/* Header Bar */}
        <Header
          isOnline={isOnline}
          alertCount={alerts.length}
          patientName="Budi Santoso"
          roomNumber="ICU Room 03"
        />

        {/* Top 4 Stat Metric Cards */}
        <StatCards latestMetric={latestMetric} />

        {/* Main Grid: Biometric Chart & Patient Profile */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mb-6">
          {/* Smooth Curved Line Chart (Pure SVG Bezier - 8 cols) */}
          <div className="lg:col-span-8">
            <SmoothBiometricChart metrics={metrics} />
          </div>

          {/* Patient Medical Status Card (4 cols) */}
          <div className="lg:col-span-4">
            <PatientProfileCard latestMetric={latestMetric} />
          </div>
        </div>

        {/* Bottom Section: Live Telemetry Stream Feed */}
        <div className="grid grid-cols-1 gap-6">
          <TelemetryFeed metrics={metrics} />
        </div>
      </main>
    </div>
  );
};

export default App;

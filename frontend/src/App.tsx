import React, { useState, useEffect } from 'react';
import { Sidebar, BottomNav } from './components/Sidebar';
import { Header } from './components/Header';
import { StatCards } from './components/StatCards';
import { SmoothBiometricChart } from './components/SmoothBiometricChart';
import { TelemetryFeed } from './components/TelemetryFeed';
import { EmergencyAlertBanner } from './components/EmergencyAlertBanner';
import { HomeSafetyView } from './components/HomeSafetyView';
import { AiCompanionView } from './components/AiCompanionView';
import { FamilyPrivacyView } from './components/FamilyPrivacyView';
import {
  fetchLatestTelemetry,
  fetchEmergencyEvents,
  fetchActiveAlerts,
  fetchEmergencyContacts,
  triggerSimulatedEvent,
} from './services/api';
import type {
  HealthMetric,
  EmergencyEvent,
  HealthAlert,
  EmergencyContact,
} from './types/telemetry';

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [metrics, setMetrics] = useState<HealthMetric[]>([]);
  const [events, setEvents] = useState<EmergencyEvent[]>([]);
  const [alerts, setAlerts] = useState<HealthAlert[]>([]);
  const [contacts, setContacts] = useState<EmergencyContact[]>([]);

  const loadAllData = async () => {
    try {
      const [latestMetrics, emergencyEvents, activeAlerts, emergencyContacts] =
        await Promise.all([
          fetchLatestTelemetry(1),
          fetchEmergencyEvents(1),
          fetchActiveAlerts(),
          fetchEmergencyContacts(1),
        ]);

      setMetrics(latestMetrics);
      setEvents(emergencyEvents);
      setAlerts(activeAlerts);
      setContacts(emergencyContacts);
    } catch (err) {
      console.error('[App Polling Error]:', err);
    }
  };

  useEffect(() => {
    loadAllData();
    const timer = setInterval(loadAllData, 2500);
    return () => clearInterval(timer);
  }, []);

  const handleResolveEvent = async (eventId: string) => {
    // Cari event yang cocok lalu tandai resolved
    const ev = events.find((e) => e.event_id === eventId);
    if (ev) {
      await triggerSimulatedEvent(ev.event_type as any, 'RESOLVED', 0);
      loadAllData();
    }
  };

  // Ekstraksi data metrik terbaru untuk Watch dan Home Node
  const latestWatchMetric =
    metrics.find((m) => m.device_type === 'watch') ||
    (metrics.length > 0 ? metrics[0] : null);

  const latestHomeMetric =
    metrics.find((m) => m.device_type === 'home' || m.room_temp !== null) || null;

  const primaryContact =
    contacts.find((c) => c.is_primary) || (contacts.length > 0 ? contacts[0] : null);

  const activeAlertCount =
    events.filter((e) => e.status === 'PENDING' || e.status === 'ESCALATED').length ||
    alerts.length;

  return (
    <div className="min-h-screen bg-[#F6F7F9] flex flex-col md:flex-row overflow-x-hidden font-sans">
      {/* 1. Sleek Black Pill Sidebar (Tampil di Desktop >= md) */}
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        alertCount={activeAlertCount}
      />

      {/* 2. Main Dashboard Content (Diberi pb-32 agar seluruh konten bawah tuntas tanpa tertutup mobile nav) */}
      <main className="flex-1 p-3.5 sm:p-5 lg:p-6 max-w-[1440px] mx-auto w-full pb-32 md:pb-8 overflow-y-auto">
        {/* Banner Alert Kejadian Darurat Aktif (Juknis Bagian 6) */}
        <EmergencyAlertBanner
          events={events}
          primaryContact={primaryContact}
          onResolve={handleResolveEvent}
        />

        {/* Header Bar Clean & Minimalist */}
        <Header alertCount={activeAlertCount} />

        {/* Tab 1: Health Monitoring (Pilar 1 - Default) */}
        {activeTab === 'dashboard' && (
          <>
            {/* Top 4 Stat Metric Cards (Watch + Home Node Combined) */}
            <StatCards
              latestMetric={latestWatchMetric}
              homeMetric={latestHomeMetric}
            />

            {/* Biometric Chart Full-Width (Lega & Fokus Visual) */}
            <div className="w-full mb-6">
              <SmoothBiometricChart metrics={metrics} />
            </div>

            {/* Bottom Section: Live Telemetry Stream Feed */}
            <div className="w-full">
              <TelemetryFeed metrics={metrics} />
            </div>
          </>
        )}

        {/* Tab 2: Home Safety & Environmental Node (Pilar 2) */}
        {activeTab === 'home' && (
          <HomeSafetyView
            events={events}
            latestMetric={latestWatchMetric}
            homeMetric={latestHomeMetric}
            onRefresh={loadAllData}
          />
        )}

        {/* Tab 3: AI Companionship & Reminders (Pilar 3) */}
        {activeTab === 'companion' && <AiCompanionView />}

        {/* Tab 4: Family Connection & UU PDP Consent (Pilar 4) */}
        {activeTab === 'family' && <FamilyPrivacyView />}

        {/* Tab 5: Settings & Arsitektur Sistem */}
        {activeTab === 'settings' && (
          <div className="bg-white rounded-3xl p-6 border border-neutral-200/80 shadow-xs space-y-6">
            <div>
              <h3 className="text-lg font-bold text-[#111111]">
                Informasi & Arsitektur Sistem (Juknis Bagian 4)
              </h3>
              <p className="text-xs text-neutral-500 mt-1">
                AI-Powered Elderly Care Ecosystem — Solusi Pemantauan dan Pendampingan Lansia Berbasis AI & IoT.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div className="p-4 rounded-2xl bg-neutral-50 border border-neutral-200/60 space-y-2">
                <span className="font-bold text-neutral-900 block">Identitas Perangkat Terdaftar:</span>
                <div>• Smartwatch Lansia: <code className="bg-neutral-200 px-1.5 py-0.5 rounded">HUAWEI-WATCH-001</code> (Core 1 FreeRTOS)</div>
                <div>• Home Safety Node: <code className="bg-neutral-200 px-1.5 py-0.5 rounded">ECA-HOME-001</code> (Sensor Asap MQ-2 + DHT22)</div>
                <div>• Jaringan / Telemetri: Core 0 FreeRTOS Multithread (Bebas Freeze)</div>
              </div>

              <div className="p-4 rounded-2xl bg-neutral-50 border border-neutral-200/60 space-y-2">
                <span className="font-bold text-neutral-900 block">Infrastruktur Cloud & Database:</span>
                <div>• Database: Huawei Cloud RDS (MySQL 8.0) — Terhubung Normal</div>
                <div>• Protokol Komunikasi: REST API over JSON & Bearer Token Authentication</div>
                <div>• Kepatuhan Hukum: UU No. 27 Tahun 2022 tentang Pelindungan Data Pribadi</div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* 3. Floating Bottom Navigation Bar (Layar HP < md) */}
      <BottomNav
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        alertCount={activeAlertCount}
      />
    </div>
  );
};

export default App;

import React, { useState, useEffect, useCallback } from 'react';
import { Sidebar, BottomNav } from './components/Sidebar';
import { Header } from './components/Header';
import { StatCards } from './components/StatCards';
import { SmoothBiometricChart } from './components/SmoothBiometricChart';
import { TelemetryFeed } from './components/TelemetryFeed';
import { EmergencyAlertBanner } from './components/EmergencyAlertBanner';
import { HomeSafetyView } from './components/HomeSafetyView';
import { AiCompanionView } from './components/AiCompanionView';
import { FamilyPrivacyView } from './components/FamilyPrivacyView';
import { LoginModal } from './components/LoginModal';
import {
  fetchLatestTelemetry,
  fetchEmergencyEvents,
  fetchActiveAlerts,
  fetchEmergencyContacts,
  triggerSimulatedEvent,
  getSavedSession,
  clearSession,
} from './services/api';
import type {
  HealthMetric,
  EmergencyEvent,
  HealthAlert,
  EmergencyContact,
  AuthSession,
} from './types/telemetry';

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [metrics, setMetrics] = useState<HealthMetric[]>([]);
  const [events, setEvents] = useState<EmergencyEvent[]>([]);
  const [alerts, setAlerts] = useState<HealthAlert[]>([]);
  const [contacts, setContacts] = useState<EmergencyContact[]>([]);

  // Sesi Autentikasi / Pairing Perangkat (Tersimpan Permanen di Chrome LocalStorage)
  const [session, setSession] = useState<AuthSession | null>(() => getSavedSession());
  const [isAuthModalOpen, setIsAuthModalOpen] = useState<boolean>(false);

  const activePatientId = session?.patient_id ?? 1;

  const loadAllData = useCallback(async () => {
    if (!session) return;
    try {
      const [latestMetrics, emergencyEvents, activeAlerts, emergencyContacts] =
        await Promise.all([
          fetchLatestTelemetry(activePatientId),
          fetchEmergencyEvents(activePatientId),
          fetchActiveAlerts(),
          fetchEmergencyContacts(activePatientId),
        ]);

      setMetrics(latestMetrics);
      setEvents(emergencyEvents);
      setAlerts(activeAlerts);
      setContacts(emergencyContacts);
    } catch (err) {
      console.error('[App Polling Error]:', err);
    }
  }, [session, activePatientId]);

  useEffect(() => {
    if (!session) return;
    loadAllData();
    const timer = setInterval(loadAllData, 2500);
    return () => clearInterval(timer);
  }, [session, loadAllData]);

  const handleAuthSuccess = (newSession: AuthSession) => {
    setSession(newSession);
    setIsAuthModalOpen(false);
    setMetrics([]);
    setEvents([]);
  };

  const handleLogout = () => {
    clearSession();
    setSession(null);
    setMetrics([]);
    setEvents([]);
    setAlerts([]);
    setContacts([]);
    setIsAuthModalOpen(false);
  };

  const handleResolveEvent = async (eventId: string) => {
    const ev = events.find((e) => e.event_id === eventId);
    if (ev) {
      await triggerSimulatedEvent(ev.event_type as any, 'RESOLVED', 0);
      loadAllData();
    }
  };

  // JIKA BELUM ADA PERANGKAT TERHUBUNG / BELUM LOGIN:
  // Tampilkan Layar Penuh Gerbang Pairing Jam Tangan (Full Screen Gate)
  if (!session) {
    return (
      <LoginModal
        isOpen={true}
        isFullScreen={true}
        onClose={() => {}}
        onSuccess={handleAuthSuccess}
        currentSession={null}
      />
    );
  }

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
        onOpenAuth={() => setIsAuthModalOpen(true)}
        onLogout={handleLogout}
      />

      {/* 2. Main Dashboard Content */}
      <main className="flex-1 p-3.5 sm:p-5 lg:p-6 max-w-[1440px] mx-auto w-full pb-32 md:pb-8 overflow-y-auto">
        {/* Banner Alert Kejadian Darurat Aktif */}
        <EmergencyAlertBanner
          events={events}
          primaryContact={primaryContact}
          onResolve={handleResolveEvent}
        />

        {/* Header Bar Clean & Minimalist */}
        <Header
          alertCount={activeAlertCount}
          session={session}
          onOpenAuth={() => setIsAuthModalOpen(true)}
          onLogout={handleLogout}
        />

        {/* Tab 1: Health Monitoring (Default) */}
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

        {/* Tab 2: Home Safety & Environmental Node */}
        {activeTab === 'home' && (
          <HomeSafetyView
            events={events}
            latestMetric={latestWatchMetric}
            homeMetric={latestHomeMetric}
            onRefresh={loadAllData}
          />
        )}

        {/* Tab 3: AI Companionship & Reminders */}
        {activeTab === 'companion' && <AiCompanionView />}

        {/* Tab 4: Family Connection & UU PDP Consent */}
        {activeTab === 'family' && <FamilyPrivacyView />}

        {/* Tab 5: Settings & Arsitektur Sistem */}
        {activeTab === 'settings' && (
          <div className="bg-white rounded-none p-6 border-2 border-neutral-900 shadow-xs space-y-6">
            <div>
              <h3 className="text-lg font-bold text-[#111111]">
                Informasi & Arsitektur Sistem
              </h3>
              <p className="text-xs text-neutral-500 mt-1">
                AI-Powered Elderly Care Ecosystem — Solusi Pemantauan dan Pendampingan Lansia Berbasis AI & IoT.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div className="p-4 bg-neutral-50 border border-neutral-300 space-y-2">
                <span className="font-bold text-neutral-900 block">Sesi Perangkat yang Sedang Aktif:</span>
                <div>• Token ID Jam: <code className="bg-neutral-200 px-1.5 py-0.5 font-bold font-mono">{session?.token}</code></div>
                <div>• Nama Lansia: <strong>{session?.patient_name}</strong> (ID: {session?.patient_id})</div>
                <div>• Model Jam: <code className="bg-neutral-200 px-1.5 py-0.5">Huawei Smart Health Band Pro</code></div>
                <div className="flex gap-2 pt-2">
                  <button
                    onClick={() => setIsAuthModalOpen(true)}
                    className="px-3 py-1.5 bg-neutral-900 text-white font-bold text-xs uppercase cursor-pointer hover:bg-neutral-800"
                  >
                    Ganti Jam / Token
                  </button>
                  <button
                    onClick={handleLogout}
                    className="px-3 py-1.5 bg-red-600 text-white font-bold text-xs uppercase cursor-pointer hover:bg-red-700"
                  >
                    Putuskan Koneksi
                  </button>
                </div>
              </div>

              <div className="p-4 bg-neutral-50 border border-neutral-300 space-y-2">
                <span className="font-bold text-neutral-900 block">Infrastruktur Multi-Tenant & Keamanan:</span>
                <div>• Database: Huawei Cloud RDS / MySQL 8.0 — Terhubung Normal</div>
                <div>• Isolasi Data: Data difilter ketat per <code>device_token</code> &amp; <code>patient_id</code></div>
                <div>• Protokol: Enkripsi REST API over TLS / Bearer Token</div>
                <div>• Kepatuhan: UU No. 27/2022 Pelindungan Data Pribadi</div>
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
        onOpenAuth={() => setIsAuthModalOpen(true)}
      />

      {/* 4. Modal Pairing & Ganti Token (Saat Berada di Dalam Dashboard) */}
      <LoginModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        onSuccess={handleAuthSuccess}
        currentSession={session}
        isFullScreen={false}
      />
    </div>
  );
};

export default App;

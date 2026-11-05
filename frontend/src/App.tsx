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
  sendSimulatedTelemetry,
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

  // Sesi Autentikasi / Pairing Perangkat (Tersimpan di Chrome LocalStorage)
  const [session, setSession] = useState<AuthSession | null>(() => getSavedSession());
  const [isAuthModalOpen, setIsAuthModalOpen] = useState<boolean>(false);
  const [simSteps, setSimSteps] = useState<number>(120);

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

  // 1. Polling data rutin setiap 2.5 detik
  useEffect(() => {
    if (!session) return;
    loadAllData();
    const timer = setInterval(loadAllData, 2500);
    return () => clearInterval(timer);
  }, [session, loadAllData]);

  // 2. Auto-Stream Otomatis di Background (Tanpa Perlu Klik Tombol Manual)
  // Jika Wokwi/hardware tidak mengirim sinyal selama >4.5 detik, sistem otomatis mengalirkan data
  useEffect(() => {
    if (!session) return;

    const autoTimer = setInterval(async () => {
      // Periksa apakah ada paket telemetry fisik (non-sim) yang baru dalam 4.5 detik terakhir
      const lastMetric = metrics[0];
      const lastTime = lastMetric ? new Date(lastMetric.recorded_at).getTime() : 0;
      const isHardwareFresh = (Date.now() - lastTime) < 4500 && lastMetric?.sim === false;

      // Jika hardware sedang diam/offline, kirim paket latar belakang agar grafik tetap hidup
      if (!isHardwareFresh) {
        const nextSteps = simSteps + Math.floor(1 + Math.random() * 3);
        setSimSteps(nextSteps);
        try {
          await sendSimulatedTelemetry({
            heart_rate: Math.floor(72 + Math.random() * 14),
            steps: nextSteps,
            activity: nextSteps % 10 === 0 ? 'WALKING' : 'REST',
            room_temp: +(26.8 + Math.random() * 0.8).toFixed(1),
            humidity: +(62 + Math.random() * 3).toFixed(1),
            smoke_adc: 310 + Math.floor(Math.random() * 35),
          });
          loadAllData();
        } catch (e) {
          console.error('[AutoStream Background Tick Error]:', e);
        }
      }
    }, 3000);

    return () => clearInterval(autoTimer);
  }, [session, metrics, simSteps, loadAllData]);

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

  const handleTriggerSim = async (type: 'FALL' | 'SOS' | 'SMOKE') => {
    await triggerSimulatedEvent(type, 'ESCALATED', type === 'SMOKE' ? 2800 : 3.5);
    loadAllData();
  };

  const handleResetNormal = async () => {
    // 1. Selesaikan semua kejadian darurat yang masih aktif di database
    for (const ev of events) {
      if (ev.status === 'PENDING' || ev.status === 'ESCALATED') {
        await triggerSimulatedEvent(ev.event_type as any, 'RESOLVED', 0);
      }
    }
    // 2. Injeksi telemetri normal (HR 72, Asap aman 310 ADC, Suhu 27.0)
    await sendSimulatedTelemetry({
      heart_rate: 72,
      steps: simSteps,
      activity: 'REST',
      room_temp: 27.0,
      humidity: 60,
      smoke_adc: 310,
    });
    loadAllData();
  };

  // Layar Penuh Gerbang Pairing jika belum login
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
      {/* 1. Flat Sidebar (Tablet & Desktop >= md) */}
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        alertCount={activeAlertCount}
        onOpenAuth={() => setIsAuthModalOpen(true)}
        onLogout={handleLogout}
      />

      {/* 2. Main Dashboard Content (Padding bawah aman untuk BottomNav di HP) */}
      <main className="flex-1 p-3 sm:p-5 lg:p-6 max-w-[1440px] mx-auto w-full pb-24 md:pb-8 overflow-y-auto">
        {/* Banner Alert Kejadian Darurat Aktif (Flat & Tegas) */}
        <EmergencyAlertBanner
          events={events}
          primaryContact={primaryContact}
          onResolve={handleResolveEvent}
        />

        {/* Header Bar Clean & Flat */}
        <Header
          alertCount={activeAlertCount}
          session={session}
          onOpenAuth={() => setIsAuthModalOpen(true)}
          onLogout={handleLogout}
        />

        {/* Sub-bar Status Auto-Stream & Pengujian Darurat (Flat Minimalist) */}
        <div className="mb-5 px-3 py-2 bg-white border border-neutral-200 flex flex-wrap items-center justify-between gap-2 shadow-xs">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-none bg-emerald-500 animate-pulse" />
            <span className="text-[11px] font-bold text-neutral-800 uppercase tracking-wider">
              Live Biometrics Auto-Stream
            </span>
            <span className="text-[10px] text-neutral-400 hidden sm:inline">
              — Aliran otomatis aktif untuk {session?.patient_name} ({session?.token})
            </span>
          </div>

          <div className="flex items-center gap-1.5 ml-auto">
            <span className="text-[10px] font-bold text-neutral-400 uppercase hidden sm:inline mr-1">
              Uji Coba:
            </span>
            <button
              onClick={() => handleTriggerSim('FALL')}
              className="px-2 py-1 text-[11px] font-semibold bg-neutral-100 hover:bg-neutral-200 text-neutral-800 border border-neutral-300 transition-colors cursor-pointer rounded-none"
              title="Memicu simulasi deteksi jatuh"
            >
              🚨 Jatuh
            </button>
            <button
              onClick={() => handleTriggerSim('SOS')}
              className="px-2 py-1 text-[11px] font-semibold bg-neutral-100 hover:bg-neutral-200 text-neutral-800 border border-neutral-300 transition-colors cursor-pointer rounded-none"
              title="Memicu tombol SOS darurat"
            >
              🆘 SOS
            </button>
            <button
              onClick={() => handleTriggerSim('SMOKE')}
              className="px-2 py-1 text-[11px] font-semibold bg-neutral-100 hover:bg-neutral-200 text-neutral-800 border border-neutral-300 transition-colors cursor-pointer rounded-none"
              title="Memicu sensor asap rumah"
            >
              🔥 Asap
            </button>
            <button
              onClick={handleResetNormal}
              className="px-2 py-1 text-[11px] font-bold bg-emerald-700 hover:bg-emerald-800 text-white border border-emerald-800 transition-colors cursor-pointer rounded-none"
              title="Kembalikan semua status dan alarm ke kondisi Normal"
            >
              ✅ Reset Normal
            </button>
          </div>
        </div>

        {/* Tab 1: Health Monitoring (Default) */}
        {activeTab === 'dashboard' && (
          <>
            {/* Top 4 Stat Metric Cards (Watch + Home Node Combined) */}
            <StatCards
              latestMetric={latestWatchMetric}
              homeMetric={latestHomeMetric}
            />

            {/* Biometric Chart Full-Width */}
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
        {activeTab === 'companion' && <AiCompanionView session={session} />}

        {/* Tab 4: Family Connection & UU PDP Consent */}
        {activeTab === 'family' && <FamilyPrivacyView session={session} />}

        {/* Tab 5: Settings & Arsitektur Sistem */}
        {activeTab === 'settings' && (
          <div className="bg-white rounded-none p-5 sm:p-6 border border-neutral-200 shadow-xs space-y-6">
            <div>
              <h3 className="text-base sm:text-lg font-bold text-[#111111]">
                Informasi &amp; Arsitektur Sistem
              </h3>
              <p className="text-xs text-neutral-500 mt-1">
                AI-Powered Elderly Care Ecosystem — Solusi Pemantauan dan Pendampingan Lansia Berbasis AI &amp; IoT.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div className="p-4 bg-neutral-50 border border-neutral-200 space-y-2">
                <span className="font-bold text-neutral-900 block">Sesi Perangkat yang Sedang Aktif:</span>
                <div>
                  • Token ID Jam: <code className="bg-neutral-200 px-1.5 py-0.5 font-bold font-mono">{session?.token}</code>
                </div>
                <div>
                  • Nama Lansia: <strong>{session?.patient_name}</strong> (ID: {session?.patient_id})
                </div>
                <div>
                  • Model Jam: <code className="bg-neutral-200 px-1.5 py-0.5">Huawei Smart Health Band Pro</code>
                </div>
                <div className="flex gap-2 pt-2">
                  <button
                    onClick={() => setIsAuthModalOpen(true)}
                    className="px-3 py-1.5 bg-[#111111] text-white font-bold text-xs uppercase cursor-pointer hover:bg-neutral-800 rounded-none"
                  >
                    Ganti Jam / Token
                  </button>
                  <button
                    onClick={handleLogout}
                    className="px-3 py-1.5 bg-red-600 text-white font-bold text-xs uppercase cursor-pointer hover:bg-red-700 rounded-none"
                  >
                    Putuskan Koneksi
                  </button>
                </div>
              </div>

              <div className="p-4 bg-neutral-50 border border-neutral-200 space-y-2">
                <span className="font-bold text-neutral-900 block">Infrastruktur Multi-Tenant &amp; Keamanan:</span>
                <div>• Database: Huawei Cloud RDS / MySQL 8.0 — Terhubung Normal</div>
                <div>• Isolasi Data: Data difilter ketat per <code>device_token</code> &amp; <code>patient_id</code></div>
                <div>• Protokol: Enkripsi REST API over TLS / Bearer Token</div>
                <div>• Kepatuhan: UU No. 27/2022 Pelindungan Data Pribadi</div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* 3. Docked Flat Bottom Navigation Bar (Layar HP < md) */}
      <BottomNav
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        alertCount={activeAlertCount}
        onOpenAuth={() => setIsAuthModalOpen(true)}
        onLogout={handleLogout}
      />

      {/* 4. Modal Pairing & Ganti Token */}
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

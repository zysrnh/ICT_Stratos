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
import { Zap } from 'lucide-react';

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [metrics, setMetrics] = useState<HealthMetric[]>([]);
  const [events, setEvents] = useState<EmergencyEvent[]>([]);
  const [alerts, setAlerts] = useState<HealthAlert[]>([]);
  const [contacts, setContacts] = useState<EmergencyContact[]>([]);

  // Sesi Autentikasi / Pairing Perangkat (Tersimpan Permanen di Chrome LocalStorage)
  const [session, setSession] = useState<AuthSession | null>(() => getSavedSession());
  const [isAuthModalOpen, setIsAuthModalOpen] = useState<boolean>(false);

  // State Simulasi Data Mandiri (Uji Coba Langsung di Web)
  const [isSimulating, setIsSimulating] = useState<boolean>(false);
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

  // Polling data rutin setiap 2.5 detik
  useEffect(() => {
    if (!session) return;
    loadAllData();
    const timer = setInterval(loadAllData, 2500);
    return () => clearInterval(timer);
  }, [session, loadAllData]);

  // Loop Injeksi Data Simulasi jika Mode Simulasi Web diaktifkan
  useEffect(() => {
    if (!isSimulating || !session) return;
    const simTimer = setInterval(async () => {
      const next = simSteps + Math.floor(1 + Math.random() * 3);
      setSimSteps(next);
      await sendSimulatedTelemetry({
        heart_rate: Math.floor(72 + Math.random() * 15),
        steps: next,
        activity: next % 8 === 0 ? 'WALKING' : 'REST',
        room_temp: +(26.8 + Math.random() * 0.8).toFixed(1),
        humidity: +(63 + Math.random() * 3).toFixed(1),
        smoke_adc: 310 + Math.floor(Math.random() * 35),
      });
      loadAllData();
    }, 2500);
    return () => clearInterval(simTimer);
  }, [isSimulating, session, simSteps, loadAllData]);

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
    setIsSimulating(false);
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

        {/* Panel Pengujian & Simulator Real-time (Uji Mandiri Web) */}
        <div className="mb-5 p-3.5 bg-white border-2 border-neutral-900 shadow-xs flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <span
              className={`w-3 h-3 rounded-full flex items-center justify-center ${
                isSimulating ? 'bg-emerald-500 animate-pulse' : 'bg-neutral-300'
              }`}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  isSimulating ? 'bg-white' : 'bg-neutral-500'
                }`}
              />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-black text-neutral-900 uppercase tracking-wider">
                  {isSimulating ? 'Stream Simulasi IoT Aktif' : 'Simulator Pengujian Live (Mandiri Web)'}
                </span>
                <span
                  className={`text-[10px] font-black px-1.5 py-0.5 uppercase ${
                    isSimulating
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-neutral-100 text-neutral-600'
                  }`}
                >
                  {isSimulating ? 'Mengalir Real-time' : 'Siap Uji'}
                </span>
              </div>
              <p className="text-[11px] text-neutral-500">
                {isSimulating
                  ? `Mengirim detak jantung, langkah & suhu ruangan real-time untuk ${session?.patient_name} (${session?.token}).`
                  : 'Klik tombol di samping untuk uji coba langsung tanpa perlu menjalankan Wokwi.'}
              </p>
            </div>
          </div>

          <div className="flex items-center flex-wrap gap-2">
            <button
              onClick={() => setIsSimulating(!isSimulating)}
              className={`px-3 py-1.5 text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer flex items-center gap-1.5 border-2 ${
                isSimulating
                  ? 'bg-red-600 hover:bg-red-700 text-white border-red-700'
                  : 'bg-neutral-900 hover:bg-neutral-800 text-white border-neutral-900'
              }`}
            >
              <Zap className="w-3.5 h-3.5 text-amber-300" />
              <span>{isSimulating ? 'Hentikan Stream' : 'Mulai Stream Data'}</span>
            </button>

            <div className="h-5 w-[1px] bg-neutral-300 mx-1 hidden sm:block" />

            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-bold text-neutral-400 uppercase hidden lg:inline">
                Uji Darurat:
              </span>
              <button
                onClick={() => handleTriggerSim('FALL')}
                className="px-2.5 py-1 text-[11px] font-bold bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-400 cursor-pointer transition-colors"
                title="Memicu Simulasi Deteksi Jatuh"
              >
                🚨 Uji Jatuh
              </button>
              <button
                onClick={() => handleTriggerSim('SOS')}
                className="px-2.5 py-1 text-[11px] font-bold bg-red-50 hover:bg-red-100 text-red-900 border border-red-400 cursor-pointer transition-colors"
                title="Memicu Tombol Darurat SOS"
              >
                🆘 Uji SOS
              </button>
              <button
                onClick={() => handleTriggerSim('SMOKE')}
                className="px-2.5 py-1 text-[11px] font-bold bg-orange-50 hover:bg-orange-100 text-orange-900 border border-orange-400 cursor-pointer transition-colors"
                title="Memicu Alarm Sensor Asap Rumah"
              >
                🔥 Uji Asap
              </button>
            </div>
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
        {activeTab === 'companion' && <AiCompanionView session={session} />}

        {/* Tab 4: Family Connection & UU PDP Consent */}
        {activeTab === 'family' && <FamilyPrivacyView session={session} />}

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

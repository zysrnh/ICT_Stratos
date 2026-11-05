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

  // 1. Polling data rutin cepat setiap 1 detik (Realtime Stream dari Cloud / Wokwi)
  useEffect(() => {
    if (!session) return;
    loadAllData();
    const timer = setInterval(loadAllData, 1000);
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

  const handleTriggerSim = async (type: 'FALL' | 'SOS' | 'SMOKE') => {
    try {
      if (type === 'FALL') {
        await triggerSimulatedEvent('FALL', 'ESCALATED', 3.5);
        await sendSimulatedTelemetry({
          heart_rate: 116,
          activity: 'FALL',
          steps: latestWatchMetric?.steps ?? 0,
        });
      } else if (type === 'SOS') {
        await triggerSimulatedEvent('SOS', 'ESCALATED', 1.0);
        await sendSimulatedTelemetry({
          heart_rate: 124,
          activity: 'REST',
          steps: latestWatchMetric?.steps ?? 0,
        });
      } else if (type === 'SMOKE') {
        await triggerSimulatedEvent('SMOKE', 'ESCALATED', 3200);
        await sendSimulatedTelemetry({
          smoke_adc: 3200,
          room_temp: 33.2,
          heart_rate: latestWatchMetric?.heart_rate ?? 76,
          steps: latestWatchMetric?.steps ?? 0,
        });
      }
      await loadAllData();
    } catch (err) {
      console.error('[Trigger Sim Error]:', err);
    }
  };

  const handleResetNormal = async () => {
    try {
      // 1. Selesaikan semua kejadian darurat yang masih aktif di database
      for (const ev of events) {
        if (ev.status === 'PENDING' || ev.status === 'ESCALATED') {
          await triggerSimulatedEvent(ev.event_type as any, 'RESOLVED', 0);
        }
      }
      // 2. Injeksi telemetri normal (HR 72, Asap aman 310 ADC, Suhu 27.0)
      await sendSimulatedTelemetry({
        heart_rate: 72,
        steps: latestWatchMetric?.steps ?? 0,
        activity: 'REST',
        room_temp: 27.0,
        humidity: 60,
        smoke_adc: 310,
      });
      await loadAllData();
    } catch (err) {
      console.error('[Reset Normal Error]:', err);
    }
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

        {/* Panel Status Sinkronisasi Realtime & Pengujian Darurat */}
        <div className="mb-6 bg-white border-2 border-neutral-900 p-3 sm:p-4 shadow-sm">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-neutral-200">
            <div className="flex items-center gap-2.5">
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex h-3 w-3 bg-emerald-600"></span>
              </span>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-black text-neutral-900 uppercase tracking-wider">
                    SINKRONISASI REALTIME AKTIF (1 DETIK)
                  </span>
                  <span className="text-[10px] bg-neutral-900 text-white font-mono px-1.5 py-0.5">
                    {session?.token}
                  </span>
                </div>
                <p className="text-[11px] text-neutral-500">
                  Terhubung ke <strong>{session?.patient_name}</strong> • Data biometrik diperbarui langsung dari ESP32 Wokwi.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 text-xs">
              <span className="text-neutral-500 text-[11px]">Status Darurat:</span>
              {activeAlertCount > 0 ? (
                <span className="bg-rose-600 text-white font-bold px-2 py-0.5 text-[10px] uppercase animate-pulse">
                  🚨 {activeAlertCount} Kejadian Darurat Aktif!
                </span>
              ) : (
                <span className="bg-emerald-100 text-emerald-800 border border-emerald-300 font-bold px-2 py-0.5 text-[10px] uppercase">
                  ✓ Semua Normal & Aman
                </span>
              )}
            </div>
          </div>

          {/* Tombol-tombol Uji Coba yang Jelas, Kontras & Informatif */}
          <div className="pt-3 flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-black text-neutral-700 uppercase tracking-wider mr-1">
              UJI SKENARIO:
            </span>

            <button
              type="button"
              onClick={() => handleTriggerSim('FALL')}
              className="px-3 py-1.5 text-xs font-bold bg-amber-50 hover:bg-amber-100 text-amber-900 border-2 border-amber-500 transition-colors cursor-pointer flex items-center gap-1.5"
              title="Simulasikan lansia terjatuh (Benturan IMU MPU6050)"
            >
              <span>🚨 Uji Jatuh</span>
              <span className="text-[10px] text-amber-700 font-normal hidden sm:inline">(Impact 3.5G)</span>
            </button>

            <button
              type="button"
              onClick={() => handleTriggerSim('SOS')}
              className="px-3 py-1.5 text-xs font-bold bg-rose-50 hover:bg-rose-100 text-rose-900 border-2 border-rose-500 transition-colors cursor-pointer flex items-center gap-1.5"
              title="Simulasikan penekanan tombol fisik SOS di jam tangan"
            >
              <span>🆘 Uji Tombol SOS</span>
              <span className="text-[10px] text-rose-700 font-normal hidden sm:inline">(Panik)</span>
            </button>

            <button
              type="button"
              onClick={() => handleTriggerSim('SMOKE')}
              className="px-3 py-1.5 text-xs font-bold bg-orange-50 hover:bg-orange-100 text-orange-900 border-2 border-orange-500 transition-colors cursor-pointer flex items-center gap-1.5"
              title="Simulasikan sensor asap/gas MQ-2 terdeteksi pekat"
            >
              <span>🔥 Uji Kebakaran / Asap</span>
              <span className="text-[10px] text-orange-700 font-normal hidden sm:inline">(MQ-2 &gt; 2500)</span>
            </button>

            <button
              type="button"
              onClick={handleResetNormal}
              className="ml-auto px-4 py-1.5 text-xs font-black bg-emerald-700 hover:bg-emerald-800 text-white border-2 border-emerald-900 transition-colors cursor-pointer flex items-center gap-1.5 shadow-sm"
              title="Selesaikan semua alarm & kembalikan status ke Normal"
            >
              <span>✅ Reset Normal</span>
              <span className="text-[10px] text-emerald-200 font-normal hidden sm:inline">(Matikan Alarm)</span>
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
              activeEvents={events}
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

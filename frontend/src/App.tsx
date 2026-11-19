import React, { useState, useEffect, useCallback } from 'react';
import {
  Watch,
  ShieldCheck,
  CheckCircle2,
  ChevronDown,
  AlertTriangle,
} from 'lucide-react';
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

  // State UI Pengaturan (konfirmasi putuskan koneksi & accordion detail teknis)
  const [isDisconnectConfirmOpen, setIsDisconnectConfirmOpen] = useState<boolean>(false);
  const [isTechAccordionOpen, setIsTechAccordionOpen] = useState<boolean>(false);
  const [lastSyncSeconds, setLastSyncSeconds] = useState<number>(1);

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
      setLastSyncSeconds(1);
    } catch (err) {
      console.error('[App Polling Error]:', err);
      setLastSyncSeconds((prev) => Math.min(prev + 1, 60));
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
    setIsDisconnectConfirmOpen(false);
  };

  const handleResolveEvent = async (eventId: string) => {
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

  const primaryContact =
    contacts.find((c) => c.is_primary) || (contacts.length > 0 ? contacts[0] : null);

  const activeAlertCount =
    events.filter((e) => e.status === 'PENDING' || e.status === 'ESCALATED').length ||
    alerts.length;

  return (
    <div className="min-h-screen bg-[#F7F6F3] flex flex-col md:flex-row w-full min-w-0">
      {/* 1. Navigasi Samping (Tablet & Desktop >= md) */}
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        alertCount={activeAlertCount}
        onOpenAuth={() => setIsAuthModalOpen(true)}
        onLogout={() => setIsDisconnectConfirmOpen(true)}
      />

      {/* 2. Konten Utama */}
      <main className="flex-1 min-w-0 p-4 sm:p-6 lg:p-8 w-full pb-16 md:pb-8">
        {/* Header Bar Ramah dengan Popover Mode Simulasi & Avatar Menu */}
        <Header
          alertCount={activeAlertCount}
          session={session}
          onOpenAuth={() => setIsAuthModalOpen(true)}
          onLogout={() => setIsDisconnectConfirmOpen(true)}
          onTriggerSim={handleTriggerSim}
          onResetNormal={handleResetNormal}
          onGoToSettings={() => setActiveTab('settings')}
          onGoToSafety={() => setActiveTab('home')}
          lastUpdatedText={`Diperbarui ${lastSyncSeconds} detik lalu`}
        />

        {/* Banner Alert Ringkas (Tampil di Semua Halaman Hanya Saat Darurat Aktif) */}
        <EmergencyAlertBanner
          events={events}
          primaryContact={primaryContact}
          onResolve={handleResolveEvent}
        />

        {/* Konten Halaman Aktif dengan Animasi Transisi Halus */}
        <div key={activeTab} className="animate-page-enter">
          {/* Tab 1: Ringkasan Kesehatan (Default) */}
          {activeTab === 'dashboard' && (
            <div className="space-y-8">
              <StatCards
                latestMetric={latestWatchMetric}
                homeMetric={latestHomeMetric}
                activeEvents={events}
              />

              <SmoothBiometricChart metrics={metrics} />

              <TelemetryFeed metrics={metrics} />
            </div>
          )}

          {/* Tab 2: Keamanan Rumah */}
          {activeTab === 'home' && (
            <HomeSafetyView
              events={events}
              latestMetric={latestWatchMetric}
              homeMetric={latestHomeMetric}
              onRefresh={loadAllData}
            />
          )}

          {/* Tab 3: Pendamping & Jadwal */}
          {activeTab === 'companion' && <AiCompanionView session={session} />}

          {/* Tab 4: Keluarga & Persetujuan Data */}
          {activeTab === 'family' && <FamilyPrivacyView session={session} />}

          {/* Tab 5: Pengaturan */}
          {activeTab === 'settings' && (
            <div className="space-y-8">
              <div className="hc-card p-6">
                <h2 className="text-xl font-semibold text-[#18181B]">Pengaturan</h2>
                <p className="text-[15px] text-[#52525B] mt-1 mb-6">
                  Kelola koneksi jam tangan pintar dan perlindungan data keluarga.
                </p>

                {/* Layout 2 Kolom Seimbang */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Kolom 1: Jam Terhubung */}
                  <section
                    aria-label="Jam terhubung"
                    className="p-6 rounded-[20px] bg-[#FAF9F7] border border-[#E5E3DD] flex flex-col justify-between gap-5"
                  >
                    <div>
                      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-white border border-[#E5E3DD] text-[#18181B] flex items-center justify-center shrink-0">
                            <Watch className="w-5 h-5" aria-hidden="true" />
                          </div>
                          <h3 className="text-[16px] font-semibold text-[#18181B]">
                            Jam terhubung
                          </h3>
                        </div>

                        <span className="hc-chip bg-[#F0FDF4] text-[#166534] border border-[#BBF7D0]">
                          <CheckCircle2 className="w-3.5 h-3.5 text-[#15803D]" aria-hidden="true" />
                          <span>Terhubung</span>
                        </span>
                      </div>

                      <dl className="space-y-3 text-[15px]">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <dt className="text-[#52525B]">Nama lansia</dt>
                          <dd className="font-medium text-[#18181B]">{session?.patient_name}</dd>
                        </div>
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <dt className="text-[#52525B]">Model jam</dt>
                          <dd className="font-medium text-[#18181B]">
                            {session?.paired_device?.model_name || 'Huawei Smart Health Band Pro'}
                          </dd>
                        </div>
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <dt className="text-[#52525B]">Kode perangkat</dt>
                          <dd>
                            <code className="hc-chip bg-white border border-[#E5E3DD] font-mono text-[13px] text-[#18181B]">
                              {session?.token}
                            </code>
                          </dd>
                        </div>
                      </dl>
                    </div>

                    <div className="flex flex-wrap items-center gap-3 pt-2">
                      <button
                        type="button"
                        onClick={() => setIsAuthModalOpen(true)}
                        className="hc-btn-secondary flex-1 sm:flex-initial px-4 py-2.5 text-[14px] cursor-pointer"
                      >
                        Ganti jam
                      </button>
                      <button
                        type="button"
                        onClick={() => setIsDisconnectConfirmOpen(true)}
                        className="hc-btn-danger flex-1 sm:flex-initial px-4 py-2.5 text-[14px] cursor-pointer"
                      >
                        Putuskan koneksi
                      </button>
                    </div>
                  </section>

                  {/* Kolom 2: Keamanan Data (2-3 Baris + Ikon Centang) */}
                  <section
                    aria-label="Keamanan data"
                    className="p-6 rounded-[20px] bg-[#FAF9F7] border border-[#E5E3DD] flex flex-col justify-between gap-4"
                  >
                    <div>
                      <div className="flex items-center gap-3 mb-4">
                        <div className="w-10 h-10 rounded-full bg-[#F0FDF4] text-[#15803D] flex items-center justify-center shrink-0">
                          <ShieldCheck className="w-5 h-5" aria-hidden="true" />
                        </div>
                        <h3 className="text-[16px] font-semibold text-[#18181B]">
                          Keamanan data
                        </h3>
                      </div>

                      <ul className="space-y-3.5 text-[15px] text-[#18181B]">
                        <li className="flex items-start gap-3">
                          <CheckCircle2
                            className="w-5 h-5 text-[#15803D] shrink-0 mt-0.5"
                            aria-hidden="true"
                          />
                          <span>Data kesehatan dienkripsi saat dikirim dan disimpan.</span>
                        </li>
                        <li className="flex items-start gap-3">
                          <CheckCircle2
                            className="w-5 h-5 text-[#15803D] shrink-0 mt-0.5"
                            aria-hidden="true"
                          />
                          <span>Hanya dapat diakses oleh akun keluarga yang terhubung.</span>
                        </li>
                        <li className="flex items-start gap-3">
                          <CheckCircle2
                            className="w-5 h-5 text-[#15803D] shrink-0 mt-0.5"
                            aria-hidden="true"
                          />
                          <span>Dikelola sesuai UU Pelindungan Data Pribadi No. 27/2022.</span>
                        </li>
                      </ul>
                    </div>
                  </section>
                </div>
              </div>

              {/* Accordion Detail Teknis (Tertutup Default) */}
              <section aria-label="Detail teknis infrastruktur" className="hc-card overflow-hidden">
                <button
                  type="button"
                  onClick={() => setIsTechAccordionOpen((prev) => !prev)}
                  aria-expanded={isTechAccordionOpen}
                  className="w-full min-h-[56px] px-6 py-4 flex items-center justify-between gap-4 text-left hover:bg-[#FAF9F7] transition-colors cursor-pointer"
                >
                  <div>
                    <span className="text-[16px] font-semibold text-[#18181B] block">
                      Detail teknis
                    </span>
                    <span className="text-[13px] text-[#52525B]">
                      Informasi basis data, protokol koneksi, dan isolasi perangkat
                    </span>
                  </div>
                  <ChevronDown
                    className={`w-5 h-5 text-[#52525B] shrink-0 transition-transform duration-180 ${
                      isTechAccordionOpen ? 'rotate-180' : ''
                    }`}
                    aria-hidden="true"
                  />
                </button>

                {isTechAccordionOpen && (
                  <div className="px-6 pb-6 pt-4 border-t border-[#E5E3DD] grid grid-cols-1 sm:grid-cols-2 gap-4 text-[14px] text-[#52525B] hc-fade-soft">
                    <div>
                      <span className="font-semibold text-[#18181B] block mb-0.5">Basis data</span>
                      <span>Huawei Cloud RDS (MySQL 8.0) terhubung</span>
                    </div>
                    <div>
                      <span className="font-semibold text-[#18181B] block mb-0.5">Protokol</span>
                      <span>REST API terenkripsi HTTPS/TLS dengan otorisasi token perangkat</span>
                    </div>
                    <div>
                      <span className="font-semibold text-[#18181B] block mb-0.5">Isolasi data</span>
                      <span>
                        Setiap pemantauan dipisahkan per token perangkat dan identitas lansia
                      </span>
                    </div>
                    <div>
                      <span className="font-semibold text-[#18181B] block mb-0.5">Kepatuhan</span>
                      <span>UU No. 27 Tahun 2022 tentang Pelindungan Data Pribadi</span>
                    </div>
                  </div>
                )}
              </section>
            </div>
          )}
        </div>
      </main>

      {/* 3. Navigasi Bawah Khusus Mobile (< md) */}
      <BottomNav
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        alertCount={activeAlertCount}
        onOpenAuth={() => setIsAuthModalOpen(true)}
        onLogout={() => setIsDisconnectConfirmOpen(true)}
      />

      {/* 4. Modal Pairing & Ganti Jam */}
      <LoginModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        onSuccess={handleAuthSuccess}
        currentSession={session}
        isFullScreen={false}
      />

      {/* 5. Dialog Konfirmasi Putuskan Koneksi */}
      {isDisconnectConfirmOpen && (
        <div
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="disconnect-title"
          aria-describedby="disconnect-desc"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-[2px] p-4 hc-fade-soft"
        >
          <div
            className="w-full max-w-sm bg-white border border-[#E5E3DD] rounded-[20px] p-6"
            style={{ boxShadow: 'var(--shadow-popover)' }}
          >
            <div className="flex items-start gap-3.5 mb-4">
              <div className="w-11 h-11 rounded-full bg-[#FEF2F2] text-[#DC2626] flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5" aria-hidden="true" />
              </div>
              <div>
                <h2 id="disconnect-title" className="text-lg font-semibold text-[#18181B]">
                  Putuskan koneksi?
                </h2>
                <p id="disconnect-desc" className="text-[14px] text-[#52525B] mt-1 leading-relaxed">
                  Pemantauan untuk {session?.patient_name} akan dihentikan sementara hingga Anda menghubungkan kembali jam tangan.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setIsDisconnectConfirmOpen(false)}
                className="hc-btn-secondary px-4 py-2.5 text-[14px] cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleLogout}
                className="hc-btn-danger px-4 py-2.5 text-[14px] cursor-pointer"
              >
                Ya, putuskan
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;

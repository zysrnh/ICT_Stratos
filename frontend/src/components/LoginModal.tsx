import React, { useState, useEffect } from 'react';
import { X, CheckCircle2, ShieldCheck, AlertCircle, Camera, QrCode, ArrowRight } from 'lucide-react';
import { pairDevice } from '../services/api';
import type { AuthSession } from '../types/telemetry';
import { QrCameraScanner } from './QrCameraScanner';

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (session: AuthSession) => void;
  currentSession: AuthSession | null;
  isFullScreen?: boolean;
}

export const LoginModal: React.FC<LoginModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  currentSession,
  isFullScreen = false,
}) => {
  const [tokenInput, setTokenInput] = useState('');
  const [patientName, setPatientName] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isScannerOpen, setIsScannerOpen] = useState(false);

  // Auto-detect token dari parameter URL (?pair=... atau ?token=...)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const urlToken = params.get('pair') || params.get('token');
      if (urlToken) {
        setTokenInput(urlToken.trim().toUpperCase());
      }
    }
  }, []);

  if (!isOpen) return null;

  const triggerPair = async (tokenToUse: string, patientNameToUse?: string) => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const session = await pairDevice(tokenToUse.trim(), patientNameToUse?.trim() || undefined);
      onSuccess(session);
      onClose();
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Gagal menghubungkan jam tangan.');
    } finally {
      setLoading(false);
    }
  };

  const handlePairSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tokenInput.trim()) {
      setErrorMsg('Masukkan Token ID Jam Tangan atau pindai QR Code.');
      return;
    }
    await triggerPair(tokenInput, patientName);
  };

  const handleScanSuccess = async (scannedToken: string) => {
    setIsScannerOpen(false);
    setTokenInput(scannedToken);
    await triggerPair(scannedToken, patientName);
  };

  const handleQuickDemo = async () => {
    await triggerPair('HUAWEI-ECA-8821', 'Opa Budi Santoso');
  };

  const containerClass = isFullScreen
    ? 'min-h-screen w-full flex flex-col items-center justify-center bg-[#F6F7F9] p-4 select-none font-sans'
    : 'fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 select-none font-sans animate-fadeIn';

  return (
    <>
      <div className={containerClass}>
        {/* Brand Header — Konsisten dengan Header Utama */}
        <div className="mb-6 flex flex-col items-center text-center">
          <div className="flex items-center gap-2 mb-2">
            <span className="w-8 h-8 bg-[#111111] text-white flex items-center justify-center font-black text-sm rounded-none">
              H.
            </span>
            <span className="text-[11px] font-black tracking-widest text-[#111111] uppercase">
              Huawei Health Ecosystem
            </span>
          </div>
          <h1 className="text-xl md:text-2xl font-extrabold text-[#111111] tracking-tight">
            AI-Powered Elderly Care Ecosystem
          </h1>
          <p className="text-xs text-neutral-500 max-w-sm mt-1">
            Platform Pemantauan Biometrik Real-time, Deteksi Darurat & Pendamping Lansia
          </p>
        </div>

        {/* Modal Card — Konsisten dengan Flat Solid Monochrome & border-2 border-neutral-900 */}
        <div className="bg-white border-2 border-neutral-900 w-full max-w-md rounded-none shadow-2xl overflow-hidden">
          {/* Header Card */}
          <div className="bg-neutral-900 text-white p-5 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-white text-neutral-900 flex items-center justify-center font-black text-sm">
                ECA
              </div>
              <div>
                <h2 className="text-base font-bold tracking-tight">
                  Pairing Perangkat Smartwatch
                </h2>
                <p className="text-[11px] text-neutral-400">
                  Pindai QR Code atau masukkan Token ID perangkat
                </p>
              </div>
            </div>

            {!isFullScreen && currentSession && (
              <button
                onClick={onClose}
                className="text-neutral-400 hover:text-white transition-colors cursor-pointer p-1"
                title="Tutup Modal"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>

          <div className="p-6 space-y-5">
            {errorMsg && (
              <div className="p-3 bg-red-50 border border-red-500 text-red-700 text-xs flex items-center gap-2 font-medium">
                <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Tombol Utama: Scan QR Code Kamera (Depan & Belakang) */}
            <div>
              <button
                type="button"
                onClick={() => setIsScannerOpen(true)}
                className="w-full py-3.5 px-4 bg-[#111111] hover:bg-neutral-800 text-white font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2.5 cursor-pointer transition-all border-2 border-neutral-900 shadow-sm"
              >
                <Camera className="w-4 h-4 text-emerald-400" />
                <span>Pindai QR Code via Kamera</span>
                <QrCode className="w-4 h-4 text-neutral-300 ml-1" />
              </button>
              <p className="text-[11px] text-neutral-500 text-center mt-1.5">
                Bisa pakai kamera belakang atau kamera depan (laptop / HP)
              </p>
            </div>

            {/* Divider "ATAU MASUKKAN MANUAL" */}
            <div className="relative flex items-center justify-center">
              <div className="border-t border-neutral-300 w-full" />
              <span className="bg-white px-3 text-[10px] font-bold text-neutral-400 uppercase tracking-widest shrink-0">
                Atau Masukkan Manual
              </span>
              <div className="border-t border-neutral-300 w-full" />
            </div>

            {/* Form Input Manual */}
            <form onSubmit={handlePairSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-neutral-800 uppercase tracking-wider block">
                  Token ID Smartwatch
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={tokenInput}
                    onChange={(e) => setTokenInput(e.target.value.toUpperCase())}
                    placeholder="Contoh: HUAWEI-ECA-8821"
                    className="flex-1 px-3.5 py-2.5 text-sm font-mono border-2 border-neutral-300 focus:border-neutral-900 focus:outline-none transition-colors"
                  />
                  <button
                    type="button"
                    onClick={() => setIsScannerOpen(true)}
                    className="px-3 bg-neutral-100 hover:bg-neutral-200 text-neutral-800 border-2 border-neutral-400 flex items-center justify-center cursor-pointer transition-colors"
                    title="Buka Kamera Scanner"
                  >
                    <QrCode className="w-4 h-4" />
                  </button>
                </div>
                <p className="text-[11px] text-neutral-500">
                  Lihat Token ID di layar jam tangan OLED Wokwi atau Serial Monitor.
                </p>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-neutral-800 uppercase tracking-wider block">
                  Nama Lansia / Pasien (Opsional)
                </label>
                <input
                  type="text"
                  value={patientName}
                  onChange={(e) => setPatientName(e.target.value)}
                  placeholder="Misal: Opa Budi Santoso / Oma Siti"
                  className="w-full px-3.5 py-2 text-xs border-2 border-neutral-300 focus:border-neutral-900 focus:outline-none transition-colors"
                />
                <p className="text-[11px] text-neutral-500">
                  Jika jam tangan ini baru, profil otomatis dibuatkan sesuai nama ini.
                </p>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 bg-neutral-900 hover:bg-neutral-800 text-white text-xs font-bold uppercase tracking-wider transition-colors disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2"
              >
                <span>{loading ? 'Menghubungkan Perangkat...' : 'Hubungkan & Mulai Pantau'}</span>
                {!loading && <ArrowRight className="w-3.5 h-3.5" />}
              </button>
            </form>

            {/* Quick Demo Section (1-Klik) */}
            <div className="pt-3 border-t border-neutral-200">
              <span className="text-[11px] font-bold text-neutral-500 uppercase tracking-wider block mb-2">
                Akses Cepat Pengujian Demo:
              </span>
              <button
                type="button"
                onClick={handleQuickDemo}
                disabled={loading}
                className="w-full py-2.5 px-4 bg-neutral-50 border-2 border-neutral-300 hover:border-neutral-900 text-neutral-900 text-xs font-bold flex items-center justify-between transition-all cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>Token Bawaan: <strong>HUAWEI-ECA-8821</strong> (Opa Budi)</span>
                </div>
                <span className="text-[10px] bg-neutral-900 text-white px-2 py-0.5 uppercase">1-Klik</span>
              </button>
            </div>

            {/* Footer Kepatuhan & Status Sesi */}
            <div className="pt-3 border-t border-neutral-200 flex items-center justify-between text-[11px] text-neutral-500">
              <span className="flex items-center gap-1.5 font-medium">
                <ShieldCheck className="w-3.5 h-3.5 text-neutral-700" />
                UU No. 27/2022 UU PDP Compliant
              </span>
              {currentSession && (
                <span className="font-mono text-neutral-800 font-bold">
                  Aktif: {currentSession.token}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Modal Pemindai Kamera (Depan & Belakang) */}
      <QrCameraScanner
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        onScanSuccess={handleScanSuccess}
      />
    </>
  );
};

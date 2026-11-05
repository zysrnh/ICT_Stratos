import React, { useState, useEffect } from 'react';
import {
  X,
  CheckCircle2,
  ShieldCheck,
  AlertCircle,
  Camera,
  QrCode,
  ArrowRight,
  User,
  HeartPulse,
  ArrowLeft,
  Watch,
} from 'lucide-react';
import { pairDevice, loginAuth } from '../services/api';
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
  const [step, setStep] = useState<'scan' | 'configure'>('scan');
  const [tokenCode, setTokenCode] = useState('');
  const [tokenInput, setTokenInput] = useState('');
  const [patientName, setPatientName] = useState('');
  const [age, setAge] = useState<number>(70);
  const [gender, setGender] = useState<'MALE' | 'FEMALE'>('MALE');
  const [conditionSummary, setConditionSummary] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isScannerOpen, setIsScannerOpen] = useState(false);

  // Auto-detect token dari parameter URL (?pair=... atau ?token=...)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const urlToken = params.get('pair') || params.get('token');
      if (urlToken) {
        const clean = urlToken.trim().toUpperCase();
        const code = clean.replace(/^HUAWEI-?ECA-?/i, '').replace(/^ECA-?/i, '');
        const full = clean.startsWith('HUAWEI-ECA-') ? clean : `HUAWEI-ECA-${code}`;
        setTokenCode(code);
        setTokenInput(full);
        setLoading(true);
        loginAuth({ token: full })
          .then((existingSession) => {
            if (existingSession && !existingSession.patient_name?.startsWith('Lansia (')) {
              onSuccess(existingSession);
              onClose();
            } else {
              setStep('configure');
            }
          })
          .catch(() => {
            setStep('configure');
          })
          .finally(() => {
            setLoading(false);
          });
      }
    }
  }, []);

  if (!isOpen) return null;

  const handleScanSuccess = async (scannedToken: string) => {
    setIsScannerOpen(false);
    const cleaned = scannedToken.trim().toUpperCase();
    const code = cleaned.replace(/^HUAWEI-?ECA-?/i, '').replace(/^ECA-?/i, '');
    const full = cleaned.startsWith('HUAWEI-ECA-') ? cleaned : `HUAWEI-ECA-${code}`;
    setTokenCode(code);
    setTokenInput(full);
    setErrorMsg(null);
    setLoading(true);

    try {
      const existingSession = await loginAuth({ token: full });
      if (existingSession && !existingSession.patient_name?.startsWith('Lansia (')) {
        onSuccess(existingSession);
        onClose();
        return;
      }
      setStep('configure');
    } catch {
      setStep('configure');
    } finally {
      setLoading(false);
    }
  };

  const handleNextToConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanCode = tokenCode.trim().toUpperCase();
    const full = tokenInput.trim().toUpperCase() || (cleanCode ? `HUAWEI-ECA-${cleanCode}` : '');
    if (!full || !cleanCode) {
      setErrorMsg('Masukkan 4 karakter kode smartwatch atau scan QR Code.');
      return;
    }
    setTokenInput(full);
    setErrorMsg(null);
    setLoading(true);

    try {
      // 1. Cek apakah token sudah terdaftar di database
      const existingSession = await loginAuth({ token: full });
      // Jika berhasil dan pasien bukan placeholder tak bernama, langsung masuk ke Dashboard!
      if (existingSession && !existingSession.patient_name?.startsWith('Lansia (')) {
        onSuccess(existingSession);
        onClose();
        return;
      }
      // Jika masih berupa placeholder, arahkan ke konfigurasi nama
      setStep('configure');
    } catch {
      // Token belum terdaftar di DB -> beralih ke form isi nama profil lansia baru
      setStep('configure');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!patientName.trim()) {
      setErrorMsg('Nama lengkap lansia wajib diisi.');
      return;
    }

    const cleanCode = tokenCode.trim().toUpperCase();
    const fullToken = tokenInput.trim().toUpperCase() || (cleanCode ? `HUAWEI-ECA-${cleanCode}` : '');
    if (!fullToken) {
      setErrorMsg('Token smartwatch tidak valid.');
      return;
    }

    setLoading(true);
    setErrorMsg(null);
    try {
      const session = await pairDevice({
        token: fullToken,
        patientName: patientName.trim(),
        age: Number(age) || 70,
        gender: gender,
        conditionSummary: conditionSummary.trim() || 'Kondisi kesehatan stabil dalam pemantauan rutin.',
      });
      onSuccess(session);
      onClose();
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Gagal menghubungkan jam tangan.');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickDemo = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const session = await pairDevice({
        token: 'HUAWEI-ECA-8821',
        patientName: 'Opa Budi Santoso',
        age: 71,
        gender: 'MALE',
        conditionSummary: 'Hipertensi terkontrol dengan Amlodipine 5mg. Riwayat pusing ringan saat posisi tidur ke berdiri.',
        isDemo: true,
      });
      setTokenCode('8821');
      setTokenInput('HUAWEI-ECA-8821');
      onSuccess(session);
      onClose();
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Gagal memuat akun demo.');
    } finally {
      setLoading(false);
    }
  };

  const containerClass = isFullScreen
    ? 'min-h-screen w-full flex flex-col items-center justify-center bg-[#F6F7F9] p-4 select-none font-sans'
    : 'fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 select-none font-sans animate-fadeIn';

  return (
    <>
      <div className={containerClass}>
        {/* Brand Header */}
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

        {/* Modal Card */}
        <div className="bg-white border-2 border-neutral-900 w-full max-w-md rounded-none shadow-2xl overflow-hidden">
          {/* Header Card */}
          <div className="bg-neutral-900 text-white p-5 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-white text-neutral-900 flex items-center justify-center font-black text-sm">
                ECA
              </div>
              <div>
                <h2 className="text-base font-bold tracking-tight">
                  {step === 'scan' ? 'Pairing Smartwatch Lansia' : 'Konfigurasi Profil Lansia'}
                </h2>
                <p className="text-[11px] text-neutral-400">
                  {step === 'scan'
                    ? 'Pindai QR Code atau masukkan 4 digit kode jam tangan'
                    : 'Lengkapi profil lansia yang akan dipantau'}
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

            {/* ================= STEP 1: SCAN / INPUT TOKEN ================= */}
            {step === 'scan' && (
              <>
                {/* Tombol Scan QR Camera */}
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
                    Arahkan kamera ke layar OLED jam tangan di Wokwi
                  </p>
                </div>

                {/* Divider */}
                <div className="relative flex items-center justify-center">
                  <div className="border-t border-neutral-300 w-full" />
                  <span className="bg-white px-3 text-[10px] font-bold text-neutral-400 uppercase tracking-widest shrink-0">
                    Atau Masukkan Manual
                  </span>
                  <div className="border-t border-neutral-300 w-full" />
                </div>

                {/* Form Input Manual Token */}
                <form onSubmit={handleNextToConfig} className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-neutral-800 uppercase tracking-wider block">
                      Kode Token Smartwatch (4 Karakter)
                    </label>
                    <div className="flex gap-2">
                      <div className="flex-1 flex items-stretch border-2 border-neutral-300 focus-within:border-neutral-900 transition-colors bg-white">
                        <span className="px-3 py-2.5 bg-neutral-100 text-neutral-700 font-mono text-xs font-black border-r-2 border-neutral-300 select-none flex items-center shrink-0">
                          HUAWEI-ECA-
                        </span>
                        <input
                          type="text"
                          value={tokenCode}
                          onChange={(e) => {
                            let val = e.target.value.toUpperCase().replace(/\s+/g, '');
                            if (val.startsWith('HUAWEI-ECA-')) val = val.replace('HUAWEI-ECA-', '');
                            else if (val.startsWith('ECA-')) val = val.replace('ECA-', '');
                            val = val.replace(/[^A-Z0-9-]/g, '');
                            setTokenCode(val);
                            setTokenInput(val ? `HUAWEI-ECA-${val}` : '');
                          }}
                          placeholder="2730"
                          maxLength={8}
                          className="flex-1 px-3 py-2.5 text-sm font-mono font-black tracking-widest uppercase focus:outline-none placeholder:text-neutral-300"
                        />
                      </div>
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
                      Cukup masukkan 4 karakter di layar jam tangan (contoh: <strong>2730</strong> atau <strong>FE6B</strong>).
                    </p>
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-2.5 bg-neutral-900 hover:bg-neutral-800 disabled:bg-neutral-600 text-white text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer flex items-center justify-center gap-2"
                  >
                    <span>{loading ? 'Memeriksa & Menghubungkan...' : 'Lanjut / Masuk ke Dashboard →'}</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </form>

                {/* Quick Demo Section (1-Klik) */}
                <div className="pt-3 border-t border-neutral-200">
                  <span className="text-[11px] font-bold text-neutral-500 uppercase tracking-wider block mb-2">
                    Akses Cepat Pengujian:
                  </span>
                  <button
                    type="button"
                    onClick={handleQuickDemo}
                    disabled={loading}
                    className="w-full py-2.5 px-4 bg-neutral-50 border-2 border-neutral-300 hover:border-neutral-900 text-neutral-900 text-xs font-bold flex items-center justify-between transition-all cursor-pointer"
                  >
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      <span>Demo Bawaan: <strong>Opa Budi Santoso</strong></span>
                    </div>
                    <span className="text-[10px] bg-neutral-900 text-white px-2 py-0.5 uppercase">1-Klik</span>
                  </button>
                </div>
              </>
            )}

            {/* ================= STEP 2: KONFIGURASI PROFIL BARU ================= */}
            {step === 'configure' && (
              <form onSubmit={handleSaveProfile} className="space-y-4">
                {/* Badge Token Terhubung */}
                <div className="p-3 bg-neutral-100 border border-neutral-300 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Watch className="w-4 h-4 text-neutral-700" />
                    <div>
                      <span className="text-[10px] font-bold text-neutral-500 uppercase block">Smartwatch Terdeteksi</span>
                      <span className="font-mono text-xs font-black text-neutral-900">
                        {tokenInput || (tokenCode ? `HUAWEI-ECA-${tokenCode}` : 'HUAWEI-ECA-????')}
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setStep('scan')}
                    className="text-[11px] font-bold text-neutral-600 hover:text-neutral-900 flex items-center gap-1 cursor-pointer"
                  >
                    <ArrowLeft className="w-3 h-3" />
                    <span>Ganti</span>
                  </button>
                </div>

                {/* Input Nama Lengkap Lansia */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-neutral-800 uppercase tracking-wider flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5 text-neutral-700" />
                    <span>Nama Lengkap Lansia</span>
                    <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={patientName}
                    onChange={(e) => setPatientName(e.target.value)}
                    placeholder="Contoh: Oma Ratna Sari / Kakek Subagio"
                    className="w-full px-3.5 py-2.5 text-xs font-medium border-2 border-neutral-300 focus:border-neutral-900 focus:outline-none transition-colors"
                  />
                  <p className="text-[11px] text-neutral-500">
                    Nama ini akan dipakai oleh AI Companion saat menyapa secara ramah.
                  </p>
                </div>

                {/* Grid Usia & Jenis Kelamin */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-neutral-800 uppercase tracking-wider block">
                      Usia (Tahun)
                    </label>
                    <input
                      type="number"
                      min={40}
                      max={120}
                      value={age}
                      onChange={(e) => setAge(Number(e.target.value))}
                      className="w-full px-3.5 py-2 text-xs font-medium border-2 border-neutral-300 focus:border-neutral-900 focus:outline-none transition-colors"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-neutral-800 uppercase tracking-wider block">
                      Jenis Kelamin
                    </label>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setGender('MALE')}
                        className={`flex-1 py-2 text-xs font-bold border-2 cursor-pointer transition-colors ${
                          gender === 'MALE'
                            ? 'bg-neutral-900 text-white border-neutral-900'
                            : 'bg-white text-neutral-700 border-neutral-300 hover:border-neutral-500'
                        }`}
                      >
                        Laki-laki
                      </button>
                      <button
                        type="button"
                        onClick={() => setGender('FEMALE')}
                        className={`flex-1 py-2 text-xs font-bold border-2 cursor-pointer transition-colors ${
                          gender === 'FEMALE'
                            ? 'bg-neutral-900 text-white border-neutral-900'
                            : 'bg-white text-neutral-700 border-neutral-300 hover:border-neutral-500'
                        }`}
                      >
                        Perempuan
                      </button>
                    </div>
                  </div>
                </div>

                {/* Riwayat / Kondisi Medis */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-neutral-800 uppercase tracking-wider flex items-center gap-1.5">
                    <HeartPulse className="w-3.5 h-3.5 text-neutral-700" />
                    <span>Kondisi / Riwayat Medis</span>
                  </label>
                  <input
                    type="text"
                    value={conditionSummary}
                    onChange={(e) => setConditionSummary(e.target.value)}
                    placeholder="Contoh: Riwayat Hipertensi / Diabetes / Normal"
                    className="w-full px-3.5 py-2 text-xs border-2 border-neutral-300 focus:border-neutral-900 focus:outline-none transition-colors"
                  />
                  {/* Quick Chips */}
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {['Hipertensi', 'Diabetes', 'Jantung', 'Normal / Sehat'].map((chip) => (
                      <button
                        key={chip}
                        type="button"
                        onClick={() => setConditionSummary(chip)}
                        className="text-[10px] font-bold px-2 py-0.5 border border-neutral-300 bg-neutral-50 hover:bg-neutral-200 text-neutral-700 cursor-pointer"
                      >
                        + {chip}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Tombol Simpan & Masuk */}
                <div className="pt-2 flex gap-2">
                  <button
                    type="button"
                    onClick={() => setStep('scan')}
                    className="py-2.5 px-3 border-2 border-neutral-300 hover:border-neutral-900 text-neutral-800 text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer"
                  >
                    Kembali
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="flex-1 py-2.5 bg-neutral-900 hover:bg-neutral-800 text-white text-xs font-bold uppercase tracking-wider transition-colors disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2"
                  >
                    <span>{loading ? 'Menyimpan Profil...' : 'Simpan & Masuk Dashboard'}</span>
                    {!loading && <ArrowRight className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </form>
            )}

            {/* Footer Kepatuhan UU PDP */}
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

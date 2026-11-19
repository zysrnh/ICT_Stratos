import React, { useState, useEffect } from 'react';
import {
  X,
  CheckCircle2,
  ShieldCheck,
  AlertCircle,
  QrCode,
  Watch,
  Heart,
  Shield,
  Users,
  ArrowRight,
  UserCheck,
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
      setErrorMsg('Masukkan 4 karakter kode jam tangan atau pindai QR.');
      return;
    }
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

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!patientName.trim()) {
      setErrorMsg('Nama lengkap lansia wajib diisi.');
      return;
    }

    const cleanCode = tokenCode.trim().toUpperCase();
    const fullToken = tokenInput.trim().toUpperCase() || (cleanCode ? `HUAWEI-ECA-${cleanCode}` : '');
    if (!fullToken) {
      setErrorMsg('Kode jam tangan tidak valid.');
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
        conditionSummary:
          conditionSummary.trim() || 'Kondisi kesehatan stabil dalam pemantauan rutin.',
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
        conditionSummary:
          'Hipertensi terkontrol dengan Amlodipine 5mg. Riwayat pusing ringan saat posisi tidur ke berdiri.',
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

  // Kartu Form Login / Pairing (Dipakai baik Fullscreen maupun Modal popover)
  const renderCardContent = () => (
    <div className="w-full">
      {/* Header Kartu: Logo ELDERA Mini + Judul & Deskripsi */}
      <div className="flex items-start justify-between gap-3 mb-5">
        <div className="flex items-start gap-3.5">
          <div
            className="w-11 h-11 rounded-[14px] bg-gradient-to-tr from-[#EA580C] to-[#F97316] text-white flex items-center justify-center font-bold text-lg shadow-md shadow-orange-500/20 shrink-0"
            aria-hidden="true"
          >
            E
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[12px] font-bold tracking-wider text-[#EA580C] uppercase">
                ELDERA
              </span>
              <span className="text-[11px] px-2 py-0.5 rounded-full bg-orange-100/70 text-[#C2410C] font-medium">
                Healthcare
              </span>
            </div>
            <h1 id="pairing-title" className="text-xl font-semibold text-[#18181B] leading-snug mt-0.5">
              {step === 'scan' ? 'Hubungkan jam tangan' : 'Lengkapi profil lansia'}
            </h1>
            <p className="text-[13.5px] text-[#52525B] mt-1 leading-relaxed">
              {step === 'scan'
                ? 'Pindai QR di layar jam tangan atau masukkan 4 karakter kode perangkat.'
                : 'Isi data singkat agar keluarga dapat memantau kondisi dengan tepat.'}
            </p>
          </div>
        </div>

        {!isFullScreen && currentSession && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup jendela hubungkan jam"
            className="w-9 h-9 rounded-full text-[#52525B] hover:bg-[#F3F2EE] flex items-center justify-center shrink-0 cursor-pointer transition-colors -mt-1 -mr-1"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {errorMsg && (
        <div
          role="alert"
          className="mb-5 p-3.5 rounded-[14px] bg-[#FEF2F2] border border-[#FECACA] text-[#991B1B] text-[13.5px] flex items-start gap-2.5 animate-fadeIn"
        >
          <AlertCircle className="w-4 h-4 shrink-0 text-[#DC2626] mt-0.5" aria-hidden="true" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* ================= LANGKAH 1: PINDAI QR ATAU MASUKKAN KODE ================= */}
      {step === 'scan' && (
        <div className="space-y-4">
          {/* Tombol Primer: Pindai QR */}
          <button
            type="button"
            onClick={() => setIsScannerOpen(true)}
            className="w-full min-h-[48px] px-4 py-3 rounded-[14px] bg-[#18181B] hover:bg-[#27272A] text-white text-[15px] font-semibold flex items-center justify-center gap-2.5 shadow-sm hover:shadow-md transition-all cursor-pointer"
          >
            <QrCode className="w-[18px] h-[18px]" aria-hidden="true" />
            <span>Pindai QR</span>
          </button>

          {/* Pemisah "atau" */}
          <div className="relative flex items-center justify-center my-3" aria-hidden="true">
            <div className="border-t border-[#E5E3DD] w-full" />
            <span className="bg-white/80 px-3 text-[13px] text-[#71717A] shrink-0 font-medium">atau</span>
            <div className="border-t border-[#E5E3DD] w-full" />
          </div>

          {/* Input Kode 4 Karakter dengan Prefix Chip + Tombol Masuk */}
          <form onSubmit={handleNextToConfig} className="space-y-4">
            <div>
              <label
                htmlFor="watch-code-input"
                className="block text-[13.5px] font-medium text-[#18181B] mb-1.5"
              >
                Kode jam tangan
              </label>
              <div className="flex items-center gap-2 p-1.5 rounded-[14px] border border-[#E5E3DD] focus-within:border-[#EA580C] focus-within:ring-2 focus-within:ring-[#EA580C]/15 bg-white/95 transition-all shadow-inner-sm">
                <span className="hc-chip bg-[#F7F5F0] text-[#52525B] border border-[#E5E3DD] font-mono shrink-0 px-3 py-1.5 text-[12.5px]">
                  HUAWEI-ECA-
                </span>
                <input
                  id="watch-code-input"
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
                  className="flex-1 min-w-0 min-h-[38px] px-2 text-[15px] font-mono font-semibold text-[#18181B] placeholder:text-[#A1A1AA] focus:outline-none bg-transparent uppercase"
                />
                <Watch className="w-4 h-4 text-[#A1A1AA] mr-2 shrink-0" aria-hidden="true" />
              </div>
            </div>

            {/* Tombol CTA Masuk: Gradasi Oranye & Deep Blue */}
            <button
              type="submit"
              disabled={loading}
              className="w-full min-h-[48px] px-4 py-3 rounded-[14px] bg-gradient-to-r from-[#F97316] via-[#EA580C] to-[#1E3A8A] hover:opacity-95 text-white text-[15px] font-semibold flex items-center justify-center gap-2 shadow-[0_8px_20px_rgba(234,88,12,0.25)] hover:shadow-[0_10px_25px_rgba(234,88,12,0.35)] transition-all cursor-pointer disabled:opacity-50"
            >
              <span>{loading ? 'Memeriksa kode...' : 'Masuk'}</span>
              <ArrowRight className="w-4 h-4" aria-hidden="true" />
            </button>
          </form>

          {/* Opsi Demo: Tombol Hijau Lembut */}
          <div className="pt-3 border-t border-[#E5E3DD]/70">
            <button
              type="button"
              onClick={handleQuickDemo}
              disabled={loading}
              className="w-full min-h-[48px] px-4 py-3 rounded-[16px] bg-[#F0FDF4] hover:bg-[#DCFCE7] border border-[#BBF7D0] text-[#166534] text-[14px] flex items-center justify-between transition-colors cursor-pointer disabled:opacity-50 font-medium group"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-[#DCFCE7] text-[#15803D] flex items-center justify-center shrink-0 border border-[#86EFAC]/50">
                  <UserCheck className="w-4 h-4" aria-hidden="true" />
                </div>
                <div className="text-left">
                  <span className="font-semibold block text-[#15803D] leading-tight">Coba demo: Opa Budi</span>
                  <span className="text-[12px] text-[#166534]/75 block">Akses instan data telemetri</span>
                </div>
              </div>
              <CheckCircle2 className="w-4 h-4 text-[#16A34A] opacity-75 group-hover:opacity-100 transition-opacity" aria-hidden="true" />
            </button>
          </div>
        </div>
      )}

      {/* ================= LANGKAH 2: LENGKAPI PROFIL BARU ================= */}
      {step === 'configure' && (
        <form onSubmit={handleSaveProfile} className="space-y-4">
          <div className="p-3.5 rounded-[16px] bg-[#FAF9F7] border border-[#E5E3DD] flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-9 h-9 rounded-full bg-white border border-[#E5E3DD] flex items-center justify-center shrink-0">
                <Watch className="w-4 h-4 text-[#18181B]" aria-hidden="true" />
              </div>
              <div className="min-w-0">
                <span className="text-[12px] text-[#52525B] block">Kode perangkat</span>
                <span className="font-mono text-[14px] font-medium text-[#18181B] truncate block">
                  {tokenInput || (tokenCode ? `HUAWEI-ECA-${tokenCode}` : 'HUAWEI-ECA-????')}
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setStep('scan')}
              className="hc-btn-secondary px-3 py-1.5 text-[13px] shrink-0 cursor-pointer"
            >
              Ganti
            </button>
          </div>

          <div>
            <label
              htmlFor="elder-name-input"
              className="block text-[13.5px] font-medium text-[#18181B] mb-1.5"
            >
              Nama lengkap lansia <span className="text-[#DC2626]">*</span>
            </label>
            <input
              id="elder-name-input"
              type="text"
              required
              value={patientName}
              onChange={(e) => setPatientName(e.target.value)}
              placeholder="Contoh: Opa Budi Santoso"
              className="hc-input w-full px-3.5 py-2.5"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="elder-age-input"
                className="block text-[13.5px] font-medium text-[#18181B] mb-1.5"
              >
                Usia (tahun)
              </label>
              <input
                id="elder-age-input"
                type="number"
                min={40}
                max={120}
                value={age}
                onChange={(e) => setAge(Number(e.target.value))}
                className="hc-input w-full px-3.5 py-2.5"
              />
            </div>

            <div>
              <span className="block text-[13.5px] font-medium text-[#18181B] mb-1.5">
                Jenis kelamin
              </span>
              <div className="flex p-1 rounded-[12px] bg-[#F3F2EE] border border-[#E5E3DD]">
                <button
                  type="button"
                  onClick={() => setGender('MALE')}
                  className={`flex-1 min-h-[38px] text-[13px] rounded-[9px] transition-all cursor-pointer ${
                    gender === 'MALE'
                      ? 'bg-white text-[#18181B] font-semibold shadow-xs'
                      : 'text-[#52525B] font-medium'
                  }`}
                >
                  Laki-laki
                </button>
                <button
                  type="button"
                  onClick={() => setGender('FEMALE')}
                  className={`flex-1 min-h-[38px] text-[13px] rounded-[9px] transition-all cursor-pointer ${
                    gender === 'FEMALE'
                      ? 'bg-white text-[#18181B] font-semibold shadow-xs'
                      : 'text-[#52525B] font-medium'
                  }`}
                >
                  Perempuan
                </button>
              </div>
            </div>
          </div>

          <div>
            <label
              htmlFor="elder-condition-input"
              className="block text-[13.5px] font-medium text-[#18181B] mb-1.5"
            >
              Catatan kesehatan
            </label>
            <input
              id="elder-condition-input"
              type="text"
              value={conditionSummary}
              onChange={(e) => setConditionSummary(e.target.value)}
              placeholder="Contoh: Riwayat hipertensi ringan atau kondisi stabil"
              className="hc-input w-full px-3.5 py-2.5"
            />
            <div className="flex flex-wrap gap-2 mt-2.5">
              {['Hipertensi', 'Diabetes', 'Jantung', 'Kondisi stabil'].map((chip) => (
                <button
                  key={chip}
                  type="button"
                  onClick={() => setConditionSummary(chip)}
                  className="hc-chip min-h-[34px] bg-[#FAF9F7] hover:bg-[#F3F2EE] border border-[#E5E3DD] text-[#52525B] hover:text-[#18181B] cursor-pointer text-[12.5px]"
                >
                  + {chip}
                </button>
              ))}
            </div>
          </div>

          <div className="pt-2 flex items-center gap-3">
            <button
              type="button"
              onClick={() => setStep('scan')}
              className="hc-btn-secondary px-4 py-2.5 text-[14px] cursor-pointer"
            >
              Kembali
            </button>
            <button
              type="submit"
              disabled={loading}
              className="w-full min-h-[48px] px-4 py-2.5 rounded-[14px] bg-gradient-to-r from-[#F97316] via-[#EA580C] to-[#1E3A8A] hover:opacity-95 text-white font-semibold flex items-center justify-center gap-2 shadow-[0_8px_20px_rgba(234,88,12,0.25)] transition-all cursor-pointer disabled:opacity-50"
            >
              {loading ? 'Menyimpan...' : 'Simpan & Masuk'}
            </button>
          </div>
        </form>
      )}
    </div>
  );

  // ================= MODE 1: FULLSCREEN DESKTOP VIEW =================
  if (isFullScreen) {
    return (
      <div className="min-h-screen w-full relative flex flex-col justify-between bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-[#FFF9F3] via-[#FDF3EA] to-[#FCEEE2] text-[#18181B] overflow-x-hidden selection:bg-orange-100 selection:text-orange-900">
        {/* Ambient Lighting Orbs */}
        <div className="absolute -top-32 -left-32 w-96 h-96 bg-orange-200/35 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute top-1/3 -right-24 w-96 h-96 bg-amber-200/30 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 left-1/4 w-80 h-80 bg-rose-200/20 rounded-full blur-3xl pointer-events-none" />

        {/* Content Container */}
        <div className="relative z-10 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 lg:py-10 flex-1 flex flex-col justify-center">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-14 items-center">
            
            {/* SISI KIRI: Branding ELDERA + 3D Illustration & Emotional Micro-interactions */}
            <div className="lg:col-span-7 flex flex-col justify-center">
              {/* Logo & Tagline */}
              <div className="mb-5 sm:mb-6">
                <div className="inline-flex items-center gap-3 px-3.5 py-1.5 rounded-full bg-white/70 border border-white/80 shadow-xs backdrop-blur-md mb-3">
                  <div className="w-6 h-6 rounded-full bg-gradient-to-tr from-[#EA580C] to-[#F97316] flex items-center justify-center text-white text-[12px] font-bold">
                    E
                  </div>
                  <span className="text-[13px] font-semibold text-[#18181B] tracking-wide">
                    ELDERA
                  </span>
                  <span className="text-[11px] text-[#78716C] border-l border-[#E5E3DD] pl-2.5">
                    AI-Powered Ecosystem
                  </span>
                </div>

                <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-[#18181B] tracking-tight leading-[1.18]">
                  Bridging Distance, <br />
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#EA580C] via-[#F97316] to-[#1E3A8A]">
                    Protecting Lives.
                  </span>
                </h2>
                <p className="text-[15px] sm:text-[16px] text-[#52525B] mt-2.5 max-w-xl leading-relaxed">
                  Menghubungkan jam tangan lansia dengan kecerdasan buatan dan kasih sayang keluarga. Pemantauan biometrik realtime, deteksi darurat instan, dan pendampingan 24/7.
                </p>
              </div>

              {/* 3D Illustration Hero Container dengan Floating Micro-Badges */}
              <div className="relative rounded-[28px] overflow-hidden bg-white/50 border border-white/90 shadow-[0_24px_60px_rgba(234,88,12,0.10),0_4px_16px_rgba(0,0,0,0.03)] backdrop-blur-md p-2.5 sm:p-3.5 group">
                {/* Gambar 3D Hero Render */}
                <div className="relative rounded-[22px] overflow-hidden bg-gradient-to-b from-[#FFF5ED] to-[#FDE8D7]">
                  <img
                    src="/elderly-ai-companion.jpg"
                    alt="ELDERA: Kakek tersenyum bersama AI Companion dan memori keluarga"
                    className="w-full h-auto max-h-[380px] sm:max-h-[420px] object-cover rounded-[20px] transition-transform duration-700 ease-out group-hover:scale-[1.01]"
                  />

                  {/* Gradient Overlay Lembut di Bawah Gambar */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/25 via-transparent to-transparent pointer-events-none rounded-[20px]" />
                </div>

                {/* Floating Badge 1: Heartbeat Realtime (Kiri Atas) */}
                <div className="absolute top-6 left-6 backdrop-blur-md bg-white/90 border border-white/80 shadow-[0_8px_20px_rgba(0,0,0,0.06)] rounded-full py-1.5 px-3.5 flex items-center gap-2.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-[#DC2626] animate-pulse" />
                  <Heart className="w-4 h-4 text-[#DC2626]" aria-hidden="true" />
                  <span className="text-[13px] font-semibold text-[#18181B]">72 BPM</span>
                  <span className="text-[11px] font-semibold text-[#15803D] bg-[#F0FDF4] px-2 py-0.5 rounded-full border border-[#BBF7D0]">
                    Normal
                  </span>
                </div>

                {/* Floating Badge 2: Rumah Aman (Kanan Bawah) */}
                <div className="absolute bottom-6 right-6 backdrop-blur-md bg-white/90 border border-white/80 shadow-[0_8px_20px_rgba(0,0,0,0.06)] rounded-full py-1.5 px-3.5 flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-[#F0FDF4] text-[#15803D] flex items-center justify-center">
                    <Shield className="w-3.5 h-3.5" aria-hidden="true" />
                  </div>
                  <span className="text-[13px] font-semibold text-[#18181B]">Rumah Aman</span>
                  <span className="text-[11px] text-[#52525B]">Suhu 27°C</span>
                </div>

                {/* Floating Badge 3: Keluarga Terhubung (Kiri Bawah) */}
                <div className="absolute bottom-6 left-6 hidden sm:flex backdrop-blur-md bg-white/90 border border-white/80 shadow-[0_8px_20px_rgba(0,0,0,0.06)] rounded-full py-1.5 px-3.5 items-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-[#FFFBEB] text-[#D97706] flex items-center justify-center">
                    <Users className="w-3.5 h-3.5" aria-hidden="true" />
                  </div>
                  <span className="text-[12.5px] font-medium text-[#18181B]">
                    Keluarga Terhubung
                  </span>
                </div>
              </div>
            </div>

            {/* SISI KANAN: Floating Glassmorphism Login Card */}
            <div className="lg:col-span-5 flex flex-col justify-center">
              <div
                className="w-full max-w-md mx-auto backdrop-blur-xl bg-white/85 border border-white/80 shadow-[0_20px_50px_rgba(240,140,80,0.14),0_6px_20px_rgba(0,0,0,0.04)] rounded-[24px] p-6 sm:p-8 transition-all"
                style={{ backdropFilter: 'blur(20px)' }}
              >
                {renderCardContent()}
              </div>

              {/* Catatan UU PDP di Bawah Card */}
              <div className="mt-4 flex items-center justify-center gap-2 text-[13px] text-[#52525B] text-center">
                <ShieldCheck className="w-4 h-4 text-[#15803D] shrink-0" aria-hidden="true" />
                <span>Data pribadi terlindungi sesuai UU PDP No. 27/2022</span>
              </div>
            </div>

          </div>
        </div>

        {/* Footer Halaman (Sits Above Windows Taskbar) */}
        <footer className="relative z-10 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5 flex flex-col sm:flex-row items-center justify-between gap-2.5 text-[12.5px] text-[#78716C] border-t border-orange-200/40">
          <div className="flex items-center gap-2">
            <span>© 2026 ELDERA</span>
            <span className="text-gray-300">•</span>
            <span>Healthcare & Elderly Protection Ecosystem</span>
          </div>

          <div className="flex items-center gap-3">
            <span className="font-medium text-[#52525B]">by Team Stratos | LPKIA</span>
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/70 border border-orange-200/60 shadow-2xs">
              <span className="w-2 h-2 rounded-full bg-[#EA580C]" />
              <span className="font-semibold text-[11.5px] text-[#C2410C]">Huawei ICT Competition 2026</span>
            </div>
          </div>
        </footer>

        {/* Modal Pemindai Kamera */}
        <QrCameraScanner
          isOpen={isScannerOpen}
          onClose={() => setIsScannerOpen(false)}
          onScanSuccess={handleScanSuccess}
        />
      </div>
    );
  }

  // ================= MODE 2: POPOVER MODAL (Ganti Jam Tangan) =================
  return (
    <>
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-md p-4 sm:p-6 hc-fade-soft"
        role="dialog"
        aria-modal="true"
        aria-labelledby="pairing-title"
      >
        <div
          className="w-full max-w-md backdrop-blur-xl bg-white/95 border border-white/80 rounded-[24px] p-6 sm:p-7 shadow-[0_20px_50px_rgba(0,0,0,0.15)]"
        >
          {renderCardContent()}

          {/* Catatan UU PDP */}
          <p className="mt-4 flex items-center justify-center gap-2 text-[12.5px] text-[#52525B] text-center pt-3 border-t border-[#E5E3DD]/70">
            <ShieldCheck className="w-4 h-4 text-[#15803D] shrink-0" aria-hidden="true" />
            <span>Data pribadi terlindungi sesuai UU PDP No. 27/2022</span>
          </p>
        </div>
      </div>

      {/* Modal Pemindai Kamera */}
      <QrCameraScanner
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        onScanSuccess={handleScanSuccess}
      />
    </>
  );
};

export default LoginModal;

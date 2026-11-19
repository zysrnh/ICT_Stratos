import React, { useState, useEffect } from 'react';
import {
  X,
  ShieldCheck,
  AlertCircle,
  QrCode,
  Watch,
  ArrowRight,
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

  // Card Konten Login / Konfigurasi
  const renderCardContent = () => (
    <div className="w-full">
      {/* Header Kartu: Mark Minimalis + Judul & Subtitle */}
      <div className="flex items-start justify-between gap-3 mb-6">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <div
              className="w-7 h-7 rounded-lg bg-[#0F172A] text-white flex items-center justify-center font-semibold text-[13px] shrink-0"
              aria-hidden="true"
            >
              E
            </div>
            <span className="text-[12px] font-semibold tracking-wider text-[#0F172A] uppercase">
              ELDERA
            </span>
          </div>
          <h2 id="pairing-title" className="text-[19px] font-semibold tracking-tight text-[#0F172A] leading-snug">
            {step === 'scan' ? 'Hubungkan jam tangan' : 'Lengkapi profil lansia'}
          </h2>
          <p className="text-[13px] text-[#64748B] mt-1 leading-relaxed">
            {step === 'scan'
              ? 'Pindai QR di layar jam tangan atau masukkan 4 karakter kode perangkat.'
              : 'Isi data singkat agar keluarga dapat memantau kondisi dengan tepat.'}
          </p>
        </div>

        {!isFullScreen && currentSession && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup jendela hubungkan jam"
            className="w-8 h-8 rounded-lg text-[#64748B] hover:text-[#0F172A] hover:bg-[#F1F5F9] flex items-center justify-center shrink-0 cursor-pointer transition-colors -mt-1 -mr-1"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {errorMsg && (
        <div
          role="alert"
          className="mb-5 p-3 rounded-xl bg-[#FEF2F2] border border-[#FECACA] text-[#991B1B] text-[13px] flex items-start gap-2.5"
        >
          <AlertCircle className="w-4 h-4 shrink-0 text-[#DC2626] mt-0.5" aria-hidden="true" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* ================= LANGKAH 1: PINDAI QR ATAU MASUKKAN KODE ================= */}
      {step === 'scan' && (
        <div className="space-y-4">
          {/* Primary Action: Sleek Obsidian Button */}
          <button
            type="button"
            onClick={() => setIsScannerOpen(true)}
            className="w-full min-h-[44px] px-4 py-2.5 rounded-xl bg-[#111827] hover:bg-[#1F2937] text-white text-[14px] font-medium flex items-center justify-center gap-2.5 transition-colors cursor-pointer shadow-xs"
          >
            <QrCode className="w-4 h-4" aria-hidden="true" />
            <span>Pindai QR</span>
          </button>

          {/* Divider: Hairline tipis dengan teks muted "atau" */}
          <div className="relative flex items-center justify-center my-3" aria-hidden="true">
            <div className="border-t border-[#E5E7EB] w-full" />
            <span className="bg-white px-3 text-[12px] font-medium text-[#94A3B8] shrink-0">atau</span>
            <div className="border-t border-[#E5E7EB] w-full" />
          </div>

          {/* Input Kode 4 Karakter dengan Segmented Prefix + Tombol Masuk Emerald Teal */}
          <form onSubmit={handleNextToConfig} className="space-y-4">
            <div>
              <label
                htmlFor="watch-code-input"
                className="block text-[13px] font-medium text-[#334155] mb-1.5"
              >
                Kode jam tangan
              </label>
              <div className="flex items-center gap-2 p-1.5 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] focus-within:border-[#0F172A] focus-within:bg-white focus-within:ring-2 focus-within:ring-[#0F172A]/10 transition-all">
                <span className="px-2.5 py-1 rounded-lg bg-white border border-[#E2E8F0] font-mono text-[12px] font-semibold text-[#475569] shrink-0 shadow-2xs">
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
                  className="flex-1 min-w-0 min-h-[36px] px-1 text-[15px] font-mono font-medium text-[#0F172A] placeholder:text-[#94A3B8] focus:outline-none bg-transparent uppercase"
                />
                <Watch className="w-4 h-4 text-[#94A3B8] mr-2 shrink-0" aria-hidden="true" />
              </div>
            </div>

            {/* Submit Button: Solid Medical Teal (#0D9488) */}
            <button
              type="submit"
              disabled={loading}
              className="w-full min-h-[44px] px-4 py-2.5 rounded-xl bg-[#0D9488] hover:bg-[#0F766E] text-white text-[14px] font-medium flex items-center justify-center gap-2 transition-colors cursor-pointer disabled:opacity-50 shadow-xs"
            >
              <span>{loading ? 'Memeriksa kode...' : 'Masuk'}</span>
              <ArrowRight className="w-4 h-4" aria-hidden="true" />
            </button>
          </form>

          {/* Demo Button: Minimalist Ghost / Tinted Row dengan Status Dot Hijau */}
          <div className="pt-3 border-t border-[#E5E7EB]">
            <button
              type="button"
              onClick={handleQuickDemo}
              disabled={loading}
              className="w-full min-h-[42px] px-3.5 py-2 rounded-xl bg-[#F8FAFC] hover:bg-[#F1F5F9] border border-[#E2E8F0] text-[#334155] text-[13px] font-medium flex items-center justify-between transition-colors cursor-pointer disabled:opacity-50 group"
            >
              <div className="flex items-center gap-2.5">
                <span className="w-2 h-2 rounded-full bg-[#10B981]" />
                <span>Coba demo: Opa Budi</span>
              </div>
              <span className="text-[12px] text-[#64748B] group-hover:text-[#0F172A] transition-colors">
                Masuk langsung →
              </span>
            </button>
          </div>
        </div>
      )}

      {/* ================= LANGKAH 2: LENGKAPI PROFIL BARU ================= */}
      {step === 'configure' && (
        <form onSubmit={handleSaveProfile} className="space-y-4">
          <div className="p-3 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-lg bg-white border border-[#E2E8F0] flex items-center justify-center shrink-0">
                <Watch className="w-4 h-4 text-[#0F172A]" aria-hidden="true" />
              </div>
              <div className="min-w-0">
                <span className="text-[11.5px] text-[#64748B] block">Perangkat terdeteksi</span>
                <span className="font-mono text-[13.5px] font-medium text-[#0F172A] truncate block">
                  {tokenInput || (tokenCode ? `HUAWEI-ECA-${tokenCode}` : 'HUAWEI-ECA-????')}
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setStep('scan')}
              className="text-[12.5px] font-medium text-[#0D9488] hover:underline shrink-0 cursor-pointer"
            >
              Ganti
            </button>
          </div>

          <div>
            <label
              htmlFor="elder-name-input"
              className="block text-[13px] font-medium text-[#334155] mb-1.5"
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
              className="w-full min-h-[42px] px-3.5 rounded-xl border border-[#E2E8F0] bg-white text-[14px] text-[#0F172A] placeholder:text-[#94A3B8] focus:outline-none focus:border-[#0F172A] focus:ring-2 focus:ring-[#0F172A]/10 transition-all"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label
                htmlFor="elder-age-input"
                className="block text-[13px] font-medium text-[#334155] mb-1.5"
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
                className="w-full min-h-[42px] px-3.5 rounded-xl border border-[#E2E8F0] bg-white text-[14px] text-[#0F172A] focus:outline-none focus:border-[#0F172A] focus:ring-2 focus:ring-[#0F172A]/10 transition-all"
              />
            </div>

            <div>
              <span className="block text-[13px] font-medium text-[#334155] mb-1.5">
                Jenis kelamin
              </span>
              <div className="flex p-1 rounded-xl bg-[#F1F5F9] border border-[#E2E8F0]">
                <button
                  type="button"
                  onClick={() => setGender('MALE')}
                  className={`flex-1 min-h-[34px] text-[13px] rounded-lg transition-all cursor-pointer ${
                    gender === 'MALE'
                      ? 'bg-white text-[#0F172A] font-semibold shadow-2xs'
                      : 'text-[#64748B] font-medium'
                  }`}
                >
                  Laki-laki
                </button>
                <button
                  type="button"
                  onClick={() => setGender('FEMALE')}
                  className={`flex-1 min-h-[34px] text-[13px] rounded-lg transition-all cursor-pointer ${
                    gender === 'FEMALE'
                      ? 'bg-white text-[#0F172A] font-semibold shadow-2xs'
                      : 'text-[#64748B] font-medium'
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
              className="block text-[13px] font-medium text-[#334155] mb-1.5"
            >
              Catatan kesehatan
            </label>
            <input
              id="elder-condition-input"
              type="text"
              value={conditionSummary}
              onChange={(e) => setConditionSummary(e.target.value)}
              placeholder="Contoh: Riwayat hipertensi ringan atau kondisi stabil"
              className="w-full min-h-[42px] px-3.5 rounded-xl border border-[#E2E8F0] bg-white text-[14px] text-[#0F172A] placeholder:text-[#94A3B8] focus:outline-none focus:border-[#0F172A] focus:ring-2 focus:ring-[#0F172A]/10 transition-all"
            />
            <div className="flex flex-wrap gap-1.5 mt-2">
              {['Hipertensi', 'Diabetes', 'Jantung', 'Kondisi stabil'].map((chip) => (
                <button
                  key={chip}
                  type="button"
                  onClick={() => setConditionSummary(chip)}
                  className="px-2.5 py-1 rounded-lg bg-[#F8FAFC] hover:bg-[#F1F5F9] border border-[#E2E8F0] text-[#64748B] hover:text-[#0F172A] text-[12px] font-medium transition-colors cursor-pointer"
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
              className="px-4 py-2.5 rounded-xl border border-[#E2E8F0] bg-white hover:bg-[#F8FAFC] text-[13.5px] font-medium text-[#334155] transition-colors cursor-pointer"
            >
              Kembali
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 min-h-[44px] px-4 py-2.5 rounded-xl bg-[#0D9488] hover:bg-[#0F766E] text-white text-[14px] font-medium flex items-center justify-center gap-2 transition-colors cursor-pointer disabled:opacity-50 shadow-xs"
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
      <div className="min-h-screen w-full relative flex flex-col justify-between bg-[#FAFAFA] bg-dot-grid text-[#0F172A] overflow-x-hidden">
        {/* Subtle top hairline accent */}
        <div className="h-[2px] w-full bg-[#E2E8F0]" />

        {/* Main Split-Screen Container */}
        <main className="w-full max-w-7xl mx-auto px-6 sm:px-8 lg:px-12 py-10 sm:py-16 lg:py-20 flex-1 flex flex-col justify-center">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-center">
            
            {/* SISI KIRI: Editorial & Minimalist (Apple Health / Linear Style) */}
            <div className="lg:col-span-7 flex flex-col justify-between space-y-10 sm:space-y-12">
              <div className="space-y-6">
                {/* Pill Badge */}
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white border border-[#E2E8F0] shadow-2xs text-[12px] font-medium text-[#475569] w-fit">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#0D9488]" />
                  <span>ELDERA • AI-Powered Ecosystem</span>
                </div>

                {/* Tight-tracked Display Headline */}
                <h1 className="text-4xl sm:text-5xl lg:text-[54px] font-semibold tracking-[-0.035em] leading-[1.12] text-[#0F172A]">
                  Bridging Distance, <br />
                  <span className="text-[#64748B]">Protecting Lives.</span>
                </h1>

                {/* Short, crisp 2-line subtitle */}
                <p className="text-[16px] sm:text-[17px] text-[#475569] max-w-xl leading-relaxed font-normal">
                  Continuous biometric telemetry and home safety intelligence, engineered to keep families connected and elders protected with silent confidence.
                </p>
              </div>

              {/* Minimalist Live-Status Strip */}
              <div className="pt-8 border-t border-[#E2E8F0]">
                <div className="text-[11.5px] uppercase tracking-wider font-semibold text-[#94A3B8] mb-3.5">
                  Live Telemetry Network
                </div>
                <div className="flex flex-wrap items-center gap-2.5">
                  <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white border border-[#E2E8F0] shadow-2xs text-[13px] font-medium text-[#1E293B]">
                    <span className="w-2 h-2 rounded-full bg-[#10B981] animate-pulse" />
                    <span>72 BPM • Normal</span>
                  </div>
                  <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white border border-[#E2E8F0] shadow-2xs text-[13px] font-medium text-[#1E293B]">
                    <span className="w-2 h-2 rounded-full bg-[#64748B]" />
                    <span>Home Node • 27°C</span>
                  </div>
                  <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white border border-[#E2E8F0] shadow-2xs text-[13px] font-medium text-[#1E293B]">
                    <span className="w-2 h-2 rounded-full bg-[#0D9488]" />
                    <span>24/7 AI Sentinel</span>
                  </div>
                </div>
              </div>
            </div>

            {/* SISI KANAN: Focused Pure White Login Card (#FFFFFF) */}
            <div className="lg:col-span-5 flex flex-col justify-center">
              <div className="w-full max-w-[420px] mx-auto bg-white border border-[#E5E7EB] rounded-2xl p-6 sm:p-8 shadow-sm">
                {renderCardContent()}
              </div>
            </div>

          </div>
        </main>

        {/* Ultra-minimal Single-Line Footer */}
        <footer className="w-full max-w-7xl mx-auto px-6 sm:px-8 lg:px-12 py-5 flex flex-col sm:flex-row items-center justify-between gap-3 text-[12.5px] text-[#64748B] border-t border-[#E5E7EB]">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-[#0D9488]" aria-hidden="true" />
            <span>Data pribadi terlindungi sesuai UU PDP No. 27/2022</span>
          </div>

          <div className="flex items-center gap-3">
            <span>Team Stratos • LPKIA</span>
            <span className="text-[#CBD5E1]">•</span>
            <span className="font-medium text-[#475569]">Huawei ICT Competition 2026</span>
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
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 backdrop-blur-[2px] p-4 sm:p-6"
        role="dialog"
        aria-modal="true"
        aria-labelledby="pairing-title"
      >
        <div className="w-full max-w-[420px] bg-white border border-[#E5E7EB] rounded-2xl p-6 sm:p-7 shadow-lg">
          {renderCardContent()}

          <p className="mt-4 flex items-center justify-center gap-2 text-[12px] text-[#64748B] text-center pt-3 border-t border-[#E5E7EB]">
            <ShieldCheck className="w-3.5 h-3.5 text-[#0D9488] shrink-0" aria-hidden="true" />
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

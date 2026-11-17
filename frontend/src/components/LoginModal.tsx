import React, { useState, useEffect } from 'react';
import {
  X,
  CheckCircle2,
  ShieldCheck,
  AlertCircle,
  QrCode,
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

  const containerClass = isFullScreen
    ? 'min-h-screen w-full flex flex-col items-center justify-center bg-[#F7F6F3] p-4 sm:p-6'
    : 'fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-[2px] p-4 sm:p-6 hc-fade-soft';

  return (
    <>
      <div className={containerClass} role="dialog" aria-modal="true" aria-labelledby="pairing-title">
        {/* Satu Card Putih Lembut */}
        <div
          className="w-full max-w-md bg-white border border-[#E5E3DD] rounded-[20px] p-6 sm:p-7"
          style={{ boxShadow: 'var(--shadow-card)' }}
        >
          {/* Header: Satu Logo + Satu Judul + 1 Kalimat */}
          <div className="flex items-start justify-between gap-3 mb-6">
            <div className="flex items-start gap-3.5">
              <div
                className="w-11 h-11 rounded-[14px] bg-[#18181B] text-white flex items-center justify-center font-semibold text-base shrink-0"
                aria-hidden="true"
              >
                H.
              </div>
              <div>
                <h1 id="pairing-title" className="text-xl font-semibold text-[#18181B] leading-snug">
                  {step === 'scan' ? 'Hubungkan jam tangan' : 'Lengkapi profil lansia'}
                </h1>
                <p className="text-[14px] text-[#52525B] mt-1 leading-relaxed">
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
                className="w-11 h-11 rounded-full text-[#52525B] hover:bg-[#F3F2EE] flex items-center justify-center shrink-0 cursor-pointer transition-colors -mt-1 -mr-1"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>

          {errorMsg && (
            <div
              role="alert"
              className="mb-5 p-3.5 rounded-[12px] bg-[#FEF2F2] border border-[#FECACA] text-[#991B1B] text-[14px] flex items-start gap-2.5"
            >
              <AlertCircle className="w-4 h-4 shrink-0 text-[#DC2626] mt-0.5" aria-hidden="true" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* ================= LANGKAH 1: PINDAI QR ATAU MASUKKAN KODE ================= */}
          {step === 'scan' && (
            <div className="space-y-5">
              {/* Tombol Primer: Pindai QR */}
              <button
                type="button"
                onClick={() => setIsScannerOpen(true)}
                className="hc-btn-primary w-full px-4 py-3 text-[15px] flex items-center justify-center gap-2.5 cursor-pointer"
              >
                <QrCode className="w-[18px] h-[18px]" aria-hidden="true" />
                <span>Pindai QR</span>
              </button>

              {/* Pemisah "atau" */}
              <div className="relative flex items-center justify-center" aria-hidden="true">
                <div className="border-t border-[#E5E3DD] w-full" />
                <span className="bg-white px-3 text-[13px] text-[#71717A] shrink-0">atau</span>
                <div className="border-t border-[#E5E3DD] w-full" />
              </div>

              {/* Input Kode 4 Karakter dengan Prefix Chip + Tombol Masuk */}
              <form onSubmit={handleNextToConfig} className="space-y-4">
                <div>
                  <label
                    htmlFor="watch-code-input"
                    className="block text-[14px] font-medium text-[#18181B] mb-2"
                  >
                    Kode jam tangan
                  </label>
                  <div className="flex items-center gap-2 p-1.5 rounded-[12px] border border-[#E5E3DD] focus-within:border-[#18181B] focus-within:ring-2 focus-within:ring-[#18181B]/10 bg-white transition-all">
                    <span className="hc-chip bg-[#F3F2EE] text-[#52525B] border border-[#E5E3DD] font-mono shrink-0 px-3 py-1.5">
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
                      className="flex-1 min-w-0 min-h-[38px] px-2 text-base font-mono font-medium text-[#18181B] placeholder:text-[#A1A1AA] focus:outline-none bg-transparent uppercase"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className={`w-full px-4 py-3 text-[15px] cursor-pointer disabled:opacity-50 flex items-center justify-center ${
                    tokenCode.trim() ? 'hc-btn-primary' : 'hc-btn-secondary'
                  }`}
                >
                  {loading ? 'Memeriksa kode...' : 'Masuk'}
                </button>
              </form>

              {/* Kartu Sekunder Kecil: Coba Demo */}
              <div className="pt-4 border-t border-[#E5E3DD]">
                <button
                  type="button"
                  onClick={handleQuickDemo}
                  disabled={loading}
                  className="w-full min-h-[48px] px-4 py-3 rounded-[16px] bg-[#FAF9F7] hover:bg-[#F3F2EE] border border-[#E5E3DD] text-[#18181B] text-[14px] flex items-center gap-3 transition-colors cursor-pointer disabled:opacity-50"
                >
                  <div className="w-8 h-8 rounded-full bg-[#F0FDF4] text-[#15803D] flex items-center justify-center shrink-0">
                    <CheckCircle2 className="w-4 h-4" aria-hidden="true" />
                  </div>
                  <span className="font-medium">Coba demo: Opa Budi</span>
                </button>
              </div>
            </div>
          )}

          {/* ================= LANGKAH 2: LENGKAPI PROFIL BARU ================= */}
          {step === 'configure' && (
            <form onSubmit={handleSaveProfile} className="space-y-4">
              {/* Token Terdeteksi */}
              <div className="p-3.5 rounded-[16px] bg-[#FAF9F7] border border-[#E5E3DD] flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-full bg-white border border-[#E5E3DD] flex items-center justify-center shrink-0">
                    <Watch className="w-4 h-4 text-[#18181B]" aria-hidden="true" />
                  </div>
                  <div className="min-w-0">
                    <span className="text-[13px] text-[#52525B] block">Kode perangkat</span>
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

              {/* Nama Lengkap Lansia */}
              <div>
                <label
                  htmlFor="elder-name-input"
                  className="block text-[14px] font-medium text-[#18181B] mb-1.5"
                >
                  Nama lengkap lansia <span className="text-[#DC2626]">*</span>
                </label>
                <input
                  id="elder-name-input"
                  type="text"
                  required
                  value={patientName}
                  onChange={(e) => setPatientName(e.target.value)}
                  placeholder="Contoh: Oma Ratna Sari"
                  className="hc-input w-full px-3.5 py-2.5"
                />
              </div>

              {/* Usia & Jenis Kelamin */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label
                    htmlFor="elder-age-input"
                    className="block text-[14px] font-medium text-[#18181B] mb-1.5"
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
                  <span className="block text-[14px] font-medium text-[#18181B] mb-1.5">
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

              {/* Kondisi Kesehatan */}
              <div>
                <label
                  htmlFor="elder-condition-input"
                  className="block text-[14px] font-medium text-[#18181B] mb-1.5"
                >
                  Catatan kesehatan
                </label>
                <input
                  id="elder-condition-input"
                  type="text"
                  value={conditionSummary}
                  onChange={(e) => setConditionSummary(e.target.value)}
                  placeholder="Contoh: Riwayat hipertensi atau kondisi stabil"
                  className="hc-input w-full px-3.5 py-2.5"
                />
                <div className="flex flex-wrap gap-2 mt-2.5">
                  {['Hipertensi', 'Diabetes', 'Jantung', 'Kondisi stabil'].map((chip) => (
                    <button
                      key={chip}
                      type="button"
                      onClick={() => setConditionSummary(chip)}
                      className="hc-chip min-h-[36px] bg-[#FAF9F7] hover:bg-[#F3F2EE] border border-[#E5E3DD] text-[#52525B] hover:text-[#18181B] cursor-pointer"
                    >
                      + {chip}
                    </button>
                  ))}
                </div>
              </div>

              {/* Tombol Aksi */}
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
                  className="hc-btn-primary flex-1 px-4 py-2.5 text-[15px] disabled:opacity-50 cursor-pointer"
                >
                  {loading ? 'Menyimpan...' : 'Simpan & masuk'}
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Catatan UU PDP Satu Baris Tenang di Bawah Card */}
        <p className="mt-4 flex items-center justify-center gap-2 text-[13px] text-[#52525B] text-center">
          <ShieldCheck className="w-4 h-4 text-[#15803D] shrink-0" aria-hidden="true" />
          <span>Data pribadi terlindungi sesuai UU PDP No. 27/2022</span>
        </p>
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

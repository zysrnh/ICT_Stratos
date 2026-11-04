import React, { useState, useEffect } from 'react';
import { Watch, KeyRound, UserPlus, LogIn, X, CheckCircle2, ShieldCheck, AlertCircle } from 'lucide-react';
import { loginAuth, pairDevice, registerDevice } from '../services/api';
import type { AuthSession } from '../types/telemetry';

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
  const [tab, setTab] = useState<'PAIR' | 'REGISTER' | 'LOGIN'>('PAIR');
  const [tokenInput, setTokenInput] = useState('');
  const [patientName, setPatientName] = useState('');
  const [username, setUsername] = useState('rully');
  const [password, setPassword] = useState('demo123');

  // Form Register Mandiri
  const [regToken, setRegToken] = useState(`ECA-${Math.floor(1000 + Math.random() * 9000)}`);
  const [regName, setRegName] = useState('');
  const [regRoom, setRegRoom] = useState('Kamar Lansia');

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Auto-detect token dari URL parameter (?pair=... atau ?token=...)
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

  const handlePairSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tokenInput.trim()) {
      setErrorMsg('Masukkan Token ID Jam Tangan.');
      return;
    }
    setLoading(true);
    setErrorMsg(null);
    try {
      const session = await pairDevice(tokenInput.trim(), patientName.trim() || undefined);
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
      const session = await pairDevice('HUAWEI-ECA-8821', 'Opa Budi Santoso');
      onSuccess(session);
      onClose();
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Gagal menghubungkan demo Opa Budi.');
    } finally {
      setLoading(false);
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!regToken.trim() || !regName.trim()) {
      setErrorMsg('ID Token dan Nama Lansia wajib diisi.');
      return;
    }
    setLoading(true);
    setErrorMsg(null);
    try {
      const session = await registerDevice({
        device_token: regToken.trim().toUpperCase(),
        patient_name: regName.trim(),
        room_number: regRoom.trim(),
      });
      onSuccess(session);
      onClose();
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Gagal mendaftarkan jam tangan baru.');
    } finally {
      setLoading(false);
    }
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg(null);
    try {
      const session = await loginAuth({ username, password });
      onSuccess(session);
      onClose();
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Username atau password salah.');
    } finally {
      setLoading(false);
    }
  };

  const containerClass = isFullScreen
    ? 'min-h-screen w-full flex flex-col items-center justify-center bg-[#F6F7F9] p-4 select-none'
    : 'fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 select-none animate-fadeIn';

  return (
    <div className={containerClass}>
      {isFullScreen && (
        <div className="mb-6 flex flex-col items-center text-center">
          <div className="flex items-center gap-2 mb-2">
            <span className="w-8 h-8 bg-[#111111] text-white flex items-center justify-center font-black text-sm">
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
      )}

      <div className="bg-white border-2 border-neutral-900 w-full max-w-lg rounded-none shadow-2xl overflow-hidden">
        {/* Header Modal - Flat Solid Monochrome */}
        <div className="bg-neutral-900 text-white p-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-white text-neutral-900 flex items-center justify-center font-black text-sm">
              ECA
            </div>
            <div>
              <h2 className="text-base font-bold tracking-tight">
                Pairing Perangkat & Akses Ekosistem
              </h2>
              <p className="text-[11px] text-neutral-400">
                Sistem Autentikasi & Pemantauan Multi-Device
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

        {/* Tab Selector - Flat Tabs */}
        <div className="grid grid-cols-3 border-b-2 border-neutral-900 bg-neutral-100 text-xs font-bold">
          <button
            onClick={() => {
              setTab('PAIR');
              setErrorMsg(null);
            }}
            className={`py-3 px-2 flex items-center justify-center gap-2 border-r border-neutral-300 transition-colors cursor-pointer ${
              tab === 'PAIR'
                ? 'bg-white text-neutral-900 border-b-2 border-b-white -mb-[2px]'
                : 'text-neutral-600 hover:bg-neutral-200/70'
            }`}
          >
            <Watch className="w-3.5 h-3.5" />
            <span>Pair ID Jam</span>
          </button>

          <button
            onClick={() => {
              setTab('REGISTER');
              setErrorMsg(null);
            }}
            className={`py-3 px-2 flex items-center justify-center gap-2 border-r border-neutral-300 transition-colors cursor-pointer ${
              tab === 'REGISTER'
                ? 'bg-white text-neutral-900 border-b-2 border-b-white -mb-[2px]'
                : 'text-neutral-600 hover:bg-neutral-200/70'
            }`}
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>Daftar Baru</span>
          </button>

          <button
            onClick={() => {
              setTab('LOGIN');
              setErrorMsg(null);
            }}
            className={`py-3 px-2 flex items-center justify-center gap-2 transition-colors cursor-pointer ${
              tab === 'LOGIN'
                ? 'bg-white text-neutral-900 border-b-2 border-b-white -mb-[2px]'
                : 'text-neutral-600 hover:bg-neutral-200/70'
            }`}
          >
            <KeyRound className="w-3.5 h-3.5" />
            <span>Login Keluarga</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-4">
          {errorMsg && (
            <div className="p-3 bg-red-50 border border-red-500 text-red-700 text-xs flex items-center gap-2 font-medium">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* TAB 1: PAIR TOKEN JAM TANGAN */}
          {tab === 'PAIR' && (
            <form onSubmit={handlePairSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-neutral-800 uppercase tracking-wider block">
                  Token ID Smartwatch
                </label>
                <input
                  type="text"
                  value={tokenInput}
                  onChange={(e) => setTokenInput(e.target.value.toUpperCase())}
                  placeholder="Contoh: HUAWEI-ECA-8821 atau kode dari Wokwi"
                  className="w-full px-3.5 py-2.5 text-sm font-mono border-2 border-neutral-300 focus:border-neutral-900 focus:outline-none transition-colors"
                  required
                />
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
                  placeholder="Misal: Kakek Hendra / Oma Siti"
                  className="w-full px-3.5 py-2 text-xs border-2 border-neutral-300 focus:border-neutral-900 focus:outline-none transition-colors"
                />
                <p className="text-[11px] text-neutral-500">
                  Jika jam tangan ini baru, profil dengan nama ini akan otomatis dibuatkan dan diingat di Chrome.
                </p>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 bg-neutral-900 text-white text-xs font-bold uppercase tracking-wider hover:bg-neutral-800 transition-colors disabled:opacity-50 cursor-pointer"
              >
                {loading ? 'Menghubungkan Perangkat...' : 'Hubungkan & Mulai Pantau'}
              </button>

              {/* Quick Demo Section */}
              <div className="pt-3 border-t border-neutral-200">
                <span className="text-[11px] font-bold text-neutral-500 uppercase tracking-wider block mb-2">
                  Akses Cepat Pengujian:
                </span>
                <button
                  type="button"
                  onClick={handleQuickDemo}
                  disabled={loading}
                  className="w-full py-2.5 px-4 bg-neutral-100 border-2 border-neutral-400 hover:border-neutral-900 text-neutral-900 text-xs font-bold flex items-center justify-between transition-all cursor-pointer"
                >
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>Gunakan Token Demo: <strong>HUAWEI-ECA-8821</strong> (Opa Budi Santoso)</span>
                  </div>
                  <span className="text-[10px] bg-neutral-900 text-white px-2 py-0.5 uppercase">1-Klik</span>
                </button>
              </div>
            </form>
          )}

          {/* TAB 2: DAFTAR JAM TANGAN / PASIEN BARU */}
          {tab === 'REGISTER' && (
            <form onSubmit={handleRegisterSubmit} className="space-y-3">
              <div className="p-3 bg-neutral-50 border border-neutral-200 text-[11px] text-neutral-600">
                <span className="font-bold text-neutral-900 block mb-1">Mencegah Tabrakan Data Saat Hosting:</span>
                Daftarkan Token ID baru untuk Wokwi Anda. Dashboard akan mengunci data hanya untuk ID ini, sehingga sesi pengujian lain tidak akan mencampuri telemetri Anda.
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold text-neutral-800 uppercase">
                  Token ID Jam Baru (Bebas / Auto)
                </label>
                <input
                  type="text"
                  value={regToken}
                  onChange={(e) => setRegToken(e.target.value.toUpperCase())}
                  className="w-full px-3 py-2 text-xs font-mono border-2 border-neutral-300 focus:border-neutral-900 focus:outline-none"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold text-neutral-800 uppercase">
                  Nama Lansia / Pasien
                </label>
                <input
                  type="text"
                  placeholder="Misal: Oma Siti Rahma"
                  value={regName}
                  onChange={(e) => setRegName(e.target.value)}
                  className="w-full px-3 py-2 text-xs border-2 border-neutral-300 focus:border-neutral-900 focus:outline-none"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold text-neutral-800 uppercase">
                  Nomor / Lokasi Kamar
                </label>
                <input
                  type="text"
                  value={regRoom}
                  onChange={(e) => setRegRoom(e.target.value)}
                  className="w-full px-3 py-2 text-xs border-2 border-neutral-300 focus:border-neutral-900 focus:outline-none"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 bg-neutral-900 text-white text-xs font-bold uppercase tracking-wider hover:bg-neutral-800 transition-colors disabled:opacity-50 cursor-pointer mt-2"
              >
                {loading ? 'Mendaftarkan Perangkat...' : 'Daftarkan & Langsung Hubungkan'}
              </button>
            </form>
          )}

          {/* TAB 3: LOGIN KELUARGA (KREDENSIAL) */}
          {tab === 'LOGIN' && (
            <form onSubmit={handleLoginSubmit} className="space-y-3">
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-neutral-800 uppercase">
                  Username Akun Keluarga
                </label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full px-3 py-2 text-xs border-2 border-neutral-300 focus:border-neutral-900 focus:outline-none"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold text-neutral-800 uppercase">
                  Password
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-3 py-2 text-xs border-2 border-neutral-300 focus:border-neutral-900 focus:outline-none"
                  required
                />
              </div>

              <div className="p-2.5 bg-neutral-100 text-[11px] text-neutral-600">
                Akun demo default: <code className="font-bold text-neutral-900">rully</code> / <code className="font-bold text-neutral-900">demo123</code>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 bg-neutral-900 text-white text-xs font-bold uppercase tracking-wider hover:bg-neutral-800 transition-colors disabled:opacity-50 cursor-pointer"
              >
                <span className="flex items-center justify-center gap-2">
                  <LogIn className="w-3.5 h-3.5" />
                  {loading ? 'Memverifikasi...' : 'Masuk Dashboard'}
                </span>
              </button>
            </form>
          )}

          {/* Footer Info */}
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
  );
};

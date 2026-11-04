import React, { useEffect, useRef, useState } from 'react';
import { Upload, X, AlertCircle, RefreshCw, SwitchCamera } from 'lucide-react';

declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    jsQR?: (data: Uint8ClampedArray, width: number, height: number) => { data: string } | null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    BarcodeDetector?: any;
  }
}

interface QrCameraScannerProps {
  isOpen: boolean;
  onClose: () => void;
  onScanSuccess: (token: string) => void;
}

export const QrCameraScanner: React.FC<QrCameraScannerProps> = ({
  isOpen,
  onClose,
  onScanSuccess,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [cameraActive, setCameraActive] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');

  // Parse QR content (bisa berupa teks token murni atau URL 'https://...?pair=...')
  const parseTokenFromRaw = (raw: string): string => {
    const text = raw.trim();
    if (text.includes('?')) {
      try {
        const url = new URL(text);
        const pair = url.searchParams.get('pair') || url.searchParams.get('token');
        if (pair) return pair.trim().toUpperCase();
      } catch {
        const match = text.match(/(?:pair|token)=([A-Za-z0-9\-_]+)/i);
        if (match && match[1]) return match[1].toUpperCase();
      }
    }
    return text.toUpperCase();
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      setStream(null);
    }
    setCameraActive(false);
  };

  // Toggle antara Kamera Belakang (environment) dan Kamera Depan (user)
  const toggleFacingMode = () => {
    stopCamera();
    setFacingMode((prev) => (prev === 'environment' ? 'user' : 'environment'));
  };

  // Inisialisasi Kamera saat modal dibuka atau facingMode berubah
  useEffect(() => {
    if (!isOpen) {
      stopCamera();
      return;
    }

    let isMounted = true;
    let localStream: MediaStream | null = null;

    const startCamera = async () => {
      setErrorMsg(null);
      setCameraActive(false);
      try {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          throw new Error('Browser tidak mendukung akses kamera langsung.');
        }

        localStream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: facingMode },
            width: { ideal: 640 },
            height: { ideal: 480 },
          },
          audio: false,
        });

        if (!isMounted) {
          localStream.getTracks().forEach((t) => t.stop());
          return;
        }

        setStream(localStream);
        if (videoRef.current) {
          videoRef.current.srcObject = localStream;
          await videoRef.current.play();
          setCameraActive(true);
        }
      } catch (err: unknown) {
        if (isMounted) {
          const msg = err instanceof Error ? err.message : 'Kamera tidak dapat diakses.';
          setErrorMsg(
            msg.includes('NotAllowedError') || msg.includes('Permission')
              ? 'Izin kamera ditolak. Silakan izinkan browser atau unggah screenshot gambar QR.'
              : `Gagal membuka kamera (${msg}). Anda bisa unggah gambar screenshot QR di bawah.`
          );
        }
      }
    };

    startCamera();

    return () => {
      isMounted = false;
      if (localStream) {
        localStream.getTracks().forEach((t) => t.stop());
      }
    };
  }, [isOpen, facingMode]);

  // Loop Scanning Real-time dari Video Stream
  useEffect(() => {
    if (!cameraActive || !isOpen) return;

    let animId: number;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let barcodeDetectorInstance: any = null;

    if (typeof window !== 'undefined' && 'BarcodeDetector' in window) {
      try {
        barcodeDetectorInstance = new window.BarcodeDetector({ formats: ['qr_code'] });
      } catch {
        barcodeDetectorInstance = null;
      }
    }

    const scanFrame = async () => {
      const video = videoRef.current;
      const canvas = canvasRef.current;

      if (video && video.readyState >= 2 && canvas) {
        // 1. Coba BarcodeDetector native (Chrome Android & Desktop)
        if (barcodeDetectorInstance) {
          try {
            const barcodes = await barcodeDetectorInstance.detect(video);
            if (barcodes && barcodes.length > 0 && barcodes[0].rawValue) {
              const detected = parseTokenFromRaw(barcodes[0].rawValue);
              if (detected) {
                stopCamera();
                onScanSuccess(detected);
                return;
              }
            }
          } catch {
            // fallback ke canvas
          }
        }

        // 2. Fallback jsQR via Canvas
        if (window.jsQR) {
          const ctx = canvas.getContext('2d');
          if (ctx) {
            canvas.width = video.videoWidth || 320;
            canvas.height = video.videoHeight || 240;
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const code = window.jsQR(imgData.data, imgData.width, imgData.height);
            if (code && code.data) {
              const detected = parseTokenFromRaw(code.data);
              if (detected) {
                stopCamera();
                onScanSuccess(detected);
                return;
              }
            }
          }
        }
      }

      animId = requestAnimationFrame(scanFrame);
    };

    animId = requestAnimationFrame(scanFrame);

    return () => {
      cancelAnimationFrame(animId);
    };
  }, [cameraActive, isOpen, onScanSuccess]);

  // Handler Upload File / Screenshot Gambar QR
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = async () => {
        // Coba BarcodeDetector
        if (typeof window !== 'undefined' && 'BarcodeDetector' in window) {
          try {
            const detector = new window.BarcodeDetector({ formats: ['qr_code'] });
            const barcodes = await detector.detect(img);
            if (barcodes && barcodes.length > 0 && barcodes[0].rawValue) {
              const token = parseTokenFromRaw(barcodes[0].rawValue);
              stopCamera();
              onScanSuccess(token);
              return;
            }
          } catch {
            // fallback
          }
        }

        // Coba jsQR
        if (window.jsQR) {
          const canvas = document.createElement('canvas');
          canvas.width = img.width;
          canvas.height = img.height;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(img, 0, 0);
            const imgData = ctx.getImageData(0, 0, img.width, img.height);
            const code = window.jsQR(imgData.data, imgData.width, imgData.height);
            if (code && code.data) {
              const token = parseTokenFromRaw(code.data);
              stopCamera();
              onScanSuccess(token);
              return;
            }
          }
        }

        setErrorMsg('QR Code tidak terdeteksi dalam file ini. Pastikan gambar jelas dan tidak buram.');
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/75 backdrop-blur-xs p-4 animate-fadeIn select-none font-sans">
      <div className="bg-white border-2 border-neutral-900 w-full max-w-sm rounded-none shadow-2xl overflow-hidden flex flex-col">
        {/* Header - Flat Solid Monochrome */}
        <div className="bg-neutral-900 text-white p-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-white text-neutral-900 flex items-center justify-center font-black text-xs">
              QR
            </div>
            <span className="font-bold text-xs uppercase tracking-wider">Pemindai Kamera Smartwatch</span>
          </div>

          <div className="flex items-center gap-1">
            {/* Tombol Ganti Kamera (Depan / Belakang) */}
            <button
              type="button"
              onClick={toggleFacingMode}
              title={`Beralih ke Kamera ${facingMode === 'environment' ? 'Depan' : 'Belakang'}`}
              className="p-1.5 text-neutral-300 hover:text-white hover:bg-neutral-800 transition-colors cursor-pointer flex items-center gap-1 text-[11px]"
            >
              <SwitchCamera className="w-4 h-4" />
              <span className="hidden sm:inline font-bold">
                {facingMode === 'environment' ? 'Kamera Depan' : 'Kamera Belakang'}
              </span>
            </button>

            <button
              type="button"
              onClick={() => {
                stopCamera();
                onClose();
              }}
              className="text-neutral-400 hover:text-white cursor-pointer p-1.5"
              title="Tutup Pemindai"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Viewport Scanner */}
        <div className="p-4 flex flex-col items-center">
          {errorMsg ? (
            <div className="w-full p-3 bg-red-50 border border-red-500 text-red-700 text-xs mb-3 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          ) : (
            <p className="text-[11px] text-neutral-600 mb-3 text-center">
              Arahkan ke QR Code di layar jam Wokwi. Mode: <strong>{facingMode === 'environment' ? 'Kamera Belakang' : 'Kamera Depan (Selfie/Webcam)'}</strong>.
            </p>
          )}

          {/* Area Video Kamera */}
          <div className="relative w-64 h-64 bg-black border-2 border-neutral-900 flex items-center justify-center overflow-hidden">
            <video
              ref={videoRef}
              className={`w-full h-full object-cover ${facingMode === 'user' ? 'scale-x-[-1]' : ''}`}
              playsInline
              muted
            />

            {/* Target Reticle Box */}
            <div className="absolute inset-8 border-2 border-dashed border-emerald-400 pointer-events-none flex items-center justify-center">
              <div className="w-2.5 h-2.5 bg-emerald-400"></div>
            </div>

            {/* Scanning Line Animation */}
            {cameraActive && (
              <div className="absolute inset-x-8 top-8 h-0.5 bg-emerald-400 shadow-[0_0_8px_#34d399] animate-bounce pointer-events-none" />
            )}

            {!cameraActive && !errorMsg && (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-white text-xs gap-2">
                <RefreshCw className="w-6 h-6 animate-spin text-neutral-400" />
                <span>Menghubungkan Kamera...</span>
              </div>
            )}
          </div>

          <canvas ref={canvasRef} className="hidden" />

          {/* Tombol Cepat Ganti Kamera */}
          <div className="mt-3 flex gap-2 w-full">
            <button
              type="button"
              onClick={toggleFacingMode}
              className="flex-1 py-1.5 px-2 bg-neutral-100 hover:bg-neutral-200 border border-neutral-400 text-neutral-800 text-[11px] font-bold flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
            >
              <SwitchCamera className="w-3.5 h-3.5" />
              <span>Ganti ke {facingMode === 'environment' ? 'Kamera Depan' : 'Kamera Belakang'}</span>
            </button>
          </div>

          {/* Fallback Upload Gambar Screenshot */}
          <div className="mt-3 w-full pt-3 border-t border-neutral-200">
            <span className="text-[10px] font-bold text-neutral-500 uppercase block mb-1 text-center">
              Atau Unggah Screenshot / File Gambar:
            </span>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileUpload}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="w-full py-2 px-3 bg-neutral-100 hover:bg-neutral-200 border border-neutral-400 text-neutral-900 text-xs font-bold flex items-center justify-center gap-2 cursor-pointer transition-colors"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Pilih Gambar QR dari File / Galeri</span>
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="bg-neutral-100 p-3 border-t border-neutral-200 text-center">
          <button
            type="button"
            onClick={() => {
              stopCamera();
              onClose();
            }}
            className="text-xs text-neutral-700 font-bold hover:underline cursor-pointer"
          >
            Batal & Masukkan Token Manual
          </button>
        </div>
      </div>
    </div>
  );
};

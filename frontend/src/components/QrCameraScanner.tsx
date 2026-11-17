import React, { useEffect, useRef, useState } from 'react';
import { Upload, X, AlertCircle, RefreshCw, SwitchCamera, QrCode } from 'lucide-react';

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
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Pemindai QR jam tangan"
      className="fixed inset-0 z-60 flex items-center justify-center bg-black/45 backdrop-blur-[2px] p-4 hc-fade-soft"
    >
      <div
        className="bg-white border border-[#E5E3DD] w-full max-w-sm rounded-[20px] overflow-hidden flex flex-col"
        style={{ boxShadow: 'var(--shadow-popover)' }}
      >
        {/* Header Lembut */}
        <div className="px-5 py-4 border-b border-[#E5E3DD] flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-full bg-[#F3F2EE] text-[#18181B] flex items-center justify-center shrink-0">
              <QrCode className="w-4 h-4" aria-hidden="true" />
            </div>
            <span className="font-semibold text-[15px] text-[#18181B] truncate">
              Pindai kode QR
            </span>
          </div>

          <button
            type="button"
            onClick={() => {
              stopCamera();
              onClose();
            }}
            aria-label="Tutup pemindai kamera"
            className="w-11 h-11 rounded-full text-[#52525B] hover:bg-[#F3F2EE] flex items-center justify-center cursor-pointer transition-colors shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Viewport Kamera */}
        <div className="p-5 flex flex-col items-center">
          {errorMsg ? (
            <div
              role="alert"
              className="w-full p-3.5 rounded-[12px] bg-[#FEF2F2] border border-[#FECACA] text-[#991B1B] text-[13px] mb-4 flex items-start gap-2.5"
            >
              <AlertCircle className="w-4 h-4 shrink-0 text-[#DC2626] mt-0.5" aria-hidden="true" />
              <span>{errorMsg}</span>
            </div>
          ) : (
            <p className="text-[13px] text-[#52525B] mb-4 text-center">
              Arahkan kamera ke kode QR pada layar jam tangan ({facingMode === 'environment' ? 'kamera belakang' : 'kamera depan'}).
            </p>
          )}

          {/* Area Video */}
          <div className="relative w-64 h-64 rounded-[16px] bg-[#18181B] border border-[#E5E3DD] flex items-center justify-center overflow-hidden">
            <video
              ref={videoRef}
              className={`w-full h-full object-cover ${facingMode === 'user' ? 'scale-x-[-1]' : ''}`}
              playsInline
              muted
            />

            {/* Bingkai Panduan */}
            <div className="absolute inset-8 rounded-[12px] border-2 border-dashed border-emerald-400/90 pointer-events-none" />

            {!cameraActive && !errorMsg && (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-white text-[13px] gap-2">
                <RefreshCw className="w-5 h-5 animate-spin text-neutral-300" aria-hidden="true" />
                <span>Menghubungkan kamera...</span>
              </div>
            )}
          </div>

          <canvas ref={canvasRef} className="hidden" />

          {/* Aksi Kamera & Unggah */}
          <div className="mt-4 w-full space-y-2.5">
            <button
              type="button"
              onClick={toggleFacingMode}
              className="hc-btn-secondary w-full px-4 py-2.5 text-[14px] flex items-center justify-center gap-2 cursor-pointer"
            >
              <SwitchCamera className="w-4 h-4 text-[#52525B]" aria-hidden="true" />
              <span>Ganti ke {facingMode === 'environment' ? 'kamera depan' : 'kamera belakang'}</span>
            </button>

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
              className="hc-btn-secondary w-full px-4 py-2.5 text-[14px] flex items-center justify-center gap-2 cursor-pointer"
            >
              <Upload className="w-4 h-4 text-[#52525B]" aria-hidden="true" />
              <span>Unggah gambar QR dari perangkat</span>
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 bg-[#FAF9F7] border-t border-[#E5E3DD] text-center">
          <button
            type="button"
            onClick={() => {
              stopCamera();
              onClose();
            }}
            className="min-h-[44px] px-4 text-[14px] font-medium text-[#52525B] hover:text-[#18181B] cursor-pointer transition-colors"
          >
            Batal, masukkan kode manual
          </button>
        </div>
      </div>
    </div>
  );
};

import React, { useState } from 'react';
import type { HealthMetric } from '../types/telemetry';

interface SmoothBiometricChartProps {
  metrics: HealthMetric[];
}

type ViewMode = 'combined' | 'heart_rate' | 'temperature';

export const SmoothBiometricChart: React.FC<SmoothBiometricChartProps> = ({ metrics }) => {
  const [viewMode, setViewMode] = useState<ViewMode>('combined');
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  // Urutan kronologis (data terlama di kiri, terbaru di kanan)
  const chartData = [...metrics].reverse();

  // Dimensi SVG & Area Gambar
  const width = 640;
  const height = 260;
  const padLeft = 45;
  const padRight = viewMode === 'combined' ? 45 : 25;
  const padTop = 30;
  const padBottom = 35;

  const chartW = width - padLeft - padRight;
  const chartH = height - padTop - padBottom;

  // Rentang Skala Heart Rate (BPM) & Temperature (°C)
  const hrMin = 40;
  const hrMax = 160;
  const tempMin = 34;
  const tempMax = 42;

  // Hitung Titik Koordinat Heart Rate
  const hrPoints = chartData.map((d, index) => {
    const val = d.heart_rate;
    const x = padLeft + (index / Math.max(chartData.length - 1, 1)) * chartW;
    const norm = (val - hrMin) / (hrMax - hrMin);
    const clamped = Math.max(0, Math.min(1, norm));
    const y = padTop + chartH - clamped * chartH;
    const time = new Date(d.recorded_at).toLocaleTimeString('id-ID', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    return { x, y, val, time };
  });

  // Hitung Titik Koordinat Temperature
  const tempPoints = chartData.map((d, index) => {
    const val = Number(d.temperature);
    const x = padLeft + (index / Math.max(chartData.length - 1, 1)) * chartW;
    const norm = (val - tempMin) / (tempMax - tempMin);
    const clamped = Math.max(0, Math.min(1, norm));
    const y = padTop + chartH - clamped * chartH;
    const time = new Date(d.recorded_at).toLocaleTimeString('id-ID', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    return { x, y, val, time };
  });

  // Generator Smooth Bézier Spline Path
  const generateSmoothPath = (pts: { x: number; y: number }[]): string => {
    if (pts.length === 0) return '';
    if (pts.length === 1) return `M ${pts[0].x} ${pts[0].y}`;

    let path = `M ${pts[0].x} ${pts[0].y}`;
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = i > 0 ? pts[i - 1] : pts[i];
      const p1 = pts[i];
      const p2 = pts[i + 1];
      const p3 = i < pts.length - 2 ? pts[i + 2] : p2;

      // Catmull-Rom ke Cubic Bézier
      const cp1x = p1.x + (p2.x - p0.x) / 6;
      const cp1y = p1.y + (p2.y - p0.y) / 6;
      const cp2x = p2.x - (p3.x - p1.x) / 6;
      const cp2y = p2.y - (p3.y - p1.y) / 6;

      path += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
    }
    return path;
  };

  const hrPath = generateSmoothPath(hrPoints);
  const tempPath = generateSmoothPath(tempPoints);

  // Y-Ticks untuk Axis
  const hrTicks = [50, 75, 100, 125, 150];
  const tempTicks = [35, 37, 39, 41];

  const showHR = viewMode === 'combined' || viewMode === 'heart_rate';
  const showTemp = viewMode === 'combined' || viewMode === 'temperature';

  // Perhitungan Posisi Tooltip Presisi & Responsif
  let tooltipLeftPct = 50;
  let tooltipTopPct = 50;
  let isNearTop = false;

  if (hoveredIndex !== null && chartData[hoveredIndex]) {
    const ptX = hrPoints[hoveredIndex].x;
    const ptY =
      showHR && showTemp
        ? Math.min(hrPoints[hoveredIndex].y, tempPoints[hoveredIndex].y)
        : showHR
        ? hrPoints[hoveredIndex].y
        : tempPoints[hoveredIndex].y;

    const rawLeft = (ptX / width) * 100;
    // Clamp horizontal agar tidak terpotong di tepi kiri/kanan HP
    tooltipLeftPct = Math.max(18, Math.min(82, rawLeft));
    tooltipTopPct = (ptY / height) * 100;
    // Jika titik berada di 40% area atas grafik, tampilkan tooltip di BAWAH titik
    isNearTop = tooltipTopPct < 40;
  }

  return (
    <div className="bg-white rounded-3xl p-4 sm:p-6 border border-neutral-200/80 shadow-xs flex flex-col justify-between">
      {/* Header & View Switcher (Responsif Penuh di Mobile & Desktop) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <div>
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <h2 className="text-base sm:text-lg font-extrabold text-[#111111] tracking-tight">Biometric Trend</h2>
            {/* Color Legend Indikator */}
            <div className="flex items-center gap-2.5 text-xs font-semibold">
              {showHR && (
                <span className="flex items-center gap-1.5 text-neutral-900">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#111111] ring-1 ring-neutral-300" />
                  Heart Rate (BPM)
                </span>
              )}
              {showTemp && (
                <span className="flex items-center gap-1.5 text-rose-600">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#E11D48] ring-1 ring-rose-200" />
                  Skin Temp (°C)
                </span>
              )}
            </div>
          </div>
          <p className="text-[11px] sm:text-xs text-neutral-400 font-medium mt-0.5">Real-time Stream (Last 20 Data Points)</p>
        </div>

        {/* 3-Way Mode Switcher (Full Width di HP) */}
        <div className="flex items-center gap-1 p-1 bg-neutral-100 rounded-full w-full sm:w-auto justify-between sm:justify-start select-none">
          <button
            onClick={() => setViewMode('combined')}
            className={`flex-1 sm:flex-none px-2.5 sm:px-3 py-1 text-center text-xs font-bold rounded-full transition-all cursor-pointer ${
              viewMode === 'combined'
                ? 'bg-[#111111] text-white shadow-xs'
                : 'text-neutral-500 hover:text-neutral-900'
            }`}
          >
            Combined
          </button>
          <button
            onClick={() => setViewMode('heart_rate')}
            className={`flex-1 sm:flex-none px-2.5 sm:px-3 py-1 text-center text-xs font-bold rounded-full transition-all cursor-pointer ${
              viewMode === 'heart_rate'
                ? 'bg-[#111111] text-white shadow-xs'
                : 'text-neutral-500 hover:text-neutral-900'
            }`}
          >
            Heart Rate
          </button>
          <button
            onClick={() => setViewMode('temperature')}
            className={`flex-1 sm:flex-none px-2.5 sm:px-3 py-1 text-center text-xs font-bold rounded-full transition-all cursor-pointer ${
              viewMode === 'temperature'
                ? 'bg-[#111111] text-white shadow-xs'
                : 'text-neutral-500 hover:text-neutral-900'
            }`}
          >
            Skin Temp
          </button>
        </div>
      </div>

      {/* SVG Multi-Line Chart Canvas */}
      <div className="relative w-full overflow-visible select-none my-1">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-auto overflow-visible"
        >
          {/* Horizontal Grid Lines */}
          {hrTicks.map((tick) => {
            const norm = (tick - hrMin) / (hrMax - hrMin);
            const y = padTop + chartH - norm * chartH;
            return (
              <g key={`grid-${tick}`}>
                <line
                  x1={padLeft}
                  y1={y}
                  x2={width - padRight}
                  y2={y}
                  stroke="#F1F2F4"
                  strokeWidth="1.5"
                  strokeDasharray="4 4"
                />
              </g>
            );
          })}

          {/* Left Y-Axis: BPM Labels (Muncul jika showHR) */}
          {showHR &&
            hrTicks.map((tick) => {
              const norm = (tick - hrMin) / (hrMax - hrMin);
              const y = padTop + chartH - norm * chartH;
              return (
                <text
                  key={`hr-tick-${tick}`}
                  x={padLeft - 8}
                  y={y + 4}
                  textAnchor="end"
                  fontSize="10"
                  fontWeight="700"
                  fill="#111111"
                >
                  {tick}
                </text>
              );
            })}

          {/* Right Y-Axis: Temperature Labels (Muncul di kanan jika Combined / Temp) */}
          {showTemp &&
            (viewMode === 'combined'
              ? tempTicks.map((tick) => {
                  const norm = (tick - tempMin) / (tempMax - tempMin);
                  const y = padTop + chartH - norm * chartH;
                  return (
                    <text
                      key={`temp-tick-${tick}`}
                      x={width - padRight + 8}
                      y={y + 4}
                      textAnchor="start"
                      fontSize="10"
                      fontWeight="700"
                      fill="#E11D48"
                    >
                      {tick}°
                    </text>
                  );
                })
              : tempTicks.map((tick) => {
                  const norm = (tick - tempMin) / (tempMax - tempMin);
                  const y = padTop + chartH - norm * chartH;
                  return (
                    <text
                      key={`temp-only-tick-${tick}`}
                      x={padLeft - 8}
                      y={y + 4}
                      textAnchor="end"
                      fontSize="10"
                      fontWeight="700"
                      fill="#E11D48"
                    >
                      {tick}°
                    </text>
                  );
                }))}

          {/* 1. Line Path: Heart Rate (Hitam Solid) */}
          {showHR && hrPoints.length > 1 && (
            <path
              d={hrPath}
              fill="none"
              stroke="#111111"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}

          {/* 2. Line Path: Skin Temperature (Rose Red Solid) */}
          {showTemp && tempPoints.length > 1 && (
            <path
              d={tempPath}
              fill="none"
              stroke="#E11D48"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}

          {/* Dots: Heart Rate (Hitam) */}
          {showHR &&
            hrPoints.map((pt, idx) => (
              <circle
                key={`hr-dot-${idx}`}
                cx={pt.x}
                cy={pt.y}
                r={hoveredIndex === idx ? 6 : 3.5}
                fill="#111111"
                stroke="#FFFFFF"
                strokeWidth={hoveredIndex === idx ? '2.5' : '1.5'}
                className="transition-all duration-150 cursor-pointer"
                onMouseEnter={() => setHoveredIndex(idx)}
                onMouseLeave={() => setHoveredIndex(null)}
              />
            ))}

          {/* Dots: Temperature (Rose) */}
          {showTemp &&
            tempPoints.map((pt, idx) => (
              <circle
                key={`temp-dot-${idx}`}
                cx={pt.x}
                cy={pt.y}
                r={hoveredIndex === idx ? 6 : 3.5}
                fill="#E11D48"
                stroke="#FFFFFF"
                strokeWidth={hoveredIndex === idx ? '2.5' : '1.5'}
                className="transition-all duration-150 cursor-pointer"
                onMouseEnter={() => setHoveredIndex(idx)}
                onMouseLeave={() => setHoveredIndex(null)}
              />
            ))}
        </svg>

        {/* Floating Tooltip Gabungan (Auto Flip & Full Percentage Scaling) */}
        {hoveredIndex !== null && chartData[hoveredIndex] && (
          <div
            className={`absolute z-30 px-3 py-1.5 sm:px-3.5 sm:py-2 bg-[#111111] text-white text-xs font-bold rounded-2xl shadow-2xl pointer-events-none -translate-x-1/2 transition-all border border-neutral-700/60 whitespace-nowrap ${
              isNearTop ? 'translate-y-3' : '-translate-y-full -translate-y-3'
            }`}
            style={{
              left: `${tooltipLeftPct}%`,
              top: `${tooltipTopPct}%`,
            }}
          >
            <div className="flex items-center gap-2.5">
              {showHR && (
                <span className="flex items-center gap-1 text-white">
                  <span className="w-2 h-2 rounded-full bg-white" />
                  {chartData[hoveredIndex].heart_rate} BPM
                </span>
              )}
              {showTemp && (
                <span className="flex items-center gap-1 text-rose-400">
                  <span className="w-2 h-2 rounded-full bg-rose-500" />
                  {Number(chartData[hoveredIndex].temperature).toFixed(1)} °C
                </span>
              )}
            </div>
            <div className="text-[10px] text-neutral-400 font-normal mt-0.5 text-center">
              {new Date(chartData[hoveredIndex].recorded_at).toLocaleTimeString('id-ID')}
            </div>
          </div>
        )}
      </div>

      {/* Footer Info */}
      <div className="flex items-center justify-between text-[11px] sm:text-xs text-neutral-400 font-medium mt-2 pt-2 border-t border-neutral-100">
        <span>Oldest</span>
        <span className="flex items-center gap-1.5 text-neutral-800 font-semibold">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          Live Dual Stream
        </span>
        <span>Latest</span>
      </div>
    </div>
  );
};

import React, { useState } from 'react';
import type { HealthMetric } from '../types/telemetry';

interface SmoothBiometricChartProps {
  metrics: HealthMetric[];
}

type ViewMode = 'combined' | 'heart_rate' | 'temperature';

export const SmoothBiometricChart: React.FC<SmoothBiometricChartProps> = ({ metrics }) => {
  const [viewMode, setViewMode] = useState<ViewMode>('combined');
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  // Maksimal 20 pembacaan terbaru secara kronologis (terlama di kiri, terbaru di kanan)
  const chartData = [...metrics.slice(0, 20)].reverse();

  // Dimensi SVG responsif & proporsional penuh
  const width = 1000;
  const height = 240;
  const padLeft = 46;
  const padRight = viewMode === 'combined' ? 46 : 24;
  const padTop = 24;
  const padBottom = 22;

  const chartW = width - padLeft - padRight;
  const chartH = height - padTop - padBottom;
  const baseY = padTop + chartH;

  // Rentang Skala Dinamis & Proporsional (Mencegah garis gepeng di dasar)
  const maxHrInData = Math.max(...chartData.map((d) => d.heart_rate ?? 75), 100);
  const hrMax = maxHrInData > 115 ? Math.min(160, Math.ceil(maxHrInData / 10) * 10 + 10) : 120;
  const hrMin = 50;

  const tempMin = 24;
  const tempMax = 38;

  const hrTicks = hrMax > 120 ? [60, 80, 100, 120, hrMax] : [60, 75, 90, 105, 120];
  const tempTicks = [26, 30, 34, 38];

  const hrPoints = chartData.map((d, index) => {
    const val = d.heart_rate ?? 72;
    const x =
      chartData.length <= 1
        ? padLeft + chartW / 2
        : padLeft + (index / (chartData.length - 1)) * chartW;
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

  const tempPoints = chartData.map((d, index) => {
    const val = Number(d.temperature ?? d.room_temp ?? 27.0);
    const x =
      chartData.length <= 1
        ? padLeft + chartW / 2
        : padLeft + (index / (chartData.length - 1)) * chartW;
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

  // Generator Kurva Monotone Halus (mencegah overshoot)
  const generateMonotonePath = (pts: { x: number; y: number }[]): string => {
    if (pts.length === 0) return '';
    if (pts.length === 1) return `M ${pts[0].x} ${pts[0].y}`;

    const n = pts.length;
    const dx: number[] = [];
    const dy: number[] = [];
    const slopes: number[] = [];
    for (let i = 0; i < n - 1; i++) {
      const dxi = Math.max(pts[i + 1].x - pts[i].x, 0.001);
      const dyi = pts[i + 1].y - pts[i].y;
      dx.push(dxi);
      dy.push(dyi);
      slopes.push(dyi / dxi);
    }

    const tangents: number[] = [slopes[0]];
    for (let i = 1; i < n - 1; i++) {
      if (slopes[i - 1] * slopes[i] <= 0) {
        tangents.push(0);
      } else {
        tangents.push((slopes[i - 1] + slopes[i]) / 2);
      }
    }
    tangents.push(slopes[n - 2]);

    let path = `M ${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`;
    for (let i = 0; i < n - 1; i++) {
      const x1 = pts[i].x;
      const y1 = pts[i].y;
      const x2 = pts[i + 1].x;
      const y2 = pts[i + 1].y;
      const thirdDx = (x2 - x1) / 3;
      const cp1x = x1 + thirdDx;
      const cp1y = y1 + thirdDx * tangents[i];
      const cp2x = x2 - thirdDx;
      const cp2y = y2 - thirdDx * tangents[i + 1];
      path += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${x2.toFixed(1)} ${y2.toFixed(1)}`;
    }
    return path;
  };

  const generateAreaPath = (pts: { x: number; y: number }[], linePath: string): string => {
    if (pts.length < 2 || !linePath) return '';
    return `${linePath} L ${pts[pts.length - 1].x.toFixed(1)} ${baseY.toFixed(1)} L ${pts[0].x.toFixed(1)} ${baseY.toFixed(1)} Z`;
  };

  const hrPath = generateMonotonePath(hrPoints);
  const hrAreaPath = generateAreaPath(hrPoints, hrPath);
  const tempPath = generateMonotonePath(tempPoints);
  const tempAreaPath = generateAreaPath(tempPoints, tempPath);

  const showHR = viewMode === 'combined' || viewMode === 'heart_rate';
  const showTemp = viewMode === 'combined' || viewMode === 'temperature';

  // Posisi Tooltip Presisi
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
    tooltipLeftPct = Math.max(18, Math.min(82, rawLeft));
    tooltipTopPct = (ptY / height) * 100;
    isNearTop = tooltipTopPct < 42;
  }

  return (
    <section aria-label="Grafik tren biometrik" className="hc-card p-6 flex flex-col">
      {/* Header & Toggle Segmented Pill */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-5">
        <div>
          <h2 className="text-lg font-semibold text-[#18181B]">Tren biometrik</h2>
          <div className="flex flex-wrap items-center gap-4 mt-1">
            <p className="text-[13px] text-[#52525B]">20 pembacaan terakhir</p>
            <div className="flex items-center gap-3 text-[13px] font-medium">
              <span
                className={`flex items-center gap-1.5 transition-opacity duration-200 ${
                  showHR ? 'opacity-100 text-[#18181B]' : 'opacity-35 text-[#71717A]'
                }`}
              >
                <span className="w-2.5 h-2.5 rounded-full bg-[#18181B]" />
                <span>Detak jantung</span>
              </span>
              <span
                className={`flex items-center gap-1.5 transition-opacity duration-200 ${
                  showTemp ? 'opacity-100 text-[#B45309]' : 'opacity-35 text-[#71717A]'
                }`}
              >
                <span className="w-2.5 h-2.5 rounded-full bg-[#D97706]" />
                <span>Suhu</span>
              </span>
            </div>
          </div>
        </div>

        {/* Toggle Segmented Pill Konsisten */}
        <div
          role="tablist"
          aria-label="Mode tampilan grafik"
          className="inline-flex items-center p-1 bg-[#F3F2EE] border border-[#E5E3DD] rounded-full w-full md:w-auto select-none"
        >
          {[
            { id: 'combined', label: 'Gabungan' },
            { id: 'heart_rate', label: 'Detak jantung' },
            { id: 'temperature', label: 'Suhu' },
          ].map((tab) => {
            const active = viewMode === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setViewMode(tab.id as ViewMode)}
                className={`flex-1 md:flex-initial min-h-[40px] px-2.5 sm:px-4 py-1.5 rounded-full text-[12px] sm:text-[13px] transition-all duration-180 ease-out cursor-pointer whitespace-nowrap ${
                  active
                    ? 'bg-[#18181B] text-white font-semibold shadow-xs'
                    : 'text-[#52525B] hover:text-[#18181B] font-medium'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Kanvas SVG Responsif Penuh */}
      <div className="relative w-full select-none">
        {chartData.length === 0 ? (
          <div className="h-[200px] flex items-center justify-center text-[15px] text-[#71717A]">
            Menunggu data pembacaan dari jam tangan...
          </div>
        ) : (
          <svg
            viewBox={`0 0 ${width} ${height}`}
            className="w-full h-auto overflow-visible"
            role="img"
            aria-label="Grafik garis detak jantung dan suhu"
          >
            <defs>
              <linearGradient id="hrAreaGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#18181B" stopOpacity="0.12" />
                <stop offset="100%" stopColor="#18181B" stopOpacity="0" />
              </linearGradient>
              <linearGradient id="tempAreaGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#D97706" stopOpacity="0.14" />
                <stop offset="100%" stopColor="#D97706" stopOpacity="0" />
              </linearGradient>
            </defs>

            {/* Grid Putus-putus Samar */}
            {hrTicks.map((tick) => {
              const norm = (tick - hrMin) / (hrMax - hrMin);
              const y = padTop + chartH - norm * chartH;
              return (
                <line
                  key={`grid-${tick}`}
                  x1={padLeft}
                  y1={y}
                  x2={width - padRight}
                  y2={y}
                  stroke="#E5E3DD"
                  strokeWidth="1"
                  strokeDasharray="4 4"
                />
              );
            })}

            {/* Label Sumbu Y Kiri (BPM) */}
            <g className={`transition-opacity duration-200 ${showHR ? 'opacity-100' : 'opacity-0'}`}>
              {hrTicks.map((tick) => {
                const norm = (tick - hrMin) / (hrMax - hrMin);
                const y = padTop + chartH - norm * chartH;
                return (
                  <text
                    key={`hr-tick-${tick}`}
                    x={padLeft - 8}
                    y={y + 4}
                    textAnchor="end"
                    fontSize="11"
                    fontWeight="500"
                    fill="#52525B"
                  >
                    {tick}
                  </text>
                );
              })}
            </g>

            {/* Label Sumbu Y Suhu */}
            <g className={`transition-opacity duration-200 ${showTemp ? 'opacity-100' : 'opacity-0'}`}>
              {tempTicks.map((tick) => {
                const norm = (tick - tempMin) / (tempMax - tempMin);
                const y = padTop + chartH - norm * chartH;
                const isCombined = viewMode === 'combined';
                return (
                  <text
                    key={`temp-tick-${tick}`}
                    x={isCombined ? width - padRight + 8 : padLeft - 8}
                    y={y + 4}
                    textAnchor={isCombined ? 'start' : 'end'}
                    fontSize="11"
                    fontWeight="500"
                    fill="#B45309"
                  >
                    {tick}°
                  </text>
                );
              })}
            </g>

            {/* Area Gradient Tipis: Detak Jantung */}
            {hrPoints.length > 1 && (
              <path
                d={hrAreaPath}
                fill="url(#hrAreaGrad)"
                className={`transition-opacity duration-200 ${
                  showHR ? 'opacity-100' : 'opacity-0 pointer-events-none'
                }`}
              />
            )}

            {/* Area Gradient Tipis: Suhu */}
            {tempPoints.length > 1 && (
              <path
                d={tempAreaPath}
                fill="url(#tempAreaGrad)"
                className={`transition-opacity duration-200 ${
                  showTemp ? 'opacity-100' : 'opacity-0 pointer-events-none'
                }`}
              />
            )}

            {/* Garis Kurva: Detak Jantung */}
            {hrPoints.length > 1 && (
              <path
                d={hrPath}
                fill="none"
                stroke="#18181B"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className={`transition-opacity duration-200 ${
                  showHR ? 'opacity-100' : 'opacity-0 pointer-events-none'
                }`}
              />
            )}

            {/* Garis Kurva: Suhu */}
            {tempPoints.length > 1 && (
              <path
                d={tempPath}
                fill="none"
                stroke="#D97706"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className={`transition-opacity duration-200 ${
                  showTemp ? 'opacity-100' : 'opacity-0 pointer-events-none'
                }`}
              />
            )}

            {/* Titik Interaktif: Detak Jantung */}
            <g
              className={`transition-opacity duration-200 ${
                showHR ? 'opacity-100' : 'opacity-0 pointer-events-none'
              }`}
            >
              {hrPoints.map((pt, idx) => (
                <circle
                  key={`hr-dot-${idx}`}
                  cx={pt.x}
                  cy={pt.y}
                  r={hoveredIndex === idx ? 5.5 : 3}
                  fill="#18181B"
                  stroke="#FFFFFF"
                  strokeWidth={hoveredIndex === idx ? '2' : '1.5'}
                  className="transition-all duration-150 cursor-pointer"
                  onMouseEnter={() => setHoveredIndex(idx)}
                  onMouseLeave={() => setHoveredIndex(null)}
                />
              ))}
            </g>

            {/* Titik Interaktif: Suhu */}
            <g
              className={`transition-opacity duration-200 ${
                showTemp ? 'opacity-100' : 'opacity-0 pointer-events-none'
              }`}
            >
              {tempPoints.map((pt, idx) => (
                <circle
                  key={`temp-dot-${idx}`}
                  cx={pt.x}
                  cy={pt.y}
                  r={hoveredIndex === idx ? 5.5 : 3}
                  fill="#D97706"
                  stroke="#FFFFFF"
                  strokeWidth={hoveredIndex === idx ? '2' : '1.5'}
                  className="transition-all duration-150 cursor-pointer"
                  onMouseEnter={() => setHoveredIndex(idx)}
                  onMouseLeave={() => setHoveredIndex(null)}
                />
              ))}
            </g>
          </svg>
        )}

        {/* Tooltip Hover Lembut */}
        {hoveredIndex !== null && chartData[hoveredIndex] && (
          <div
            className={`absolute z-30 px-3.5 py-2 bg-[#18181B] text-white text-[13px] font-medium rounded-[12px] pointer-events-none -translate-x-1/2 transition-all duration-150 whitespace-nowrap ${
              isNearTop ? 'translate-y-3' : '-translate-y-full -translate-y-3'
            }`}
            style={{
              left: `${tooltipLeftPct}%`,
              top: `${tooltipTopPct}%`,
              boxShadow: 'var(--shadow-popover)',
            }}
          >
            <div className="flex items-center gap-3">
              {showHR && (
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-white" />
                  <span>{chartData[hoveredIndex].heart_rate} BPM</span>
                </span>
              )}
              {showTemp && (
                <span className="flex items-center gap-1.5 text-amber-300">
                  <span className="w-2 h-2 rounded-full bg-amber-400" />
                  <span>
                    {Number(
                      chartData[hoveredIndex].temperature ?? chartData[hoveredIndex].room_temp ?? 27
                    ).toFixed(1)}{' '}
                    °C
                  </span>
                </span>
              )}
            </div>
            <div className="text-[12px] text-neutral-300 mt-0.5 text-center">
              {new Date(chartData[hoveredIndex].recorded_at).toLocaleTimeString('id-ID')}
            </div>
          </div>
        )}
      </div>

      {/* Footer Info Bahasa Indonesia */}
      <div className="flex items-center justify-between text-[13px] text-[#52525B] mt-3 pt-3 border-t border-[#E5E3DD]">
        <span>Terlama</span>
        <span className="flex items-center gap-2 text-[#18181B] font-medium">
          <span className="w-2 h-2 rounded-full bg-[#15803D]" />
          <span>Terhubung langsung</span>
        </span>
        <span>Terbaru</span>
      </div>
    </section>
  );
};

export default SmoothBiometricChart;

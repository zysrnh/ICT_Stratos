import React, { useState } from 'react';
import type { HealthMetric } from '../types/telemetry';

interface SmoothBiometricChartProps {
  metrics: HealthMetric[];
}

export const SmoothBiometricChart: React.FC<SmoothBiometricChartProps> = ({ metrics }) => {
  const [metricType, setMetricType] = useState<'heart_rate' | 'temperature'>('heart_rate');
  const [hoveredPoint, setHoveredPoint] = useState<{ x: number; y: number; val: number; time: string } | null>(null);

  // Balik urutan agar data lama di kiri, data terbaru di kanan (chronological)
  const chartData = [...metrics].reverse();

  // SVG Dimension & Padding
  const width = 640;
  const height = 240;
  const padLeft = 45;
  const padRight = 25;
  const padTop = 30;
  const padBottom = 35;

  const chartW = width - padLeft - padRight;
  const chartH = height - padTop - padBottom;

  // Nilai Min & Max Berdasarkan Metrik
  const dataMin = metricType === 'heart_rate' ? 40 : 34;
  const dataMax = metricType === 'heart_rate' ? 160 : 42;

  // Hitung Koordinat Titik (X, Y)
  const points = chartData.map((d, index) => {
    const val = metricType === 'heart_rate' ? d.heart_rate : Number(d.temperature);
    const x = padLeft + (index / Math.max(chartData.length - 1, 1)) * chartW;
    const norm = (val - dataMin) / (dataMax - dataMin);
    const clampedNorm = Math.max(0, Math.min(1, norm));
    const y = padTop + chartH - clampedNorm * chartH;
    const time = new Date(d.recorded_at).toLocaleTimeString('id-ID', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    return { x, y, val, time };
  });

  // Fungsi Menghasilkan Smooth Bézier Curve Path
  const generateSmoothPath = (pts: { x: number; y: number }[]): string => {
    if (pts.length === 0) return '';
    if (pts.length === 1) return `M ${pts[0].x} ${pts[0].y}`;

    let path = `M ${pts[0].x} ${pts[0].y}`;
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = i > 0 ? pts[i - 1] : pts[i];
      const p1 = pts[i];
      const p2 = pts[i + 1];
      const p3 = i < pts.length - 2 ? pts[i + 2] : p2;

      // Catmull-Rom ke Cubic Bezier
      const cp1x = p1.x + (p2.x - p0.x) / 6;
      const cp1y = p1.y + (p2.y - p0.y) / 6;
      const cp2x = p2.x - (p3.x - p1.x) / 6;
      const cp2y = p2.y - (p3.y - p1.y) / 6;

      path += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
    }
    return path;
  };

  const smoothPath = generateSmoothPath(points);

  // Y-Axis Ticks
  const yTicks = metricType === 'heart_rate' ? [50, 75, 100, 125, 150] : [35, 37, 39, 41];

  return (
    <div className="bg-white rounded-3xl p-6 border border-neutral-200/80 shadow-xs flex flex-col justify-between">
      {/* Chart Header & Toggles */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <div>
          <h2 className="text-lg font-extrabold text-[#111111] tracking-tight">Biometric Trend</h2>
          <p className="text-xs text-neutral-400 font-medium">Real-time Stream (Last 20 Data Points)</p>
        </div>

        {/* Tab Switcher: HR vs Temp */}
        <div className="flex items-center gap-1.5 p-1 bg-neutral-100 rounded-full self-start sm:self-auto">
          <button
            onClick={() => setMetricType('heart_rate')}
            className={`px-3 py-1 text-xs font-bold rounded-full transition-all cursor-pointer ${
              metricType === 'heart_rate'
                ? 'bg-[#111111] text-white shadow-xs'
                : 'text-neutral-500 hover:text-neutral-900'
            }`}
          >
            Heart Rate (BPM)
          </button>
          <button
            onClick={() => setMetricType('temperature')}
            className={`px-3 py-1 text-xs font-bold rounded-full transition-all cursor-pointer ${
              metricType === 'temperature'
                ? 'bg-[#111111] text-white shadow-xs'
                : 'text-neutral-500 hover:text-neutral-900'
            }`}
          >
            Skin Temp (°C)
          </button>
        </div>
      </div>

      {/* SVG Chart Container */}
      <div className="relative w-full overflow-hidden select-none">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-auto overflow-visible"
        >
          {/* Horizontal Grid Lines & Y-Labels */}
          {yTicks.map((tick) => {
            const norm = (tick - dataMin) / (dataMax - dataMin);
            const y = padTop + chartH - norm * chartH;
            return (
              <g key={tick}>
                <line
                  x1={padLeft}
                  y1={y}
                  x2={width - padRight}
                  y2={y}
                  stroke="#F1F2F4"
                  strokeWidth="1.5"
                  strokeDasharray="4 4"
                />
                <text
                  x={padLeft - 10}
                  y={y + 4}
                  textAnchor="end"
                  fontSize="10"
                  fontWeight="600"
                  fill="#9CA3AF"
                >
                  {tick}
                </text>
              </g>
            );
          })}

          {/* Smooth Curved Line Path */}
          {points.length > 1 && (
            <path
              d={smoothPath}
              fill="none"
              stroke="#111111"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}

          {/* Data Points (Dots) */}
          {points.map((pt, idx) => (
            <g
              key={idx}
              onMouseEnter={() => setHoveredPoint(pt)}
              onMouseLeave={() => setHoveredPoint(null)}
              className="cursor-pointer"
            >
              <circle
                cx={pt.x}
                cy={pt.y}
                r={hoveredPoint?.time === pt.time ? 6 : 3.5}
                fill="#111111"
                stroke="#FFFFFF"
                strokeWidth={hoveredPoint?.time === pt.time ? '2.5' : '1.5'}
                className="transition-all duration-150"
              />
            </g>
          ))}
        </svg>

        {/* Hover Tooltip */}
        {hoveredPoint && (
          <div
            className="absolute z-10 px-3 py-1.5 bg-[#111111] text-white text-xs font-bold rounded-xl shadow-lg pointer-events-none -translate-x-1/2 -translate-y-full mb-2 transition-all"
            style={{
              left: `${(hoveredPoint.x / width) * 100}%`,
              top: `${(hoveredPoint.y / height) * 100}%`,
            }}
          >
            <div>
              {hoveredPoint.val} {metricType === 'heart_rate' ? 'BPM' : '°C'}
            </div>
            <div className="text-[10px] text-neutral-400 font-normal">{hoveredPoint.time}</div>
          </div>
        )}
      </div>

      {/* Footer Info */}
      <div className="flex items-center justify-between text-xs text-neutral-400 font-medium mt-2 pt-2 border-t border-neutral-100">
        <span>Oldest recorded</span>
        <span className="flex items-center gap-1.5 text-neutral-700 font-semibold">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          Live Sampling (Every 3s)
        </span>
        <span>Latest recorded</span>
      </div>
    </div>
  );
};

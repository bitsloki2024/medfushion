'use client';

import { memo } from 'react';
import {
  ComposedChart, Line, Scatter, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine, Area
} from 'recharts';
import type { AnomalyResult } from '@/lib/ml-utils';
import type { DiseaseKey } from '@/lib/disease-data';
import { DISEASE_META } from '@/lib/disease-data';
import { formatNumber } from '@/lib/utils';

interface Props {
  data: AnomalyResult[];
  disease: DiseaseKey;
}

const ANOMALY_COLORS = {
  numerical_spike: '#ef4444',
  numerical_drop: '#f97316',
  seasonal: '#a855f7',
  normal: 'transparent',
};

// ── Module-level storage so tooltip data survives any remount ──
let _trendLast: { payload: any[]; label: any } | null = null;
let _trendColor = '#00a0dc';

// ── Stable tooltip — defined outside, never recreated ──
function TrendTooltip({ active, payload, label }: any) {
  if (active && payload?.length) _trendLast = { payload, label };
  if (!_trendLast) return null;
  const { payload: p, label: l } = _trendLast;
  const d = p[0]?.payload;
  return (
    <div style={{ background: 'rgba(0,10,28,0.97)', border: '1px solid rgba(0,120,180,0.2)', borderRadius: 8, padding: '8px 12px', fontSize: 11, fontFamily: 'JetBrains Mono, monospace' }}>
      <div style={{ color: '#ffffff', fontWeight: 700, marginBottom: 4 }}>{l}</div>
      <div style={{ color: _trendColor }}>Cases: {formatNumber(d?.cases)}</div>
      {d?.anomalyDot && (
        <>
          <div style={{ color: '#fbbf24', marginTop: 4 }}>⚠ ANOMALY DETECTED</div>
          <div style={{ color: '#94a3b8' }}>Type: {d.anomalyType?.replace('_', ' ')}</div>
          <div style={{ color: '#94a3b8' }}>Score: {(d.anomalyScore * 100).toFixed(0)}%</div>
        </>
      )}
    </div>
  );
}

// ── Stable dot shape — defined outside, never recreated ──
function AnomalyDot(props: any) {
  const { cx, cy, payload } = props;
  if (!payload.anomalyDot) return null;
  const color = ANOMALY_COLORS[payload.anomalyType as keyof typeof ANOMALY_COLORS] || '#ef4444';
  return (
    <g>
      <circle cx={cx} cy={cy} r={6} fill={color} opacity={0.8} />
      <circle cx={cx} cy={cy} r={10} fill="none" stroke={color} strokeWidth={1.5} opacity={0.5} />
      <line x1={cx - 4} y1={cy - 4} x2={cx + 4} y2={cy + 4} stroke={color} strokeWidth={2} />
      <line x1={cx + 4} y1={cy - 4} x2={cx - 4} y2={cy + 4} stroke={color} strokeWidth={2} />
    </g>
  );
}

export const TrendChart = memo(function TrendChart({ data, disease }: Props) {
  const meta = DISEASE_META[disease];
  _trendColor = meta.color;

  const chartData = data.map(d => ({
    year: d.year,
    cases: d.cases,
    anomalyDot: d.isAnomaly ? d.cases : null,
    anomalyType: d.anomalyType,
    anomalyScore: d.anomalyScore,
  }));

  const anomalies = data.filter(d => d.isAnomaly);
  const mean = data.reduce((s, d) => s + d.cases, 0) / Math.max(data.length, 1);

  return (
    <div>
      <ResponsiveContainer width="99%" height={160}>
        <ComposedChart data={chartData} margin={{ top: 5, right: 5, bottom: 5, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
          <XAxis dataKey="year" tick={{ fill: '#64748b', fontSize: 9 }} tickLine={false} axisLine={false} />
          <YAxis tick={{ fill: '#64748b', fontSize: 9 }} tickLine={false} axisLine={false} tickFormatter={v => formatNumber(v)} width={38} />
          <Tooltip content={TrendTooltip} isAnimationActive={false} cursor={{ stroke: 'rgba(0,160,220,0.3)', strokeWidth: 1 }} />
          <ReferenceLine y={mean} stroke="rgba(255,255,255,0.15)" strokeDasharray="4 4"
            label={{ value: 'avg', fill: '#475569', fontSize: 9, position: 'right' }} />
          <Area type="monotone" dataKey="cases" fill={meta.color + '18'} stroke="none" isAnimationActive={false} />
          <Line type="monotone" dataKey="cases" stroke={meta.color} strokeWidth={1.5} dot={false}
            activeDot={{ r: 4, fill: meta.color }} isAnimationActive={false} />
          <Scatter dataKey="anomalyDot" shape={AnomalyDot} isAnimationActive={false} />
        </ComposedChart>
      </ResponsiveContainer>

      {anomalies.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {anomalies.map(a => (
            <span key={a.year} className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-mono"
              style={{ background: ANOMALY_COLORS[a.anomalyType] + '20', color: ANOMALY_COLORS[a.anomalyType] }}>
              ✕ {a.year} · {a.anomalyType?.replace('_', ' ')}
            </span>
          ))}
        </div>
      )}
    </div>
  );
});

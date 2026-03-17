'use client';

import { memo } from 'react';
import {
  ComposedChart, Line, Area, XAxis, YAxis,
  CartesianGrid, Tooltip, ReferenceLine, ResponsiveContainer
} from 'recharts';
import type { ForecastPoint } from '@/lib/ml-utils';
import type { DiseaseKey } from '@/lib/disease-data';
import { DISEASE_META } from '@/lib/disease-data';
import { formatNumber } from '@/lib/utils';

interface Props {
  data: ForecastPoint[];
  disease: DiseaseKey;
}

// ── Module-level storage so tooltip data survives any remount ──
let _forecastLast: { payload: any[]; label: any } | null = null;
let _forecastColor = '#f97316';

// ── Stable tooltip — defined outside, never recreated ──
function ForecastTooltip({ active, payload, label }: any) {
  if (active && payload?.length) _forecastLast = { payload, label };
  if (!_forecastLast) return null;
  const { payload: p, label: l } = _forecastLast;
  const d = p[0]?.payload as ForecastPoint;
  return (
    <div style={{ background: 'rgba(0,10,28,0.97)', border: `1px solid ${_forecastColor}40`, borderLeft: `2px solid ${_forecastColor}`, borderRadius: 8, padding: '8px 12px', fontSize: 11, fontFamily: 'JetBrains Mono, monospace' }}>
      <div style={{ color: '#ffffff', fontWeight: 700, marginBottom: 4 }}>{l} {d?.isForecast ? '🔮' : ''}</div>
      {d?.actual !== undefined && (
        <div style={{ color: _forecastColor }}>Actual: {formatNumber(d.actual)}</div>
      )}
      <div style={{ color: '#fb923c' }}>Predicted: {formatNumber(Math.round(d?.predicted ?? 0))}</div>
      <div style={{ color: '#64748b' }}>Low: {formatNumber(Math.round(d?.lower ?? 0))}</div>
      <div style={{ color: '#64748b' }}>High: {formatNumber(Math.round(d?.upper ?? 0))}</div>
      {d?.isForecast && <div style={{ color: '#c084fc', marginTop: 4 }}>⚡ AI Forecast</div>}
    </div>
  );
}

export const ForecastChart = memo(function ForecastChart({ data, disease }: Props) {
  const meta = DISEASE_META[disease];
  _forecastColor = meta.color;

  const splitYear = data.find(d => d.isForecast)?.year;

  return (
    <ResponsiveContainer width="99%" height={160}>
      <ComposedChart data={data} margin={{ top: 5, right: 5, bottom: 5, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
        <XAxis dataKey="year" tick={{ fill: '#64748b', fontSize: 9 }} tickLine={false} axisLine={false} />
        <YAxis tick={{ fill: '#64748b', fontSize: 9 }} tickLine={false} axisLine={false} tickFormatter={v => formatNumber(v)} width={38} />
        <Tooltip content={ForecastTooltip} isAnimationActive={false} cursor={{ stroke: 'rgba(0,160,220,0.3)', strokeWidth: 1 }} />

        <Area type="monotone" dataKey="upper" fill="rgba(249,115,22,0.08)" stroke="none" isAnimationActive={false} />
        <Area type="monotone" dataKey="lower" fill="rgba(0,8,20,1)" stroke="none" isAnimationActive={false} />
        <Line type="monotone" dataKey="predicted" stroke="#f97316" strokeWidth={1.5} strokeDasharray="5 3"
          dot={false} activeDot={{ r: 4, fill: '#f97316' }} isAnimationActive={false} />
        <Line type="monotone" dataKey="actual" stroke={meta.color} strokeWidth={2}
          dot={false} activeDot={{ r: 4, fill: meta.color }} connectNulls={false} isAnimationActive={false} />

        {splitYear && (
          <ReferenceLine x={splitYear} stroke="rgba(255,255,255,0.2)" strokeDasharray="4 4"
            label={{ value: '▶ Forecast', fill: '#64748b', fontSize: 8, position: 'insideTopLeft' }} />
        )}
      </ComposedChart>
    </ResponsiveContainer>
  );
});

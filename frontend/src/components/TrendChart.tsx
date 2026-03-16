'use client';

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

export function TrendChart({ data, disease }: Props) {
  const meta = DISEASE_META[disease];

  const chartData = data.map(d => ({
    year: d.year,
    cases: d.cases,
    anomalyDot: d.isAnomaly ? d.cases : null,
    anomalyType: d.anomalyType,
    anomalyScore: d.anomalyScore,
  }));

  const anomalies = data.filter(d => d.isAnomaly);

  const CustomDot = (props: any) => {
    const { cx, cy, payload } = props;
    if (!payload.anomalyDot) return null;
    const color = ANOMALY_COLORS[payload.anomalyType as keyof typeof ANOMALY_COLORS] || '#ef4444';
    return (
      <g>
        <circle cx={cx} cy={cy} r={6} fill={color} opacity={0.8} />
        <circle cx={cx} cy={cy} r={10} fill="none" stroke={color} strokeWidth={1.5} opacity={0.5} />
        {/* X marker */}
        <line x1={cx - 4} y1={cy - 4} x2={cx + 4} y2={cy + 4} stroke={color} strokeWidth={2} />
        <line x1={cx + 4} y1={cy - 4} x2={cx - 4} y2={cy + 4} stroke={color} strokeWidth={2} />
      </g>
    );
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    const d = payload[0]?.payload;
    return (
      <div className="glass-strong p-2 text-[11px] font-mono">
        <p className="text-white font-bold mb-1">{label}</p>
        <p style={{ color: meta.color }}>Cases: {formatNumber(d.cases)}</p>
        {d.anomalyDot && (
          <>
            <p className="text-amber-400 mt-1">⚠ ANOMALY DETECTED</p>
            <p className="text-slate-400">Type: {d.anomalyType?.replace('_', ' ')}</p>
            <p className="text-slate-400">Score: {(d.anomalyScore * 100).toFixed(0)}%</p>
          </>
        )}
      </div>
    );
  };

  const mean = data.reduce((s, d) => s + d.cases, 0) / Math.max(data.length, 1);

  return (
    <div>
      <ResponsiveContainer width="100%" height={160}>
        <ComposedChart data={chartData} margin={{ top: 5, right: 5, bottom: 5, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
          <XAxis
            dataKey="year"
            tick={{ fill: '#64748b', fontSize: 9 }}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            tick={{ fill: '#64748b', fontSize: 9 }}
            tickLine={false}
            axisLine={false}
            tickFormatter={v => formatNumber(v)}
            width={38}
          />
          <Tooltip content={<CustomTooltip />} />
          <ReferenceLine y={mean} stroke="rgba(255,255,255,0.15)" strokeDasharray="4 4"
            label={{ value: 'avg', fill: '#475569', fontSize: 9, position: 'right' }} />
          <Area
            type="monotone"
            dataKey="cases"
            fill={meta.color + '18'}
            stroke="none"
          />
          <Line
            type="monotone"
            dataKey="cases"
            stroke={meta.color}
            strokeWidth={1.5}
            dot={false}
            activeDot={{ r: 4, fill: meta.color }}
          />
          <Scatter
            dataKey="anomalyDot"
            shape={<CustomDot />}
          />
        </ComposedChart>
      </ResponsiveContainer>

      {/* Anomaly legend */}
      {anomalies.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {anomalies.map(a => (
            <span
              key={a.year}
              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-mono"
              style={{ background: ANOMALY_COLORS[a.anomalyType] + '20', color: ANOMALY_COLORS[a.anomalyType] }}
            >
              ✕ {a.year} · {a.anomalyType?.replace('_', ' ')}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

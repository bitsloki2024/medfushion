'use client';

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

export function ForecastChart({ data, disease }: Props) {
  const meta = DISEASE_META[disease];

  // Find split year
  const splitYear = data.find(d => d.isForecast)?.year;

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    const d = payload[0]?.payload as ForecastPoint;
    return (
      <div className="glass-strong p-2 text-[11px] font-mono border-l-2" style={{ borderColor: meta.color }}>
        <p className="text-white font-bold mb-1">{label} {d.isForecast ? '🔮' : ''}</p>
        {d.actual !== undefined && (
          <p style={{ color: meta.color }}>Actual: {formatNumber(d.actual)}</p>
        )}
        <p className="text-orange-300">Predicted: {formatNumber(Math.round(d.predicted))}</p>
        <p className="text-slate-500">Low: {formatNumber(Math.round(d.lower))}</p>
        <p className="text-slate-500">High: {formatNumber(Math.round(d.upper))}</p>
        {d.isForecast && <p className="text-purple-400 mt-1">⚡ AI Forecast</p>}
      </div>
    );
  };

  return (
    <ResponsiveContainer width="100%" height={160}>
      <ComposedChart data={data} margin={{ top: 5, right: 5, bottom: 5, left: 0 }}>
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

        {/* Confidence interval band */}
        <Area
          type="monotone"
          dataKey="upper"
          fill="rgba(249,115,22,0.08)"
          stroke="none"
        />
        <Area
          type="monotone"
          dataKey="lower"
          fill="rgba(0,8,20,1)"
          stroke="none"
        />

        {/* Predicted line (dashed for forecast portion) */}
        <Line
          type="monotone"
          dataKey="predicted"
          stroke="#f97316"
          strokeWidth={1.5}
          strokeDasharray="5 3"
          dot={false}
          activeDot={{ r: 4, fill: '#f97316' }}
        />

        {/* Actual data line */}
        <Line
          type="monotone"
          dataKey="actual"
          stroke={meta.color}
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 4, fill: meta.color }}
          connectNulls={false}
        />

        {/* Forecast boundary */}
        {splitYear && (
          <ReferenceLine
            x={splitYear}
            stroke="rgba(255,255,255,0.2)"
            strokeDasharray="4 4"
            label={{ value: '▶ Forecast', fill: '#64748b', fontSize: 8, position: 'insideTopLeft' }}
          />
        )}
      </ComposedChart>
    </ResponsiveContainer>
  );
}

'use client';

import { useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  DISEASE_META, INDIA_STATES, generateTrendData, computeRiskScore,
  getRiskColor, type GlobePoint, type DiseaseKey
} from '@/lib/disease-data';
import {
  isolationForest, prophetForecast, computeOutbreakRisk,
  computeDataConfidence, linearRegression
} from '@/lib/ml-utils';
import { formatNumber } from '@/lib/utils';
import { TrendChart } from './TrendChart';
import { ForecastChart } from './ForecastChart';

interface Props {
  country: GlobePoint;
  disease: DiseaseKey;
  selectedState?: string;
}

export function CountryPanel({ country, disease, selectedState }: Props) {
  const meta = DISEASE_META[disease];
  const isIndia = country.country === 'India';
  const stateData = selectedState ? INDIA_STATES[selectedState] : null;

  // ─── Compute everything with ML ─────────────────────────────────────────────
  const trendData = useMemo(() => generateTrendData(disease, country.country), [disease, country.country]);
  const anomalies = useMemo(() => isolationForest(trendData), [trendData]);
  const forecast = useMemo(() => prophetForecast(trendData, 5), [trendData]);
  const regression = useMemo(() => linearRegression(trendData, 5), [trendData]);

  const { score: riskScore, label: riskLabel, isAlarming } = useMemo(
    () => computeRiskScore(country.cases, country.population, country.risk_score * 0.5),
    [country]
  );

  const latestCases = trendData.at(-1)?.cases ?? country.cases;
  const prevCases = trendData.at(-2)?.cases ?? latestCases;
  const growthRate = prevCases > 0 ? (latestCases - prevCases) / prevCases : 0;
  const historicalAvg = trendData.length > 0
    ? trendData.reduce((s, d) => s + d.cases, 0) / trendData.length : latestCases;

  const outbreakRisk = useMemo(
    () => computeOutbreakRisk(latestCases, historicalAvg, growthRate, country.population),
    [latestCases, historicalAvg, growthRate, country.population]
  );

  const confidence = useMemo(
    () => computeDataConfidence(trendData.length, false, meta.source, new Date()),
    [trendData.length, meta.source]
  );

  const anomalyCount = anomalies.filter(a => a.isAnomaly).length;
  const anomalyYears = anomalies.filter(a => a.isAnomaly).map(a => a.year);

  const riskColor = getRiskColor(country.risk_score);
  const riskTextClass = riskScore < 25 ? 'risk-low' : riskScore < 50 ? 'risk-moderate' : riskScore < 75 ? 'risk-high' : 'risk-critical';

  return (
    <div className="space-y-3 fade-in-up">
      {/* ── Country header ──────────────────────────────────────────────────── */}
      <div className="glass-strong p-3 animate-border" style={{ borderColor: `${riskColor}30` }}>
        <div className="flex items-start justify-between mb-3">
          <div>
            <h2 className="text-base font-bold text-white tracking-wide">
              {isIndia && selectedState ? `${selectedState}, India` : country.country}
            </h2>
            <p className="text-[10px] text-slate-500 mt-0.5 font-mono">
              {meta.icon} {meta.label} · Pop: {formatNumber(stateData?.population ?? country.population)}
            </p>
          </div>
          <div className={`border rounded px-2 py-1 text-xs font-mono font-bold ${riskTextClass}`}>
            {riskScore}/100
          </div>
        </div>

        {/* Key stats row */}
        <div className="grid grid-cols-3 gap-2">
          <div className="text-center">
            <p className="stat-number text-white font-bold text-sm">
              {formatNumber(stateData ? Math.round(country.cases * (stateData.population / country.population)) : country.cases)}
            </p>
            <p className="text-[10px] text-slate-500 mt-0.5">Total Cases</p>
          </div>
          <div className="text-center">
            <p className={`stat-number font-bold text-sm ${riskTextClass}`}>
              {riskLabel}
            </p>
            <p className="text-[10px] text-slate-500 mt-0.5">Risk Level</p>
          </div>
          <div className="text-center">
            <p className={`stat-number font-bold text-sm ${growthRate > 0.1 ? 'text-red-400' : growthRate > 0 ? 'text-amber-400' : 'text-green-400'}`}>
              {growthRate > 0 ? '+' : ''}{(growthRate * 100).toFixed(1)}%
            </p>
            <p className="text-[10px] text-slate-500 mt-0.5">YoY Change</p>
          </div>
        </div>
      </div>

      {/* ── Alarming indicator ──────────────────────────────────────────────── */}
      <div className={`glass-strong p-2.5 flex items-center gap-3 ${isAlarming ? 'glow-red' : 'glow-green'}`}
        style={{ borderColor: isAlarming ? 'rgba(239,68,68,0.3)' : 'rgba(34,197,94,0.3)' }}>
        <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${isAlarming ? 'bg-red-500/20' : 'bg-green-500/20'}`}>
          <span className="text-lg">{isAlarming ? '⚠️' : '✅'}</span>
        </div>
        <div>
          <p className={`text-xs font-bold ${isAlarming ? 'text-red-400' : 'text-green-400'}`}>
            {isAlarming ? 'ALARMING — Cases above normal threshold' : 'Situation Stable'}
          </p>
          <p className="text-[10px] text-slate-500 mt-0.5">
            Per 100K pop: {((country.cases / country.population) * 100000).toFixed(1)} cases
          </p>
        </div>
      </div>

      {/* ── Outbreak Risk Score ──────────────────────────────────────────────── */}
      <div className="glass-strong p-3">
        <div className="flex items-center justify-between mb-2">
          <p className="text-[10px] text-slate-400 uppercase tracking-widest">Outbreak Risk Score</p>
          <p className="text-[10px] text-slate-500 font-mono">ML: Isolation Forest + Trend</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative w-16 h-16 flex-shrink-0">
            <svg viewBox="0 0 36 36" className="w-16 h-16 -rotate-90">
              <circle cx="18" cy="18" r="15.9" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="3" />
              <circle
                cx="18" cy="18" r="15.9" fill="none"
                stroke={outbreakRisk.score > 75 ? '#ef4444' : outbreakRisk.score > 50 ? '#f97316' : outbreakRisk.score > 25 ? '#eab308' : '#22c55e'}
                strokeWidth="3"
                strokeDasharray={`${outbreakRisk.score} ${100 - outbreakRisk.score}`}
                strokeLinecap="round"
                style={{ filter: `drop-shadow(0 0 4px ${outbreakRisk.score > 75 ? '#ef4444' : '#f97316'})` }}
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="stat-number text-xs font-bold text-white">{outbreakRisk.score}</span>
            </div>
          </div>
          <div className="flex-1">
            <p className={`text-sm font-bold font-mono mb-1 ${
              outbreakRisk.score > 75 ? 'text-red-400'
              : outbreakRisk.score > 50 ? 'text-orange-400'
              : outbreakRisk.score > 25 ? 'text-amber-400' : 'text-green-400'
            }`}>{outbreakRisk.label}</p>
            <p className="text-[10px] text-slate-400">
              Outbreak probability: <span className="text-white font-mono">{(outbreakRisk.probability * 100).toFixed(0)}%</span>
            </p>
            <p className="text-[10px] text-slate-500 mt-0.5">
              Historical avg: {formatNumber(Math.round(historicalAvg))} cases/yr
            </p>
          </div>
        </div>
      </div>

      {/* ── Data Confidence ──────────────────────────────────────────────────── */}
      <div className="glass-strong p-3">
        <div className="flex items-center justify-between mb-1.5">
          <p className="text-[10px] text-slate-400 uppercase tracking-widest">Data Confidence</p>
          <span className={`text-[10px] font-bold font-mono ${
            confidence.label === 'HIGH' ? 'text-green-400' : confidence.label === 'MODERATE' ? 'text-amber-400' : 'text-red-400'
          }`}>{confidence.label}</span>
        </div>
        <div className="relative h-1.5 bg-slate-800 rounded-full overflow-hidden mb-1.5">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${confidence.score}%` }}
            transition={{ duration: 0.8, ease: 'easeOut' }}
            className="absolute inset-y-0 left-0 rounded-full"
            style={{ background: `linear-gradient(90deg, #22c55e, ${confidence.score > 80 ? '#22c55e' : confidence.score > 60 ? '#eab308' : '#ef4444'})` }}
          />
        </div>
        <div className="flex justify-between text-[10px] text-slate-500">
          <span>Score: <span className="text-white font-mono">{confidence.score}%</span></span>
          <span>Source: {meta.source}</span>
          <span>{confidence.freshness}</span>
        </div>
      </div>

      {/* ── Trend Chart with Anomaly Detection ──────────────────────────────── */}
      {trendData.length > 0 && (
        <div className="glass-strong p-3">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[10px] text-slate-400 uppercase tracking-widest">
              Historical Trend — Anomaly Detection
            </p>
            <span className="text-[10px] font-mono text-slate-500">Isolation Forest</span>
          </div>
          {anomalyCount > 0 && (
            <div className="flex items-center gap-2 mb-2 px-2 py-1 bg-amber-500/10 border border-amber-500/20 rounded text-[10px] text-amber-400">
              <span>⚠</span>
              <span>{anomalyCount} anomalous year{anomalyCount > 1 ? 's' : ''} detected: {anomalyYears.join(', ')}</span>
            </div>
          )}
          <TrendChart data={anomalies} disease={disease} />
        </div>
      )}

      {/* ── Forecast Chart (Prophet + Linear Regression) ─────────────────────── */}
      {forecast.length > 0 && (
        <div className="glass-strong p-3">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[10px] text-slate-400 uppercase tracking-widest">
              AI Forecast — Next 5 Years
            </p>
            <span className="text-[10px] font-mono text-slate-500">Prophet + LinReg</span>
          </div>
          <div className="flex items-center gap-3 mb-2">
            <div className="flex items-center gap-1">
              <div className="w-2 h-0.5 bg-cyan-400 rounded" />
              <span className="text-[10px] text-slate-400">Actual</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-2 h-0.5 border-t-2 border-dashed border-orange-400" />
              <span className="text-[10px] text-slate-400">Forecast</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 bg-orange-500/20 rounded-sm" />
              <span className="text-[10px] text-slate-400">Confidence interval</span>
            </div>
          </div>
          <div className="text-[10px] text-slate-500 mb-2 font-mono">
            R² = {regression.r2.toFixed(3)} · Trend: {regression.slope > 0 ? '↑' : '↓'} {Math.abs(regression.slope / (trendData[0]?.cases || 1) * 100).toFixed(1)}%/yr
          </div>
          <ForecastChart data={forecast} disease={disease} />
        </div>
      )}

      {/* ── ML Model summary ─────────────────────────────────────────────────── */}
      <div className="glass p-3">
        <p className="text-[10px] text-slate-500 uppercase tracking-widest mb-2">ML Models Active</p>
        <div className="space-y-1">
          {[
            { name: 'Isolation Forest', role: 'Anomaly detection', status: 'active' },
            { name: 'Facebook Prophet', role: '5-year forecasting', status: 'active' },
            { name: 'Linear Regression', role: 'Trend analysis', status: 'active' },
            { name: 'K-Means Clustering', role: 'Risk classification', status: 'active' },
          ].map(m => (
            <div key={m.name} className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 pulse-dot" />
              <span className="text-[10px] text-slate-300 font-mono">{m.name}</span>
              <span className="text-[10px] text-slate-600">—</span>
              <span className="text-[10px] text-slate-500">{m.role}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

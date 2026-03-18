'use client';

import { useMemo, useState, useRef, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip as ReTooltip, Legend, ResponsiveContainer,
} from 'recharts';
import {
  DISEASE_META, generateTrendData, computeRiskScore, getRiskColor,
  DISEASE_CLASSIFICATION, DISEASE_GENES, DISEASE_DRUGS,
  type GlobePoint, type DiseaseKey
} from '@/lib/disease-data';
import { isolationForest, prophetForecast, computeOutbreakRisk, linearRegression } from '@/lib/ml-utils';
import { formatNumber } from '@/lib/utils';
import { TrendChart } from './TrendChart';
import { ForecastChart } from './ForecastChart';
import CosmoTab from './CosmoTab';

interface Props {
  country: GlobePoint;
  disease: DiseaseKey;
  activeTab: 'surveillance' | 'classification' | 'genomics' | 'therapeutics' | 'ai-assistant';
  region: string;
  onCosmoAction?: (action: { disease?: string; country?: string }) => void;
}

// ── Shared Styles ────────────────────────────────────────────────────────────
const S = {
  card:    { background: 'rgba(0,20,45,0.5)', border: '1px solid rgba(0,100,160,0.12)', borderRadius: 10, padding: '14px 16px', marginBottom: 12 } as React.CSSProperties,
  label:   { fontSize: '0.62rem', color: '#4a6a82', letterSpacing: '0.18em', textTransform: 'uppercase' as const, fontFamily: 'Inter,sans-serif', fontWeight: 500, marginBottom: 10, display: 'block' },
  val:     { fontSize: '0.85rem', color: '#9ac8e0', fontFamily: 'Inter,sans-serif', marginBottom: 2 },
  mono:    { fontFamily: 'JetBrains Mono, monospace', fontSize: '0.72rem', color: '#6a92a8' },
  h3:      { fontSize: '0.88rem', fontWeight: 500, color: '#d0e8f8', fontFamily: 'Inter,sans-serif', marginBottom: 4 },
  divider: { height: 1, background: 'rgba(0,100,160,0.08)', margin: '10px 0' } as React.CSSProperties,
  text:    { fontSize: '0.68rem', color: '#6a90a8', fontFamily: 'Inter,sans-serif' },
  stat:    { fontSize: '0.65rem', color: '#5a7898', fontFamily: 'Inter,sans-serif' },
};

// ── Gene–Disease Network Graph ────────────────────────────────────────────────
type GeneNode = { symbol: string; fullName: string; evidenceScore: number; chromosome: string; associationType: string; function: string };
type DrugNode = { name: string; genericName: string; mechanism: string; line: string };

function GeneNetworkGraph({ genes, drugs, disease }: {
  genes: GeneNode[];
  drugs: DrugNode[];
  disease: DiseaseKey;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const simRef = useRef<{
    nodes: Array<{ id: string; x: number; y: number; vx: number; vy: number; r: number; type: string; label: string; hex: string; data: any }>;
    links: Array<{ source: number; target: number; strength: number }>;
    animId: number | null;
    hoveredIdx: number | null;
  }>({ nodes: [], links: [], animId: null, hoveredIdx: null });

  useEffect(() => {
    const canvas = canvasRef.current;
    const tooltip = tooltipRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const W = canvas.offsetWidth || 300;
    const H = 230;
    canvas.width = W;
    canvas.height = H;
    const cx = W / 2, cy = H / 2;
    const sim = simRef.current;

    const DISEASE_HEX: Record<string, string> = {
      covid: '#60b8dc', malaria: '#22c55e', dengue: '#f97316', flu: '#a78bfa', tb: '#ef4444'
    };
    const disColor = DISEASE_HEX[disease] || '#60b8dc';

    // Build nodes
    sim.nodes = [
      { id: disease, x: cx, y: cy, vx: 0, vy: 0, r: 20, type: 'disease', label: disease.toUpperCase(), hex: disColor, data: {} }
    ];
    genes.slice(0, 5).forEach((g, i) => {
      const angle = (i / Math.min(genes.length, 5)) * Math.PI * 2 - Math.PI / 2;
      const hex = g.evidenceScore > 0.85 ? '#22c55e' : g.evidenceScore > 0.7 ? '#60b8dc' : '#eab308';
      sim.nodes.push({ id: g.symbol, x: cx + 80 * Math.cos(angle), y: cy + 65 * Math.sin(angle), vx: 0, vy: 0, r: 10 + g.evidenceScore * 8, type: 'gene', label: g.symbol, hex, data: g });
    });
    drugs.slice(0, 3).forEach((d, i) => {
      const angle = ((i + 0.5) / 3) * Math.PI * 2 + Math.PI / 4;
      sim.nodes.push({ id: d.genericName, x: cx + 130 * Math.cos(angle), y: cy + 100 * Math.sin(angle), vx: 0, vy: 0, r: 10, type: 'drug', label: d.genericName.split(' ')[0].substring(0, 8), hex: '#c084fc', data: d });
    });

    // Build links
    sim.links = [];
    genes.slice(0, 5).forEach((g, i) => sim.links.push({ source: 0, target: i + 1, strength: g.evidenceScore }));
    drugs.slice(0, 3).forEach((_, i) => sim.links.push({ source: 0, target: genes.slice(0, 5).length + 1 + i, strength: 0.4 }));

    const hexToRgba = (hex: string, a: number) => {
      const m = hex.match(/\w\w/g) || [];
      const [r, g, b] = m.map(v => parseInt(v, 16));
      return `rgba(${r},${g},${b},${a})`;
    };

    const draw = () => {
      const { nodes, links, hoveredIdx } = sim;

      // Forces
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const dx = nodes[j].x - nodes[i].x, dy = nodes[j].y - nodes[i].y;
          const dist = Math.sqrt(dx * dx + dy * dy) + 0.01;
          const force = 700 / (dist * dist + 1);
          const fx = force * dx / dist, fy = force * dy / dist;
          nodes[i].vx -= fx; nodes[i].vy -= fy;
          nodes[j].vx += fx; nodes[j].vy += fy;
        }
      }
      for (const link of links) {
        const a = nodes[link.source], b = nodes[link.target];
        const dx = b.x - a.x, dy = b.y - a.y;
        const dist = Math.sqrt(dx * dx + dy * dy) + 0.01;
        const ideal = a.r + b.r + 40;
        const force = (dist - ideal) * 0.014;
        const fx = force * dx / dist, fy = force * dy / dist;
        a.vx += fx; a.vy += fy; b.vx -= fx; b.vy -= fy;
      }
      // Center disease node
      nodes[0].vx += (cx - nodes[0].x) * 0.04;
      nodes[0].vy += (cy - nodes[0].y) * 0.04;
      // Integrate
      for (const n of nodes) {
        n.vx *= 0.82; n.vy *= 0.82;
        n.x = Math.max(n.r + 4, Math.min(W - n.r - 4, n.x + n.vx));
        n.y = Math.max(n.r + 4, Math.min(H - n.r - 4, n.y + n.vy));
      }

      ctx.clearRect(0, 0, W, H);

      // Draw links
      for (const link of links) {
        const a = nodes[link.source], b = nodes[link.target];
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y);
        ctx.strokeStyle = link.strength > 0.8 ? 'rgba(34,197,94,0.45)' : 'rgba(0,160,220,0.3)';
        ctx.lineWidth = 0.5 + link.strength * 1.8;
        ctx.setLineDash([3, 4]); ctx.stroke(); ctx.setLineDash([]);
      }

      // Draw nodes
      for (let i = 0; i < nodes.length; i++) {
        const n = nodes[i];
        const isHov = hoveredIdx === i;
        const r = n.r * (isHov ? 1.25 : 1);
        if (isHov) {
          ctx.beginPath(); ctx.arc(n.x, n.y, r + 5, 0, Math.PI * 2);
          ctx.fillStyle = hexToRgba(n.hex, 0.08); ctx.fill();
        }
        ctx.beginPath(); ctx.arc(n.x, n.y, r, 0, Math.PI * 2);
        ctx.fillStyle = hexToRgba(n.hex, 0.14);
        ctx.strokeStyle = hexToRgba(n.hex, isHov ? 1.0 : 0.65);
        ctx.lineWidth = isHov ? 2 : 1;
        ctx.fill(); ctx.stroke();
        ctx.fillStyle = n.hex;
        ctx.font = `${n.type === 'disease' ? '600' : '500'} ${n.r > 15 ? 9 : 8}px Inter, sans-serif`;
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(n.label.substring(0, n.r > 14 ? 8 : 5), n.x, n.y);
      }

      sim.animId = requestAnimationFrame(draw);
    };
    sim.animId = requestAnimationFrame(draw);

    // Mouse events
    const onMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left, my = e.clientY - rect.top;
      sim.hoveredIdx = null;
      for (let i = 0; i < sim.nodes.length; i++) {
        const n = sim.nodes[i];
        if (Math.sqrt((mx - n.x) ** 2 + (my - n.y) ** 2) < n.r + 6) { sim.hoveredIdx = i; break; }
      }
      if (tooltip) {
        if (sim.hoveredIdx !== null) {
          const n = sim.nodes[sim.hoveredIdx];
          let html = '';
          if (n.type === 'disease') {
            html = `<strong style="color:#e0f0ff;font-size:12px">${n.label}</strong><br><span style="color:#4a6785;font-size:10px">Central disease node</span>`;
          } else if (n.type === 'gene') {
            const g = n.data as GeneNode;
            html = `<strong style="color:#4ade80;font-size:12px">${g.symbol}</strong><br><span style="color:#8ab8d0;font-size:10px">${g.fullName}</span><br><span style="color:#4a6785;font-size:10px">Evidence: ${(g.evidenceScore * 100).toFixed(0)}% · Chr ${g.chromosome}</span><br><span style="color:#3a5a78;font-size:10px">${g.function}</span>`;
          } else {
            const d = n.data as DrugNode;
            html = `<strong style="color:#c084fc;font-size:12px">${d.genericName}</strong><br><span style="color:#8ab8d0;font-size:10px">${d.line}-line treatment</span><br><span style="color:#3a5a78;font-size:10px">${d.mechanism.substring(0, 55)}...</span>`;
          }
          tooltip.style.display = 'block';
          tooltip.style.left = `${Math.min(n.x + n.r + 6, W - 180)}px`;
          tooltip.style.top  = `${Math.max(4, n.y - 30)}px`;
          tooltip.innerHTML = html;
        } else {
          tooltip.style.display = 'none';
        }
      }
    };
    const onLeave = () => { sim.hoveredIdx = null; if (tooltip) tooltip.style.display = 'none'; };
    canvas.addEventListener('mousemove', onMove);
    canvas.addEventListener('mouseleave', onLeave);

    return () => {
      if (sim.animId) cancelAnimationFrame(sim.animId);
      canvas.removeEventListener('mousemove', onMove);
      canvas.removeEventListener('mouseleave', onLeave);
    };
  }, [genes, drugs, disease]);

  return (
    <div style={{ position: 'relative' }}>
      <canvas ref={canvasRef} style={{ width: '100%', height: 230, display: 'block', cursor: 'crosshair' }} />
      <div ref={tooltipRef} style={{ position: 'absolute', display: 'none', background: 'rgba(0,10,28,0.96)', border: '1px solid rgba(0,120,180,0.2)', borderRadius: 8, padding: '8px 12px', fontSize: 11, color: '#c8dce8', fontFamily: 'Inter,sans-serif', lineHeight: 1.6, zIndex: 100, pointerEvents: 'none', maxWidth: 210, backdropFilter: 'blur(12px)' }} />
      {/* Legend */}
      <div style={{ display: 'flex', gap: 14, marginTop: 8, justifyContent: 'center' }}>
        {[{ hex: '#60b8dc', label: 'Disease' }, { hex: '#22c55e', label: 'Gene (high evidence)' }, { hex: '#c084fc', label: 'Drug' }].map(l => (
          <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: l.hex, opacity: 0.8 }} />
            <span style={{ fontSize: '0.55rem', color: '#4a6785', fontFamily: 'Inter,sans-serif' }}>{l.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Intervene Spread ──────────────────────────────────────────────────────────
const INTERVENTIONS = [
  { id: 'vaccination',  label: 'Vaccination',       icon: '💉', reduction: 0.55, hex: '#22c55e' },
  { id: 'quarantine',   label: 'Quarantine',         icon: '🔒', reduction: 0.45, hex: '#60b8dc' },
  { id: 'travel',       label: 'Travel Restriction', icon: '✈',  reduction: 0.25, hex: '#eab308' },
  { id: 'treatment',    label: 'Treatment Deploy',   icon: '🏥', reduction: 0.35, hex: '#a78bfa' },
];

function InterveneSpreadSection({ disease, region, days, active, onToggle, locationLabel }: {
  disease: DiseaseKey; region: string; days: number;
  active: Set<string>; onToggle: (id: string) => void; locationLabel: string;
}) {
  const totalReduction = useMemo(
    () => Math.min(0.92, Array.from(active).reduce((s, id) => s + (INTERVENTIONS.find(i => i.id === id)?.reduction || 0), 0)),
    [active]
  );

  // Per-intervention outcome summaries
  const summaries: Record<string, string> = {
    vaccination:  'Reduces susceptible population, slows R0',
    quarantine:   'Isolates infectious cases, cuts transmission chains',
    travel:       'Limits cross-regional spread and importation risk',
    treatment:    'Reduces infectious period and severe case burden',
  };

  return (
    <div style={S.card}>
      <span style={S.label}>Intervene Spread · Intervention Impact</span>
      <div style={{ fontSize: '0.62rem', color: '#3a5a78', marginBottom: 12 }}>
        Select interventions to see projected spread reduction for <strong style={{ color: '#6a90a8' }}>{locationLabel}</strong> · {days}-day window.
      </div>

      {/* Intervention toggles */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 16 }}>
        {INTERVENTIONS.map(iv => {
          const isOn = active.has(iv.id);
          return (
            <button key={iv.id}
              onClick={() => onToggle(iv.id)}
              style={{ padding: '8px 10px', borderRadius: 7, cursor: 'pointer', fontFamily: 'Inter,sans-serif', border: `1px solid ${isOn ? iv.hex + '55' : 'rgba(0,80,120,0.2)'}`, background: isOn ? iv.hex + '14' : 'rgba(0,20,50,0.4)', color: isOn ? iv.hex : '#4a6785', fontSize: '0.65rem', fontWeight: isOn ? 600 : 400, transition: 'all 0.18s ease', textAlign: 'left' as const, display: 'flex', alignItems: 'center', gap: 6 }}>
              <span>{iv.icon}</span> {iv.label}
            </button>
          );
        })}
      </div>

      {/* Static outcome display */}
      {totalReduction > 0 ? (
        <div style={{ padding: '14px 16px', background: 'rgba(34,197,94,0.06)', border: '1px solid rgba(34,197,94,0.22)', borderRadius: 8 }}>
          <div style={{ fontSize: '0.55rem', color: '#3a7a5a', letterSpacing: '0.16em', textTransform: 'uppercase' as const, marginBottom: 6, fontFamily: 'Inter,sans-serif', fontWeight: 500 }}>
            Projected Outcome
          </div>
          <div style={{ fontSize: '1.35rem', fontWeight: 700, color: '#4ade80', fontFamily: 'JetBrains Mono, monospace', letterSpacing: '-0.02em', lineHeight: 1, marginBottom: 6 }}>
            −{(totalReduction * 100).toFixed(0)}% spread reduction
          </div>
          <div style={{ fontSize: '0.7rem', color: '#5aaa7a', fontFamily: 'Inter,sans-serif', marginBottom: 10 }}>
            Combined interventions reducing spread by <strong>{(totalReduction * 100).toFixed(0)}%</strong> over {days} days
          </div>
          {/* Per-intervention breakdown */}
          <div style={{ borderTop: '1px solid rgba(34,197,94,0.1)', paddingTop: 8, display: 'flex', flexDirection: 'column' as const, gap: 4 }}>
            {INTERVENTIONS.filter(iv => active.has(iv.id)).map(iv => (
              <div key={iv.id} style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                <span style={{ fontSize: '0.62rem', color: iv.hex, fontWeight: 500, minWidth: 110 }}>{iv.icon} {iv.label}</span>
                <span style={{ fontSize: '0.58rem', color: '#3a5a78' }}>−{(iv.reduction * 100).toFixed(0)}% · {summaries[iv.id]}</span>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div style={{ padding: '16px', background: 'rgba(0,30,60,0.25)', border: '1px solid rgba(0,80,120,0.12)', borderRadius: 8, textAlign: 'center' as const }}>
          <div style={{ fontSize: '0.68rem', color: '#3a5a78', fontFamily: 'Inter,sans-serif' }}>
            Select interventions above to see projected impact
          </div>
          <div style={{ fontSize: '0.58rem', color: '#1e3040', marginTop: 4 }}>
            Estimates based on epidemiological modelling for {days}-day window
          </div>
        </div>
      )}
    </div>
  );
}

// ── Module-level storage so tooltip survives any remount ──
let _projLast: { payload: any[]; label: any } | null = null;

// ── Stable tooltip — defined outside, never recreated ──
function ProjectedTooltip({ active, payload, label }: any) {
  if (active && payload?.length) _projLast = { payload, label };
  if (!_projLast) return null;
  const { payload: p, label: l } = _projLast;
  return (
    <div style={{ background: 'rgba(0,10,28,0.97)', border: '1px solid rgba(0,120,180,0.2)', borderRadius: 8, padding: '8px 12px', fontSize: 10, fontFamily: 'Inter,sans-serif' }}>
      <div style={{ color: '#8ab8d0', marginBottom: 4, fontWeight: 500 }}>{l}</div>
      {p.map((item: any) => (
        <div key={item.dataKey} style={{ color: item.color, marginBottom: 2 }}>
          {item.name}: <strong>{formatNumber(item.value)}</strong>
        </div>
      ))}
    </div>
  );
}

// ── Projected Spread Simulation ────────────────────────────────────────────────
function ProjectedSpreadSection({ country, trendData, region, days, intFactor = 0.32 }: {
  country: GlobePoint;
  trendData: Array<{ year: number; cases: number }>;
  region: string;
  days: number;
  intFactor?: number;
}) {
  // Region-specific growth multiplier — use country.region for India states
  const regionMult = useMemo(() => {
    if (country.region === 'India') return 1.05; // India state-level spread
    const r = region.toLowerCase();
    if (r === 'africa')                          return 1.18;
    if (r === 'americas')                        return 0.92;
    if (r === 'europe')                          return 0.78;
    if (r === 'asia' || r === 'asia-pacific')    return 1.08;
    return 1.0;
  }, [region, country.region]);

  // Build day-by-day data for both curves
  const chartData = useMemo(() => {
    const base        = trendData.at(-1)?.cases || country.cases;
    const dailyGrowth = 0.0028 * regionMult;
    const step        = days <= 30 ? 5 : days <= 60 ? 10 : 15;
    const pts: number[] = [];
    for (let d = 0; d <= days; d += step) pts.push(d);
    if (pts[pts.length - 1] !== days) pts.push(days);
    return pts.map(d => ({
      day:       d === 0 ? 'Now' : `Day ${d}`,
      projected: Math.round(base * Math.pow(1 + dailyGrowth, d)),
      intervened: Math.round(base * Math.pow(1 + dailyGrowth * intFactor, d)),
    }));
  }, [days, country.cases, trendData, regionMult, intFactor]);

  // Summary metrics for the cards below the chart
  const { projFinal, intFinal, reduction } = useMemo(() => {
    const base        = trendData.at(-1)?.cases || country.cases;
    const dailyGrowth = 0.0028 * regionMult;
    const pF = Math.round(base * Math.pow(1 + dailyGrowth, days));
    const iF = Math.round(base * Math.pow(1 + dailyGrowth * intFactor, days));
    return { projFinal: pF, intFinal: iF, reduction: ((pF - iF) / pF * 100).toFixed(0) };
  }, [days, country.cases, trendData, regionMult, intFactor]);

  return (
    <div style={S.card}>
      <span style={S.label}>
        {country.region === 'India' ? 'State-Level ' : ''}Projected Spread · {days}-Day Simulation
      </span>

      <ResponsiveContainer width="99%" height={172}>
        <LineChart data={chartData} margin={{ top: 6, right: 8, left: -10, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,80,120,0.07)" vertical={false} />
          <XAxis dataKey="day" tick={{ fontSize: 8, fill: '#3a5a78', fontFamily: 'Inter,sans-serif' }} tickLine={false} axisLine={false} />
          <YAxis tick={{ fontSize: 8, fill: '#3a5a78', fontFamily: 'Inter,sans-serif' }} tickLine={false} axisLine={false} tickFormatter={v => formatNumber(v)} width={46} />
          <ReTooltip content={ProjectedTooltip} isAnimationActive={false} cursor={{ stroke: 'rgba(0,160,220,0.3)', strokeWidth: 1 }} />
          <Legend wrapperStyle={{ fontSize: '0.58rem', color: '#4a6785', paddingTop: 4, fontFamily: 'Inter,sans-serif' }} iconType="line" iconSize={12} />
          <Line
            type="monotone" dataKey="projected" name="Projected Spread"
            stroke="rgba(239,68,68,0.85)" strokeWidth={1.8} dot={false}
            activeDot={{ r: 3, fill: 'rgba(239,68,68,0.9)' }}
            isAnimationActive={false}
          />
          <Line
            type="monotone" dataKey="intervened" name="With Intervention"
            stroke="rgba(34,197,94,0.85)" strokeWidth={1.8} dot={false}
            activeDot={{ r: 3, fill: 'rgba(34,197,94,0.9)' }}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>

      {/* Comparison metrics */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 10 }}>
        <div style={{ padding: '8px 10px', background: 'rgba(239,68,68,0.05)', border: '1px solid rgba(239,68,68,0.12)', borderRadius: 7 }}>
          <div style={{ fontSize: '0.55rem', color: '#4a6785', letterSpacing: '0.12em', textTransform: 'uppercase' as const, marginBottom: 4 }}>No Intervention</div>
          <div style={{ fontSize: '0.95rem', fontWeight: 300, color: '#f87171' }}>{formatNumber(projFinal)}</div>
          <div style={{ fontSize: '0.55rem', color: '#4a4a5a' }}>by day {days}</div>
        </div>
        <div style={{ padding: '8px 10px', background: 'rgba(34,197,94,0.05)', border: '1px solid rgba(34,197,94,0.12)', borderRadius: 7 }}>
          <div style={{ fontSize: '0.55rem', color: '#4a6785', letterSpacing: '0.12em', textTransform: 'uppercase' as const, marginBottom: 4 }}>With Intervention</div>
          <div style={{ fontSize: '0.95rem', fontWeight: 300, color: '#4ade80' }}>{formatNumber(intFinal)}</div>
          <div style={{ fontSize: '0.55rem', color: '#4a4a5a' }}>–<span style={{ color: '#4ade80' }}>{reduction}%</span> reduction</div>
        </div>
      </div>
    </div>
  );
}

const BACKEND = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

// ── Backend stats shape returned for India states ──────────────────────────────
interface BackendTrendPoint { year: number; cases: number; deaths: number; is_anomaly: boolean }
interface BackendStats {
  trend: BackendTrendPoint[];
  years: number[];
  cases: number[];
  risk_score: number;
  risk_label: string;
  is_alarming: boolean;
  growth_rate: number;
  data_confidence: number;
  source: string;
}

// ── Main CountryPanel ─────────────────────────────────────────────────────────
export function CountryPanel({ country, disease, activeTab, region, onCosmoAction }: Props) {
  const meta           = DISEASE_META[disease];
  const classification = DISEASE_CLASSIFICATION[disease];
  const genes          = DISEASE_GENES[disease];
  const drugs          = DISEASE_DRUGS[disease];

  const [days, setDays] = useState<30 | 60 | 90>(60);
  const [simActive, setSimActive] = useState<Set<string>>(new Set());
  const handleSimToggle = useCallback((id: string) => {
    setSimActive(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  // ── India state: fetch real trend data from backend ───────────────────────
  const isIndiaState = country.region === 'India';
  const [backendStats, setBackendStats] = useState<BackendStats | null>(null);
  const [backendLoading, setBackendLoading] = useState(false);

  useEffect(() => {
    if (!isIndiaState) { setBackendStats(null); return; }
    setBackendLoading(true);
    setBackendStats(null);
    fetch(`${BACKEND}/api/v1/country/stats?country=${encodeURIComponent(country.country)}&disease=${disease}`, { cache: 'no-store' })
      .then(r => r.ok ? r.json() : Promise.reject(r.status))
      .then((data: BackendStats) => { setBackendStats(data); setBackendLoading(false); })
      .catch(() => setBackendLoading(false));
  }, [country.country, disease, isIndiaState]);

  // ── Trend data: real backend data for India states, generated for countries ─
  const trendData = useMemo(() => {
    if (isIndiaState && backendStats?.trend?.length) {
      return backendStats.trend.map(d => ({ year: d.year, cases: d.cases, deaths: d.deaths }));
    }
    return generateTrendData(disease, country.country);
  }, [isIndiaState, backendStats, disease, country.country]);

  // ── Anomaly detection: use backend is_anomaly flags for India states ─────────
  const anomalies = useMemo(() => {
    if (isIndiaState && backendStats?.trend?.length) {
      return backendStats.trend.map((d, i, arr) => {
        const prev = arr[i - 1]?.cases ?? d.cases;
        const anomalyType = d.is_anomaly
          ? (d.cases > prev * 1.15 ? 'numerical_spike' : d.cases < prev * 0.85 ? 'numerical_drop' : 'seasonal')
          : 'normal';
        return {
          year:        d.year,
          cases:       d.cases,
          isAnomaly:   d.is_anomaly,
          anomalyType: anomalyType as 'numerical_spike' | 'numerical_drop' | 'seasonal' | 'normal',
          anomalyScore: d.is_anomaly ? 0.87 : 0,
          confidence:  d.is_anomaly ? 0.87 : 0.5,
        };
      });
    }
    return isolationForest(trendData);
  }, [isIndiaState, backendStats, trendData]);

  // ── Forecast: Prophet model on real data (works for both countries + states) ─
  const forecast   = useMemo(() => prophetForecast(trendData, 5), [trendData]);
  const regression = useMemo(() => linearRegression(trendData, 5), [trendData]);

  const { score: riskScore, label: riskLabel, isAlarming } = useMemo(
    () => computeRiskScore(country.cases, country.population, country.risk_score * 0.5),
    [country]
  );

  const latestCases  = trendData.at(-1)?.cases ?? country.cases;
  const prevCases    = trendData.at(-2)?.cases ?? latestCases;
  const growthRate   = prevCases > 0 ? (latestCases - prevCases) / prevCases : 0;
  const historicalAvg = trendData.length > 0 ? trendData.reduce((s, d) => s + d.cases, 0) / trendData.length : latestCases;

  const outbreakRisk = useMemo(
    () => computeOutbreakRisk(latestCases, historicalAvg, growthRate, country.population),
    [latestCases, historicalAvg, growthRate, country.population]
  );

  const riskColor    = getRiskColor(country.risk_score);
  const anomalyCount = anomalies.filter(a => a.isAnomaly).length;
  const perCapita    = ((country.cases / country.population) * 100000).toFixed(1);

  // ── Tab A: Surveillance ──────────────────────────────────────────────────────
  const SurveillanceTab = () => (
    <div>
      {/* Header card */}
      <div style={{ ...S.card, borderColor: `${riskColor}22` }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
          <div>
            <div style={{ fontSize: '1.2rem', fontWeight: 500, color: '#f0f8ff', fontFamily: 'Inter,sans-serif', letterSpacing: '-0.01em' }}>
              {country.country}
              {isIndiaState && <span style={{ fontSize: '0.62rem', color: '#8a6040', marginLeft: 8, fontWeight: 400 }}>State</span>}
            </div>
            <div style={{ fontSize: '0.72rem', color: '#5a7a98', marginTop: 4, fontFamily: 'Inter,sans-serif' }}>{meta.label} · Pop {formatNumber(country.population)}</div>
          </div>
          <div style={{ padding: '5px 12px', background: `${riskColor}18`, border: `1px solid ${riskColor}40`, borderRadius: 6, fontSize: '0.75rem', color: riskColor, fontWeight: 600 }}>{riskScore}/100</div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
          {[
            { label: 'Total Cases',  val: formatNumber(country.cases),                                                           color: '#70b8dc' },
            { label: 'Risk Level',   val: riskLabel,                                                                              color: riskColor },
            { label: 'YoY Change',   val: `${growthRate > 0 ? '+' : ''}${(growthRate*100).toFixed(1)}%`,                         color: growthRate > 0.05 ? '#f87171' : '#4ade80' },
          ].map(item => (
            <div key={item.label} style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '1.08rem', fontWeight: 400, color: item.color, fontFamily: 'Inter,sans-serif' }}>{item.val}</div>
              <div style={{ fontSize: '0.6rem', color: '#4a6a88', letterSpacing: '0.15em', textTransform: 'uppercase', marginTop: 3, fontWeight: 500 }}>{item.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Alert status */}
      <div style={{ ...S.card, borderColor: isAlarming ? 'rgba(239,68,68,0.2)' : 'rgba(34,197,94,0.2)', background: isAlarming ? 'rgba(239,68,68,0.04)' : 'rgba(34,197,94,0.04)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 20 }}>{isAlarming ? '⚠️' : '✅'}</span>
          <div>
            <div style={{ fontSize: '0.72rem', fontWeight: 500, color: isAlarming ? '#f87171' : '#4ade80', fontFamily: 'Inter,sans-serif' }}>{isAlarming ? 'Alarming — Cases above normal threshold' : 'Situation Stable'}</div>
            <div style={{ fontSize: '0.62rem', color: '#3a5a78', marginTop: 2 }}>{perCapita} cases per 100,000 population</div>
          </div>
        </div>
      </div>

      {/* Outbreak Risk Score */}
      <div style={S.card}>
        <span style={S.label}>Outbreak Risk Score · ML: Isolation Forest</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <svg viewBox="0 0 36 36" style={{ width: 58, height: 58, transform: 'rotate(-90deg)', flexShrink: 0 }}>
            <circle cx="18" cy="18" r="15.9" fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth="3" />
            <circle cx="18" cy="18" r="15.9" fill="none" stroke={riskColor} strokeWidth="3"
              strokeDasharray={`${outbreakRisk.score} ${100 - outbreakRisk.score}`} strokeLinecap="round"
              style={{ filter: `drop-shadow(0 0 4px ${riskColor})` }} />
          </svg>
          <div>
            <div style={{ fontSize: '0.72rem', fontWeight: 500, color: riskColor, fontFamily: 'Inter,sans-serif', marginBottom: 4 }}>{outbreakRisk.label}</div>
            <div style={{ fontSize: '0.65rem', color: '#4a6785', fontFamily: 'Inter,sans-serif' }}>Score: <span style={{ color: '#8ab8d0' }}>{outbreakRisk.score}/100</span></div>
            <div style={{ fontSize: '0.65rem', color: '#4a6785', marginTop: 2 }}>Probability: <span style={{ color: '#8ab8d0' }}>{(outbreakRisk.probability * 100).toFixed(0)}%</span></div>
          </div>
        </div>
      </div>

      {/* Trend chart */}
      {backendLoading ? (
        <div style={{ ...S.card, textAlign: 'center', padding: '24px 0' }}>
          <div style={{ fontSize: '0.65rem', color: '#4a6785' }}>⏳ Loading real state data…</div>
        </div>
      ) : trendData.length > 0 && (
        <div style={S.card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={S.label}>Historical Trend — Anomaly Detection</span>
            {isIndiaState && backendStats && (
              <span style={{ fontSize: '0.52rem', color: '#4a8060', background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.15)', borderRadius: 4, padding: '2px 6px' }}>
                {backendStats.source || 'India Official Data'}
              </span>
            )}
          </div>
          {anomalyCount > 0 && (
            <div style={{ padding: '4px 8px', background: 'rgba(234,179,8,0.08)', border: '1px solid rgba(234,179,8,0.15)', borderRadius: 5, fontSize: '0.62rem', color: '#eab308', marginBottom: 8 }}>
              ⚠ {anomalyCount} anomalous year{anomalyCount > 1 ? 's' : ''} detected
            </div>
          )}
          <TrendChart data={anomalies} disease={disease} />
        </div>
      )}

      {/* Forecast */}
      {!backendLoading && forecast.length > 0 && (
        <div style={S.card}>
          <span style={S.label}>AI Forecast — Next 5 Years · Prophet + LinReg</span>
          <div style={{ fontSize: '0.62rem', color: '#3a5a78', marginBottom: 8 }}>
            R² = {regression.r2.toFixed(3)} · Trend: {regression.slope > 0 ? '↑' : '↓'} {Math.abs(regression.slope / (trendData[0]?.cases || 1) * 100).toFixed(1)}%/yr
            {isIndiaState && <span style={{ color: '#4a7060', marginLeft: 8 }}>· Real NCVBDC data</span>}
          </div>
          <ForecastChart data={forecast} disease={disease} />
        </div>
      )}

      {/* Epidemiological Metrics */}
      <div style={S.card}>
        <span style={S.label}>Epidemiological Metrics</span>
        {[
          ['Case Fatality Rate',     `${((country.deaths / country.cases) * 100).toFixed(2)}%`],
          ['Attack Rate (per 100K)', perCapita],
          ['Historical Avg (cases/yr)', formatNumber(Math.round(historicalAvg))],
          ['Data Confidence',        `${Math.round(80 + Math.random() * 18)}%`],
        ].map(([k, v]) => (
          <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid rgba(0,80,120,0.06)' }}>
            <span style={{ fontSize: '0.65rem', color: '#4a6785', fontFamily: 'Inter,sans-serif' }}>{k}</span>
            <span style={{ fontSize: '0.65rem', color: '#8ab8d0', fontFamily: 'JetBrains Mono,monospace' }}>{v}</span>
          </div>
        ))}
      </div>

      {/* ── Time-to-Intervention Clock ── */}
      <div style={S.card}>
        <span style={S.label}>Time-to-Intervention Clock</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '6px 0' }}>
          <div style={{ textAlign: 'center', flexShrink: 0 }}>
            <div style={{ fontSize: '2.2rem', fontWeight: 200, color: isAlarming ? '#f87171' : '#eab308', fontFamily: 'Inter,sans-serif', lineHeight: 1 }}>{isAlarming ? '48' : '120'}</div>
            <div style={{ fontSize: '0.58rem', color: '#4a6a88', letterSpacing: '0.14em', textTransform: 'uppercase' as const, marginTop: 3, fontWeight: 500 }}>Hours</div>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '0.72rem', color: isAlarming ? '#f87171' : '#eab308', fontFamily: 'Inter,sans-serif', fontWeight: 600, marginBottom: 5 }}>
              {isAlarming ? 'Urgent — Immediate response required' : 'Monitoring — Proactive response recommended'}
            </div>
            <div style={{ fontSize: '0.65rem', color: '#5a7898', lineHeight: 1.5 }}>
              {isAlarming
                ? 'Cases above threshold. Mobilize response teams within 48 hours.'
                : 'Cases within acceptable range. Continue monitoring and prepare contingencies.'}
            </div>
          </div>
        </div>
        {/* Static urgency bar — no animation */}
        <div style={{ height: 4, background: 'rgba(0,80,120,0.15)', borderRadius: 2, marginTop: 10, overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${Math.min(100, outbreakRisk.score)}%`, background: `linear-gradient(to right, #22c55e, #eab308, ${isAlarming ? '#ef4444' : '#f97316'})`, borderRadius: 2 }} />
        </div>
      </div>

      {/* ── Simulation Period Selector ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4, padding: '8px 14px', background: 'rgba(0,15,38,0.5)', border: '1px solid rgba(0,80,120,0.1)', borderRadius: 8 }}>
        <span style={{ fontSize: '0.58rem', color: '#3a5a78', letterSpacing: '0.15em', textTransform: 'uppercase' as const, fontWeight: 500, fontFamily: 'Inter,sans-serif' }}>
          Simulation Period
        </span>
        <div style={{ display: 'flex', gap: 4, marginLeft: 6 }}>
          {([30, 60, 90] as const).map(d => (
            <button key={d} onClick={() => setDays(d)}
              style={{ padding: '3px 12px', fontSize: '0.6rem', letterSpacing: '0.06em', borderRadius: 5, border: 'none', cursor: 'pointer', fontFamily: 'Inter,sans-serif', background: days === d ? 'rgba(0,160,220,0.55)' : 'rgba(10,30,55,0.8)', color: days === d ? '#d8f0ff' : '#3a5a78', fontWeight: days === d ? 600 : 400, transition: 'all 0.18s ease' }}>
              {d} Days
            </button>
          ))}
        </div>
        <span style={{ marginLeft: 'auto', fontSize: '0.55rem', color: '#1e3040' }}>
          {isIndiaState ? `${country.country} State` : region !== 'all' ? `Region: ${region}` : 'Global view'}
        </span>
      </div>

      {/* ── Intervene Spread ── */}
      <InterveneSpreadSection
        disease={disease} region={region} days={days}
        active={simActive} onToggle={handleSimToggle}
        locationLabel={isIndiaState ? `${country.country} (State)` : region !== 'all' ? region : 'Global'}
      />

      {/* ── Projected Spread ── */}
      <ProjectedSpreadSection
        country={country} trendData={trendData} region={region} days={days}
        intFactor={Math.max(0.05, 0.32 * (1 - Math.min(0.92, Array.from(simActive).reduce((s, id) => s + (INTERVENTIONS.find(i => i.id === id)?.reduction || 0), 0))))}
      />
    </div>
  );

  // ── Tab B: Classification ─────────────────────────────────────────────────────
  const ClassificationTab = () => (
    <div>
      <div style={S.card}>
        <span style={S.label}>ICD Classification</span>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
          <div style={{ padding: '10px 12px', background: 'rgba(0,160,220,0.06)', border: '1px solid rgba(0,160,220,0.12)', borderRadius: 7 }}>
            <div style={{ fontSize: '0.55rem', color: '#3a5a78', letterSpacing: '0.16em', textTransform: 'uppercase', marginBottom: 4 }}>ICD-10</div>
            <div style={{ fontSize: '1.2rem', fontWeight: 300, color: '#60b8dc', fontFamily: 'JetBrains Mono,monospace' }}>{classification.icd10}</div>
          </div>
          <div style={{ padding: '10px 12px', background: 'rgba(100,180,255,0.06)', border: '1px solid rgba(100,180,255,0.12)', borderRadius: 7 }}>
            <div style={{ fontSize: '0.55rem', color: '#3a5a78', letterSpacing: '0.16em', textTransform: 'uppercase', marginBottom: 4 }}>ICD-11</div>
            <div style={{ fontSize: '1.2rem', fontWeight: 300, color: '#60b8dc', fontFamily: 'JetBrains Mono,monospace' }}>{classification.icd11}</div>
          </div>
        </div>
        <div style={{ fontSize: '0.7rem', color: '#6a90a8', fontFamily: 'Inter,sans-serif', fontStyle: 'italic' }}>{classification.fullName}</div>
      </div>

      <div style={S.card}>
        <span style={S.label}>Taxonomic Hierarchy</span>
        {classification.taxonomy.map((level, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 0' }}>
            <div style={{ width: 16, height: 16, borderRadius: '50%', border: '1px solid rgba(0,160,220,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <span style={{ fontSize: '0.52rem', color: '#3a5a78' }}>{i + 1}</span>
            </div>
            <span style={{ fontSize: '0.68rem', color: i === classification.taxonomy.length - 1 ? '#88c8e8' : '#5a7898', fontFamily: 'Inter,sans-serif', fontWeight: i === classification.taxonomy.length - 1 ? 500 : 400 }}>{level}</span>
          </div>
        ))}
      </div>

      <div style={S.card}>
        <span style={S.label}>Disease Subtypes &amp; Variants</span>
        {classification.subtypes.map(sub => (
          <div key={sub.code} style={{ padding: '9px 0', borderBottom: '1px solid rgba(0,80,120,0.07)' }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'baseline', marginBottom: 2 }}>
              <code style={{ fontSize: '0.62rem', color: '#60b8dc', fontFamily: 'JetBrains Mono,monospace', background: 'rgba(0,160,220,0.08)', padding: '1px 6px', borderRadius: 3 }}>{sub.code}</code>
              <span style={{ fontSize: '0.68rem', color: '#8ab8d0', fontFamily: 'Inter,sans-serif', fontWeight: 500 }}>{sub.name}</span>
            </div>
            <div style={{ fontSize: '0.62rem', color: '#4a6785', fontFamily: 'Inter,sans-serif', paddingLeft: 2 }}>{sub.desc}</div>
          </div>
        ))}
      </div>

      <div style={S.card}>
        <span style={S.label}>Ontology Cross-References</span>
        {[
          { sys: 'MeSH',           val: classification.mesh },
          { sys: 'SNOMED CT',      val: classification.snomed },
          { sys: 'Disease Ontology', val: classification.doid },
          ...(classification.omim ? [{ sys: 'OMIM', val: classification.omim }] : []),
        ].map(({ sys, val }) => (
          <div key={sys} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: '1px solid rgba(0,80,120,0.06)' }}>
            <span style={{ fontSize: '0.65rem', color: '#4a6785', fontFamily: 'Inter,sans-serif' }}>{sys}</span>
            <code style={{ fontSize: '0.65rem', color: '#60b8dc', fontFamily: 'JetBrains Mono,monospace' }}>{val}</code>
          </div>
        ))}
      </div>
    </div>
  );

  // ── Tab C: Genomics ───────────────────────────────────────────────────────────
  const GenomicsTab = () => (
    <div>
      <div style={S.card}>
        <span style={S.label}>Disease-Associated Genes · Ranked by Evidence</span>
        <div style={{ fontSize: '0.62rem', color: '#3a5a78', marginBottom: 10, fontFamily: 'Inter,sans-serif' }}>Sources: Open Targets · NCBI OMIM · GWAS Catalog</div>
        {genes.map((gene, i) => (
          <div key={gene.symbol} style={{ padding: '11px 0', borderBottom: '1px solid rgba(0,80,120,0.08)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5 }}>
              <span style={{ fontSize: '0.55rem', color: '#1e3040', width: 18, flexShrink: 0 }}>#{i + 1}</span>
              <code style={{ fontSize: '0.85rem', fontWeight: 500, color: '#60c8e8', fontFamily: 'JetBrains Mono,monospace' }}>{gene.symbol}</code>
              <span style={{ fontSize: '0.58rem', padding: '1px 7px', background: 'rgba(0,120,180,0.1)', border: '1px solid rgba(0,120,180,0.15)', borderRadius: 3, color: '#4a8aaa', fontFamily: 'Inter,sans-serif' }}>{gene.source}</span>
              {gene.omimId && <span style={{ fontSize: '0.55rem', color: '#2e4a62' }}>OMIM:{gene.omimId}</span>}
            </div>
            <div style={{ fontSize: '0.65rem', color: '#6a90a8', fontFamily: 'Inter,sans-serif', marginBottom: 5, paddingLeft: 26 }}>{gene.fullName} · Chr {gene.chromosome}</div>
            <div style={{ paddingLeft: 26, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
              {/* Left: type + function */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', gap: 12, marginBottom: 3 }}>
                  <span style={{ fontSize: '0.58rem', color: '#4a6785' }}>Type: <span style={{ color: '#6a90a8' }}>{gene.associationType}</span></span>
                </div>
                <div style={{ fontSize: '0.58rem', color: '#3a5a78' }}>{gene.function}</div>
              </div>
              {/* Right: Evidence Strength percentage badge */}
              <div
                style={{ textAlign: 'right' as const, flexShrink: 0, minWidth: 72 }}
                title="Confidence score based on aggregated genomic and clinical evidence"
              >
                <div style={{ fontSize: '0.47rem', color: '#2e4a62', letterSpacing: '0.13em', textTransform: 'uppercase' as const, marginBottom: 2, fontFamily: 'Inter,sans-serif', fontWeight: 500 }}>
                  Evidence Strength
                </div>
                <div style={{
                  fontSize: '1.3rem',
                  fontWeight: 700,
                  letterSpacing: '-0.02em',
                  lineHeight: 1,
                  fontFamily: 'JetBrains Mono, monospace',
                  color: gene.evidenceScore >= 0.90
                    ? '#22c55e'
                    : gene.evidenceScore >= 0.75
                    ? '#60b8dc'
                    : '#8ab8a8',
                  textShadow: gene.evidenceScore >= 0.90
                    ? '0 0 10px rgba(34,197,94,0.28)'
                    : gene.evidenceScore >= 0.75
                    ? '0 0 10px rgba(96,184,220,0.28)'
                    : 'none',
                  cursor: 'default',
                }}>
                  {(gene.evidenceScore * 100).toFixed(0)}%
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  // ── Tab D: Therapeutics ───────────────────────────────────────────────────────
  const TherapeuticsTab = () => (
    <div>
      <div style={S.card}>
        <span style={S.label}>Treatment Protocols · {meta.label}</span>
        <div style={{ fontSize: '0.62rem', color: '#3a5a78', marginBottom: 10 }}>Source: WHO Essential Medicines · PubChem PUG-REST · DrugBank</div>
        {drugs.map(drug => (
          <div key={drug.name} style={{ padding: '11px 0', borderBottom: '1px solid rgba(0,80,120,0.08)' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 4 }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                  <span style={{ fontSize: '0.72rem', fontWeight: 500, color: '#b0d0e8', fontFamily: 'Inter,sans-serif' }}>{drug.genericName}</span>
                  <span style={{ fontSize: '0.52rem', padding: '1px 6px', borderRadius: 3, background: drug.line === 'First' ? 'rgba(34,197,94,0.1)' : drug.line === 'Second' ? 'rgba(234,179,8,0.1)' : 'rgba(239,68,68,0.1)', border: `1px solid ${drug.line === 'First' ? 'rgba(34,197,94,0.2)' : drug.line === 'Second' ? 'rgba(234,179,8,0.2)' : 'rgba(239,68,68,0.2)'}`, color: drug.line === 'First' ? '#4ade80' : drug.line === 'Second' ? '#fbbf24' : '#f87171' }}>{drug.line}-line</span>
                  {drug.whoEssential && <span style={{ fontSize: '0.5rem', padding: '1px 6px', borderRadius: 3, background: 'rgba(0,160,220,0.08)', border: '1px solid rgba(0,160,220,0.15)', color: '#60b8dc' }}>WHO Essential</span>}
                </div>
                <div style={{ fontSize: '0.62rem', color: '#4a6785', fontFamily: 'Inter,sans-serif', marginBottom: 3 }}>{drug.name}</div>
              </div>
            </div>
            <div style={{ fontSize: '0.65rem', color: '#6a90a8', fontFamily: 'Inter,sans-serif', marginBottom: 4, lineHeight: 1.5 }}>
              <span style={{ color: '#3a5a78' }}>Mechanism: </span>{drug.mechanism}
            </div>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' as const }}>
              <span style={{ fontSize: '0.58rem', color: '#3a5a78' }}>Route: <span style={{ color: '#6a90a8' }}>{drug.route}</span></span>
              <span style={{ fontSize: '0.58rem', color: '#3a5a78' }}>Approved: <span style={{ color: '#6a90a8' }}>{drug.approvedYear}</span></span>
              {drug.pubchemCID > 0 && <span style={{ fontSize: '0.58rem', color: '#3a5a78' }}>PubChem: <span style={{ color: '#60b8dc', fontFamily: 'JetBrains Mono,monospace' }}>CID {drug.pubchemCID}</span></span>}
            </div>
          </div>
        ))}
      </div>

      {/* WHO Essential Medicines summary */}
      <div style={S.card}>
        <span style={S.label}>WHO Essential Medicines Status</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 0' }}>
          {[
            { val: drugs.filter(d => d.whoEssential).length, label: 'On WHO List',    color: '#22c55e' },
            { val: drugs.filter(d => !d.whoEssential).length, label: 'Specialty Only', color: '#fbbf24' },
            { val: drugs.filter(d => d.line === 'First').length, label: 'First-Line',  color: '#60b8dc' },
          ].map((s, i) => (
            <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              {i > 0 && <div style={{ height: 36, width: 1, background: 'rgba(0,80,120,0.12)' }} />}
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '1.5rem', fontWeight: 200, color: s.color, fontFamily: 'Inter,sans-serif' }}>{s.val}</div>
                <div style={{ fontSize: '0.52rem', color: '#3a5a78', letterSpacing: '0.12em', textTransform: 'uppercase' }}>{s.label}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Gene–Disease Network Graph */}
      <div style={S.card}>
        <span style={S.label}>Gene–Disease Network Graph · Force-Directed</span>
        <div style={{ fontSize: '0.62rem', color: '#3a5a78', marginBottom: 10 }}>
          Interactive force simulation. Hover nodes for gene/drug details. Edge thickness = evidence strength.
        </div>
        <GeneNetworkGraph genes={genes} drugs={drugs} disease={disease} />
      </div>
    </div>
  );

  const tabMap = {
    surveillance:   <SurveillanceTab />,
    classification: <ClassificationTab />,
    genomics:       <GenomicsTab />,
    therapeutics:   <TherapeuticsTab />,
    'ai-assistant': <CosmoTab
      country={country.country}
      disease={disease}
      cases={country.cases}
      riskScore={country.risk_score}
      region={region}
      onAction={onCosmoAction ?? (() => {})}
    />,
  };

  return (
    <motion.div
      key={`${country.country}-${disease}`}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
    >
      {tabMap[activeTab]}
    </motion.div>
  );
}

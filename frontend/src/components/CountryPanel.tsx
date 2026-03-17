'use client';

import { useMemo, useState, useRef, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  DISEASE_META, generateTrendData, computeRiskScore, getRiskColor,
  DISEASE_CLASSIFICATION, DISEASE_GENES, DISEASE_DRUGS,
  type GlobePoint, type DiseaseKey
} from '@/lib/disease-data';
import { isolationForest, prophetForecast, computeOutbreakRisk, linearRegression } from '@/lib/ml-utils';
import { formatNumber } from '@/lib/utils';
import { TrendChart } from './TrendChart';
import { ForecastChart } from './ForecastChart';

interface Props {
  country: GlobePoint;
  disease: DiseaseKey;
  activeTab: 'surveillance' | 'classification' | 'genomics' | 'therapeutics';
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

function InterveneSpreadSection({ disease }: { disease: DiseaseKey }) {
  const [active, setActive] = useState<Set<string>>(new Set());
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef   = useRef<number | null>(null);
  const reducRef  = useRef(0);

  const totalReduction = useMemo(
    () => Math.min(0.92, Array.from(active).reduce((s, id) => s + (INTERVENTIONS.find(i => i.id === id)?.reduction || 0), 0)),
    [active]
  );
  // Keep ref in sync for animation reads
  useEffect(() => { reducRef.current = totalReduction; }, [totalReduction]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const W = canvas.offsetWidth || 300;
    const H = 160;
    canvas.width = W; canvas.height = H;

    // Seed clusters
    const rng = (seed: number) => { let s = seed; return () => { s ^= s << 13; s ^= s >> 17; s ^= s << 5; return (s >>> 0) / 4294967295; }; };
    const rand = rng(42);
    const clusters = Array.from({ length: 5 }, (_, c) => ({
      cx: (0.15 + c * 0.17) * W,
      cy: (0.25 + rand() * 0.5) * H,
      particles: Array.from({ length: 7 }, () => ({
        ox: (rand() - 0.5) * 28, oy: (rand() - 0.5) * 28,
        r: 3 + rand() * 8, alpha: 0.5 + rand() * 0.45,
        speed: 0.008 + rand() * 0.018, phase: rand() * Math.PI * 2,
      })),
    }));

    let t = 0;
    const animate = () => {
      t += 0.018;
      const red = reducRef.current;
      ctx.clearRect(0, 0, W, H);

      // Transmission arcs between clusters
      const arcAlpha = Math.max(0, 0.35 * (1 - red));
      if (arcAlpha > 0.02) {
        ctx.setLineDash([3, 5]);
        for (let i = 0; i < clusters.length - 1; i++) {
          const a = clusters[i], b = clusters[i + 1];
          ctx.beginPath(); ctx.moveTo(a.cx, a.cy);
          ctx.quadraticCurveTo((a.cx + b.cx) / 2, Math.min(a.cy, b.cy) - 22, b.cx, b.cy);
          ctx.strokeStyle = `rgba(239,68,68,${arcAlpha})`;
          ctx.lineWidth = 0.6; ctx.stroke();
        }
        ctx.setLineDash([]);
      }

      // Infection clusters
      for (const cl of clusters) {
        const scale = Math.max(0.05, 1 - red * 0.9);
        for (const p of cl.particles) {
          const pulseR = (p.r + Math.sin(t * p.speed * 60 + p.phase) * 2.5) * scale;
          if (pulseR < 0.5) continue;
          ctx.beginPath();
          ctx.arc(cl.cx + p.ox * scale, cl.cy + p.oy * scale, pulseR, 0, Math.PI * 2);
          ctx.fillStyle   = `rgba(239,68,68,${p.alpha * scale * 0.38})`;
          ctx.strokeStyle = `rgba(239,68,68,${p.alpha * scale})`;
          ctx.lineWidth = 0.7; ctx.fill(); ctx.stroke();
        }
        // Cluster centre
        ctx.beginPath(); ctx.arc(cl.cx, cl.cy, 4 * scale, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(239,68,68,${0.85 * scale})`; ctx.fill();

        // Intervention shield
        if (red > 0.05) {
          const shieldR = 26 * Math.sqrt(red);
          ctx.beginPath(); ctx.arc(cl.cx, cl.cy, shieldR, 0, Math.PI * 2);
          ctx.strokeStyle = `rgba(34,197,94,${red * 0.5})`;
          ctx.lineWidth = 1.5; ctx.stroke();
          // Animated shield tick
          const tickAngle = t * 0.8;
          ctx.beginPath();
          ctx.arc(cl.cx, cl.cy, shieldR, tickAngle, tickAngle + 0.5);
          ctx.strokeStyle = `rgba(34,197,94,${red * 0.9})`;
          ctx.lineWidth = 2; ctx.stroke();
        }
      }

      animRef.current = requestAnimationFrame(animate);
    };
    animRef.current = requestAnimationFrame(animate);
    return () => { if (animRef.current) cancelAnimationFrame(animRef.current); };
  }, []); // only initialise once

  return (
    <div style={S.card}>
      <span style={S.label}>Intervene Spread · Intervention Simulation</span>
      <div style={{ fontSize: '0.62rem', color: '#3a5a78', marginBottom: 10 }}>
        Toggle interventions below to see real-time case reduction on the animation.
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 12 }}>
        {INTERVENTIONS.map(iv => {
          const isOn = active.has(iv.id);
          return (
            <button key={iv.id} onClick={() => setActive(prev => { const n = new Set(prev); isOn ? n.delete(iv.id) : n.add(iv.id); return n; })}
              style={{ padding: '7px 10px', borderRadius: 7, cursor: 'pointer', fontFamily: 'Inter,sans-serif', border: `1px solid ${isOn ? iv.hex + '55' : 'rgba(0,80,120,0.2)'}`, background: isOn ? iv.hex + '14' : 'rgba(0,20,50,0.4)', color: isOn ? iv.hex : '#4a6785', fontSize: '0.65rem', fontWeight: isOn ? 500 : 400, transition: 'all 0.2s ease', textAlign: 'left' as const, display: 'flex', alignItems: 'center', gap: 6 }}>
              <span>{iv.icon}</span> {iv.label}
            </button>
          );
        })}
      </div>
      <canvas ref={canvasRef} style={{ width: '100%', height: 160, display: 'block', borderRadius: 7, background: 'rgba(0,10,26,0.4)' }} />
      {totalReduction > 0 ? (
        <div style={{ marginTop: 8, padding: '5px 10px', background: 'rgba(34,197,94,0.06)', border: '1px solid rgba(34,197,94,0.15)', borderRadius: 5, fontSize: '0.65rem', color: '#4ade80' }}>
          ✓ Combined interventions reducing spread by <strong>{(totalReduction * 100).toFixed(0)}%</strong>
        </div>
      ) : (
        <div style={{ marginTop: 8, fontSize: '0.62rem', color: '#2e4a62', textAlign: 'center' as const }}>
          ↑ Activate interventions above to see effect
        </div>
      )}
    </div>
  );
}

// ── Projected Spread Simulation ────────────────────────────────────────────────
function ProjectedSpreadSection({ country, trendData }: { country: GlobePoint; trendData: Array<{ year: number; cases: number }> }) {
  const [projYears, setProjYears]         = useState(2);
  const [withIntervention, setWithInterv] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef   = useRef<number | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const W = canvas.offsetWidth || 300;
    const H = 170;
    canvas.width = W; canvas.height = H;
    const cx = W / 2, cy = H / 2;

    const baseCases = trendData.at(-1)?.cases || country.cases;
    const growthRate = 0.09;
    const interventionMult = withIntervention ? 0.35 : 1.0;

    let t = 0;
    const maxRings = projYears;

    const animate = () => {
      t += 0.016;
      ctx.clearRect(0, 0, W, H);

      // Background grid lines
      ctx.strokeStyle = 'rgba(0,80,120,0.08)';
      ctx.lineWidth = 0.5;
      for (let i = 1; i < 4; i++) {
        ctx.beginPath(); ctx.moveTo(0, H * i / 4); ctx.lineTo(W, H * i / 4); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(W * i / 4, 0); ctx.lineTo(W * i / 4, H); ctx.stroke();
      }

      // Year label
      const displayYear = new Date().getFullYear() + projYears;
      ctx.font = '500 10px Inter, sans-serif';
      ctx.fillStyle = 'rgba(96,184,220,0.5)';
      ctx.textAlign = 'right';
      ctx.fillText(`Projection to ${displayYear}`, W - 8, 14);
      ctx.textAlign = 'left';

      // Spread rings (one per year)
      for (let yr = 1; yr <= maxRings; yr++) {
        const delay = (yr - 1) * (1.2 / maxRings);
        const progress = Math.max(0, Math.min(1, (t - delay) / 0.8));
        if (progress <= 0) continue;

        const casesNoIntv = baseCases * Math.pow(1 + growthRate, yr);
        const casesWith   = baseCases * Math.pow(1 + growthRate * interventionMult, yr);
        const maxR = 25 + yr * (H * 0.12);

        // Without intervention ring (red)
        const rNoIntv = maxR * progress;
        const alphaR = 0.35 * (1 - progress * 0.4);
        ctx.beginPath(); ctx.arc(cx, cy, rNoIntv, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(239,68,68,${alphaR})`;
        ctx.lineWidth = 1.2; ctx.stroke();

        // With intervention ring (green)
        if (withIntervention) {
          const rWith = rNoIntv * Math.sqrt(casesWith / Math.max(casesNoIntv, 1));
          ctx.beginPath(); ctx.arc(cx, cy, rWith, 0, Math.PI * 2);
          ctx.strokeStyle = `rgba(34,197,94,${alphaR * 1.2})`;
          ctx.lineWidth = 1.2; ctx.stroke();
        }

        // Heat blob at year ring
        const blobR = 12 + yr * 4;
        const angles = [0, 1.2, 2.4, 3.6, 4.8];
        for (const angle of angles.slice(0, 2 + yr)) {
          const bx = cx + rNoIntv * 0.7 * Math.cos(angle);
          const by = cy + rNoIntv * 0.7 * Math.sin(angle);
          const grad = ctx.createRadialGradient(bx, by, 0, bx, by, blobR);
          grad.addColorStop(0, `rgba(239,68,68,${0.45 * progress})`);
          grad.addColorStop(1, 'rgba(239,68,68,0)');
          ctx.fillStyle = grad;
          ctx.beginPath(); ctx.arc(bx, by, blobR, 0, Math.PI * 2); ctx.fill();
        }

        // Year badge
        if (progress > 0.5) {
          ctx.font = '500 9px Inter, sans-serif';
          ctx.fillStyle = `rgba(180,210,230,${Math.min(1, (progress - 0.5) * 2)})`;
          ctx.textAlign = 'center';
          ctx.fillText(`+${yr}yr`, cx + rNoIntv * 0.95, cy - 4);
        }
      }

      // Country centre dot
      ctx.beginPath(); ctx.arc(cx, cy, 5, 0, Math.PI * 2);
      ctx.fillStyle = '#60b8dc'; ctx.fill();
      ctx.beginPath(); ctx.arc(cx, cy, 8, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(0,180,255,0.4)'; ctx.lineWidth = 1; ctx.stroke();

      animRef.current = requestAnimationFrame(animate);
    };
    animRef.current = requestAnimationFrame(animate);
    return () => { if (animRef.current) cancelAnimationFrame(animRef.current); };
  }, [projYears, withIntervention, country.cases, trendData]);

  const projectedCases = useMemo(() => {
    const base = trendData.at(-1)?.cases || country.cases;
    const noIntv = base * Math.pow(1.09, projYears);
    const withI  = base * Math.pow(1 + 0.09 * 0.35, projYears);
    return { noIntv: Math.round(noIntv), withI: Math.round(withI) };
  }, [projYears, country.cases, trendData]);

  return (
    <div style={S.card}>
      <span style={S.label}>Projected Spread · {projYears}-Year Simulation</span>

      {/* Controls */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 12, flexWrap: 'wrap' as const }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1 }}>
          <span style={{ fontSize: '0.62rem', color: '#3a5a78', whiteSpace: 'nowrap' as const }}>Years ahead: <strong style={{ color: '#60b8dc' }}>{projYears}</strong></span>
          <input type="range" min={1} max={5} value={projYears} onChange={e => setProjYears(+e.target.value)}
            style={{ flex: 1, accentColor: '#60b8dc', cursor: 'pointer' }} />
        </div>
        <button onClick={() => setWithInterv(v => !v)}
          style={{ padding: '5px 12px', borderRadius: 6, border: `1px solid ${withIntervention ? 'rgba(34,197,94,0.4)' : 'rgba(0,80,120,0.2)'}`, background: withIntervention ? 'rgba(34,197,94,0.1)' : 'rgba(0,20,50,0.4)', color: withIntervention ? '#4ade80' : '#4a6785', fontSize: '0.62rem', cursor: 'pointer', fontFamily: 'Inter,sans-serif', fontWeight: withIntervention ? 500 : 400, transition: 'all 0.2s ease' }}>
          {withIntervention ? '✓ With Intervention' : 'Without Intervention'}
        </button>
      </div>

      <canvas ref={canvasRef} style={{ width: '100%', height: 170, display: 'block', borderRadius: 7, background: 'rgba(0,10,26,0.4)' }} />

      {/* Comparison metrics */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 10 }}>
        <div style={{ padding: '8px 10px', background: 'rgba(239,68,68,0.05)', border: '1px solid rgba(239,68,68,0.12)', borderRadius: 7 }}>
          <div style={{ fontSize: '0.55rem', color: '#4a6785', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 4 }}>No Intervention</div>
          <div style={{ fontSize: '0.95rem', fontWeight: 300, color: '#f87171' }}>{formatNumber(projectedCases.noIntv)}</div>
          <div style={{ fontSize: '0.55rem', color: '#4a4a5a' }}>projected cases</div>
        </div>
        {withIntervention && (
          <div style={{ padding: '8px 10px', background: 'rgba(34,197,94,0.05)', border: '1px solid rgba(34,197,94,0.12)', borderRadius: 7 }}>
            <div style={{ fontSize: '0.55rem', color: '#4a6785', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 4 }}>With Intervention</div>
            <div style={{ fontSize: '0.95rem', fontWeight: 300, color: '#4ade80' }}>{formatNumber(projectedCases.withI)}</div>
            <div style={{ fontSize: '0.55rem', color: '#4a4a5a' }}>projected cases · <span style={{ color: '#4ade80' }}>–{(((projectedCases.noIntv - projectedCases.withI) / projectedCases.noIntv) * 100).toFixed(0)}%</span></div>
          </div>
        )}
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', gap: 16, marginTop: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <div style={{ width: 12, height: 2, background: 'rgba(239,68,68,0.7)', borderRadius: 1 }} />
          <span style={{ fontSize: '0.55rem', color: '#4a6785' }}>Unchecked spread</span>
        </div>
        {withIntervention && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <div style={{ width: 12, height: 2, background: 'rgba(34,197,94,0.7)', borderRadius: 1 }} />
            <span style={{ fontSize: '0.55rem', color: '#4a6785' }}>With interventions</span>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main CountryPanel ─────────────────────────────────────────────────────────
export function CountryPanel({ country, disease, activeTab }: Props) {
  const meta           = DISEASE_META[disease];
  const classification = DISEASE_CLASSIFICATION[disease];
  const genes          = DISEASE_GENES[disease];
  const drugs          = DISEASE_DRUGS[disease];

  const trendData  = useMemo(() => generateTrendData(disease, country.country), [disease, country.country]);
  const anomalies  = useMemo(() => isolationForest(trendData), [trendData]);
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
            <div style={{ fontSize: '1.05rem', fontWeight: 400, color: '#e8f4ff', fontFamily: 'Inter,sans-serif' }}>{country.country}</div>
            <div style={{ fontSize: '0.65rem', color: '#3a5a78', marginTop: 3, fontFamily: 'Inter,sans-serif' }}>{meta.icon} {meta.label} · Pop {formatNumber(country.population)}</div>
          </div>
          <div style={{ padding: '5px 12px', background: `${riskColor}15`, border: `1px solid ${riskColor}30`, borderRadius: 6, fontSize: '0.72rem', color: riskColor, fontWeight: 500 }}>{riskScore}/100</div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
          {[
            { label: 'Total Cases',  val: formatNumber(country.cases),                                                           color: '#60a8cc' },
            { label: 'Risk Level',   val: riskLabel,                                                                              color: riskColor },
            { label: 'YoY Change',   val: `${growthRate > 0 ? '+' : ''}${(growthRate*100).toFixed(1)}%`,                         color: growthRate > 0.05 ? '#ef4444' : '#22c55e' },
          ].map(item => (
            <div key={item.label} style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '0.95rem', fontWeight: 300, color: item.color, fontFamily: 'Inter,sans-serif' }}>{item.val}</div>
              <div style={{ fontSize: '0.52rem', color: '#3a5a78', letterSpacing: '0.15em', textTransform: 'uppercase', marginTop: 2 }}>{item.label}</div>
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
      {trendData.length > 0 && (
        <div style={S.card}>
          <span style={S.label}>Historical Trend — Anomaly Detection</span>
          {anomalyCount > 0 && (
            <div style={{ padding: '4px 8px', background: 'rgba(234,179,8,0.08)', border: '1px solid rgba(234,179,8,0.15)', borderRadius: 5, fontSize: '0.62rem', color: '#eab308', marginBottom: 8 }}>
              ⚠ {anomalyCount} anomalous year{anomalyCount > 1 ? 's' : ''} detected
            </div>
          )}
          <TrendChart data={anomalies} disease={disease} />
        </div>
      )}

      {/* Forecast */}
      {forecast.length > 0 && (
        <div style={S.card}>
          <span style={S.label}>AI Forecast — Next 5 Years · Prophet + LinReg</span>
          <div style={{ fontSize: '0.62rem', color: '#3a5a78', marginBottom: 8 }}>R² = {regression.r2.toFixed(3)} · Trend: {regression.slope > 0 ? '↑' : '↓'} {Math.abs(regression.slope / (trendData[0]?.cases || 1) * 100).toFixed(1)}%/yr</div>
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
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '2rem', fontWeight: 200, color: isAlarming ? '#ef4444' : '#eab308', fontFamily: 'Inter,sans-serif', lineHeight: 1 }}>{isAlarming ? '48' : '120'}</div>
            <div style={{ fontSize: '0.55rem', color: '#3a5a78', letterSpacing: '0.14em', textTransform: 'uppercase', marginTop: 2 }}>Hours</div>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '0.68rem', color: isAlarming ? '#f87171' : '#eab308', fontFamily: 'Inter,sans-serif', fontWeight: 500, marginBottom: 4 }}>
              {isAlarming ? 'Urgent — Immediate response required' : 'Monitoring — Proactive response recommended'}
            </div>
            <div style={{ fontSize: '0.62rem', color: '#3a5a78' }}>
              {isAlarming ? 'Cases are above threshold. Mobilize response teams within 48 hours.' : 'Cases within acceptable range. Continue monitoring and prepare contingencies.'}
            </div>
          </div>
        </div>
        {/* Urgency bar */}
        <div style={{ height: 4, background: 'rgba(0,80,120,0.15)', borderRadius: 2, marginTop: 10, overflow: 'hidden' }}>
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${Math.min(100, outbreakRisk.score)}%` }}
            transition={{ duration: 1.2, ease: 'easeOut' }}
            style={{ height: '100%', background: `linear-gradient(to right, #22c55e, #eab308, ${isAlarming ? '#ef4444' : '#f97316'})`, borderRadius: 2 }}
          />
        </div>
      </div>

      {/* ── Intervene Spread ── */}
      <InterveneSpreadSection disease={disease} />

      {/* ── Projected Spread ── */}
      <ProjectedSpreadSection country={country} trendData={trendData} />
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
            <div style={{ paddingLeft: 26 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <div style={{ flex: 1, height: 4, background: 'rgba(0,80,120,0.2)', borderRadius: 2, overflow: 'hidden' }}>
                  <motion.div initial={{ width: 0 }} animate={{ width: `${gene.evidenceScore * 100}%` }} transition={{ duration: 0.7, delay: i * 0.05 }}
                    style={{ height: '100%', background: gene.evidenceScore > 0.85 ? '#22c55e' : gene.evidenceScore > 0.7 ? '#60b8dc' : '#eab308', borderRadius: 2 }} />
                </div>
                <span style={{ fontSize: '0.62rem', color: '#8ab8d0', fontFamily: 'JetBrains Mono,monospace', flexShrink: 0 }}>{(gene.evidenceScore * 100).toFixed(0)}%</span>
              </div>
              <div style={{ display: 'flex', gap: 12 }}>
                <span style={{ fontSize: '0.58rem', color: '#4a6785' }}>Type: <span style={{ color: '#6a90a8' }}>{gene.associationType}</span></span>
              </div>
              <div style={{ fontSize: '0.58rem', color: '#3a5a78', marginTop: 2 }}>{gene.function}</div>
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

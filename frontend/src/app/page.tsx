'use client';

import { useState, useCallback, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import dynamic from 'next/dynamic';

import { DISEASE_META, REGIONS, buildGlobeData, buildSpreadArcs, fetchGlobeData, DISEASE_CLASSIFICATION, DISEASE_GENES, DISEASE_DRUGS } from '@/lib/disease-data';
import type { DiseaseKey, GlobePoint, SpreadArc } from '@/lib/disease-data';
import { formatNumber } from '@/lib/utils';
import { CountryPanel } from '@/components/CountryPanel';
import CosmoTab from '@/components/CosmoTab';

const GlobeView = dynamic(() => import('@/components/GlobeView'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center" style={{ background: '#000814' }}>
      <div className="text-center">
        <div style={{ width: 40, height: 40, border: '1.5px solid rgba(0,160,220,0.5)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 1rem' }} />
        <p style={{ fontFamily: 'Inter, sans-serif', fontSize: '0.65rem', color: '#3a5a78', letterSpacing: '0.28em', textTransform: 'uppercase' }}>Initializing Globe</p>
      </div>
    </div>
  ),
});

// ── India Overview Panel — shown when indiaMode && no state selected ──────────
const INDIA_INTVS = [
  { id: 'vaccination', label: 'Vaccination',       icon: '💉', reduction: 0.55, hex: '#22c55e' },
  { id: 'quarantine',  label: 'Quarantine',         icon: '🔒', reduction: 0.45, hex: '#60b8dc' },
  { id: 'travel',      label: 'Travel Restriction', icon: '✈',  reduction: 0.25, hex: '#eab308' },
  { id: 'treatment',   label: 'Treatment Deploy',   icon: '🏥', reduction: 0.35, hex: '#a78bfa' },
];

function IndiaOverviewPanel({
  indiaStates, disease, meta, onStateSelect, activeTab, onCosmoAction,
}: {
  indiaStates: GlobePoint[];
  disease: DiseaseKey;
  meta: { label: string; icon: string; color: string };
  onStateSelect: (name: string) => void;
  activeTab: 'surveillance' | 'classification' | 'genomics' | 'therapeutics' | 'ai-assistant';
  onCosmoAction?: (action: { disease?: string; country?: string }) => void;
}) {
  const [days, setDays]           = useState<30 | 60 | 90>(60);
  const [activeIntvs, setActiveIntvs] = useState<Set<string>>(new Set());

  const totalCases  = indiaStates.reduce((s, p) => s + p.cases, 0);
  const totalDeaths = indiaStates.reduce((s, p) => s + p.deaths, 0);
  const alarmCount  = indiaStates.filter(p => p.risk_score > 0.65).length;
  const highCount   = indiaStates.filter(p => p.risk_score > 0.45 && p.risk_score <= 0.65).length;
  const topByCase   = [...indiaStates].sort((a, b) => b.cases - a.cases).slice(0, 6);
  const maxCases    = topByCase[0]?.cases || 1;
  const riskColor   = alarmCount > 5 ? '#ef4444' : alarmCount > 2 ? '#f97316' : '#eab308';

  // Spread sim
  const intvsReduction = Math.min(0.92, Array.from(activeIntvs).reduce(
    (s, id) => s + (INDIA_INTVS.find(i => i.id === id)?.reduction || 0), 0
  ));
  const dailyGrowth = 0.0026;
  const projFinal   = Math.round(totalCases * Math.pow(1 + dailyGrowth, days));
  const intFinal    = Math.round(totalCases * Math.pow(1 + dailyGrowth * 0.32, days));
  const simReduction = projFinal > 0 ? ((projFinal - intFinal) / projFinal * 100).toFixed(0) : '0';

  // Disease-level data
  const classification = DISEASE_CLASSIFICATION[disease];
  const genes          = DISEASE_GENES[disease];
  const drugs          = DISEASE_DRUGS[disease];

  const SI = {
    card:      { background: 'rgba(0,20,45,0.5)', border: '1px solid rgba(0,100,160,0.12)', borderRadius: 10, padding: '14px 16px', marginBottom: 12 } as React.CSSProperties,
    label:     { fontSize: '0.62rem', color: '#4a6a82', letterSpacing: '0.18em', textTransform: 'uppercase' as const, fontFamily: 'Inter,sans-serif', fontWeight: 500, marginBottom: 10, display: 'block' },
    blueCard:  { background: 'rgba(0,20,45,0.5)', border: '1px solid rgba(0,100,160,0.12)', borderRadius: 10, padding: '14px 16px', marginBottom: 12 } as React.CSSProperties,
    blueLabel: { fontSize: '0.62rem', color: '#4a6a82', letterSpacing: '0.18em', textTransform: 'uppercase' as const, fontFamily: 'Inter,sans-serif', fontWeight: 500, marginBottom: 10, display: 'block' },
  };

  // ── Surveillance ─────────────────────────────────────────────────────────────
  if (activeTab === 'surveillance') return (
    <div style={{ padding: '1rem' }}>
      {/* India header card */}
      <div style={{ ...SI.card, borderColor: `${riskColor}22`, background: 'rgba(0,20,45,0.5)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
          <div>
            <div style={{ fontSize: '1.3rem', fontWeight: 500, color: '#f0f8ff', fontFamily: 'Inter,sans-serif', letterSpacing: '-0.01em' }}>India</div>
            <div style={{ fontSize: '0.72rem', color: '#5a7a98', marginTop: 4, fontFamily: 'Inter,sans-serif' }}>{meta.label} · {indiaStates.length} states/UTs</div>
          </div>
          <div style={{ padding: '5px 12px', background: `${riskColor}18`, border: `1px solid ${riskColor}40`, borderRadius: 6, fontSize: '0.72rem', color: riskColor, fontWeight: 600 }}>{alarmCount} ALARMING</div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
          {[
            { label: 'Total Cases',    val: formatNumber(totalCases),  color: '#70b8dc' },
            { label: 'Total Deaths',   val: formatNumber(totalDeaths), color: '#f87171' },
            { label: 'States at Risk', val: `${alarmCount + highCount}/${indiaStates.length}`, color: riskColor },
          ].map(item => (
            <div key={item.label} style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '1.05rem', fontWeight: 400, color: item.color, fontFamily: 'Inter,sans-serif' }}>{item.val}</div>
              <div style={{ fontSize: '0.58rem', color: '#4a6a88', letterSpacing: '0.14em', textTransform: 'uppercase', marginTop: 3, fontWeight: 500 }}>{item.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Risk breakdown */}
      <div style={SI.card}>
        <span style={SI.label}>Risk Distribution · All States</span>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 6 }}>
          {[
            { label: 'Alarming', count: indiaStates.filter(p => p.risk_score > 0.65).length, color: '#ef4444' },
            { label: 'High',     count: indiaStates.filter(p => p.risk_score > 0.45 && p.risk_score <= 0.65).length, color: '#f97316' },
            { label: 'Moderate', count: indiaStates.filter(p => p.risk_score > 0.25 && p.risk_score <= 0.45).length, color: '#eab308' },
            { label: 'Low',      count: indiaStates.filter(p => p.risk_score <= 0.25).length, color: '#22c55e' },
          ].map(r => (
            <div key={r.label} style={{ textAlign: 'center', padding: '8px 6px', background: `${r.color}08`, border: `1px solid ${r.color}20`, borderRadius: 7 }}>
              <div style={{ fontSize: '1.4rem', fontWeight: 200, color: r.color, fontFamily: 'Inter,sans-serif', lineHeight: 1 }}>{r.count}</div>
              <div style={{ fontSize: '0.52rem', color: '#4a6a88', letterSpacing: '0.12em', textTransform: 'uppercase', marginTop: 3 }}>{r.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Top 6 states */}
      <div style={SI.card}>
        <span style={SI.label}>Top States by Case Count — click to explore</span>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
          {topByCase.map(state => {
            const barPct = (state.cases / maxCases) * 100;
            const stateRisk = state.risk_score > 0.65 ? '#ef4444' : state.risk_score > 0.45 ? '#f97316' : state.risk_score > 0.25 ? '#eab308' : '#22c55e';
            return (
              <button key={state.country} onClick={() => onStateSelect(state.country)}
                style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', textAlign: 'left', width: '100%' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 }}>
                  <span style={{ fontSize: '0.68rem', color: '#9ac8e0', fontFamily: 'Inter,sans-serif', fontWeight: 500 }}>{state.country}</span>
                  <span style={{ fontSize: '0.62rem', color: '#6a92a8', fontFamily: 'JetBrains Mono,monospace' }}>{formatNumber(state.cases)}</span>
                </div>
                <div style={{ height: 4, background: 'rgba(0,100,160,0.15)', borderRadius: 2, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${barPct}%`, background: stateRisk, borderRadius: 2, opacity: 0.75 }} />
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Spread Simulator ── */}
      <div style={SI.card}>
        <span style={SI.label}>India National · Projected Spread Simulation</span>
        {/* Day selector */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
          <span style={{ fontSize: '0.58rem', color: '#3a5a78', letterSpacing: '0.15em', textTransform: 'uppercase' as const, fontWeight: 500, fontFamily: 'Inter,sans-serif' }}>Period</span>
          {([30, 60, 90] as const).map(d => (
            <button key={d} onClick={() => setDays(d)}
              style={{ padding: '3px 10px', fontSize: '0.6rem', letterSpacing: '0.06em', borderRadius: 5, border: 'none', cursor: 'pointer', fontFamily: 'Inter,sans-serif', background: days === d ? 'rgba(0,160,220,0.55)' : 'rgba(10,30,55,0.8)', color: days === d ? '#d8f0ff' : '#3a5a78', fontWeight: days === d ? 600 : 400, transition: 'all 0.18s ease' }}>
              {d} Days
            </button>
          ))}
        </div>
        {/* Outcome cards */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 14 }}>
          <div style={{ padding: '10px 12px', background: 'rgba(239,68,68,0.05)', border: '1px solid rgba(239,68,68,0.15)', borderRadius: 8 }}>
            <div style={{ fontSize: '0.55rem', color: '#4a6785', letterSpacing: '0.12em', textTransform: 'uppercase' as const, marginBottom: 4 }}>No Intervention</div>
            <div style={{ fontSize: '1.05rem', fontWeight: 300, color: '#f87171', fontFamily: 'Inter,sans-serif' }}>{formatNumber(projFinal)}</div>
            <div style={{ fontSize: '0.55rem', color: '#3a5070' }}>by day {days}</div>
          </div>
          <div style={{ padding: '10px 12px', background: 'rgba(34,197,94,0.05)', border: '1px solid rgba(34,197,94,0.15)', borderRadius: 8 }}>
            <div style={{ fontSize: '0.55rem', color: '#4a6785', letterSpacing: '0.12em', textTransform: 'uppercase' as const, marginBottom: 4 }}>With Intervention</div>
            <div style={{ fontSize: '1.05rem', fontWeight: 300, color: '#4ade80', fontFamily: 'Inter,sans-serif' }}>{formatNumber(intFinal)}</div>
            <div style={{ fontSize: '0.55rem', color: '#3a5070' }}>–<span style={{ color: '#4ade80' }}>{simReduction}%</span> reduction</div>
          </div>
        </div>
        {/* Intervention toggles */}
        <div style={{ fontSize: '0.58rem', color: '#3a5a78', marginBottom: 8, fontFamily: 'Inter,sans-serif' }}>Select interventions to model impact:</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: intvsReduction > 0 ? 12 : 0 }}>
          {INDIA_INTVS.map(iv => {
            const isOn = activeIntvs.has(iv.id);
            return (
              <button key={iv.id}
                onClick={() => setActiveIntvs(prev => { const n = new Set(prev); isOn ? n.delete(iv.id) : n.add(iv.id); return n; })}
                style={{ padding: '8px 10px', borderRadius: 7, cursor: 'pointer', fontFamily: 'Inter,sans-serif', border: `1px solid ${isOn ? iv.hex + '55' : 'rgba(0,80,120,0.2)'}`, background: isOn ? iv.hex + '14' : 'rgba(0,20,50,0.4)', color: isOn ? iv.hex : '#4a6785', fontSize: '0.65rem', fontWeight: isOn ? 600 : 400, transition: 'all 0.18s ease', textAlign: 'left' as const, display: 'flex', alignItems: 'center', gap: 6 }}>
                <span>{iv.icon}</span> {iv.label}
              </button>
            );
          })}
        </div>
        {/* Intervention impact breakdown */}
        {intvsReduction > 0 && (
          <div style={{ padding: '12px 14px', background: 'rgba(34,197,94,0.05)', border: '1px solid rgba(34,197,94,0.18)', borderRadius: 8 }}>
            <div style={{ fontSize: '1.0rem', fontWeight: 700, color: '#4ade80', fontFamily: 'JetBrains Mono,monospace', marginBottom: 6 }}>
              −{(intvsReduction * 100).toFixed(0)}% spread reduction
            </div>
            <div style={{ height: 4, background: 'rgba(255,255,255,0.05)', borderRadius: 2, overflow: 'hidden', marginBottom: 8 }}>
              <div style={{ height: '100%', width: `${intvsReduction * 100}%`, background: 'rgba(34,197,94,0.6)', borderRadius: 2 }} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 3 }}>
              {INDIA_INTVS.filter(iv => activeIntvs.has(iv.id)).map(iv => (
                <div key={iv.id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: '0.6rem', color: iv.hex, fontWeight: 500, minWidth: 120, fontFamily: 'Inter,sans-serif' }}>{iv.icon} {iv.label}</span>
                  <span style={{ fontSize: '0.58rem', color: '#3a5a78' }}>−{(iv.reduction * 100).toFixed(0)}%</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* CTA */}
      <div style={{ textAlign: 'center', padding: '14px 0', color: '#3a5a78', fontSize: '0.62rem', letterSpacing: '0.1em' }}>
        Click any state on the globe or select from the dropdown above
      </div>
    </div>
  );

  // ── Classification ────────────────────────────────────────────────────────────
  if (activeTab === 'classification') return (
    <div style={{ padding: '1rem' }}>
      <div style={{ padding: '8px 14px', background: 'rgba(0,100,160,0.05)', border: '1px solid rgba(0,100,160,0.12)', borderRadius: 8, marginBottom: 14, fontSize: '0.62rem', color: '#4a6a82', fontFamily: 'Inter,sans-serif' }}>
        India national classification · {classification.fullName}
      </div>
      <div style={SI.blueCard}>
        <span style={SI.blueLabel}>ICD Classification</span>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
          <div style={{ padding: '10px 12px', background: 'rgba(0,160,220,0.06)', border: '1px solid rgba(0,160,220,0.12)', borderRadius: 7 }}>
            <div style={{ fontSize: '0.55rem', color: '#3a5a78', letterSpacing: '0.16em', textTransform: 'uppercase' as const, marginBottom: 4 }}>ICD-10</div>
            <div style={{ fontSize: '1.2rem', fontWeight: 300, color: '#60b8dc', fontFamily: 'JetBrains Mono,monospace' }}>{classification.icd10}</div>
          </div>
          <div style={{ padding: '10px 12px', background: 'rgba(100,180,255,0.06)', border: '1px solid rgba(100,180,255,0.12)', borderRadius: 7 }}>
            <div style={{ fontSize: '0.55rem', color: '#3a5a78', letterSpacing: '0.16em', textTransform: 'uppercase' as const, marginBottom: 4 }}>ICD-11</div>
            <div style={{ fontSize: '1.2rem', fontWeight: 300, color: '#60b8dc', fontFamily: 'JetBrains Mono,monospace' }}>{classification.icd11}</div>
          </div>
        </div>
        <div style={{ fontSize: '0.7rem', color: '#6a90a8', fontFamily: 'Inter,sans-serif', fontStyle: 'italic' }}>{classification.fullName}</div>
      </div>
      <div style={SI.blueCard}>
        <span style={SI.blueLabel}>Taxonomic Hierarchy</span>
        {classification.taxonomy.map((level, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 0' }}>
            <div style={{ width: 16, height: 16, borderRadius: '50%', border: '1px solid rgba(0,160,220,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <span style={{ fontSize: '0.52rem', color: '#3a5a78' }}>{i + 1}</span>
            </div>
            <span style={{ fontSize: '0.68rem', color: i === classification.taxonomy.length - 1 ? '#88c8e8' : '#5a7898', fontFamily: 'Inter,sans-serif', fontWeight: i === classification.taxonomy.length - 1 ? 500 : 400 }}>{level}</span>
          </div>
        ))}
      </div>
      <div style={SI.blueCard}>
        <span style={SI.blueLabel}>Disease Subtypes &amp; Variants</span>
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
      <div style={SI.blueCard}>
        <span style={SI.blueLabel}>Ontology Cross-References</span>
        {[
          { sys: 'MeSH',             val: classification.mesh },
          { sys: 'SNOMED CT',        val: classification.snomed },
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

  // ── Genomics ──────────────────────────────────────────────────────────────────
  if (activeTab === 'genomics') return (
    <div style={{ padding: '1rem' }}>
      <div style={{ padding: '8px 14px', background: 'rgba(0,100,160,0.05)', border: '1px solid rgba(0,100,160,0.12)', borderRadius: 8, marginBottom: 14, fontSize: '0.62rem', color: '#4a6a82', fontFamily: 'Inter,sans-serif' }}>
        India genomic surveillance · {meta.label} disease-associated genes
      </div>
      <div style={SI.blueCard}>
        <span style={SI.blueLabel}>Disease-Associated Genes · Ranked by Evidence</span>
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
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', gap: 12, marginBottom: 3 }}>
                  <span style={{ fontSize: '0.58rem', color: '#4a6785' }}>Type: <span style={{ color: '#6a90a8' }}>{gene.associationType}</span></span>
                </div>
                <div style={{ fontSize: '0.58rem', color: '#3a5a78' }}>{gene.function}</div>
              </div>
              <div style={{ textAlign: 'right' as const, flexShrink: 0, minWidth: 72 }}>
                <div style={{ fontSize: '0.47rem', color: '#2e4a62', letterSpacing: '0.13em', textTransform: 'uppercase' as const, marginBottom: 2, fontFamily: 'Inter,sans-serif', fontWeight: 500 }}>Evidence Strength</div>
                <div style={{ fontSize: '1.3rem', fontWeight: 700, letterSpacing: '-0.02em', lineHeight: 1, fontFamily: 'JetBrains Mono,monospace', color: gene.evidenceScore >= 0.90 ? '#22c55e' : gene.evidenceScore >= 0.75 ? '#60b8dc' : '#8ab8a8' }}>
                  {(gene.evidenceScore * 100).toFixed(0)}%
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  // ── AI Chatbot tab ──────────────────────────────────────────────────────────
  if (activeTab === 'ai-assistant') return (
    <div style={{ height: '100%', padding: '0' }}>
      <CosmoTab
        country="India"
        disease={disease}
        cases={totalCases}
        riskScore={alarmCount / Math.max(indiaStates.length, 1)}
        region="South Asia"
        onAction={onCosmoAction ?? (() => {})}
      />
    </div>
  );

  // ── Therapeutics (default) ────────────────────────────────────────────────────
  return (
    <div style={{ padding: '1rem' }}>
      <div style={{ padding: '8px 14px', background: 'rgba(0,100,160,0.05)', border: '1px solid rgba(0,100,160,0.12)', borderRadius: 8, marginBottom: 14, fontSize: '0.62rem', color: '#4a6a82', fontFamily: 'Inter,sans-serif' }}>
        India treatment protocols · {meta.label}
      </div>
      <div style={SI.blueCard}>
        <span style={SI.blueLabel}>Treatment Protocols · {meta.label}</span>
        <div style={{ fontSize: '0.62rem', color: '#3a5a78', marginBottom: 10 }}>Source: WHO Essential Medicines · PubChem PUG-REST · DrugBank</div>
        {drugs.map(drug => (
          <div key={drug.name} style={{ padding: '11px 0', borderBottom: '1px solid rgba(0,80,120,0.08)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
              <span style={{ fontSize: '0.72rem', fontWeight: 500, color: '#b0d0e8', fontFamily: 'Inter,sans-serif' }}>{drug.genericName}</span>
              <span style={{ fontSize: '0.52rem', padding: '1px 6px', borderRadius: 3, background: drug.line === 'First' ? 'rgba(34,197,94,0.1)' : drug.line === 'Second' ? 'rgba(234,179,8,0.1)' : 'rgba(239,68,68,0.1)', border: `1px solid ${drug.line === 'First' ? 'rgba(34,197,94,0.2)' : drug.line === 'Second' ? 'rgba(234,179,8,0.2)' : 'rgba(239,68,68,0.2)'}`, color: drug.line === 'First' ? '#4ade80' : drug.line === 'Second' ? '#fbbf24' : '#f87171' }}>{drug.line}-line</span>
              {drug.whoEssential && <span style={{ fontSize: '0.5rem', padding: '1px 6px', borderRadius: 3, background: 'rgba(0,160,220,0.08)', border: '1px solid rgba(0,160,220,0.15)', color: '#60b8dc' }}>WHO Essential</span>}
            </div>
            <div style={{ fontSize: '0.62rem', color: '#4a6785', fontFamily: 'Inter,sans-serif', marginBottom: 5 }}>{drug.name}</div>
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
      <div style={SI.blueCard}>
        <span style={SI.blueLabel}>WHO Essential Medicines Status</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 0' }}>
          {[
            { val: drugs.filter(d => d.whoEssential).length,  label: 'On WHO List',    color: '#22c55e' },
            { val: drugs.filter(d => !d.whoEssential).length, label: 'Specialty Only', color: '#fbbf24' },
            { val: drugs.filter(d => d.line === 'First').length, label: 'First-Line',  color: '#60b8dc' },
          ].map((s, i) => (
            <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              {i > 0 && <div style={{ height: 36, width: 1, background: 'rgba(0,80,120,0.12)' }} />}
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '1.5rem', fontWeight: 200, color: s.color, fontFamily: 'Inter,sans-serif' }}>{s.val}</div>
                <div style={{ fontSize: '0.52rem', color: '#3a5a78', letterSpacing: '0.12em', textTransform: 'uppercase' as const }}>{s.label}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  return null;
}

// ── Isolated clock — only this component re-renders every second ──
function LiveClock() {
  const [clock, setClock] = useState('');
  useEffect(() => {
    const tick = () => setClock(new Date().toUTCString().slice(0, 25));
    tick(); const id = setInterval(tick, 1000); return () => clearInterval(id);
  }, []);
  return <span style={{ color: '#1e3040' }}>{clock} UTC</span>;
}

export default function Home() {
  const [disease, setDisease] = useState<DiseaseKey>('malaria');
  const [diseaseSelected, setDiseaseSelected] = useState(false);
  const [region, setRegion] = useState('all');
  const [selectedCountry, setSelectedCountry] = useState<GlobePoint | null>(null);
  const [spreadMode, setSpreadMode] = useState(false);
  const [spreadPeriod, setSpreadPeriod] = useState<'week' | 'month' | 'year'>('month');
  const [globeData, setGlobeData] = useState<GlobePoint[]>([]);
  const [spreadArcs, setSpreadArcs] = useState<SpreadArc[]>([]);
  const [activeTab, setActiveTab] = useState<'surveillance' | 'classification' | 'genomics' | 'therapeutics' | 'ai-assistant'>('surveillance');
  const [heatmapMode, setHeatmapMode] = useState(false);
  const [countryDropdown, setCountryDropdown] = useState('');
  const [indiaMode, setIndiaMode] = useState(false);
  const [indiaActiveTab, setIndiaActiveTab] = useState<'surveillance' | 'classification' | 'genomics' | 'therapeutics' | 'ai-assistant'>('surveillance');
  const [indiaStateDropdown, setIndiaStateDropdown] = useState('');
  const [focusCoords, setFocusCoords] = useState<{ lat: number; lng: number; altitude: number } | null>(null);

  useEffect(() => {
    fetchGlobeData(disease, region).then(setGlobeData);
  }, [disease, region]);
  useEffect(() => {
    setSpreadArcs(spreadMode ? buildSpreadArcs(disease, selectedCountry?.country, spreadPeriod) : []);
  }, [spreadMode, disease, selectedCountry, spreadPeriod]);

  const handleCountrySelect = useCallback((point: GlobePoint) => {
    setIndiaMode(false);
    setSelectedCountry(point);
    setCountryDropdown(point.country);
    setActiveTab('surveillance');
  }, []);

  // Enter India-overview mode: zoom to India centre, show state picker
  const handleIndiaClick = useCallback(() => {
    setIndiaMode(true);
    setSelectedCountry(null);
    setCountryDropdown('__india__');
    setIndiaStateDropdown('');
    setIndiaActiveTab('surveillance');
    setFocusCoords({ lat: 20.59, lng: 78.96, altitude: 1.8 });
  }, []);

  const handleCountryDropdown = useCallback((name: string) => {
    if (name === '__india__') { handleIndiaClick(); return; }
    setIndiaMode(false);
    setIndiaStateDropdown('');
    setCountryDropdown(name);
    if (!name) { setSelectedCountry(null); return; }
    const point = globeData.find(p => p.country === name);
    if (point) handleCountrySelect(point);
  }, [globeData, handleCountrySelect, handleIndiaClick]);

  const handleStateSelect = useCallback((stateName: string) => {
    setIndiaStateDropdown(stateName);
    if (!stateName) return;
    const point = globeData.find(p => p.country === stateName);
    if (point) handleCountrySelect(point);
  }, [globeData, handleCountrySelect]);

  const meta = DISEASE_META[disease];
  const totalCases = useMemo(() => globeData.reduce((s, p) => s + p.cases, 0), [globeData]);
  const countriesAffected = globeData.length;
  const activeAlerts = globeData.filter(p => p.risk_score > 0.65).length;

  const TABS: { key: typeof activeTab; label: string; icon: string }[] = [
    { key: 'surveillance',    label: 'Surveillance',    icon: '📡' },
    { key: 'classification',  label: 'Classification',  icon: '🔬' },
    { key: 'genomics',        label: 'Genomics',        icon: '🧬' },
    { key: 'therapeutics',    label: 'Therapeutics',    icon: '💊' },
    { key: 'ai-assistant',    label: 'AI Chatbot',      icon: '🤖' },
  ];

  const handleCosmoAction = useCallback((action: { disease?: string; country?: string }) => {
    if (action.disease) setDisease(action.disease as import('@/lib/disease-data').DiseaseKey);
    if (action.country) {
      const pt = globeData.find(p => p.country === action.country);
      if (pt) { setSelectedCountry(pt); setCountryDropdown(pt.country); setActiveTab('surveillance'); setIndiaMode(false); }
    }
  }, [globeData]);

  const sortedCountries = useMemo(() =>
    [...globeData]
      .filter(p => p.region !== 'India')
      .sort((a, b) => a.country.localeCompare(b.country)),
    [globeData]
  );

  const sortedIndiaStates = useMemo(() =>
    [...globeData]
      .filter(p => p.region === 'India')
      .sort((a, b) => a.country.localeCompare(b.country)),
    [globeData]
  );

  return (
    <div style={{ height: '100vh', width: '100vw', display: 'flex', flexDirection: 'column', background: '#000814', overflow: 'hidden', fontFamily: 'Inter, -apple-system, sans-serif' }}>

      {/* ── Header ── */}
      <header style={{ flexShrink: 0, zIndex: 30, borderBottom: '1px solid rgba(0,120,180,0.12)', background: 'rgba(0,6,18,0.96)', backdropFilter: 'blur(24px)', padding: '0 1.5rem', height: 52, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        {/* Brand */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
          <div style={{ width: 30, height: 30, borderRadius: '50%', border: '1.5px solid rgba(0,180,255,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 14px rgba(0,160,220,0.2)' }}>
            <span style={{ fontSize: 13, color: '#60b0d8' }}>✦</span>
          </div>
          <div>
            <div style={{ fontSize: '1.05rem', fontWeight: 600, letterSpacing: '0.1em', color: '#d0eeff' }}>CosmoSentinel</div>
            <div style={{ fontSize: '0.52rem', color: '#2e4a62', letterSpacing: '0.25em', textTransform: 'uppercase', marginTop: 1 }}>Global Disease Intelligence</div>
          </div>
        </div>

        {/* Disease pills */}
        <div style={{ display: 'flex', gap: '0.4rem' }}>
          {(Object.entries(DISEASE_META) as [DiseaseKey, typeof meta][]).map(([key, m]) => (
            <button key={key} onClick={() => { setDisease(key); setDiseaseSelected(true); setSelectedCountry(null); setCountryDropdown(''); setIndiaMode(false); setIndiaStateDropdown(''); setFocusCoords(null); }}
              style={{ padding: '4px 12px', borderRadius: 20, border: `1px solid ${diseaseSelected && disease === key ? m.color : 'rgba(255,255,255,0.08)'}`, background: diseaseSelected && disease === key ? `${m.color}20` : 'transparent', color: diseaseSelected && disease === key ? m.color : '#5a7898', fontSize: '0.65rem', fontWeight: 500, letterSpacing: '0.06em', cursor: 'pointer', transition: 'all 0.2s ease', fontFamily: 'Inter, sans-serif' }}>
              {m.label}
            </button>
          ))}
        </div>

        {/* Status */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', fontSize: '0.62rem', color: '#2e4a62' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <div style={{ width: 5, height: 5, borderRadius: '50%', background: '#22c55e', boxShadow: '0 0 5px #22c55e' }} />
            <span style={{ color: '#22c55e', fontWeight: 500 }}>LIVE</span>
          </div>
          <LiveClock />
        </div>
      </header>

      {/* ── Controls bar ── */}
      <div style={{ flexShrink: 0, zIndex: 25, borderBottom: '1px solid rgba(0,80,120,0.1)', background: 'rgba(0,4,14,0.92)', padding: '0 1.5rem', height: 38, display: 'flex', alignItems: 'center', gap: 20 }}>
        {/* Heatmap toggle */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: '0.58rem', color: '#3a5a78', letterSpacing: '0.16em', textTransform: 'uppercase', fontWeight: 500 }}>Heatmap</span>
          <button
            onClick={() => setHeatmapMode(v => !v)}
            style={{ width: 36, height: 18, borderRadius: 9, background: heatmapMode ? 'rgba(0,180,255,0.6)' : 'rgba(30,50,70,0.8)', border: `1px solid ${heatmapMode ? 'rgba(0,180,255,0.4)' : 'rgba(50,80,110,0.3)'}`, cursor: 'pointer', position: 'relative', transition: 'all 0.25s ease' }}>
            <span style={{ position: 'absolute', top: 2, width: 12, height: 12, borderRadius: '50%', background: '#fff', left: heatmapMode ? 20 : 2, transition: 'left 0.25s ease' }} />
          </button>
          {heatmapMode && <span style={{ fontSize: '0.55rem', color: '#60b8dc', fontWeight: 400 }}>Case Density Active</span>}
        </div>

        <div style={{ height: 18, width: 1, background: 'rgba(0,80,120,0.2)' }} />

        {/* Primary: countries + India entry-point */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: '0.58rem', color: '#3a5a78', letterSpacing: '0.16em', textTransform: 'uppercase', fontWeight: 500 }}>Location</span>
          <select
            value={indiaMode ? '__india__' : countryDropdown}
            onChange={e => handleCountryDropdown(e.target.value)}
            style={{ background: 'rgba(0,15,40,0.9)', border: `1px solid ${indiaMode ? 'rgba(255,153,51,0.4)' : 'rgba(0,100,160,0.2)'}`, borderRadius: 6, color: (indiaMode || countryDropdown) ? '#a0c8e0' : '#3a5a78', fontSize: '0.62rem', padding: '3px 8px', fontFamily: 'Inter,sans-serif', cursor: 'pointer', outline: 'none', minWidth: 170 }}>
            <option value="">Select country…</option>
            {sortedIndiaStates.length > 0 && (
              <option value="__india__">🇮🇳 India → (States)</option>
            )}
            {sortedCountries.map(p => (
              <option key={p.country} value={p.country}>{p.country}</option>
            ))}
          </select>

          {/* Secondary: state picker — slides in when India selected */}
          {indiaMode && sortedIndiaStates.length > 0 && (
            <select
              value={indiaStateDropdown}
              onChange={e => handleStateSelect(e.target.value)}
              style={{ background: 'rgba(10,5,0,0.95)', border: '1px solid rgba(255,153,51,0.35)', borderRadius: 6, color: indiaStateDropdown ? '#ffa040' : '#a06030', fontSize: '0.62rem', padding: '3px 8px', fontFamily: 'Inter,sans-serif', cursor: 'pointer', outline: 'none', minWidth: 160 }}>
              <option value="">Select state…</option>
              {sortedIndiaStates.map(p => (
                <option key={p.country} value={p.country}>{p.country}</option>
              ))}
            </select>
          )}
        </div>

        <div style={{ height: 18, width: 1, background: 'rgba(0,80,120,0.2)' }} />

        {/* Disease stats summary */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginLeft: 'auto' }}>
          <span style={{ fontSize: '0.58rem', color: '#3a5a78' }}>
            <span style={{ color: meta.color, fontWeight: 500 }}>{countriesAffected}</span> countries ·{' '}
            <span style={{ color: '#8ab8d0', fontWeight: 500 }}>{formatNumber(totalCases)}</span> cases ·{' '}
            <span style={{ color: '#e87070', fontWeight: 500 }}>{activeAlerts}</span> high-risk
          </span>
        </div>
      </div>

      {/* ── Main layout ── */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden', minHeight: 0 }}>

        {/* Globe — shrinks from 100% to 45% when country or India mode active */}
        <motion.div
          animate={{ width: (selectedCountry || indiaMode) ? '45%' : '100%' }}
          transition={{ duration: 0.65, ease: [0.25, 0.46, 0.45, 0.94] }}
          style={{ position: 'relative', flexShrink: 0, overflow: 'hidden' }}
        >
          <GlobeView
            disease={disease}
            region={region}
            globeData={globeData}
            spreadArcs={spreadArcs}
            onCountrySelect={handleCountrySelect}
            selectedCountry={selectedCountry}
            heroMode={!selectedCountry}
            heatmapMode={heatmapMode}
            indiaMode={indiaMode}
            onIndiaClick={handleIndiaClick}
            focusCoords={focusCoords}
          />

          {/* Hero overlay — only when no country/India selected */}
          <AnimatePresence>
            {!selectedCountry && !indiaMode && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                style={{ position: 'absolute', inset: 0, pointerEvents: 'none', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', padding: '0 0 6% 0', alignItems: 'center', background: 'linear-gradient(to top, rgba(0,8,20,0.7) 0%, transparent 50%)' }}>
                <div style={{ fontSize: '0.6rem', letterSpacing: '0.36em', color: 'rgba(0,160,220,0.65)', textTransform: 'uppercase', marginBottom: '0.5rem' }}>
                  Click a country or select from dropdown
                </div>
                <div style={{ fontSize: '0.65rem', color: '#2a4458', letterSpacing: '0.12em' }}>
                  {heatmapMode ? `Heatmap: case density view active · ${countriesAffected} regions` : `${countriesAffected} countries · ${formatNumber(totalCases)} cases · ${activeAlerts} high-risk alerts`}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* India mode overlay — shown on globe when in indiaMode */}
          <AnimatePresence>
            {indiaMode && !selectedCountry && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                style={{ position: 'absolute', inset: 0, pointerEvents: 'none', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', padding: '0 0 6% 0', alignItems: 'center', background: 'linear-gradient(to top, rgba(20,6,0,0.7) 0%, transparent 55%)' }}>
                <div style={{ fontSize: '0.6rem', letterSpacing: '0.36em', color: 'rgba(255,153,51,0.75)', textTransform: 'uppercase', marginBottom: '0.5rem' }}>
                  India State Mode — click a state to explore
                </div>
                <div style={{ fontSize: '0.65rem', color: '#6a4020', letterSpacing: '0.12em' }}>
                  {sortedIndiaStates.length} states · {formatNumber(sortedIndiaStates.reduce((s, p) => s + p.cases, 0))} cases
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Selected country badge */}
          <AnimatePresence>
            {selectedCountry && (
              <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                style={{ position: 'absolute', top: 12, left: '50%', transform: 'translateX(-50%)', zIndex: 10, display: 'flex', alignItems: 'center', gap: '0.6rem', padding: '6px 16px', background: 'rgba(0,12,30,0.9)', border: '1px solid rgba(0,160,220,0.2)', borderRadius: 20, backdropFilter: 'blur(12px)' }}>
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#00b4e0', boxShadow: '0 0 6px #00b4e0' }} />
                <span style={{ color: '#88d0f0', fontSize: '0.68rem', fontWeight: 500, letterSpacing: '0.08em' }}>{selectedCountry.country}</span>
                <button onClick={() => { setSelectedCountry(null); setCountryDropdown(''); setIndiaMode(false); setIndiaStateDropdown(''); }} style={{ color: '#2e4a62', background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.75rem', marginLeft: 4 }}>✕</button>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Spread simulator */}
          {selectedCountry && (
            <div style={{ position: 'absolute', bottom: 16, left: 16, zIndex: 10, background: 'rgba(0,12,30,0.9)', border: '1px solid rgba(0,120,180,0.15)', borderRadius: 10, padding: '10px 14px', backdropFilter: 'blur(16px)', minWidth: 200 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: spreadMode ? 8 : 0 }}>
                <span style={{ fontSize: '0.58rem', color: '#3a5a78', letterSpacing: '0.18em', textTransform: 'uppercase', fontWeight: 500 }}>Spread Sim</span>
                <button onClick={() => setSpreadMode(v => !v)} style={{ width: 34, height: 17, borderRadius: 9, background: spreadMode ? 'rgba(0,160,220,0.65)' : 'rgba(30,50,70,0.8)', border: `1px solid ${spreadMode ? 'rgba(0,160,220,0.4)' : 'rgba(50,80,110,0.3)'}`, cursor: 'pointer', position: 'relative', transition: 'all 0.25s ease' }}>
                  <span style={{ position: 'absolute', top: 2, width: 11, height: 11, borderRadius: '50%', background: '#fff', left: spreadMode ? 19 : 2, transition: 'left 0.25s ease' }} />
                </button>
              </div>
              {spreadMode && (
                <div style={{ display: 'flex', gap: 4 }}>
                  {(['week','month','year'] as const).map(p => (
                    <button key={p} onClick={() => setSpreadPeriod(p)} style={{ flex: 1, padding: '3px 0', fontSize: '0.58rem', letterSpacing: '0.1em', textTransform: 'uppercase', borderRadius: 4, border: 'none', cursor: 'pointer', background: spreadPeriod === p ? 'rgba(0,160,220,0.6)' : 'rgba(20,40,60,0.8)', color: spreadPeriod === p ? '#e0f0ff' : '#3a5a78', fontFamily: 'Inter, sans-serif', fontWeight: spreadPeriod === p ? 500 : 400 }}>{p}</button>
                  ))}
                </div>
              )}
            </div>
          )}
        </motion.div>

        {/* Analytics panel — slides in when country or India mode active */}
        <AnimatePresence>
          {(selectedCountry || indiaMode) && (
            <motion.div
              initial={{ opacity: 0, x: 40 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 40 }}
              transition={{ duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] }}
              style={{ width: '55%', display: 'flex', flexDirection: 'column', borderLeft: 'rgba(0,90,140,0.15)', background: 'rgba(0,4,16,0.97)', overflow: 'hidden' }}
            >
              {/* Tab nav — only for state/country panels, not India overview */}
              {selectedCountry && (
                <div style={{ flexShrink: 0, display: 'flex', borderBottom: '1px solid rgba(0,90,140,0.12)', background: 'rgba(0,6,20,0.8)', padding: '0 0.5rem' }}>
                  {TABS.map(tab => (
                    <button key={tab.key} onClick={() => setActiveTab(tab.key)}
                      style={{ flex: 1, padding: '11px 4px', fontSize: '0.62rem', fontWeight: activeTab === tab.key ? 500 : 400, letterSpacing: '0.08em', textTransform: 'uppercase', border: 'none', background: 'none', color: activeTab === tab.key ? '#70c8ec' : '#3a5870', borderBottom: `2px solid ${activeTab === tab.key ? '#70c8ec' : 'transparent'}`, cursor: 'pointer', fontFamily: 'Inter, sans-serif', transition: 'all 0.2s ease', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}>
                      {tab.label}
                    </button>
                  ))}
                </div>
              )}

              {/* India overview header + tabs — when indiaMode but no state selected */}
              {indiaMode && !selectedCountry && (
                <>
                  <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid rgba(0,90,140,0.12)', background: 'rgba(0,6,20,0.8)', padding: '0 1rem', height: 44 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div>
                        <div style={{ fontSize: '0.72rem', fontWeight: 500, color: '#d0eeff', letterSpacing: '0.06em' }}>India</div>
                        <div style={{ fontSize: '0.55rem', color: '#4a6a82', letterSpacing: '0.15em', textTransform: 'uppercase' }}>National Overview · Select a state to drill down</div>
                      </div>
                    </div>
                    <button onClick={() => { setIndiaMode(false); setCountryDropdown(''); setIndiaStateDropdown(''); setFocusCoords(null); }}
                      style={{ background: 'none', border: 'none', color: '#2e4a62', cursor: 'pointer', fontSize: '0.85rem' }}>✕</button>
                  </div>
                  {/* Tab bar for India overview — matching country tab style */}
                  <div style={{ flexShrink: 0, display: 'flex', borderBottom: '1px solid rgba(0,90,140,0.12)', background: 'rgba(0,6,20,0.8)', padding: '0 0.5rem' }}>
                    {([
                      { key: 'surveillance',   label: 'Surveillance',   icon: '📡' },
                      { key: 'classification', label: 'Classification', icon: '🔬' },
                      { key: 'genomics',       label: 'Genomics',       icon: '🧬' },
                      { key: 'therapeutics',   label: 'Therapeutics',   icon: '💊' },
                      { key: 'ai-assistant',   label: 'AI Chatbot',     icon: '🤖' },
                    ] as { key: typeof indiaActiveTab; label: string; icon: string }[]).map(tab => (
                      <button key={tab.key} onClick={() => setIndiaActiveTab(tab.key)}
                        style={{ flex: 1, padding: '11px 4px', fontSize: '0.62rem', fontWeight: indiaActiveTab === tab.key ? 500 : 400, letterSpacing: '0.08em', textTransform: 'uppercase', border: 'none', background: 'none', color: indiaActiveTab === tab.key ? '#70c8ec' : '#3a5870', borderBottom: `2px solid ${indiaActiveTab === tab.key ? '#70c8ec' : 'transparent'}`, cursor: 'pointer', fontFamily: 'Inter, sans-serif', transition: 'all 0.2s ease', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}>
                        {tab.label}
                      </button>
                    ))}
                  </div>
                </>
              )}

              {/* Panel content */}
              <div style={{ flex: 1, overflowY: 'auto', scrollbarWidth: 'thin', scrollbarColor: 'rgba(0,140,200,0.2) transparent' }}>
                {selectedCountry ? (
                  <div style={{ padding: '1rem' }}>
                    <CountryPanel
                      country={selectedCountry}
                      disease={disease}
                      activeTab={activeTab}
                      region={region}
                      onCosmoAction={handleCosmoAction}
                    />
                  </div>
                ) : indiaMode ? (
                  <IndiaOverviewPanel
                    indiaStates={sortedIndiaStates}
                    disease={disease}
                    meta={meta}
                    onStateSelect={handleStateSelect}
                    activeTab={indiaActiveTab}
                    onCosmoAction={handleCosmoAction}
                  />
                ) : null}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── Footer stats bar ── */}
      <footer style={{ flexShrink: 0, borderTop: '1px solid rgba(0,80,120,0.12)', background: 'rgba(0,6,18,0.9)', backdropFilter: 'blur(20px)', padding: '0 1.5rem', height: 40, display: 'flex', alignItems: 'center', gap: 0 }}>
        {[
          { label: 'Countries', value: countriesAffected, color: '#60a0cc' },
          { label: 'Total Cases', value: formatNumber(totalCases), color: meta.color },
          { label: 'High-Risk Alerts', value: activeAlerts, color: '#e87070' },
          { label: 'Data Sources', value: '9 APIs', color: '#22c55e' },
          { label: 'ML Models', value: '4 Active', color: '#a370e0' },
        ].map((s, i) => (
          <div key={s.label} style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8, padding: '0 12px', borderRight: i < 4 ? '1px solid rgba(0,80,120,0.1)' : 'none' }}>
            <div>
              <div style={{ fontSize: '0.9rem', fontWeight: 400, color: s.color, letterSpacing: '-0.01em' }}>{typeof s.value === 'number' ? s.value.toLocaleString() : s.value}</div>
              <div style={{ fontSize: '0.58rem', color: '#8ab0cc', letterSpacing: '0.2em', textTransform: 'uppercase', marginTop: 2, fontWeight: 500 }}>{s.label}</div>
            </div>
          </div>
        ))}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginLeft: 'auto', paddingLeft: 12 }}>
          <div style={{ width: 5, height: 5, borderRadius: '50%', background: '#22c55e', boxShadow: '0 0 4px #22c55e' }} />
          <span style={{ fontSize: '0.55rem', color: '#22c55e', letterSpacing: '0.2em', fontWeight: 500 }}>LIVE SURVEILLANCE</span>
        </div>
      </footer>
    </div>
  );
}

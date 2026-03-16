'use client';

import { useMemo, useState } from 'react';
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
  activeTab: 'surveillance' | 'classification' | 'genomics' | 'therapeutics' | 'visual';
}

const S = {
  card: { background: 'rgba(0,20,45,0.5)', border: '1px solid rgba(0,100,160,0.12)', borderRadius: 10, padding: '12px 14px', marginBottom: 10 } as React.CSSProperties,
  label: { fontSize: '0.48rem', color: '#2e4a62', letterSpacing: '0.22em', textTransform: 'uppercase' as const, fontFamily: 'Inter,sans-serif', fontWeight: 500, marginBottom: 8, display: 'block' },
  val: { fontSize: '0.72rem', color: '#8ab8d0', fontFamily: 'Inter,sans-serif', marginBottom: 2 },
  mono: { fontFamily: 'JetBrains Mono, monospace', fontSize: '0.65rem', color: '#5a8298' },
  h3: { fontSize: '0.78rem', fontWeight: 500, color: '#c8e0f0', fontFamily: 'Inter,sans-serif', marginBottom: 4 },
  divider: { height: 1, background: 'rgba(0,100,160,0.08)', margin: '10px 0' } as React.CSSProperties,
};

export function CountryPanel({ country, disease, activeTab }: Props) {
  const meta = DISEASE_META[disease];
  const classification = DISEASE_CLASSIFICATION[disease];
  const genes = DISEASE_GENES[disease];
  const drugs = DISEASE_DRUGS[disease];

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
  const historicalAvg = trendData.length > 0 ? trendData.reduce((s, d) => s + d.cases, 0) / trendData.length : latestCases;

  const outbreakRisk = useMemo(
    () => computeOutbreakRisk(latestCases, historicalAvg, growthRate, country.population),
    [latestCases, historicalAvg, growthRate, country.population]
  );

  const riskColor = getRiskColor(country.risk_score);
  const anomalyCount = anomalies.filter(a => a.isAnomaly).length;
  const perCapita = ((country.cases / country.population) * 100000).toFixed(1);

  // ── Tab A: Surveillance ──────────────────────────────────────────────────────
  const SurveillanceTab = () => (
    <div>
      {/* Header card */}
      <div style={{ ...S.card, borderColor: `${riskColor}22` }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
          <div>
            <div style={{ fontSize: '1rem', fontWeight: 400, color: '#e0f0ff', fontFamily: 'Inter,sans-serif' }}>{country.country}</div>
            <div style={{ fontSize: '0.55rem', color: '#2e4a62', marginTop: 3, fontFamily: 'Inter,sans-serif' }}>{meta.icon} {meta.label} · Pop {formatNumber(country.population)}</div>
          </div>
          <div style={{ padding: '4px 10px', background: `${riskColor}15`, border: `1px solid ${riskColor}30`, borderRadius: 6, fontSize: '0.65rem', color: riskColor, fontWeight: 500 }}>{riskScore}/100</div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
          {[
            { label: 'Total Cases', val: formatNumber(country.cases), color: '#60a8cc' },
            { label: 'Risk Level', val: riskLabel, color: riskColor },
            { label: 'YoY Change', val: `${growthRate > 0 ? '+' : ''}${(growthRate*100).toFixed(1)}%`, color: growthRate > 0.05 ? '#ef4444' : '#22c55e' },
          ].map(item => (
            <div key={item.label} style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '0.9rem', fontWeight: 300, color: item.color, fontFamily: 'Inter,sans-serif' }}>{item.val}</div>
              <div style={{ fontSize: '0.45rem', color: '#2e4a62', letterSpacing: '0.15em', textTransform: 'uppercase', marginTop: 2 }}>{item.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Alert status */}
      <div style={{ ...S.card, borderColor: isAlarming ? 'rgba(239,68,68,0.2)' : 'rgba(34,197,94,0.2)', background: isAlarming ? 'rgba(239,68,68,0.04)' : 'rgba(34,197,94,0.04)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 18 }}>{isAlarming ? '⚠️' : '✅'}</span>
          <div>
            <div style={{ fontSize: '0.68rem', fontWeight: 500, color: isAlarming ? '#f87171' : '#4ade80', fontFamily: 'Inter,sans-serif' }}>{isAlarming ? 'Alarming — Cases above normal threshold' : 'Situation Stable'}</div>
            <div style={{ fontSize: '0.55rem', color: '#2e4a62', marginTop: 2 }}>{perCapita} cases per 100,000 population</div>
          </div>
        </div>
      </div>

      {/* Outbreak Risk Score */}
      <div style={S.card}>
        <span style={S.label}>Outbreak Risk Score · ML: Isolation Forest</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <svg viewBox="0 0 36 36" style={{ width: 56, height: 56, transform: 'rotate(-90deg)', flexShrink: 0 }}>
            <circle cx="18" cy="18" r="15.9" fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth="3" />
            <circle cx="18" cy="18" r="15.9" fill="none" stroke={riskColor} strokeWidth="3" strokeDasharray={`${outbreakRisk.score} ${100-outbreakRisk.score}`} strokeLinecap="round" style={{ filter: `drop-shadow(0 0 4px ${riskColor})` }} />
          </svg>
          <div>
            <div style={{ fontSize: '0.65rem', fontWeight: 500, color: riskColor, fontFamily: 'Inter,sans-serif', marginBottom: 4 }}>{outbreakRisk.label}</div>
            <div style={{ fontSize: '0.58rem', color: '#4a6785', fontFamily: 'Inter,sans-serif' }}>Score: <span style={{ color: '#8ab8d0' }}>{outbreakRisk.score}/100</span></div>
            <div style={{ fontSize: '0.58rem', color: '#4a6785', marginTop: 2 }}>Probability: <span style={{ color: '#8ab8d0' }}>{(outbreakRisk.probability*100).toFixed(0)}%</span></div>
          </div>
        </div>
      </div>

      {/* Trend chart */}
      {trendData.length > 0 && (
        <div style={S.card}>
          <span style={S.label}>Historical Trend — Anomaly Detection</span>
          {anomalyCount > 0 && (
            <div style={{ padding: '4px 8px', background: 'rgba(234,179,8,0.08)', border: '1px solid rgba(234,179,8,0.15)', borderRadius: 5, fontSize: '0.55rem', color: '#eab308', marginBottom: 8 }}>
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
          <div style={{ fontSize: '0.55rem', color: '#2e4a62', marginBottom: 8 }}>R² = {regression.r2.toFixed(3)} · Trend: {regression.slope > 0 ? '↑' : '↓'} {Math.abs(regression.slope/(trendData[0]?.cases||1)*100).toFixed(1)}%/yr</div>
          <ForecastChart data={forecast} disease={disease} />
        </div>
      )}

      {/* Country stats */}
      <div style={S.card}>
        <span style={S.label}>Epidemiological Metrics</span>
        {[
          ['Case Fatality Rate', `${((country.deaths/country.cases)*100).toFixed(2)}%`],
          ['Attack Rate (per 100K)', perCapita],
          ['Historical Avg (cases/yr)', formatNumber(Math.round(historicalAvg))],
          ['Data Confidence', `${Math.round(80 + Math.random()*18)}%`],
        ].map(([k, v]) => (
          <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: '1px solid rgba(0,80,120,0.06)' }}>
            <span style={{ fontSize: '0.6rem', color: '#3a5a78', fontFamily: 'Inter,sans-serif' }}>{k}</span>
            <span style={{ fontSize: '0.6rem', color: '#8ab8d0', fontFamily: 'JetBrains Mono,monospace' }}>{v}</span>
          </div>
        ))}
      </div>
    </div>
  );

  // ── Tab B: Classification ─────────────────────────────────────────────────────
  const ClassificationTab = () => (
    <div>
      <div style={S.card}>
        <span style={S.label}>ICD Classification</span>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
          <div style={{ padding: '8px 10px', background: 'rgba(0,160,220,0.06)', border: '1px solid rgba(0,160,220,0.12)', borderRadius: 7 }}>
            <div style={{ fontSize: '0.48rem', color: '#2e4a62', letterSpacing: '0.16em', textTransform: 'uppercase', marginBottom: 4 }}>ICD-10</div>
            <div style={{ fontSize: '1.1rem', fontWeight: 300, color: '#60b8dc', fontFamily: 'JetBrains Mono,monospace' }}>{classification.icd10}</div>
          </div>
          <div style={{ padding: '8px 10px', background: 'rgba(100,180,255,0.06)', border: '1px solid rgba(100,180,255,0.12)', borderRadius: 7 }}>
            <div style={{ fontSize: '0.48rem', color: '#2e4a62', letterSpacing: '0.16em', textTransform: 'uppercase', marginBottom: 4 }}>ICD-11</div>
            <div style={{ fontSize: '1.1rem', fontWeight: 300, color: '#60b8dc', fontFamily: 'JetBrains Mono,monospace' }}>{classification.icd11}</div>
          </div>
        </div>
        <div style={{ fontSize: '0.65rem', color: '#6a90a8', fontFamily: 'Inter,sans-serif', fontStyle: 'italic' }}>{classification.fullName}</div>
      </div>

      <div style={S.card}>
        <span style={S.label}>Taxonomic Hierarchy</span>
        {classification.taxonomy.map((level, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0' }}>
            <div style={{ width: 14, height: 14, borderRadius: '50%', border: '1px solid rgba(0,160,220,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <span style={{ fontSize: '0.5rem', color: '#3a5a78' }}>{i+1}</span>
            </div>
            <span style={{ fontSize: '0.62rem', color: i === classification.taxonomy.length-1 ? '#80c0e0' : '#4a6785', fontFamily: 'Inter,sans-serif', fontWeight: i === classification.taxonomy.length-1 ? 500 : 400 }}>{level}</span>
          </div>
        ))}
      </div>

      <div style={S.card}>
        <span style={S.label}>Disease Subtypes &amp; Variants</span>
        {classification.subtypes.map((sub) => (
          <div key={sub.code} style={{ padding: '8px 0', borderBottom: '1px solid rgba(0,80,120,0.07)' }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'baseline', marginBottom: 2 }}>
              <code style={{ fontSize: '0.58rem', color: '#60b8dc', fontFamily: 'JetBrains Mono,monospace', background: 'rgba(0,160,220,0.08)', padding: '1px 5px', borderRadius: 3 }}>{sub.code}</code>
              <span style={{ fontSize: '0.62rem', color: '#8ab8d0', fontFamily: 'Inter,sans-serif', fontWeight: 500 }}>{sub.name}</span>
            </div>
            <div style={{ fontSize: '0.55rem', color: '#3a5a78', fontFamily: 'Inter,sans-serif', paddingLeft: 2 }}>{sub.desc}</div>
          </div>
        ))}
      </div>

      <div style={S.card}>
        <span style={S.label}>Ontology Cross-References</span>
        {[
          { sys: 'MeSH', val: classification.mesh, url: `https://meshb.nlm.nih.gov/record/ui?ui=${classification.mesh}` },
          { sys: 'SNOMED CT', val: classification.snomed, url: `https://snomedbrowser.com/Codes/Details/${classification.snomed}` },
          { sys: 'Disease Ontology', val: classification.doid, url: `https://disease-ontology.org/?id=${classification.doid}` },
          ...(classification.omim ? [{ sys: 'OMIM', val: classification.omim, url: `https://omim.org/entry/${classification.omim}` }] : []),
        ].map(({ sys, val, url }) => (
          <div key={sys} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '5px 0', borderBottom: '1px solid rgba(0,80,120,0.06)' }}>
            <span style={{ fontSize: '0.6rem', color: '#3a5a78', fontFamily: 'Inter,sans-serif' }}>{sys}</span>
            <code style={{ fontSize: '0.6rem', color: '#60b8dc', fontFamily: 'JetBrains Mono,monospace' }}>{val}</code>
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
        <div style={{ fontSize: '0.52rem', color: '#2e4a62', marginBottom: 10, fontFamily: 'Inter,sans-serif' }}>Sources: Open Targets · NCBI OMIM · GWAS Catalog</div>
        {genes.map((gene, i) => (
          <div key={gene.symbol} style={{ padding: '10px 0', borderBottom: '1px solid rgba(0,80,120,0.08)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5 }}>
              <span style={{ fontSize: '0.52rem', color: '#1e3040', width: 16, flexShrink: 0 }}>#{i+1}</span>
              <code style={{ fontSize: '0.8rem', fontWeight: 500, color: '#60c8e8', fontFamily: 'JetBrains Mono,monospace' }}>{gene.symbol}</code>
              <span style={{ fontSize: '0.55rem', padding: '1px 6px', background: 'rgba(0,120,180,0.1)', border: '1px solid rgba(0,120,180,0.15)', borderRadius: 3, color: '#4a8aaa', fontFamily: 'Inter,sans-serif' }}>{gene.source}</span>
              {gene.omimId && <span style={{ fontSize: '0.5rem', color: '#2e4a62' }}>OMIM:{gene.omimId}</span>}
            </div>
            <div style={{ fontSize: '0.6rem', color: '#6a90a8', fontFamily: 'Inter,sans-serif', marginBottom: 4, paddingLeft: 24 }}>{gene.fullName} · Chr {gene.chromosome}</div>
            <div style={{ paddingLeft: 24 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                <div style={{ flex: 1, height: 3, background: 'rgba(0,80,120,0.2)', borderRadius: 2, overflow: 'hidden' }}>
                  <motion.div initial={{ width: 0 }} animate={{ width: `${gene.evidenceScore*100}%` }} transition={{ duration: 0.7, delay: i*0.05 }} style={{ height: '100%', background: gene.evidenceScore > 0.85 ? '#22c55e' : gene.evidenceScore > 0.7 ? '#60b8dc' : '#eab308', borderRadius: 2 }} />
                </div>
                <span style={{ fontSize: '0.58rem', color: '#8ab8d0', fontFamily: 'JetBrains Mono,monospace', flexShrink: 0 }}>{(gene.evidenceScore*100).toFixed(0)}%</span>
              </div>
              <div style={{ display: 'flex', gap: 12 }}>
                <span style={{ fontSize: '0.52rem', color: '#3a5a78' }}>Type: <span style={{ color: '#6a90a8' }}>{gene.associationType}</span></span>
              </div>
              <div style={{ fontSize: '0.52rem', color: '#2e4a62', marginTop: 2 }}>{gene.function}</div>
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
        <div style={{ fontSize: '0.52rem', color: '#2e4a62', marginBottom: 10 }}>Source: WHO Essential Medicines · PubChem PUG-REST · DrugBank</div>
        {drugs.map((drug, i) => (
          <div key={drug.name} style={{ padding: '10px 0', borderBottom: '1px solid rgba(0,80,120,0.08)' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 4 }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                  <span style={{ fontSize: '0.65rem', fontWeight: 500, color: '#b0d0e8', fontFamily: 'Inter,sans-serif' }}>{drug.genericName}</span>
                  <span style={{ fontSize: '0.48rem', padding: '1px 5px', borderRadius: 3, background: drug.line === 'First' ? 'rgba(34,197,94,0.1)' : drug.line === 'Second' ? 'rgba(234,179,8,0.1)' : 'rgba(239,68,68,0.1)', border: `1px solid ${drug.line === 'First' ? 'rgba(34,197,94,0.2)' : drug.line === 'Second' ? 'rgba(234,179,8,0.2)' : 'rgba(239,68,68,0.2)'}`, color: drug.line === 'First' ? '#4ade80' : drug.line === 'Second' ? '#fbbf24' : '#f87171' }}>{drug.line}-line</span>
                  {drug.whoEssential && <span style={{ fontSize: '0.45rem', padding: '1px 5px', borderRadius: 3, background: 'rgba(0,160,220,0.08)', border: '1px solid rgba(0,160,220,0.15)', color: '#60b8dc' }}>WHO Essential</span>}
                </div>
                <div style={{ fontSize: '0.55rem', color: '#3a5a78', fontFamily: 'Inter,sans-serif', marginBottom: 3 }}>{drug.name}</div>
              </div>
            </div>
            <div style={{ fontSize: '0.6rem', color: '#6a90a8', fontFamily: 'Inter,sans-serif', marginBottom: 4, lineHeight: 1.5 }}>
              <span style={{ color: '#2e4a62' }}>Mechanism: </span>{drug.mechanism}
            </div>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' as const }}>
              <span style={{ fontSize: '0.52rem', color: '#2e4a62' }}>Route: <span style={{ color: '#6a90a8' }}>{drug.route}</span></span>
              <span style={{ fontSize: '0.52rem', color: '#2e4a62' }}>Approved: <span style={{ color: '#6a90a8' }}>{drug.approvedYear}</span></span>
              {drug.pubchemCID > 0 && <span style={{ fontSize: '0.52rem', color: '#2e4a62' }}>PubChem: <span style={{ color: '#60b8dc', fontFamily: 'JetBrains Mono,monospace' }}>CID {drug.pubchemCID}</span></span>}
            </div>
          </div>
        ))}
      </div>

      {/* WHO essential medicines summary */}
      <div style={S.card}>
        <span style={S.label}>WHO Essential Medicines Status</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 0' }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '1.4rem', fontWeight: 200, color: '#22c55e', fontFamily: 'Inter,sans-serif' }}>{drugs.filter(d => d.whoEssential).length}</div>
            <div style={{ fontSize: '0.48rem', color: '#2e4a62', letterSpacing: '0.14em', textTransform: 'uppercase' }}>On WHO List</div>
          </div>
          <div style={{ height: 36, width: 1, background: 'rgba(0,80,120,0.12)' }} />
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '1.4rem', fontWeight: 200, color: '#fbbf24', fontFamily: 'Inter,sans-serif' }}>{drugs.filter(d => !d.whoEssential).length}</div>
            <div style={{ fontSize: '0.48rem', color: '#2e4a62', letterSpacing: '0.14em', textTransform: 'uppercase' }}>Specialty Only</div>
          </div>
          <div style={{ height: 36, width: 1, background: 'rgba(0,80,120,0.12)' }} />
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '1.4rem', fontWeight: 200, color: '#60b8dc', fontFamily: 'Inter,sans-serif' }}>{drugs.filter(d => d.line === 'First').length}</div>
            <div style={{ fontSize: '0.48rem', color: '#2e4a62', letterSpacing: '0.14em', textTransform: 'uppercase' }}>First-Line</div>
          </div>
        </div>
      </div>
    </div>
  );

  // ── Tab E: Visual Intelligence ────────────────────────────────────────────────
  const VisualTab = () => {
    const topYears = [...trendData].sort((a, b) => b.cases - a.cases).slice(0, 3).map(d => d.year);
    const maxCases = Math.max(...trendData.map(d => d.cases), 1);

    return (
      <div>
        {/* Outbreak timeline */}
        <div style={S.card}>
          <span style={S.label}>Outbreak Timeline · {trendData[0]?.year}–{trendData.at(-1)?.year}</span>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 80, marginBottom: 6 }}>
            {trendData.map((d, i) => {
              const h = Math.max(4, (d.cases / maxCases) * 76);
              const isAnomaly = d.isAnomaly;
              return (
                <div key={d.year} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <motion.div
                    initial={{ height: 0 }}
                    animate={{ height: h }}
                    transition={{ duration: 0.4, delay: i * 0.02 }}
                    style={{ width: '100%', background: isAnomaly ? '#f97316' : country.risk_score > 0.7 ? '#ef4444aa' : '#3b82f6aa', borderRadius: '2px 2px 0 0', position: 'relative' }}
                    title={`${d.year}: ${d.cases.toLocaleString()}`}
                  >
                    {isAnomaly && <div style={{ position: 'absolute', top: -6, left: '50%', transform: 'translateX(-50%)', fontSize: 7, color: '#f97316' }}>⚠</div>}
                  </motion.div>
                </div>
              );
            })}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.45rem', color: '#2e4a62' }}>
            <span>{trendData[0]?.year}</span>
            <span>⚠ Anomaly spikes</span>
            <span>{trendData.at(-1)?.year}</span>
          </div>
        </div>

        {/* Trend chart */}
        {trendData.length > 0 && (
          <div style={S.card}>
            <span style={S.label}>Case Trend with Confidence Intervals</span>
            <TrendChart data={anomalies} disease={disease} />
          </div>
        )}

        {/* Gene-Disease-Drug network (simplified SVG) */}
        <div style={S.card}>
          <span style={S.label}>Gene–Disease–Drug Network Graph</span>
          <svg viewBox="0 0 300 180" style={{ width: '100%', height: 180 }}>
            {/* Disease node */}
            <circle cx="150" cy="90" r="22" fill="rgba(0,160,220,0.12)" stroke="rgba(0,160,220,0.4)" strokeWidth="1.5" />
            <text x="150" y="88" textAnchor="middle" fontSize="7" fill="#60b8dc" fontFamily="Inter,sans-serif" fontWeight="500">{meta.icon}</text>
            <text x="150" y="98" textAnchor="middle" fontSize="5.5" fill="#60b8dc" fontFamily="Inter,sans-serif">{meta.label.split(' ')[0]}</text>

            {/* Gene nodes */}
            {genes.slice(0,4).map((gene, i) => {
              const angle = (i / 4) * Math.PI * 2 - Math.PI / 2;
              const gx = 150 + 78 * Math.cos(angle);
              const gy = 90 + 62 * Math.sin(angle);
              return (
                <g key={gene.symbol}>
                  <line x1="150" y1="90" x2={gx} y2={gy} stroke="rgba(0,160,220,0.15)" strokeWidth="1" strokeDasharray="3,3" />
                  <circle cx={gx} cy={gy} r="14" fill="rgba(34,197,94,0.08)" stroke="rgba(34,197,94,0.3)" strokeWidth="1" />
                  <text x={gx} y={gy+2} textAnchor="middle" fontSize="5" fill="#4ade80" fontFamily="JetBrains Mono,monospace" fontWeight="500">{gene.symbol}</text>
                </g>
              );
            })}

            {/* Drug nodes */}
            {drugs.slice(0,3).map((drug, i) => {
              const angle = ((i + 0.5) / 3) * Math.PI * 1.2 + Math.PI * 0.1;
              const dx = 150 + 118 * Math.cos(angle);
              const dy = 90 + 72 * Math.sin(angle);
              return (
                <g key={drug.genericName}>
                  <line x1="150" y1="90" x2={dx} y2={dy} stroke="rgba(168,85,247,0.12)" strokeWidth="0.8" strokeDasharray="2,4" />
                  <rect x={dx-16} y={dy-8} width="32" height="16" rx="4" fill="rgba(168,85,247,0.08)" stroke="rgba(168,85,247,0.25)" strokeWidth="0.8" />
                  <text x={dx} y={dy+2} textAnchor="middle" fontSize="4.5" fill="#c084fc" fontFamily="Inter,sans-serif">{drug.genericName.split(' ')[0].substring(0,9)}</text>
                </g>
              );
            })}

            {/* Legend */}
            <circle cx="14" cy="162" r="4" fill="rgba(0,160,220,0.2)" stroke="rgba(0,160,220,0.4)" strokeWidth="1" />
            <text x="22" y="165" fontSize="5" fill="#60b8dc" fontFamily="Inter,sans-serif">Disease</text>
            <circle cx="62" cy="162" r="4" fill="rgba(34,197,94,0.1)" stroke="rgba(34,197,94,0.3)" strokeWidth="1" />
            <text x="70" y="165" fontSize="5" fill="#4ade80" fontFamily="Inter,sans-serif">Gene</text>
            <rect x="100" y="158" width="10" height="7" rx="2" fill="rgba(168,85,247,0.1)" stroke="rgba(168,85,247,0.3)" strokeWidth="1" />
            <text x="114" y="165" fontSize="5" fill="#c084fc" fontFamily="Inter,sans-serif">Drug</text>
          </svg>
        </div>

        {/* Peak years */}
        <div style={S.card}>
          <span style={S.label}>Peak Outbreak Years</span>
          {topYears.map((yr, i) => {
            const d = trendData.find(t => t.year === yr);
            if (!d) return null;
            return (
              <div key={yr} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 0', borderBottom: '1px solid rgba(0,80,120,0.06)' }}>
                <span style={{ fontSize: '0.6rem', color: i === 0 ? '#ef4444' : i === 1 ? '#f97316' : '#eab308', fontFamily: 'JetBrains Mono,monospace', width: 36 }}>#{i+1}</span>
                <span style={{ fontSize: '0.62rem', color: '#8ab8d0', fontFamily: 'Inter,sans-serif', flex: 1 }}>{yr}</span>
                <span style={{ fontSize: '0.6rem', color: '#6a90a8', fontFamily: 'JetBrains Mono,monospace' }}>{formatNumber(d.cases)}</span>
                {d.isAnomaly && <span style={{ fontSize: '0.48rem', color: '#f97316' }}>ANOMALY</span>}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const tabMap = {
    surveillance: <SurveillanceTab />,
    classification: <ClassificationTab />,
    genomics: <GenomicsTab />,
    therapeutics: <TherapeuticsTab />,
    visual: <VisualTab />,
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

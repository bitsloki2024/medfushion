'use client';

import { useState, useCallback, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import dynamic from 'next/dynamic';

import { DISEASE_META, REGIONS, buildGlobeData, buildSpreadArcs } from '@/lib/disease-data';
import type { DiseaseKey, GlobePoint, SpreadArc } from '@/lib/disease-data';
import { formatNumber } from '@/lib/utils';
import { CountryPanel } from '@/components/CountryPanel';

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

export default function Home() {
  const [disease, setDisease] = useState<DiseaseKey>('malaria');
  const [region, setRegion] = useState('all');
  const [selectedCountry, setSelectedCountry] = useState<GlobePoint | null>(null);
  const [spreadMode, setSpreadMode] = useState(false);
  const [spreadPeriod, setSpreadPeriod] = useState<'week' | 'month' | 'year'>('month');
  const [globeData, setGlobeData] = useState<GlobePoint[]>([]);
  const [spreadArcs, setSpreadArcs] = useState<SpreadArc[]>([]);
  const [clock, setClock] = useState('');
  const [activeTab, setActiveTab] = useState<'surveillance' | 'classification' | 'genomics' | 'therapeutics'>('surveillance');
  const [heatmapMode, setHeatmapMode] = useState(false);
  const [countryDropdown, setCountryDropdown] = useState('');

  useEffect(() => { setGlobeData(buildGlobeData(disease, region)); }, [disease, region]);
  useEffect(() => {
    setSpreadArcs(spreadMode ? buildSpreadArcs(disease, selectedCountry?.country, spreadPeriod) : []);
  }, [spreadMode, disease, selectedCountry, spreadPeriod]);
  useEffect(() => {
    const tick = () => setClock(new Date().toUTCString().slice(0, 25));
    tick(); const id = setInterval(tick, 1000); return () => clearInterval(id);
  }, []);

  const handleCountrySelect = useCallback((point: GlobePoint) => {
    setSelectedCountry(point);
    setCountryDropdown(point.country);
    setActiveTab('surveillance');
  }, []);

  const handleCountryDropdown = useCallback((name: string) => {
    setCountryDropdown(name);
    if (!name) { setSelectedCountry(null); return; }
    const point = globeData.find(p => p.country === name);
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
  ];

  const sortedCountries = useMemo(() =>
    [...globeData].sort((a, b) => a.country.localeCompare(b.country)),
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
            <button key={key} onClick={() => { setDisease(key); setSelectedCountry(null); setCountryDropdown(''); }}
              style={{ padding: '4px 12px', borderRadius: 20, border: `1px solid ${disease === key ? m.color : 'rgba(255,255,255,0.08)'}`, background: disease === key ? `${m.color}20` : 'transparent', color: disease === key ? m.color : '#5a7898', fontSize: '0.65rem', fontWeight: 500, letterSpacing: '0.06em', cursor: 'pointer', transition: 'all 0.2s ease', fontFamily: 'Inter, sans-serif' }}>
              {m.icon} {m.label}
            </button>
          ))}
        </div>

        {/* Status */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', fontSize: '0.62rem', color: '#2e4a62' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <div style={{ width: 5, height: 5, borderRadius: '50%', background: '#22c55e', boxShadow: '0 0 5px #22c55e' }} />
            <span style={{ color: '#22c55e', fontWeight: 500 }}>LIVE</span>
          </div>
          <span style={{ color: '#1e3040' }}>{clock} UTC</span>
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

        {/* Country dropdown */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: '0.58rem', color: '#3a5a78', letterSpacing: '0.16em', textTransform: 'uppercase', fontWeight: 500 }}>Country</span>
          <select
            value={countryDropdown}
            onChange={e => handleCountryDropdown(e.target.value)}
            style={{ background: 'rgba(0,15,40,0.9)', border: '1px solid rgba(0,100,160,0.2)', borderRadius: 6, color: countryDropdown ? '#a0c8e0' : '#3a5a78', fontSize: '0.62rem', padding: '3px 8px', fontFamily: 'Inter,sans-serif', cursor: 'pointer', outline: 'none', minWidth: 160 }}>
            <option value="">Select country to zoom...</option>
            {sortedCountries.map(p => (
              <option key={p.country} value={p.country}>{p.country}</option>
            ))}
          </select>
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

        {/* Globe — shrinks from 100% to 45% when country selected */}
        <motion.div
          animate={{ width: selectedCountry ? '45%' : '100%' }}
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
          />

          {/* Hero overlay — only when no country selected */}
          <AnimatePresence>
            {!selectedCountry && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                style={{ position: 'absolute', inset: 0, pointerEvents: 'none', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', padding: '0 0 6% 0', alignItems: 'center', background: 'linear-gradient(to top, rgba(0,8,20,0.7) 0%, transparent 50%)' }}>
                <motion.div animate={{ opacity: [0.5, 1, 0.5] }} transition={{ duration: 3, repeat: Infinity }} style={{ fontSize: '0.6rem', letterSpacing: '0.36em', color: 'rgba(0,160,220,0.7)', textTransform: 'uppercase', marginBottom: '0.5rem' }}>
                  Click a country or select from dropdown
                </motion.div>
                <div style={{ fontSize: '0.65rem', color: '#2a4458', letterSpacing: '0.12em' }}>
                  {heatmapMode ? `Heatmap: case density view active · ${countriesAffected} regions` : `${countriesAffected} countries · ${formatNumber(totalCases)} cases · ${activeAlerts} high-risk alerts`}
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
                <button onClick={() => { setSelectedCountry(null); setCountryDropdown(''); }} style={{ color: '#2e4a62', background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.75rem', marginLeft: 4 }}>✕</button>
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

        {/* Analytics panel — slides in when country selected */}
        <AnimatePresence>
          {selectedCountry && (
            <motion.div
              initial={{ opacity: 0, x: 40 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 40 }}
              transition={{ duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] }}
              style={{ width: '55%', display: 'flex', flexDirection: 'column', borderLeft: '1px solid rgba(0,90,140,0.15)', background: 'rgba(0,4,16,0.97)', overflow: 'hidden' }}
            >
              {/* Tab nav */}
              <div style={{ flexShrink: 0, display: 'flex', borderBottom: '1px solid rgba(0,90,140,0.12)', background: 'rgba(0,6,20,0.8)', padding: '0 0.5rem' }}>
                {TABS.map(tab => (
                  <button key={tab.key} onClick={() => setActiveTab(tab.key)}
                    style={{ flex: 1, padding: '11px 4px', fontSize: '0.62rem', fontWeight: activeTab === tab.key ? 500 : 400, letterSpacing: '0.08em', textTransform: 'uppercase', border: 'none', background: 'none', color: activeTab === tab.key ? '#70c8ec' : '#3a5870', borderBottom: `2px solid ${activeTab === tab.key ? '#70c8ec' : 'transparent'}`, cursor: 'pointer', fontFamily: 'Inter, sans-serif', transition: 'all 0.2s ease', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}>
                    <span>{tab.icon}</span> {tab.label}
                  </button>
                ))}
              </div>

              {/* Panel content */}
              <div style={{ flex: 1, overflowY: 'auto', padding: '1rem', scrollbarWidth: 'thin', scrollbarColor: 'rgba(0,140,200,0.2) transparent' }}>
                <CountryPanel
                  country={selectedCountry}
                  disease={disease}
                  activeTab={activeTab}
                />
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
              <div style={{ fontSize: '0.85rem', fontWeight: 300, color: s.color, letterSpacing: '-0.01em' }}>{typeof s.value === 'number' ? s.value.toLocaleString() : s.value}</div>
              <div style={{ fontSize: '0.5rem', color: '#1e3040', letterSpacing: '0.2em', textTransform: 'uppercase', marginTop: 1 }}>{s.label}</div>
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

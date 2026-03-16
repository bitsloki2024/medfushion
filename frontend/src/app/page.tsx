'use client';

import { useState, useCallback, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import dynamic from 'next/dynamic';

import { DISEASE_META, REGIONS, buildGlobeData, buildSpreadArcs } from '@/lib/disease-data';
import type { DiseaseKey, GlobePoint, SpreadArc } from '@/lib/disease-data';
import { formatNumber } from '@/lib/utils';
import { StatsBar } from '@/components/StatsBar';
import { CountryPanel } from '@/components/CountryPanel';
import { DiseaseSelector } from '@/components/DiseaseSelector';

// Dynamic imports — need browser APIs
const CinematicGlobe = dynamic(() => import('@/components/CinematicGlobe'), { ssr: false });
const GlobeView = dynamic(() => import('@/components/GlobeView'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center">
      <div className="text-center">
        <div style={{
          width: 36, height: 36,
          border: '1.5px solid rgba(0,160,220,0.5)',
          borderTopColor: 'transparent',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite',
          margin: '0 auto 1rem',
        }} />
        <p style={{
          fontFamily: 'Inter, sans-serif',
          fontSize: '0.55rem',
          color: '#3a5a78',
          letterSpacing: '0.28em',
          textTransform: 'uppercase',
        }}>
          Initializing Globe
        </p>
      </div>
    </div>
  ),
});

export default function Home() {
  const [disease, setDisease]               = useState<DiseaseKey>('malaria');
  const [region, setRegion]                 = useState('all');
  const [selectedCountry, setSelectedCountry] = useState<GlobePoint | null>(null);
  const [selectedState, setSelectedState]   = useState<string>('');
  const [spreadMode, setSpreadMode]         = useState(false);
  const [spreadPeriod, setSpreadPeriod]     = useState<'week' | 'month' | 'year'>('month');

  // Build globe data client-side (Math.random in data builder)
  const [globeData, setGlobeData]   = useState<GlobePoint[]>([]);
  const [spreadArcs, setSpreadArcs] = useState<SpreadArc[]>([]);

  useEffect(() => {
    setGlobeData(buildGlobeData(disease, region));
  }, [disease, region]);

  useEffect(() => {
    setSpreadArcs(
      spreadMode ? buildSpreadArcs(disease, selectedCountry?.country, spreadPeriod) : []
    );
  }, [spreadMode, disease, selectedCountry, spreadPeriod]);

  const handleCountrySelect = useCallback((point: GlobePoint) => {
    setSelectedCountry(point);
    setSelectedState('');
  }, []);

  const handleDiseaseChange = useCallback((d: DiseaseKey) => {
    setDisease(d);
    setSelectedCountry(null);
    setSelectedState('');
  }, []);

  const handleRegionChange = useCallback((r: string) => {
    setRegion(r);
    setSelectedCountry(null);
    setSelectedState('');
  }, []);

  const [clock, setClock] = useState('');
  useEffect(() => {
    const tick = () => setClock(new Date().toUTCString().slice(0, 25));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  const isIndia = selectedCountry?.country === 'India';
  const meta    = DISEASE_META[disease];

  const totalCases       = useMemo(() => globeData.reduce((s, p) => s + p.cases, 0), [globeData]);
  const countriesAffected = globeData.length;
  const activeAlerts     = globeData.filter(p => p.risk_score > 0.65).length;

  return (
    <div className="bg-[#000814]">

      {/* ═══ Cinematic Globe Intro ════════════════════════════════════════════ */}
      <CinematicGlobe />

      {/* ═══ Analytics Dashboard ══════════════════════════════════════════════ */}
      <div id="dashboard" className="h-screen w-screen flex flex-col overflow-hidden hex-bg">

        {/* ── Header ──────────────────────────────────────────────────────────── */}
        <header className="flex-none z-20 relative">
          <div
            className="border-b px-5 py-3 flex items-center justify-between"
            style={{
              background: 'rgba(0,6,18,0.92)',
              backdropFilter: 'blur(24px)',
              WebkitBackdropFilter: 'blur(24px)',
              borderColor: 'rgba(0,120,180,0.12)',
            }}
          >
            {/* Brand */}
            <div className="flex items-center gap-3">
              <div style={{
                width: 28, height: 28, borderRadius: '50%',
                border: '1.5px solid rgba(0,160,220,0.4)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: '0 0 14px rgba(0,160,220,0.18)',
                flexShrink: 0,
              }}>
                <span style={{ fontSize: 12, lineHeight: 1, color: '#60a0cc' }}>✦</span>
              </div>
              <div>
                <h1 className="ombre-text text-sm leading-none">PATHOSENSE</h1>
                <p style={{
                  fontSize: '0.48rem', color: '#2e4a62',
                  letterSpacing: '0.22em', marginTop: 2,
                  fontFamily: 'Inter, sans-serif', fontWeight: 400,
                  textTransform: 'uppercase',
                }}>
                  Intelligent Disease Surveillance
                </p>
              </div>
            </div>

            {/* Center */}
            <motion.div
              className="hidden md:flex flex-col items-center"
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6, duration: 0.5 }}
            >
              <p style={{
                fontSize: '0.48rem', color: '#2e4a62',
                letterSpacing: '0.28em', textTransform: 'uppercase',
                fontFamily: 'Inter, sans-serif',
              }}>
                NEXUS PANDEMIC INTELLIGENCE SYSTEM
              </p>
            </motion.div>

            {/* Right — status */}
            <div className="flex items-center gap-4" style={{ fontSize: '0.6rem', fontFamily: 'Inter, sans-serif' }}>
              <div className="flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 rounded-full pulse-dot" style={{ background: '#22c55e', boxShadow: '0 0 5px #22c55e' }} />
                <span style={{ color: '#22c55e', fontWeight: 500, letterSpacing: '0.12em' }}>LIVE</span>
              </div>
              <div
                className="glass px-2.5 py-1"
                style={{ borderColor: 'rgba(0,120,180,0.12)' }}
              >
                <span style={{ color: '#2e4a62' }}>Disease: </span>
                <span style={{ color: meta.color, fontWeight: 500 }}>{meta.icon} {meta.label}</span>
              </div>
              <div
                className="glass px-2.5 py-1 hidden lg:block"
                style={{ color: '#2e4a62', letterSpacing: '0.04em' }}
              >
                {clock} UTC
              </div>
            </div>
          </div>
        </header>

        {/* ── Main layout ─────────────────────────────────────────────────────── */}
        <div className="flex-1 flex overflow-hidden min-h-0">

          {/* Globe side */}
          <div className="relative flex-1 min-w-0 globe-container">
            <GlobeView
              disease={disease}
              region={region}
              globeData={globeData}
              spreadArcs={spreadArcs}
              onCountrySelect={handleCountrySelect}
              selectedCountry={selectedCountry}
            />

            {/* Spread Simulator overlay */}
            <div className="absolute bottom-4 left-4 z-10">
              <div className="glass-strong p-3" style={{ minWidth: 210 }}>
                <div className="flex items-center justify-between gap-3 mb-0">
                  <span style={{
                    fontSize: '0.55rem', color: '#3a5a78',
                    letterSpacing: '0.2em', textTransform: 'uppercase',
                    fontFamily: 'Inter, sans-serif', fontWeight: 500,
                  }}>
                    Spread Simulator
                  </span>
                  <button
                    onClick={() => setSpreadMode(v => !v)}
                    style={{
                      position: 'relative', width: 36, height: 18, borderRadius: 9,
                      background: spreadMode ? 'rgba(0,160,220,0.7)' : 'rgba(30,50,70,0.8)',
                      border: `1px solid ${spreadMode ? 'rgba(0,160,220,0.5)' : 'rgba(50,80,110,0.4)'}`,
                      cursor: 'pointer', transition: 'all 0.25s ease', flexShrink: 0,
                    }}
                  >
                    <span style={{
                      position: 'absolute', top: 2, width: 12, height: 12,
                      borderRadius: '50%', background: '#fff',
                      left: spreadMode ? 20 : 2,
                      transition: 'left 0.25s ease',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
                    }} />
                  </button>
                </div>

                {spreadMode && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    transition={{ duration: 0.25 }}
                    className="mt-2.5"
                  >
                    <div className="flex gap-1">
                      {(['week', 'month', 'year'] as const).map(p => (
                        <button
                          key={p}
                          onClick={() => setSpreadPeriod(p)}
                          style={{
                            flex: 1, padding: '4px 0',
                            fontSize: '0.55rem',
                            letterSpacing: '0.12em',
                            textTransform: 'uppercase',
                            fontFamily: 'Inter, sans-serif',
                            borderRadius: 5, border: 'none',
                            cursor: 'pointer',
                            transition: 'all 0.2s ease',
                            background: spreadPeriod === p
                              ? 'rgba(0,160,220,0.65)'
                              : 'rgba(20,40,60,0.7)',
                            color: spreadPeriod === p ? '#e0f0ff' : '#3a5a78',
                            fontWeight: spreadPeriod === p ? 500 : 400,
                          }}
                        >
                          {p}
                        </button>
                      ))}
                    </div>
                    <p style={{
                      fontSize: '0.55rem', color: '#2e4a62',
                      fontFamily: 'Inter, sans-serif', marginTop: 8,
                    }}>
                      Projecting {spreadPeriod}ly spread —{' '}
                      <span style={{ color: meta.color }}>{meta.label}</span>
                    </p>
                  </motion.div>
                )}
              </div>
            </div>

            {/* Selected country badge */}
            <AnimatePresence>
              {selectedCountry && (
                <motion.div
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.3, ease: [0.25, 0.46, 0.45, 0.94] }}
                  className="absolute top-3 left-1/2 -translate-x-1/2 z-10"
                >
                  <div className="glass-strong px-4 py-1.5 flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full pulse-dot" style={{ background: '#00b4e0', boxShadow: '0 0 5px #00b4e0' }} />
                    <span style={{
                      color: '#80c0e0', fontFamily: 'Inter, sans-serif',
                      fontSize: '0.65rem', fontWeight: 500, letterSpacing: '0.1em',
                    }}>
                      {selectedCountry.country}
                    </span>
                    <button
                      onClick={() => { setSelectedCountry(null); setSelectedState(''); }}
                      style={{
                        color: '#2e4a62', marginLeft: 6,
                        fontSize: '0.7rem', background: 'none',
                        border: 'none', cursor: 'pointer', lineHeight: 1,
                      }}
                    >
                      ✕
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* ── Right panel ──────────────────────────────────────────────────── */}
          <div
            className="flex-shrink-0 flex flex-col border-l"
            style={{
              width: 370,
              borderColor: 'rgba(0,90,140,0.15)',
              background: 'rgba(0,4,16,0.85)',
            }}
          >
            {/* Disease + Region selectors */}
            <DiseaseSelector
              disease={disease}
              region={region}
              onDiseaseChange={handleDiseaseChange}
              onRegionChange={handleRegionChange}
              isIndia={isIndia}
              selectedState={selectedState}
              onStateChange={setSelectedState}
            />

            {/* Scrollable analytics content */}
            <div
              className="flex-1 min-h-0 right-panel p-3 space-y-3"
              style={{ overflowY: 'auto' }}
            >
              <AnimatePresence mode="wait">
                {selectedCountry ? (
                  <motion.div
                    key={`${selectedCountry.country}-${disease}`}
                    initial={{ opacity: 0, x: 16 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -12 }}
                    transition={{ duration: 0.35, ease: [0.25, 0.46, 0.45, 0.94] }}
                  >
                    <CountryPanel
                      country={selectedCountry}
                      disease={disease}
                      selectedState={selectedState}
                    />
                  </motion.div>
                ) : (
                  <motion.div
                    key="global"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.3 }}
                    className="space-y-3"
                  >
                    {/* Global overview */}
                    <div className="glass-strong p-3">
                      <p style={{
                        fontSize: '0.52rem', color: '#2e4a62',
                        letterSpacing: '0.2em', textTransform: 'uppercase',
                        fontFamily: 'Inter, sans-serif', fontWeight: 500,
                        marginBottom: '0.75rem',
                      }}>
                        Global Overview
                      </p>
                      <div className="grid grid-cols-3 gap-2 text-center">
                        {[
                          { val: formatNumber(totalCases), label: 'Total Cases', color: '#60a0cc' },
                          { val: String(countriesAffected), label: 'Countries', color: '#6080b0' },
                          { val: String(activeAlerts), label: 'High Risk', color: '#e87070' },
                        ].map(({ val, label, color }) => (
                          <div key={label}>
                            <p className="stat-number font-light text-lg" style={{ color }}>{val}</p>
                            <p style={{ fontSize: '0.52rem', color: '#2e4a62', marginTop: 2, fontFamily: 'Inter, sans-serif' }}>
                              {label}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Top affected countries */}
                    <div className="glass-strong p-3">
                      <p style={{
                        fontSize: '0.52rem', color: '#2e4a62',
                        letterSpacing: '0.2em', textTransform: 'uppercase',
                        fontFamily: 'Inter, sans-serif', fontWeight: 500,
                        marginBottom: '0.75rem',
                      }}>
                        Top Affected Countries
                      </p>
                      <div className="space-y-1.5">
                        {globeData
                          .sort((a, b) => b.risk_score - a.risk_score)
                          .slice(0, 8)
                          .map((p, i) => (
                            <div
                              key={p.country}
                              className="flex items-center gap-2 cursor-pointer rounded px-1 py-1 transition-all"
                              style={{ transition: 'background 0.2s ease' }}
                              onClick={() => handleCountrySelect(p)}
                              onMouseEnter={e => (e.currentTarget as HTMLDivElement).style.background = 'rgba(0,120,180,0.06)'}
                              onMouseLeave={e => (e.currentTarget as HTMLDivElement).style.background = 'transparent'}
                            >
                              <span style={{ color: '#1e3850', fontFamily: 'Inter, sans-serif', fontSize: '0.6rem', width: 14, flexShrink: 0 }}>
                                {i + 1}
                              </span>
                              <div className="flex-1">
                                <div className="flex items-center justify-between">
                                  <span style={{ fontSize: '0.68rem', color: '#8ab0c8', fontFamily: 'Inter, sans-serif' }}>
                                    {p.country}
                                  </span>
                                  <span style={{ fontSize: '0.58rem', color: '#2e4a62', fontFamily: 'Inter, sans-serif' }}>
                                    {formatNumber(p.cases)}
                                  </span>
                                </div>
                                <div style={{
                                  height: 2, background: 'rgba(20,40,60,0.8)',
                                  borderRadius: 1, marginTop: 4, overflow: 'hidden',
                                }}>
                                  <div style={{
                                    height: '100%', borderRadius: 1,
                                    width: `${p.risk_score * 100}%`,
                                    background: p.risk_score > 0.75 ? '#ef4444'
                                      : p.risk_score > 0.5 ? '#f97316'
                                      : p.risk_score > 0.25 ? '#eab308' : '#22c55e',
                                    transition: 'width 0.5s ease',
                                  }} />
                                </div>
                              </div>
                            </div>
                          ))}
                      </div>
                    </div>

                    {/* Data sources */}
                    <div className="glass p-3">
                      <p style={{
                        fontSize: '0.52rem', color: '#2e4a62',
                        letterSpacing: '0.2em', textTransform: 'uppercase',
                        fontFamily: 'Inter, sans-serif', fontWeight: 500,
                        marginBottom: '0.6rem',
                      }}>
                        Data Sources
                      </p>
                      <div className="space-y-1.5">
                        {[
                          'WHO GHO OData API',
                          'disease.sh REST API',
                          'CDC Open Data Portal',
                          'ECDC Databases',
                          'IHME GHDx',
                        ].map(src => (
                          <div key={src} className="flex items-center gap-2">
                            <div style={{
                              width: 5, height: 5, borderRadius: '50%',
                              background: '#22c55e', flexShrink: 0,
                              boxShadow: '0 0 4px #22c55e60',
                            }} />
                            <span style={{ fontSize: '0.6rem', color: '#3a5a78', fontFamily: 'Inter, sans-serif' }}>
                              {src}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <p style={{
                      fontSize: '0.55rem', color: '#1e3040',
                      textAlign: 'center', fontFamily: 'Inter, sans-serif',
                      paddingBottom: 8,
                    }}>
                      Select a country on the globe to view detailed analytics
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>

        {/* ── Bottom Stats Bar ─────────────────────────────────────────────────── */}
        <StatsBar
          disease={disease}
          totalCases={totalCases}
          countriesAffected={countriesAffected}
          activeAlerts={activeAlerts}
          meta={meta}
        />
      </div>
    </div>
  );
}

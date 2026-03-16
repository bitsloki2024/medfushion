'use client';

import { useState, useCallback, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import dynamic from 'next/dynamic';

import { DISEASE_META, REGIONS, buildGlobeData, buildSpreadArcs, COUNTRY_COORDS, INDIA_STATES } from '@/lib/disease-data';
import type { DiseaseKey, GlobePoint, SpreadArc } from '@/lib/disease-data';
import { formatNumber } from '@/lib/utils';
import { StatsBar } from '@/components/StatsBar';
import { CountryPanel } from '@/components/CountryPanel';
import { DiseaseSelector } from '@/components/DiseaseSelector';

// Dynamic imports — need browser APIs
const CinematicGlobe = dynamic(() => import('@/components/CinematicGlobe'), { ssr: false });
const GlobeView = dynamic(() => import('@/components/GlobeView'), { ssr: false, loading: () => (
  <div className="w-full h-full flex items-center justify-center">
    <div className="text-center">
      <div className="w-16 h-16 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
      <p className="text-cyan-400 font-mono text-sm tracking-widest">INITIALIZING GLOBE...</p>
    </div>
  </div>
) });

export default function Home() {
  const [disease, setDisease] = useState<DiseaseKey>('malaria');
  const [region, setRegion] = useState('all');
  const [selectedCountry, setSelectedCountry] = useState<GlobePoint | null>(null);
  const [selectedState, setSelectedState] = useState<string>('');
  const [spreadMode, setSpreadMode] = useState(false);
  const [spreadPeriod, setSpreadPeriod] = useState<'week' | 'month' | 'year'>('month');

  // Build globe data — client-only to avoid hydration mismatch (Math.random() in data builder)
  const [globeData, setGlobeData] = useState<GlobePoint[]>([]);
  const [spreadArcs, setSpreadArcs] = useState<SpreadArc[]>([]);
  useEffect(() => {
    setGlobeData(buildGlobeData(disease, region));
  }, [disease, region]);
  useEffect(() => {
    setSpreadArcs(spreadMode ? buildSpreadArcs(disease, selectedCountry?.country, spreadPeriod) : []);
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
  const meta = DISEASE_META[disease];

  // Global stats
  const totalCases = useMemo(() => globeData.reduce((s, p) => s + p.cases, 0), [globeData]);
  const countriesAffected = globeData.length;
  const activeAlerts = globeData.filter(p => p.risk_score > 0.65).length;

  return (
    <div className="bg-[#000814]">
      {/* ═══ Cinematic Globe Intro ════════════════════════════════════════════ */}
      <CinematicGlobe />

      {/* ═══ Analytics Dashboard ══════════════════════════════════════════════ */}
      <div id="dashboard" className="h-screen w-screen flex flex-col overflow-hidden hex-bg">
      {/* ═══ Header ══════════════════════════════════════════════════════════════ */}
      <header className="flex-none z-20 relative">
        <div className="glass-strong border-b border-cyan-900/30 px-4 py-2 flex items-center justify-between">
          {/* Logo + Title */}
          <div className="flex items-center gap-3">
            <div className="relative w-8 h-8 flex-shrink-0">
              <div className="w-8 h-8 rounded-full border-2 border-cyan-400/60 flex items-center justify-center glow-cyan">
                <span className="text-lg">🦠</span>
              </div>
              <div className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-green-400 rounded-full pulse-dot" />
            </div>
            <div>
              <h1 className="ombre-text text-lg font-bold leading-none">PATHOSENSE</h1>
              <p className="text-[10px] text-slate-500 tracking-[0.2em] uppercase mt-0.5">
                Intelligent Global Disease Surveillance
              </p>
            </div>
          </div>

          {/* Center: Welcome text */}
          <motion.div
            className="hidden md:flex flex-col items-center"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
          >
            <p className="text-[11px] text-slate-400 tracking-[0.3em] uppercase">
              Welcome to
            </p>
            <p className="ombre-text text-sm font-bold tracking-widest">
              NEXUS PANDEMIC INTELLIGENCE SYSTEM
            </p>
          </motion.div>

          {/* Right: Status indicators */}
          <div className="flex items-center gap-4 text-[11px]">
            <div className="flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 bg-green-400 rounded-full pulse-dot" />
              <span className="text-green-400 font-mono">LIVE</span>
            </div>
            <div className="glass px-2.5 py-1 text-cyan-400 font-mono">
              <span className="text-slate-500">DISEASE: </span>
              <span style={{ color: meta.color }}>{meta.icon} {meta.label}</span>
            </div>
            <div className="glass px-2.5 py-1 text-slate-400 font-mono hidden lg:block">
              {clock} UTC
            </div>
          </div>
        </div>
      </header>

      {/* ═══ Main Content ════════════════════════════════════════════════════════ */}
      <div className="flex-1 flex overflow-hidden min-h-0">

        {/* ── Left: Globe ─────────────────────────────────────────────────────── */}
        <div className="relative flex-1 min-w-0 globe-container">
          <div className="scan-line" />
          <GlobeView
            disease={disease}
            region={region}
            globeData={globeData}
            spreadArcs={spreadArcs}
            onCountrySelect={handleCountrySelect}
            selectedCountry={selectedCountry}
          />

          {/* Spread Simulator Controls — overlay bottom-left */}
          <div className="absolute bottom-4 left-4 z-10">
            <div className="glass-strong p-3 space-y-2 min-w-[200px]">
              <div className="flex items-center justify-between gap-3">
                <span className="text-[11px] text-slate-400 tracking-widest uppercase">Spread Simulator</span>
                <button
                  onClick={() => setSpreadMode(v => !v)}
                  className={`relative w-10 h-5 rounded-full transition-all duration-300 ${spreadMode ? 'bg-cyan-500' : 'bg-slate-700'}`}
                >
                  <span className={`absolute top-0.5 w-4 h-4 rounded-full transition-all duration-300 bg-white shadow ${spreadMode ? 'left-5' : 'left-0.5'}`} />
                </button>
              </div>
              {spreadMode && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  className="flex gap-1"
                >
                  {(['week', 'month', 'year'] as const).map(p => (
                    <button
                      key={p}
                      onClick={() => setSpreadPeriod(p)}
                      className={`flex-1 py-1 text-[10px] rounded font-mono uppercase tracking-wider transition-all ${
                        spreadPeriod === p
                          ? 'bg-cyan-500 text-black font-bold'
                          : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                      }`}
                    >
                      {p}
                    </button>
                  ))}
                </motion.div>
              )}
              {spreadMode && (
                <p className="text-[10px] text-slate-500">
                  Showing projected {spreadPeriod}ly spread for <span style={{ color: meta.color }}>{meta.label}</span>
                </p>
              )}
            </div>
          </div>

          {/* Selected country badge on globe */}
          <AnimatePresence>
            {selectedCountry && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="absolute top-3 left-1/2 -translate-x-1/2 z-10"
              >
                <div className="glass-strong px-4 py-1.5 flex items-center gap-2 glow-cyan">
                  <div className="w-2 h-2 rounded-full bg-cyan-400 pulse-dot" />
                  <span className="text-cyan-300 font-mono text-xs tracking-widest uppercase">
                    {selectedCountry.country}
                  </span>
                  <button
                    onClick={() => { setSelectedCountry(null); setSelectedState(''); }}
                    className="text-slate-500 hover:text-slate-300 ml-2 text-xs"
                  >✕</button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* ── Right: Control Panel ─────────────────────────────────────────────── */}
        <div className="w-[380px] flex-shrink-0 flex flex-col right-panel border-l border-slate-800/50 bg-[#000c1e]/80">

          {/* Disease + Region Selectors */}
          <DiseaseSelector
            disease={disease}
            region={region}
            onDiseaseChange={handleDiseaseChange}
            onRegionChange={handleRegionChange}
            isIndia={isIndia}
            selectedState={selectedState}
            onStateChange={setSelectedState}
          />

          {/* Country/Region Dashboard */}
          <div className="flex-1 min-h-0 overflow-y-auto right-panel p-3 space-y-3">
            <AnimatePresence mode="wait">
              {selectedCountry ? (
                <motion.div
                  key={`${selectedCountry.country}-${disease}`}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.3 }}
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
                  className="space-y-3"
                >
                  {/* Global overview cards */}
                  <div className="glass-strong p-3">
                    <p className="text-[10px] text-slate-500 uppercase tracking-widest mb-2">Global Overview</p>
                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div>
                        <p className="stat-number text-cyan-400 font-bold text-lg">{formatNumber(totalCases)}</p>
                        <p className="text-[10px] text-slate-500 mt-0.5">Total Cases</p>
                      </div>
                      <div>
                        <p className="stat-number text-blue-400 font-bold text-lg">{countriesAffected}</p>
                        <p className="text-[10px] text-slate-500 mt-0.5">Countries</p>
                      </div>
                      <div>
                        <p className="stat-number text-red-400 font-bold text-lg">{activeAlerts}</p>
                        <p className="text-[10px] text-slate-500 mt-0.5">High Risk</p>
                      </div>
                    </div>
                  </div>

                  {/* Top affected countries */}
                  <div className="glass-strong p-3">
                    <p className="text-[10px] text-slate-500 uppercase tracking-widest mb-2">Top Affected Countries</p>
                    <div className="space-y-1.5">
                      {globeData
                        .sort((a, b) => b.risk_score - a.risk_score)
                        .slice(0, 8)
                        .map((p, i) => (
                          <div
                            key={p.country}
                            className="flex items-center gap-2 cursor-pointer hover:bg-white/5 rounded px-1 py-0.5 transition-colors"
                            onClick={() => handleCountrySelect(p)}
                          >
                            <span className="text-slate-600 font-mono text-[10px] w-4">{i + 1}</span>
                            <div className="flex-1">
                              <div className="flex items-center justify-between">
                                <span className="text-xs text-slate-300">{p.country}</span>
                                <span className="text-[10px] font-mono text-slate-500">{formatNumber(p.cases)}</span>
                              </div>
                              <div className="h-1 bg-slate-800 rounded-full mt-1 overflow-hidden">
                                <div
                                  className="h-full rounded-full transition-all duration-500"
                                  style={{
                                    width: `${p.risk_score * 100}%`,
                                    background: p.risk_score > 0.75 ? '#ef4444'
                                      : p.risk_score > 0.5 ? '#f97316'
                                      : p.risk_score > 0.25 ? '#eab308' : '#22c55e',
                                  }}
                                />
                              </div>
                            </div>
                          </div>
                        ))}
                    </div>
                  </div>

                  {/* Data sources */}
                  <div className="glass p-3">
                    <p className="text-[10px] text-slate-500 uppercase tracking-widest mb-2">Data Sources</p>
                    <div className="space-y-1">
                      {['WHO GHO OData API', 'disease.sh REST API', 'CDC Open Data Portal', 'ECDC Databases', 'IHME GHDx'].map(src => (
                        <div key={src} className="flex items-center gap-2">
                          <div className="w-1.5 h-1.5 rounded-full bg-green-400 pulse-dot flex-shrink-0" />
                          <span className="text-[10px] text-slate-400">{src}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <p className="text-[10px] text-slate-600 text-center">
                    Click a country on the globe to view detailed analytics
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* ═══ Bottom Stats Bar ════════════════════════════════════════════════════ */}
      <StatsBar
        disease={disease}
        totalCases={totalCases}
        countriesAffected={countriesAffected}
        activeAlerts={activeAlerts}
        meta={meta}
      />
      </div>{/* end #dashboard */}
    </div>
  );
}

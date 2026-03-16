'use client';

import { useRef, useEffect, useState, useCallback } from 'react';
import * as THREE from 'three';
import type { GlobePoint, SpreadArc } from '@/lib/disease-data';
import { getRiskColor } from '@/lib/disease-data';
import type { DiseaseKey } from '@/lib/disease-data';

import Globe from 'react-globe.gl';

interface Props {
  disease: DiseaseKey;
  region: string;
  globeData: GlobePoint[];
  spreadArcs: SpreadArc[];
  onCountrySelect: (point: GlobePoint) => void;
  selectedCountry: GlobePoint | null;
}

// ─── Starfield ────────────────────────────────────────────────────────────────
function addStarfield(scene: THREE.Scene): void {
  const count = 5000;
  const positions = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const theta = Math.random() * Math.PI * 2;
    const phi   = Math.acos(2 * Math.random() - 1);
    const r     = 800 + Math.random() * 400;
    positions[i * 3]     = r * Math.sin(phi) * Math.cos(theta);
    positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
    positions[i * 3 + 2] = r * Math.cos(phi);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const mat = new THREE.PointsMaterial({
    color: 0xd0e8ff, size: 1.0,
    transparent: true, opacity: 0.7,
    sizeAttenuation: false,
  });
  const stars = new THREE.Points(geo, mat);
  stars.name = 'starfield';
  scene.add(stars);
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function GlobeView({ globeData, spreadArcs, onCountrySelect, selectedCountry }: Props) {
  const globeRef      = useRef<any>(null);
  const containerRef  = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions]   = useState({ width: 800, height: 600 });
  const [hoveredPoint, setHoveredPoint] = useState<GlobePoint | null>(null);
  const [tooltipPos, setTooltipPos]   = useState({ x: 0, y: 0 });
  const [isInitialized, setIsInitialized] = useState(false);

  // Container sizing
  useEffect(() => {
    const measure = () => {
      if (containerRef.current) {
        const r = containerRef.current.getBoundingClientRect();
        setDimensions({ width: r.width, height: r.height });
      }
    };
    measure();
    const ro = new ResizeObserver(measure);
    if (containerRef.current) ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  // Three.js scene setup
  useEffect(() => {
    if (!globeRef.current || isInitialized) return;
    const timer = setTimeout(() => {
      try {
        const renderer = globeRef.current?.renderer?.();
        const scene    = globeRef.current?.scene?.();
        const camera   = globeRef.current?.camera?.();
        const controls = globeRef.current?.controls?.();
        if (!renderer || !scene || !camera || !controls) return;

        const existing = scene.getObjectByName('starfield');
        if (existing) scene.remove(existing);
        addStarfield(scene);

        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        renderer.setClearColor(new THREE.Color('#000814'), 1);
        renderer.toneMapping         = THREE.ACESFilmicToneMapping;
        renderer.toneMappingExposure = 1.0;

        camera.far = 5000;
        camera.updateProjectionMatrix();

        controls.autoRotate       = true;
        controls.autoRotateSpeed  = 0.28; // slow, cinematic
        controls.enableDamping    = true;
        controls.dampingFactor    = 0.06;
        controls.minDistance      = 130;
        controls.maxDistance      = 550;
        controls.enablePan        = false;

        setIsInitialized(true);
      } catch (_) { /* retry */ }
    }, 600);
    return () => clearTimeout(timer);
  }, [isInitialized, globeRef.current]);

  // Fly-to on country select
  useEffect(() => {
    if (!selectedCountry || !globeRef.current) return;
    const { lat, lng } = selectedCountry;
    const altitude = selectedCountry.country === 'India' ? 1.2 : 1.7;
    setTimeout(() => {
      try {
        globeRef.current?.pointOfView({ lat, lng, altitude }, 1400);
        const controls = globeRef.current?.controls?.();
        if (controls) controls.autoRotateSpeed = 0.08;
      } catch (_) {}
    }, 80);
  }, [selectedCountry]);

  // Resume rotation on deselect
  useEffect(() => {
    if (!selectedCountry && globeRef.current) {
      setTimeout(() => {
        try {
          const controls = globeRef.current?.controls?.();
          if (controls) controls.autoRotateSpeed = 0.28;
        } catch (_) {}
      }, 80);
    }
  }, [selectedCountry]);

  const handlePointClick = useCallback((point: object) => {
    onCountrySelect(point as GlobePoint);
  }, [onCountrySelect]);

  const handlePointHover = useCallback((point: object | null, _: object | null, evt?: MouseEvent) => {
    setHoveredPoint(point as GlobePoint | null);
    if (point && evt) setTooltipPos({ x: evt.clientX, y: evt.clientY });
  }, []);

  // Refined tooltip HTML — Inter font, executive style
  const pointLabel = useCallback((d: object) => {
    const p = d as GlobePoint;
    const riskColor = getRiskColor(p.risk_score);
    const riskEmoji  = p.risk_score > 0.75 ? '🔴' : p.risk_score > 0.5 ? '🟡' : '🟢';
    const riskLabel  = p.risk_score > 0.75 ? 'Alarming'
      : p.risk_score > 0.5 ? 'Moderate Risk'
      : p.risk_score > 0.25 ? 'Low–Moderate' : 'Low Risk';
    const perCapita = ((p.cases / p.population) * 100000).toFixed(1);

    return `
      <div style="
        background: rgba(0,8,24,0.96);
        border: 1px solid ${riskColor}28;
        border-radius: 10px;
        padding: 12px 16px;
        font-family: Inter, -apple-system, sans-serif;
        color: #c8dce8;
        font-size: 11.5px;
        box-shadow: 0 8px 32px rgba(0,0,0,0.5), 0 0 16px ${riskColor}18;
        min-width: 200px;
        backdrop-filter: blur(20px);
        -webkit-backdrop-filter: blur(20px);
      ">
        <div style="font-size: 14px; font-weight: 500; color: #e8f4ff; margin-bottom: 10px; letter-spacing: 0.01em;">
          ${p.country}
        </div>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 6px 10px; margin-bottom: 10px;">
          <div>
            <div style="font-size: 9px; color: #4a6785; letter-spacing: 0.12em; text-transform: uppercase; margin-bottom: 2px;">Cases</div>
            <div style="font-size: 12px; color: #c0d8e8; font-weight: 400;">${p.cases.toLocaleString()}</div>
          </div>
          <div>
            <div style="font-size: 9px; color: #4a6785; letter-spacing: 0.12em; text-transform: uppercase; margin-bottom: 2px;">Per 100K</div>
            <div style="font-size: 12px; color: #c0d8e8;">${perCapita}</div>
          </div>
          <div>
            <div style="font-size: 9px; color: #4a6785; letter-spacing: 0.12em; text-transform: uppercase; margin-bottom: 2px;">Population</div>
            <div style="font-size: 12px; color: #c0d8e8;">${(p.population / 1e6).toFixed(1)}M</div>
          </div>
          <div>
            <div style="font-size: 9px; color: #4a6785; letter-spacing: 0.12em; text-transform: uppercase; margin-bottom: 2px;">Risk Score</div>
            <div style="font-size: 12px; color: ${riskColor}; font-weight: 500;">${(p.risk_score * 100).toFixed(0)}%</div>
          </div>
        </div>
        <div style="
          padding: 5px 10px;
          background: ${riskColor}12;
          border: 1px solid ${riskColor}20;
          border-radius: 5px;
          font-size: 10px;
          color: ${riskColor};
          font-weight: 500;
          letter-spacing: 0.04em;
        ">
          ${riskEmoji} ${riskLabel}
        </div>
        <div style="margin-top: 8px; font-size: 9px; color: #2a4055; letter-spacing: 0.08em; text-align: right;">
          Click to explore →
        </div>
      </div>
    `;
  }, []);

  const arcLabel = useCallback((d: object) => {
    const a = d as SpreadArc;
    return `
      <div style="
        background: rgba(0,8,24,0.9); border: 1px solid rgba(0,160,220,0.2);
        border-radius: 6px; padding: 5px 10px;
        font-family: Inter, -apple-system, sans-serif;
        font-size: 10px; color: #8ab0c8; letter-spacing: 0.04em;
      ">
        Spread intensity: ${(a.intensity * 100).toFixed(0)}%
      </div>
    `;
  }, []);

  return (
    <div ref={containerRef} className="w-full h-full relative overflow-hidden">
      {dimensions.width > 0 && (
        <Globe
          ref={globeRef}
          width={dimensions.width}
          height={dimensions.height}

          // ── Textures ──────────────────────────────────────────────
          globeImageUrl="//unpkg.com/three-globe/example/img/earth-night.jpg"
          bumpImageUrl="//unpkg.com/three-globe/example/img/earth-topology.png"
          backgroundColor="rgba(0,8,20,1)"

          // ── Atmosphere ────────────────────────────────────────────
          atmosphereColor="#1a5fff"
          atmosphereAltitude={0.15}

          // ── Points — flat, smooth, low altitude ───────────────────
          pointsData={globeData}
          pointLat="lat"
          pointLng="lng"
          pointColor={(d: object) => getRiskColor((d as GlobePoint).risk_score)}
          // Very low altitude — points lie flat on the surface, not protruding
          pointAltitude={(d: object) => 0.001 + (d as GlobePoint).risk_score * 0.012}
          pointRadius={(d: object) => {
            const p = d as GlobePoint;
            const base = Math.sqrt(p.cases) / 3200;
            return Math.min(1.2, Math.max(0.18, base));
          }}
          pointLabel={pointLabel}
          onPointClick={handlePointClick}
          onPointHover={handlePointHover as any}
          pointsMerge={false}
          pointResolution={10}

          // ── Spread arcs ───────────────────────────────────────────
          arcsData={spreadArcs}
          arcStartLat={(d: object) => (d as SpreadArc).startLat}
          arcStartLng={(d: object) => (d as SpreadArc).startLng}
          arcEndLat={(d: object) => (d as SpreadArc).endLat}
          arcEndLng={(d: object) => (d as SpreadArc).endLng}
          arcColor={(d: object) => (d as SpreadArc).color}
          arcDashLength={0.3}
          arcDashGap={0.2}
          arcDashAnimateTime={2200}
          arcStroke={(d: object) => 0.2 + (d as SpreadArc).intensity * 0.35}
          arcLabel={arcLabel}
          arcAltitudeAutoScale={0.35}

          // ── Selection rings — subtle ──────────────────────────────
          ringsData={selectedCountry ? [selectedCountry] : []}
          ringLat={(d: object) => (d as GlobePoint).lat}
          ringLng={(d: object) => (d as GlobePoint).lng}
          ringColor={() => 'rgba(0,180,255,0.5)'}
          ringMaxRadius={2.5}
          ringPropagationSpeed={1.8}
          ringRepeatPeriod={1000}
        />
      )}

      {/* Refined risk legend */}
      <div className="absolute bottom-4 right-4 z-10">
        <div className="glass-strong p-3 space-y-1.5" style={{ minWidth: 148 }}>
          <p style={{
            fontSize: '0.5rem', color: '#3a5a78',
            letterSpacing: '0.2em', textTransform: 'uppercase',
            fontFamily: 'Inter, sans-serif', fontWeight: 500,
            marginBottom: '0.5rem',
          }}>
            Risk Level
          </p>
          {[
            { color: '#22c55e', label: 'Low', range: '< 25%' },
            { color: '#eab308', label: 'Moderate', range: '25–50%' },
            { color: '#f97316', label: 'High', range: '50–75%' },
            { color: '#ef4444', label: 'Alarming', range: '> 75%' },
          ].map(({ color, label, range }) => (
            <div key={label} className="flex items-center gap-2">
              <div style={{
                width: 6, height: 6, borderRadius: '50%', flexShrink: 0,
                background: color,
                boxShadow: `0 0 5px ${color}80`,
              }} />
              <span style={{
                fontSize: '0.6rem', color: '#7a9ab8',
                fontFamily: 'Inter, sans-serif',
              }}>
                {label}
                <span style={{ color: '#3a5a78', marginLeft: 4 }}>{range}</span>
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

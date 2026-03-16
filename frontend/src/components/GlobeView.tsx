'use client';

import { useRef, useEffect, useState, useCallback } from 'react';
import * as THREE from 'three';
import type { GlobePoint, SpreadArc } from '@/lib/disease-data';
import { getRiskColor } from '@/lib/disease-data';
import type { DiseaseKey } from '@/lib/disease-data';

// Dynamic import for react-globe.gl
import Globe from 'react-globe.gl';

interface Props {
  disease: DiseaseKey;
  region: string;
  globeData: GlobePoint[];
  spreadArcs: SpreadArc[];
  onCountrySelect: (point: GlobePoint) => void;
  selectedCountry: GlobePoint | null;
}

// ─── Starfield helper ──────────────────────────────────────────────────────────
function addStarfield(scene: THREE.Scene): void {
  const starCount = 6000;
  const positions = new Float32Array(starCount * 3);
  const colors = new Float32Array(starCount * 3);
  const sizes = new Float32Array(starCount);

  for (let i = 0; i < starCount; i++) {
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    const r = 800 + Math.random() * 400;

    positions[i * 3]     = r * Math.sin(phi) * Math.cos(theta);
    positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
    positions[i * 3 + 2] = r * Math.cos(phi);

    // Bluish-white star colors
    const brightness = 0.6 + Math.random() * 0.4;
    colors[i * 3]     = brightness * (0.85 + Math.random() * 0.15);
    colors[i * 3 + 1] = brightness * (0.85 + Math.random() * 0.15);
    colors[i * 3 + 2] = brightness;

    sizes[i] = 0.5 + Math.random() * 1.5;
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));

  const material = new THREE.PointsMaterial({
    size: 1.2,
    vertexColors: true,
    transparent: true,
    opacity: 0.9,
    sizeAttenuation: false,
  });

  const stars = new THREE.Points(geometry, material);
  stars.name = 'starfield';
  scene.add(stars);
}

// ─── Main Globe Component ──────────────────────────────────────────────────────
export default function GlobeView({ globeData, spreadArcs, onCountrySelect, selectedCountry }: Props) {
  const globeRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  const [hoveredPoint, setHoveredPoint] = useState<GlobePoint | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);

  // Measure container
  useEffect(() => {
    const measure = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        setDimensions({ width: rect.width, height: rect.height });
      }
    };
    measure();
    const ro = new ResizeObserver(measure);
    if (containerRef.current) ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  // Initialize Three.js scene enhancements
  useEffect(() => {
    if (!globeRef.current || isInitialized) return;

    const timer = setTimeout(() => {
      try {
        const renderer = globeRef.current?.renderer?.();
        const scene = globeRef.current?.scene?.();
        const camera = globeRef.current?.camera?.();
        const controls = globeRef.current?.controls?.();

        if (!renderer || !scene || !camera || !controls) return;

        // Clear any existing starfield
        const existing = scene.getObjectByName('starfield');
        if (existing) scene.remove(existing);
        addStarfield(scene);

        // Renderer settings
        renderer.setPixelRatio(window.devicePixelRatio);
        renderer.setClearColor(new THREE.Color('#000814'), 1);
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        renderer.toneMappingExposure = 1.2;

        // Camera
        camera.far = 5000;
        camera.updateProjectionMatrix();

        // Controls
        controls.autoRotate = true;
        controls.autoRotateSpeed = 0.35;
        controls.enableDamping = true;
        controls.dampingFactor = 0.08;
        controls.minDistance = 120;
        controls.maxDistance = 600;

        setIsInitialized(true);
      } catch (e) {
        // Retry silently
      }
    }, 800);

    return () => clearTimeout(timer);
  }, [isInitialized, globeRef.current]);

  // Smooth camera fly-to when country selected
  useEffect(() => {
    if (!selectedCountry || !globeRef.current) return;

    const { lat, lng } = selectedCountry;
    const isIndia = selectedCountry.country === 'India';
    const altitude = isIndia ? 1.2 : 1.8;

    setTimeout(() => {
      try {
        globeRef.current?.pointOfView({ lat, lng, altitude }, 1500);
        // Slow down auto-rotation when a country is selected
        const controls = globeRef.current?.controls?.();
        if (controls) controls.autoRotateSpeed = 0.1;
      } catch (e) {}
    }, 100);
  }, [selectedCountry]);

  // Resume auto-rotation speed when deselected
  useEffect(() => {
    if (!selectedCountry && globeRef.current) {
      setTimeout(() => {
        try {
          const controls = globeRef.current?.controls?.();
          if (controls) controls.autoRotateSpeed = 0.35;
        } catch (e) {}
      }, 100);
    }
  }, [selectedCountry]);

  const handlePointClick = useCallback((point: object) => {
    onCountrySelect(point as GlobePoint);
  }, [onCountrySelect]);

  const handlePointHover = useCallback((point: object | null) => {
    setHoveredPoint(point as GlobePoint | null);
  }, []);

  // Point label HTML
  const pointLabel = useCallback((d: object) => {
    const p = d as GlobePoint;
    const riskColor = getRiskColor(p.risk_score);
    const riskLabel = p.risk_score > 0.75 ? 'CRITICAL'
      : p.risk_score > 0.5 ? 'HIGH'
      : p.risk_score > 0.25 ? 'MODERATE' : 'LOW';
    return `
      <div style="
        background: rgba(0,12,33,0.92);
        border: 1px solid ${riskColor}40;
        border-radius: 8px;
        padding: 10px 14px;
        font-family: 'JetBrains Mono', monospace;
        color: #e2e8f0;
        font-size: 11px;
        box-shadow: 0 0 20px ${riskColor}30;
        min-width: 180px;
      ">
        <div style="font-size: 13px; font-weight: 700; color: #fff; margin-bottom: 6px; font-family: 'Orbitron', sans-serif;">
          ${p.country}
        </div>
        <div style="display: flex; justify-content: space-between; margin-bottom: 3px;">
          <span style="color: #94a3b8;">Cases:</span>
          <span style="color: #e2e8f0;">${p.cases.toLocaleString()}</span>
        </div>
        <div style="display: flex; justify-content: space-between; margin-bottom: 3px;">
          <span style="color: #94a3b8;">Risk Score:</span>
          <span style="color: ${riskColor}; font-weight: 700;">${(p.risk_score * 100).toFixed(0)}%</span>
        </div>
        <div style="margin-top: 6px; padding: 3px 8px; background: ${riskColor}20; border-radius: 4px; text-align: center; color: ${riskColor}; font-weight: 700; font-size: 10px; letter-spacing: 0.1em;">
          ● ${riskLabel} RISK
        </div>
        <div style="margin-top: 4px; color: #475569; font-size: 9px; text-align: center;">Click to explore →</div>
      </div>
    `;
  }, []);

  // Arc label
  const arcLabel = useCallback((d: object) => {
    const a = d as SpreadArc;
    return `<div style="color: #fff; font-size: 10px; font-family: monospace; background: rgba(0,0,0,0.8); padding: 4px 8px; border-radius: 4px;">Spread intensity: ${(a.intensity * 100).toFixed(0)}%</div>`;
  }, []);

  return (
    <div ref={containerRef} className="w-full h-full relative overflow-hidden">
      {dimensions.width > 0 && (
        <Globe
          ref={globeRef}
          width={dimensions.width}
          height={dimensions.height}

          // ── Globe appearance ──────────────────────────────────
          globeImageUrl="//unpkg.com/three-globe/example/img/earth-night.jpg"
          bumpImageUrl="//unpkg.com/three-globe/example/img/earth-topology.png"
          backgroundColor="rgba(0,8,20,1)"

          // ── Atmosphere ────────────────────────────────────────
          atmosphereColor="#1a6eff"
          atmosphereAltitude={0.18}

          // ── Disease heatmap points ────────────────────────────
          pointsData={globeData}
          pointLat="lat"
          pointLng="lng"
          pointColor={(d: object) => getRiskColor((d as GlobePoint).risk_score)}
          pointAltitude={(d: object) => 0.005 + (d as GlobePoint).risk_score * 0.06}
          pointRadius={(d: object) => {
            const p = d as GlobePoint;
            const base = Math.sqrt(p.cases) / 2500;
            return Math.min(1.8, Math.max(0.3, base));
          }}
          pointLabel={pointLabel}
          onPointClick={handlePointClick}
          onPointHover={handlePointHover}
          pointsMerge={false}

          // ── Spread arcs ───────────────────────────────────────
          arcsData={spreadArcs}
          arcStartLat={(d: object) => (d as SpreadArc).startLat}
          arcStartLng={(d: object) => (d as SpreadArc).startLng}
          arcEndLat={(d: object) => (d as SpreadArc).endLat}
          arcEndLng={(d: object) => (d as SpreadArc).endLng}
          arcColor={(d: object) => (d as SpreadArc).color}
          arcDashLength={0.35}
          arcDashGap={0.18}
          arcDashAnimateTime={2000}
          arcStroke={(d: object) => 0.3 + (d as SpreadArc).intensity * 0.5}
          arcLabel={arcLabel}
          arcAltitudeAutoScale={0.4}

          // ── Rings for selected country ────────────────────────
          ringsData={selectedCountry ? [selectedCountry] : []}
          ringLat={(d: object) => (d as GlobePoint).lat}
          ringLng={(d: object) => (d as GlobePoint).lng}
          ringColor={() => '#00d4ff'}
          ringMaxRadius={3}
          ringPropagationSpeed={2.5}
          ringRepeatPeriod={800}

          // ── Hex polygons ─────────────────────────────────────
          hexPolygonResolution={3}
          hexPolygonMargin={0.3}
        />
      )}

      {/* Hover tooltip overlay */}
      {hoveredPoint && (
        <div
          className="absolute top-4 left-4 glass-strong p-2 pointer-events-none z-10 transition-all"
          style={{ borderColor: `${getRiskColor(hoveredPoint.risk_score)}40` }}
        >
          <p className="text-xs text-slate-400 font-mono">
            <span className="text-white font-bold">{hoveredPoint.country}</span>
            {' · '}
            <span style={{ color: getRiskColor(hoveredPoint.risk_score) }}>
              {(hoveredPoint.risk_score * 100).toFixed(0)}% risk
            </span>
          </p>
        </div>
      )}

      {/* Legend */}
      <div className="absolute bottom-4 right-4 z-10">
        <div className="glass-strong p-2 space-y-1">
          <p className="text-[9px] text-slate-500 uppercase tracking-widest mb-1.5">Risk Level</p>
          {[
            { color: '#22c55e', label: 'Low (< 25%)' },
            { color: '#eab308', label: 'Moderate (25–50%)' },
            { color: '#f97316', label: 'High (50–75%)' },
            { color: '#ef4444', label: 'Critical (> 75%)' },
          ].map(({ color, label }) => (
            <div key={label} className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: color, boxShadow: `0 0 6px ${color}` }} />
              <span className="text-[10px] text-slate-400">{label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

'use client';

import { useRef, useEffect, useState, useCallback, useMemo } from 'react';
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
  heroMode?: boolean;
  heatmapMode?: boolean;
}

function addStarfield(scene: THREE.Scene): void {
  const count = 5000;
  const positions = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    const r = 800 + Math.random() * 400;
    positions[i*3] = r*Math.sin(phi)*Math.cos(theta);
    positions[i*3+1] = r*Math.sin(phi)*Math.sin(theta);
    positions[i*3+2] = r*Math.cos(phi);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const stars = new THREE.Points(geo, new THREE.PointsMaterial({ color: 0xd0e8ff, size: 1.0, transparent: true, opacity: 0.65, sizeAttenuation: false }));
  stars.name = 'starfield';
  scene.add(stars);
}

/** Fuzzy-match a GeoJSON country name to our GlobePoint array */
function findGlobePoint(geoName: string, globeData: GlobePoint[]): GlobePoint | null {
  const norm = (s: string) =>
    s.toLowerCase()
      .replace(/\s*\(.*?\)/g, '')
      .replace(/[^a-z\s]/g, '')
      .trim()
      .replace(/\s+/g, ' ');
  const gn = norm(geoName);
  return (
    globeData.find(p => norm(p.country) === gn) ||
    globeData.find(p => {
      const pn = norm(p.country);
      return gn.includes(pn) || pn.includes(gn);
    }) ||
    null
  );
}

export default function GlobeView({
  globeData, spreadArcs, onCountrySelect, selectedCountry,
  heroMode = false, heatmapMode = false
}: Props) {
  const globeRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  const [isInitialized, setIsInitialized] = useState(false);
  const [countriesGeoJson, setCountriesGeoJson] = useState<any[]>([]);

  // Load country GeoJSON for polygon boundaries
  useEffect(() => {
    fetch('https://raw.githubusercontent.com/vasturiano/react-globe.gl/master/example/datasets/ne_110m_admin_0_countries.geojson')
      .then(r => r.json())
      .then(data => setCountriesGeoJson(data.features))
      .catch(() => {}); // fail silently — dots still work
  }, []);

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

        // Brighter, more illuminated setup
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        renderer.setClearColor(new THREE.Color('#000814'), 1);
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        renderer.toneMappingExposure = 1.8; // increased for brightness

        // Add ambient light so continents are clearly visible
        const ambient = new THREE.AmbientLight(0xffffff, 0.6);
        ambient.name = 'ambientLight';
        if (!scene.getObjectByName('ambientLight')) scene.add(ambient);

        // Directional sunlight from upper-right
        const dirLight = new THREE.DirectionalLight(0xc8e8ff, 0.9);
        dirLight.position.set(2, 1, 1);
        dirLight.name = 'dirLight';
        if (!scene.getObjectByName('dirLight')) scene.add(dirLight);

        camera.far = 5000;
        camera.updateProjectionMatrix();

        controls.autoRotate      = true;
        controls.autoRotateSpeed = heroMode ? 0.22 : 0.18;
        controls.enableDamping   = true;
        controls.dampingFactor   = 0.06;
        controls.minDistance     = heroMode ? 150 : 130;
        controls.maxDistance     = heroMode ? 600 : 480;
        controls.enablePan       = false;

        setIsInitialized(true);
      } catch (_) {}
    }, 600);
    return () => clearTimeout(timer);
  }, [isInitialized, heroMode]);

  // Zoom to selected country
  useEffect(() => {
    if (!selectedCountry || !globeRef.current) return;
    const { lat, lng } = selectedCountry;
    setTimeout(() => {
      try {
        globeRef.current?.pointOfView({ lat, lng, altitude: 1.4 }, 1400);
        const controls = globeRef.current?.controls?.();
        if (controls) controls.autoRotateSpeed = 0.06;
      } catch (_) {}
    }, 80);
  }, [selectedCountry]);

  // Restore rotation speed when country deselected
  useEffect(() => {
    if (!selectedCountry && globeRef.current) {
      setTimeout(() => {
        try {
          const controls = globeRef.current?.controls?.();
          if (controls) controls.autoRotateSpeed = heroMode ? 0.22 : 0.18;
        } catch (_) {}
      }, 80);
    }
  }, [selectedCountry, heroMode]);

  // Max cases for heatmap normalization
  const maxCases = useMemo(() => Math.max(...globeData.map(p => p.cases), 1), [globeData]);

  // Polygon color based on risk score
  const polygonCapColor = useCallback((feat: any) => {
    const name = feat.properties?.ADMIN || feat.properties?.NAME || '';
    if (
      selectedCountry &&
      (feat.properties?.ADMIN === selectedCountry.country || feat.properties?.NAME === selectedCountry.country ||
       findGlobePoint(name, [selectedCountry]) !== null)
    ) {
      return 'rgba(0,180,255,0.22)';
    }
    const point = findGlobePoint(name, globeData);
    if (!point) return 'rgba(0,40,80,0.04)';
    if (heatmapMode) {
      const intensity = Math.min(1, point.cases / maxCases);
      const r = Math.floor(255 * Math.min(1, intensity * 2.2));
      const g = Math.floor(180 * Math.max(0, 1 - intensity * 1.8));
      return `rgba(${r},${g},30,${0.08 + intensity * 0.2})`;
    }
    const risk = point.risk_score;
    if (risk > 0.75) return 'rgba(239,68,68,0.14)';
    if (risk > 0.5)  return 'rgba(249,115,22,0.11)';
    if (risk > 0.25) return 'rgba(234,179,8,0.08)';
    return 'rgba(34,197,94,0.06)';
  }, [globeData, selectedCountry, heatmapMode, maxCases]);

  // Polygon altitude — slightly elevated for selected country
  const polygonAltitude = useCallback((feat: any) => {
    if (!selectedCountry) return 0.003;
    const name = feat.properties?.ADMIN || feat.properties?.NAME || '';
    const isSelected = findGlobePoint(name, [selectedCountry]) !== null;
    return isSelected ? 0.01 : 0.003;
  }, [selectedCountry]);

  // Polygon tooltip
  const polygonLabel = useCallback((feat: any) => {
    const name = feat.properties?.ADMIN || feat.properties?.NAME || '';
    const point = findGlobePoint(name, globeData);
    if (!point) return `<div style="background:rgba(0,8,24,0.9);border:1px solid rgba(0,100,160,0.2);border-radius:8px;padding:8px 12px;font-family:Inter,sans-serif;color:#80a8c0;font-size:12px;">${name}</div>`;
    const riskColor = getRiskColor(point.risk_score);
    return `<div style="background:rgba(0,8,24,0.96);border:1px solid ${riskColor}28;border-radius:10px;padding:12px 16px;font-family:Inter,sans-serif;color:#c8dce8;font-size:12px;box-shadow:0 8px 32px rgba(0,0,0,0.5);min-width:180px;">
      <div style="font-size:14px;font-weight:500;color:#e8f4ff;margin-bottom:8px;">${point.country}</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:5px 10px;margin-bottom:8px;">
        <div><div style="font-size:9px;color:#4a6785;letter-spacing:0.1em;text-transform:uppercase;margin-bottom:1px;">Cases</div><div style="color:#c0d8e8;">${point.cases.toLocaleString()}</div></div>
        <div><div style="font-size:9px;color:#4a6785;letter-spacing:0.1em;text-transform:uppercase;margin-bottom:1px;">Risk</div><div style="color:${riskColor};font-weight:500;">${(point.risk_score*100).toFixed(0)}%</div></div>
      </div>
      <div style="font-size:10px;color:#2a4055;text-align:right;">Click to explore →</div>
    </div>`;
  }, [globeData]);

  // Handle polygon click → find matching GlobePoint
  const handlePolygonClick = useCallback((feat: any) => {
    const name = feat.properties?.ADMIN || feat.properties?.NAME || '';
    const point = findGlobePoint(name, globeData);
    if (point) {
      onCountrySelect(point);
    } else {
      // Create a synthetic point so the panel still opens
      const lat = feat.properties?.LAT ?? 0;
      const lng = feat.properties?.LON ?? 0;
      onCountrySelect({
        country: name, lat, lng,
        cases: 0, deaths: 0, population: 1_000_000,
        risk_score: 0, iso2: name.slice(0, 2).toUpperCase(), region: 'Unknown'
      } as GlobePoint);
    }
  }, [globeData, onCountrySelect]);

  // Handle dot click (existing behaviour preserved)
  const handlePointClick = useCallback((point: object) => {
    onCountrySelect(point as GlobePoint);
  }, [onCountrySelect]);

  // Tooltip for dots
  const pointLabel = useCallback((d: object) => {
    const p = d as GlobePoint;
    const riskColor = getRiskColor(p.risk_score);
    const riskEmoji = p.risk_score > 0.75 ? '🔴' : p.risk_score > 0.5 ? '🟡' : '🟢';
    const riskLabel = p.risk_score > 0.75 ? 'Alarming' : p.risk_score > 0.5 ? 'Moderate Risk' : 'Low Risk';
    const perCapita = ((p.cases / p.population) * 100000).toFixed(1);
    return `<div style="background:rgba(0,8,24,0.96);border:1px solid ${riskColor}28;border-radius:10px;padding:12px 16px;font-family:Inter,-apple-system,sans-serif;color:#c8dce8;font-size:12px;box-shadow:0 8px 32px rgba(0,0,0,0.5);min-width:200px;backdrop-filter:blur(20px);">
      <div style="font-size:14px;font-weight:500;color:#e8f4ff;margin-bottom:10px;">${p.country}</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px 10px;margin-bottom:10px;">
        <div><div style="font-size:9px;color:#4a6785;letter-spacing:0.12em;text-transform:uppercase;margin-bottom:2px;">Cases</div><div style="font-size:12px;color:#c0d8e8;">${p.cases.toLocaleString()}</div></div>
        <div><div style="font-size:9px;color:#4a6785;letter-spacing:0.12em;text-transform:uppercase;margin-bottom:2px;">Per 100K</div><div style="font-size:12px;color:#c0d8e8;">${perCapita}</div></div>
        <div><div style="font-size:9px;color:#4a6785;letter-spacing:0.12em;text-transform:uppercase;margin-bottom:2px;">Population</div><div style="font-size:12px;color:#c0d8e8;">${(p.population/1e6).toFixed(1)}M</div></div>
        <div><div style="font-size:9px;color:#4a6785;letter-spacing:0.12em;text-transform:uppercase;margin-bottom:2px;">Risk</div><div style="font-size:12px;color:${riskColor};font-weight:500;">${(p.risk_score*100).toFixed(0)}%</div></div>
      </div>
      <div style="padding:5px 10px;background:${riskColor}12;border:1px solid ${riskColor}20;border-radius:5px;font-size:10px;color:${riskColor};font-weight:500;">${riskEmoji} ${riskLabel}</div>
      <div style="margin-top:8px;font-size:9px;color:#2a4055;text-align:right;">Click to explore →</div>
    </div>`;
  }, []);

  return (
    <div
      ref={containerRef}
      style={{
        width: '100%', height: '100%', position: 'relative', overflow: 'hidden',
        background: heroMode
          ? 'radial-gradient(ellipse at center, #001830 0%, #000814 70%)'
          : 'radial-gradient(ellipse at center, #001020 0%, #000814 70%)'
      }}
    >
      {dimensions.width > 0 && (
        <Globe
          ref={globeRef}
          width={dimensions.width}
          height={dimensions.height}
          // Brighter daytime globe texture
          globeImageUrl="//unpkg.com/three-globe/example/img/earth-blue-marble.jpg"
          bumpImageUrl="//unpkg.com/three-globe/example/img/earth-topology.png"
          backgroundColor="rgba(0,8,20,1)"
          atmosphereColor="#2266ff"
          atmosphereAltitude={heroMode ? 0.22 : 0.16}

          // ── Country polygons (boundaries + click-to-select) ──────────
          polygonsData={countriesGeoJson}
          polygonCapColor={polygonCapColor}
          polygonSideColor="rgba(0,50,90,0.05)"
          polygonStrokeColor="rgba(0,160,220,0.4)"
          polygonAltitude={polygonAltitude}
          polygonLabel={polygonLabel}
          onPolygonClick={handlePolygonClick as any}

          // ── Risk dots ────────────────────────────────────────────────
          pointsData={globeData}
          pointLat="lat"
          pointLng="lng"
          pointColor={(d: object) => {
            const p = d as GlobePoint;
            if (heatmapMode) {
              const intensity = Math.min(1, p.cases / maxCases);
              const r = Math.floor(255 * Math.min(1, intensity * 2.2));
              const g = Math.floor(200 * Math.max(0, 1 - intensity * 1.8));
              return `rgba(${r},${g},40,0.82)`;
            }
            return getRiskColor(p.risk_score);
          }}
          pointAltitude={(d: object) => {
            if (heatmapMode) return 0.005;
            return 0.001 + (d as GlobePoint).risk_score * 0.012;
          }}
          pointRadius={(d: object) => {
            const p = d as GlobePoint;
            if (heatmapMode) {
              // Large heat blobs
              const base = Math.sqrt(p.cases) / 500;
              return Math.min(8, Math.max(2, base));
            }
            const base = Math.sqrt(p.cases) / 3200;
            return Math.min(heroMode ? 1.5 : 1.2, Math.max(0.2, base));
          }}
          pointLabel={pointLabel}
          onPointClick={handlePointClick as any}
          pointsMerge={false}
          pointResolution={10}

          // ── Spread arcs ──────────────────────────────────────────────
          arcsData={spreadArcs}
          arcStartLat={(d: object) => (d as SpreadArc).startLat}
          arcStartLng={(d: object) => (d as SpreadArc).startLng}
          arcEndLat={(d: object) => (d as SpreadArc).endLat}
          arcEndLng={(d: object) => (d as SpreadArc).endLng}
          arcColor={(d: object) => (d as SpreadArc).color}
          arcDashLength={0.3}
          arcDashGap={0.2}
          arcDashAnimateTime={2200}
          arcStroke={(d: object) => 0.2 + (d as SpreadArc).intensity * 0.3}
          arcAltitudeAutoScale={0.35}

          // ── Selection ring ───────────────────────────────────────────
          ringsData={selectedCountry ? [selectedCountry] : []}
          ringLat={(d: object) => (d as GlobePoint).lat}
          ringLng={(d: object) => (d as GlobePoint).lng}
          ringColor={() => 'rgba(0,180,255,0.5)'}
          ringMaxRadius={2.5}
          ringPropagationSpeed={1.8}
          ringRepeatPeriod={1000}
        />
      )}

      {/* Legend — only in analytics mode */}
      {!heroMode && (
        <div style={{ position: 'absolute', bottom: 56, right: 12, zIndex: 10, background: 'rgba(0,12,30,0.88)', border: '1px solid rgba(0,100,160,0.14)', borderRadius: 8, padding: '10px 12px', backdropFilter: 'blur(16px)' }}>
          <p style={{ fontSize: '0.52rem', color: '#3a5a78', letterSpacing: '0.18em', textTransform: 'uppercase', fontFamily: 'Inter, sans-serif', marginBottom: 8 }}>
            {heatmapMode ? 'Case Density' : 'Risk Level'}
          </p>
          {heatmapMode ? (
            // Heatmap legend
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ width: 60, height: 6, borderRadius: 3, background: 'linear-gradient(to right, rgba(34,200,94,0.8), rgba(234,179,8,0.8), rgba(239,68,68,0.9))' }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', width: 60, fontSize: '0.48rem', color: '#4a6785', position: 'absolute', bottom: 10, right: 24 }}>
              </div>
            </div>
          ) : (
            [{ color: '#22c55e', label: 'Low < 25%' }, { color: '#eab308', label: 'Moderate 25–50%' }, { color: '#f97316', label: 'High 50–75%' }, { color: '#ef4444', label: 'Alarming > 75%' }].map(({ color, label }) => (
              <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: color, boxShadow: `0 0 4px ${color}80`, flexShrink: 0 }} />
                <span style={{ fontSize: '0.58rem', color: '#5a7a92', fontFamily: 'Inter, sans-serif' }}>{label}</span>
              </div>
            ))
          )}
        </div>
      )}

      {/* Polygon click hint */}
      {heroMode && countriesGeoJson.length > 0 && (
        <div style={{ position: 'absolute', top: 16, right: 16, zIndex: 10, background: 'rgba(0,10,26,0.85)', border: '1px solid rgba(0,140,200,0.18)', borderRadius: 8, padding: '6px 12px', backdropFilter: 'blur(12px)' }}>
          <span style={{ fontSize: '0.58rem', color: '#4a7090', letterSpacing: '0.1em' }}>
            {heatmapMode ? '🌡 Heatmap mode' : '🖱 Click any country'}
          </span>
        </div>
      )}
    </div>
  );
}

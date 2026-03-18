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
  indiaMode?: boolean;
  onIndiaClick?: () => void;
  focusCoords?: { lat: number; lng: number; altitude: number } | null;
}

// ── Decorative network arcs (always visible, subtle cyan) ────────────────────
const DECORATIVE_ARCS: Array<{ startLat: number; startLng: number; endLat: number; endLng: number; color: string; intensity: number }> = [
  { startLat: 40.71, startLng: -74.01, endLat: 51.51, endLng: -0.13,  color: 'rgba(0,212,255,0.18)', intensity: 0.04 }, // NYC→London
  { startLat: 51.51, startLng: -0.13,  endLat: 52.52, endLng: 13.40,  color: 'rgba(0,212,255,0.15)', intensity: 0.04 }, // London→Berlin
  { startLat: 48.85, startLng: 2.35,   endLat: 41.90, endLng: 12.50,  color: 'rgba(0,212,255,0.14)', intensity: 0.04 }, // Paris→Rome
  { startLat: 55.75, startLng: 37.62,  endLat: 25.20, endLng: 55.27,  color: 'rgba(0,212,255,0.16)', intensity: 0.04 }, // Moscow→Dubai
  { startLat: 25.20, startLng: 55.27,  endLat: 28.61, endLng: 77.21,  color: 'rgba(0,212,255,0.17)', intensity: 0.04 }, // Dubai→Delhi
  { startLat: 28.61, startLng: 77.21,  endLat: 39.91, endLng: 116.39, color: 'rgba(0,212,255,0.16)', intensity: 0.04 }, // Delhi→Beijing
  { startLat: 39.91, startLng: 116.39, endLat: 35.68, endLng: 139.69, color: 'rgba(0,212,255,0.15)', intensity: 0.04 }, // Beijing→Tokyo
  { startLat: 35.68, startLng: 139.69, endLat: -33.87, endLng: 151.21,color: 'rgba(0,212,255,0.13)', intensity: 0.04 }, // Tokyo→Sydney
  { startLat: 22.30, startLng: 114.18, endLat: 1.35,  endLng: 103.82, color: 'rgba(0,212,255,0.15)', intensity: 0.04 }, // HK→Singapore
  { startLat: 1.35,  startLng: 103.82, endLat: -6.17, endLng: 106.83, color: 'rgba(0,212,255,0.14)', intensity: 0.04 }, // Singapore→Jakarta
  { startLat: 40.71, startLng: -74.01, endLat: 19.43, endLng: -99.13, color: 'rgba(0,212,255,0.14)', intensity: 0.04 }, // NYC→Mexico City
  { startLat: 19.43, startLng: -99.13, endLat: -23.55, endLng: -46.64,color: 'rgba(0,212,255,0.13)', intensity: 0.04 }, // MexCity→São Paulo
  { startLat: 6.52,  startLng: 3.38,   endLat: -1.29, endLng: 36.82,  color: 'rgba(0,212,255,0.15)', intensity: 0.04 }, // Lagos→Nairobi
  { startLat: -1.29, startLng: 36.82,  endLat: -33.93, endLng: 18.42, color: 'rgba(0,212,255,0.13)', intensity: 0.04 }, // Nairobi→Cape Town
  { startLat: 30.04, startLng: 31.24,  endLat: 6.52,  endLng: 3.38,   color: 'rgba(0,212,255,0.14)', intensity: 0.04 }, // Cairo→Lagos
  { startLat: 40.71, startLng: -74.01, endLat: 48.85, endLng: 2.35,   color: 'rgba(0,212,255,0.16)', intensity: 0.04 }, // NYC→Paris
  { startLat: 25.20, startLng: 55.27,  endLat: 30.04, endLng: 31.24,  color: 'rgba(0,212,255,0.15)', intensity: 0.04 }, // Dubai→Cairo
  { startLat: 51.51, startLng: -0.13,  endLat: 55.75, endLng: 37.62,  color: 'rgba(0,212,255,0.14)', intensity: 0.04 }, // London→Moscow
];

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

/** Fuzzy-match a GeoJSON India state name to our GlobePoint array (region === 'India') */
function findIndiaState(geoStateName: string, globeData: GlobePoint[]): GlobePoint | null {
  const norm = (s: string) =>
    s.toLowerCase()
      .replace(/nct of /g, '')
      .replace(/&/g, 'and')
      .replace(/[^a-z\s]/g, '')
      .trim()
      .replace(/\s+/g, ' ');
  const gn = norm(geoStateName);
  const states = globeData.filter(p => p.region === 'India');
  return (
    states.find(p => norm(p.country) === gn) ||
    states.find(p => {
      const pn = norm(p.country);
      return gn.includes(pn) || pn.includes(gn);
    }) ||
    null
  );
}

export default function GlobeView({
  globeData, spreadArcs, onCountrySelect, selectedCountry,
  heroMode = false, heatmapMode = false,
  indiaMode = false, onIndiaClick, focusCoords,
}: Props) {
  const globeRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  const [isInitialized, setIsInitialized] = useState(false);
  const [countriesGeoJson, setCountriesGeoJson] = useState<any[]>([]);
  const [indiaStatesGeoJson, setIndiaStatesGeoJson] = useState<any[]>([]);

  // Load country GeoJSON for polygon boundaries
  useEffect(() => {
    fetch('https://raw.githubusercontent.com/vasturiano/react-globe.gl/master/example/datasets/ne_110m_admin_0_countries.geojson')
      .then(r => r.json())
      .then(data => setCountriesGeoJson(data.features))
      .catch(() => {}); // fail silently — dots still work
  }, []);

  // Lazy-load India state GeoJSON when indiaMode activates
  useEffect(() => {
    if (!indiaMode || indiaStatesGeoJson.length > 0) return;
    fetch('https://gist.githubusercontent.com/jbrobst/56c13bbbf9d97d187fea01ca62ea5112/raw/e388c4cae20aa53cb5090210a42ebb9b765c0a36/india_states.geojson')
      .then(r => r.json())
      .then(data => setIndiaStatesGeoJson(data.features))
      .catch(() => {});
  }, [indiaMode, indiaStatesGeoJson.length]);

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

        // Ambient fill — cool blue-slate tone
        const ambient = new THREE.AmbientLight(0x334466, 1.2);
        ambient.name = 'ambientLight';
        if (!scene.getObjectByName('ambientLight')) scene.add(ambient);

        // Key light — bright blue from upper-right
        const dirLight = new THREE.DirectionalLight(0x6688cc, 2.0);
        dirLight.position.set(2, 1, 1);
        dirLight.name = 'dirLight';
        if (!scene.getObjectByName('dirLight')) scene.add(dirLight);

        // Rim light — deep blue from lower-left for depth
        const rimLight = new THREE.DirectionalLight(0x0033aa, 0.8);
        rimLight.position.set(-2, -1, -1);
        rimLight.name = 'rimLight';
        if (!scene.getObjectByName('rimLight')) scene.add(rimLight);

        camera.far = 5000;
        camera.updateProjectionMatrix();

        controls.autoRotate      = true;    // slow continuous rotation
        controls.autoRotateSpeed = 0.25;   // very slow and smooth
        controls.enableRotate    = true;    // full drag-to-rotate in all directions
        controls.rotateSpeed     = 0.6;     // smooth, responsive
        controls.enableDamping   = true;
        controls.dampingFactor   = 0.05;
        controls.minDistance     = heroMode ? 150 : 130;
        controls.maxDistance     = heroMode ? 600 : 480;
        controls.enablePan       = false;

        setIsInitialized(true);
      } catch (_) {}
    }, 600);
    return () => clearTimeout(timer);
  }, [isInitialized, heroMode]);

  // Zoom to selected country / state
  useEffect(() => {
    if (!selectedCountry || !globeRef.current) return;
    const { lat, lng } = selectedCountry;
    const isIndiaState = selectedCountry.region === 'India';
    const altitude = isIndiaState ? 0.5 : 1.4; // tighter zoom for India states
    setTimeout(() => {
      try {
        globeRef.current?.pointOfView({ lat, lng, altitude }, 1400);
      } catch (_) {}
    }, 80);
  }, [selectedCountry]);

  // Zoom to arbitrary coords (e.g. India overview) without opening a panel
  useEffect(() => {
    if (!focusCoords || !globeRef.current) return;
    setTimeout(() => {
      try {
        globeRef.current?.pointOfView(focusCoords, 1400);
      } catch (_) {}
    }, 80);
  }, [focusCoords]);

  // Pause rotation when a country is selected; resume when deselected
  useEffect(() => {
    if (!globeRef.current) return;
    const controls = globeRef.current?.controls?.();
    if (controls) controls.autoRotate = !selectedCountry;
  }, [selectedCountry, heroMode]);

  // Max cases for heatmap normalization
  const maxCases = useMemo(() => Math.max(...globeData.map(p => p.cases), 1), [globeData]);

  // ── Memoized point callbacks — stable references, no per-render recreation ──
  const pointColor = useCallback((d: object) => {
    const p = d as GlobePoint;
    if (heatmapMode) {
      const intensity = Math.min(1, p.cases / maxCases);
      const r = Math.floor(255 * Math.min(1, intensity * 2.2));
      const g = Math.floor(200 * Math.max(0, 1 - intensity * 1.8));
      return `rgba(${r},${g},40,0.82)`;
    }
    return getRiskColor(p.risk_score);
  }, [heatmapMode, maxCases]);

  const pointAltitude = useCallback((d: object) => {
    if (heatmapMode) return 0.005;
    return 0.001 + (d as GlobePoint).risk_score * 0.012;
  }, [heatmapMode]);

  const pointRadius = useCallback((d: object) => {
    const p = d as GlobePoint;
    if (heatmapMode) {
      const base = Math.sqrt(p.cases) / 500;
      return Math.min(8, Math.max(2, base));
    }
    const base = Math.sqrt(p.cases) / 3200;
    return Math.min(heroMode ? 1.5 : 1.2, Math.max(0.2, base));
  }, [heatmapMode, heroMode]);

  // Polygon color based on risk score (handles both country and India state modes)
  const polygonCapColor = useCallback((feat: any) => {
    if (indiaMode) {
      // India state polygon
      const stateName = feat.properties?.ST_NM || '';
      const point = findIndiaState(stateName, globeData);
      if (!point) return 'rgba(20,8,0,0.05)';
      // Highlight selected state
      if (selectedCountry?.region === 'India' && selectedCountry.country === point.country) {
        return 'rgba(255,153,51,0.45)';
      }
      const risk = point.risk_score;
      if (risk > 0.75) return 'rgba(239,68,68,0.22)';
      if (risk > 0.5)  return 'rgba(249,115,22,0.16)';
      if (risk > 0.25) return 'rgba(234,179,8,0.12)';
      return 'rgba(34,197,94,0.09)';
    }
    // Country mode
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
  }, [globeData, selectedCountry, heatmapMode, maxCases, indiaMode]);

  // Polygon altitude — slightly elevated for selected item
  const polygonAltitude = useCallback((feat: any) => {
    if (indiaMode) {
      const stateName = feat.properties?.ST_NM || '';
      const point = findIndiaState(stateName, globeData);
      if (!point) return 0.002;
      return selectedCountry?.country === point.country ? 0.015 : 0.004;
    }
    if (!selectedCountry) return 0.003;
    const name = feat.properties?.ADMIN || feat.properties?.NAME || '';
    const isSelected = findGlobePoint(name, [selectedCountry]) !== null;
    return isSelected ? 0.01 : 0.003;
  }, [selectedCountry, indiaMode, globeData]);

  // Polygon tooltip
  const polygonLabel = useCallback((feat: any) => {
    if (indiaMode) {
      const stateName = feat.properties?.ST_NM || '';
      const point = findIndiaState(stateName, globeData);
      if (!point) return `<div style="background:rgba(10,4,0,0.9);border:1px solid rgba(200,100,0,0.2);border-radius:8px;padding:8px 12px;font-family:Inter,sans-serif;color:#c09060;font-size:12px;">${stateName}</div>`;
      const riskColor = getRiskColor(point.risk_score);
      return `<div style="background:rgba(10,4,0,0.96);border:1px solid rgba(255,153,51,0.25);border-radius:10px;padding:12px 16px;font-family:Inter,sans-serif;color:#e8d8c0;font-size:12px;box-shadow:0 8px 32px rgba(0,0,0,0.5);min-width:180px;">
        <div style="font-size:13px;font-weight:500;color:#ffe8c0;margin-bottom:8px;">🇮🇳 ${point.country}</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:5px 10px;margin-bottom:8px;">
          <div><div style="font-size:9px;color:#8a6040;letter-spacing:0.1em;text-transform:uppercase;margin-bottom:1px;">Cases</div><div style="color:#d0b890;">${point.cases.toLocaleString()}</div></div>
          <div><div style="font-size:9px;color:#8a6040;letter-spacing:0.1em;text-transform:uppercase;margin-bottom:1px;">Risk</div><div style="color:${riskColor};font-weight:500;">${(point.risk_score*100).toFixed(0)}%</div></div>
        </div>
        <div style="font-size:10px;color:#6a4020;text-align:right;">Click to explore →</div>
      </div>`;
    }
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
  }, [globeData, indiaMode]);

  // Handle polygon click → find matching GlobePoint
  const handlePolygonClick = useCallback((feat: any) => {
    if (indiaMode) {
      const stateName = feat.properties?.ST_NM || '';
      const point = findIndiaState(stateName, globeData);
      if (point) onCountrySelect(point);
      return;
    }
    const name = feat.properties?.ADMIN || feat.properties?.NAME || '';
    const point = findGlobePoint(name, globeData);
    if (point) {
      onCountrySelect(point);
    } else if (name === 'India' || name.toLowerCase().includes('india')) {
      // India polygon clicked — country-level India replaced by states, so
      // enter India-state mode (zoom to India centre, show state picker)
      onIndiaClick?.();
    } else {
      // Unknown country — still open panel with zero data rather than wrong coords
      onCountrySelect({
        country: name, lat: 0, lng: 0,
        cases: 0, deaths: 0, population: 1_000_000,
        risk_score: 0, iso2: name.slice(0, 2).toUpperCase(), region: 'Unknown'
      } as GlobePoint);
    }
  }, [globeData, onCountrySelect, onIndiaClick, indiaMode]);

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
          atmosphereColor="#00aaff"
          atmosphereAltitude={heroMode ? 0.28 : 0.20}

          // ── Country / India-state polygons (boundaries + click-to-select) ──
          polygonsData={indiaMode ? indiaStatesGeoJson : countriesGeoJson}
          polygonCapColor={polygonCapColor}
          polygonSideColor={indiaMode ? 'rgba(180,80,0,0.06)' : 'rgba(0,50,90,0.05)'}
          polygonStrokeColor={indiaMode ? 'rgba(255,153,51,0.55)' : 'rgba(0,160,220,0.4)'}
          polygonAltitude={polygonAltitude}
          polygonLabel={polygonLabel}
          onPolygonClick={handlePolygonClick as any}
          polygonsTransitionDuration={500}

          // ── Risk dots ────────────────────────────────────────────────
          pointsData={globeData}
          pointLat="lat"
          pointLng="lng"
          pointColor={pointColor}
          pointAltitude={pointAltitude}
          pointRadius={pointRadius}
          pointLabel={pointLabel}
          onPointClick={handlePointClick as any}
          pointsMerge={false}
          pointResolution={24}
          pointsTransitionDuration={600}

          // ── Spread arcs + decorative network lines ───────────────────
          arcsData={[...DECORATIVE_ARCS, ...spreadArcs]}
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

          // ── India state name labels (visible when indiaMode active) ──
          labelsData={indiaMode ? globeData.filter(p => p.region === 'India') : []}
          labelLat={(d: object) => (d as GlobePoint).lat}
          labelLng={(d: object) => (d as GlobePoint).lng}
          labelText={(d: object) => (d as GlobePoint).country}
          labelSize={0.38}
          labelDotRadius={0.25}
          labelColor={() => 'rgba(200,240,255,0.92)'}
          labelResolution={3}
          labelAltitude={0.006}
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
            {heatmapMode ? 'Heatmap mode' : 'Click any country'}
          </span>
        </div>
      )}
    </div>
  );
}

'use client';

import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { motion, AnimatePresence } from 'framer-motion';

// ─── Constants ────────────────────────────────────────────────────────────────
const GLOBE_RADIUS = 2.0;
const STAR_COUNT   = 4500;

// ─── Infection hotspot data ───────────────────────────────────────────────────
const HOTSPOTS = [
  { lat: 35.86,  lng: 104.19, name: 'Eastern China',  intensity: 0.95, cases: '2.1M', hex: 0xff2244 },
  { lat: 28.61,  lng:  77.20, name: 'Delhi, India',   intensity: 0.88, cases: '850K', hex: 0xff4400 },
  { lat: 48.85,  lng:   2.35, name: 'Paris, France',  intensity: 0.72, cases: '420K', hex: 0xff7700 },
  { lat: 40.71,  lng: -74.00, name: 'New York, USA',  intensity: 0.82, cases: '680K', hex: 0xff4400 },
  { lat: -23.55, lng: -46.63, name: 'São Paulo, BR',  intensity: 0.76, cases: '510K', hex: 0xff7700 },
  { lat:   1.35, lng: 103.82, name: 'Singapore',      intensity: 0.65, cases: '280K', hex: 0xffaa00 },
  { lat:  51.51, lng:  -0.13, name: 'London, UK',     intensity: 0.68, cases: '310K', hex: 0xffaa00 },
  { lat:  35.68, lng: 139.69, name: 'Tokyo, Japan',   intensity: 0.71, cases: '390K', hex: 0xff7700 },
  { lat:  19.43, lng: -99.13, name: 'Mexico City',    intensity: 0.73, cases: '370K', hex: 0xff7700 },
  { lat:  22.54, lng: 114.06, name: 'Hong Kong',      intensity: 0.90, cases: '1.5M', hex: 0xff2244 },
];

const CONNECTIONS = [
  [0, 9], [0, 1], [1, 2], [2, 6],
  [6, 3], [3, 4], [5, 7], [0, 5],
  [1, 5], [7, 2],
];

const STAGES = [
  {
    label: 'STAGE 01 — GLOBAL OVERVIEW',
    title: 'Global Outbreak Monitor',
    sub: 'Tracking 12 active disease vectors across 47 countries',
  },
  {
    label: 'STAGE 02 — REGIONAL ANALYSIS',
    title: 'Regional Transmission Network',
    sub: 'High-density clusters identified across Asia and Europe',
  },
  {
    label: 'STAGE 03 — OUTBREAK DETAIL',
    title: 'State-Level Surveillance',
    sub: 'Real-time spread simulation — Delhi NCR, India',
  },
  {
    label: 'STAGE 04 — INTELLIGENCE PLATFORM',
    title: 'Analytical Dashboard',
    sub: 'AI-powered epidemiological analytics and predictive response',
  },
];

const MINI_METRICS = [
  { label: 'Active Outbreak Regions', value: '47',    change: '+3 this week',        up: true  },
  { label: 'Spread Velocity (R₀)',    value: '2.3×',  change: 'Above risk threshold', up: null  },
  { label: 'AI Model Confidence',     value: '94.2%', change: '+1.8% vs last cycle',  up: true  },
  { label: 'Countries Under Alert',   value: '23',    change: 'High Risk Tier',       up: false },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────
function latLng2Vec3(lat: number, lng: number, r: number): THREE.Vector3 {
  const phi   = (90 - lat) * (Math.PI / 180);
  const theta = (lng + 180) * (Math.PI / 180);
  return new THREE.Vector3(
    -r * Math.sin(phi) * Math.cos(theta),
     r * Math.cos(phi),
     r * Math.sin(phi) * Math.sin(theta),
  );
}

function easeInOut(t: number): number {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function CinematicGlobe() {
  const containerRef   = useRef<HTMLDivElement>(null);
  const canvasRef      = useRef<HTMLCanvasElement>(null);
  const dashPanelRef   = useRef<HTMLDivElement>(null);
  const progressBarRef = useRef<HTMLDivElement>(null);
  const rafRef         = useRef<number>(0);
  const [stageIdx, setStageIdx] = useState(0);

  const live = useRef({
    camera:        null as THREE.PerspectiveCamera | null,
    globeGroup:    null as THREE.Group | null,
    hotspotCores:  [] as THREE.Mesh[],
    hotspotRings:  [] as THREE.Mesh[],
    arcLines:      [] as THREE.Line[],
    targetCamPos:  new THREE.Vector3(0, 0, 7.5),
    currentCamPos: new THREE.Vector3(0, 0, 7.5),
    targetHotOp:   0,
    targetArcOp:   0,
    progress:      0,
  });

  useEffect(() => {
    const canvas    = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    // ── Scene ──────────────────────────────────────────────────────────────
    const scene = new THREE.Scene();

    // ── Camera ─────────────────────────────────────────────────────────────
    const W = canvas.clientWidth || window.innerWidth;
    const H = canvas.clientHeight || window.innerHeight;
    const camera = new THREE.PerspectiveCamera(42, W / H, 0.1, 1000);
    camera.position.set(0, 0, 7.5);
    live.current.camera        = camera;
    live.current.targetCamPos  = new THREE.Vector3(0, 0, 7.5);
    live.current.currentCamPos = new THREE.Vector3(0, 0, 7.5);

    // ── Renderer ───────────────────────────────────────────────────────────
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
    renderer.setSize(W, H, false);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x000814, 1);
    renderer.toneMapping         = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.85;

    // ── Lighting ───────────────────────────────────────────────────────────
    scene.add(new THREE.AmbientLight(0x162436, 0.7));
    const sun = new THREE.DirectionalLight(0x3a88ff, 1.1);
    sun.position.set(5, 3, 5);
    scene.add(sun);
    // Rim light from opposite side
    const rim = new THREE.DirectionalLight(0x0044aa, 0.3);
    rim.position.set(-5, -2, -3);
    scene.add(rim);

    // ── Starfield ──────────────────────────────────────────────────────────
    const starGeo = new THREE.BufferGeometry();
    const starPos = new Float32Array(STAR_COUNT * 3);
    const starOpacity = new Float32Array(STAR_COUNT);
    for (let i = 0; i < STAR_COUNT; i++) {
      const r = 90 + Math.random() * 110;
      const t = Math.random() * Math.PI * 2;
      const p = Math.acos(2 * Math.random() - 1);
      starPos[i * 3]     = r * Math.sin(p) * Math.cos(t);
      starPos[i * 3 + 1] = r * Math.sin(p) * Math.sin(t);
      starPos[i * 3 + 2] = r * Math.cos(p);
      starOpacity[i]     = 0.3 + Math.random() * 0.7;
    }
    starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
    scene.add(new THREE.Points(starGeo, new THREE.PointsMaterial({
      color: 0xffffff,
      size: 0.09,
      sizeAttenuation: true,
      transparent: true,
      opacity: 0.65,
    })));

    // ── Globe group ────────────────────────────────────────────────────────
    const globeGroup = new THREE.Group();
    scene.add(globeGroup);
    live.current.globeGroup = globeGroup;

    // ── Earth mesh ─────────────────────────────────────────────────────────
    const texLoader = new THREE.TextureLoader();
    const earthMat  = new THREE.MeshPhongMaterial({
      map:       texLoader.load('//unpkg.com/three-globe/example/img/earth-night.jpg'),
      bumpMap:   texLoader.load('//unpkg.com/three-globe/example/img/earth-topology.png'),
      bumpScale: 0.04,
      specular:  new THREE.Color(0x1a2e4a),
      shininess: 14,
    });
    globeGroup.add(new THREE.Mesh(new THREE.SphereGeometry(GLOBE_RADIUS, 72, 72), earthMat));

    // ── Atmosphere — soft blue halo ───────────────────────────────────────
    const atmoMat = new THREE.ShaderMaterial({
      vertexShader: `
        varying vec3 vN;
        varying vec3 vV;
        void main() {
          vN = normalize(normalMatrix * normal);
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          vV = normalize(-mv.xyz);
          gl_Position = projectionMatrix * mv;
        }
      `,
      fragmentShader: `
        varying vec3 vN;
        varying vec3 vV;
        void main() {
          float f = pow(0.58 - dot(vN, vV), 3.0);
          gl_FragColor = vec4(0.05, 0.55, 1.0, max(0.0, f) * 0.55);
        }
      `,
      blending:    THREE.AdditiveBlending,
      side:        THREE.BackSide,
      transparent: true,
      depthWrite:  false,
    });
    globeGroup.add(new THREE.Mesh(new THREE.SphereGeometry(GLOBE_RADIUS * 1.08, 64, 64), atmoMat));

    // ── Very subtle wireframe grid ─────────────────────────────────────────
    globeGroup.add(new THREE.Mesh(
      new THREE.SphereGeometry(GLOBE_RADIUS * 1.001, 48, 48),
      new THREE.MeshBasicMaterial({
        color: 0x00aaff, wireframe: true, transparent: true, opacity: 0.012,
      }),
    ));

    // ── Floating micro-particle cloud ──────────────────────────────────────
    const cloudGeo = new THREE.BufferGeometry();
    const cloudPos = new Float32Array(200 * 3);
    for (let i = 0; i < 200; i++) {
      const r = GLOBE_RADIUS * 1.1 + Math.random() * 0.55;
      const t = Math.random() * Math.PI * 2;
      const p = Math.acos(2 * Math.random() - 1);
      cloudPos[i * 3]     = r * Math.sin(p) * Math.cos(t);
      cloudPos[i * 3 + 1] = r * Math.sin(p) * Math.sin(t);
      cloudPos[i * 3 + 2] = r * Math.cos(p);
    }
    cloudGeo.setAttribute('position', new THREE.BufferAttribute(cloudPos, 3));
    globeGroup.add(new THREE.Points(cloudGeo, new THREE.PointsMaterial({
      color: 0x00aaff, size: 0.01, sizeAttenuation: true,
      transparent: true, opacity: 0.3, blending: THREE.AdditiveBlending,
    })));

    // ── Infection hotspots — flat smooth discs (not protruding spheres) ────
    const hotspotCores: THREE.Mesh[] = [];
    const hotspotRings: THREE.Mesh[] = [];

    HOTSPOTS.forEach((hs) => {
      const surfacePos = latLng2Vec3(hs.lat, hs.lng, GLOBE_RADIUS + 0.008);
      const diskSize   = 0.022 + hs.intensity * 0.018; // smaller, more refined

      // Flat disc (CircleGeometry) — smooth, surface-level, not protruding
      const core = new THREE.Mesh(
        new THREE.CircleGeometry(diskSize, 32),
        new THREE.MeshBasicMaterial({
          color: hs.hex, transparent: true, opacity: 0,
          side: THREE.DoubleSide, depthWrite: false,
          blending: THREE.AdditiveBlending,
        }),
      );
      core.position.copy(surfacePos);
      core.lookAt(new THREE.Vector3(0, 0, 0)); // lie flat on surface
      globeGroup.add(core);
      hotspotCores.push(core);

      // Soft outer ring — very gentle pulse
      const ring = new THREE.Mesh(
        new THREE.RingGeometry(diskSize * 1.6, diskSize * 2.2, 32),
        new THREE.MeshBasicMaterial({
          color: hs.hex, transparent: true, opacity: 0,
          side: THREE.DoubleSide, depthWrite: false,
          blending: THREE.AdditiveBlending,
        }),
      );
      ring.position.copy(surfacePos);
      ring.lookAt(new THREE.Vector3(0, 0, 0));
      globeGroup.add(ring);
      hotspotRings.push(ring);
    });

    live.current.hotspotCores = hotspotCores;
    live.current.hotspotRings = hotspotRings;

    // ── Transmission arcs — gold/silver/cyan palette ───────────────────────
    const arcLines: THREE.Line[] = [];
    const ARC_COLORS = [0x00c8ff, 0xc8a84b, 0xb0c0cc]; // cyan, gold, silver

    CONNECTIONS.forEach(([fi, ti], idx) => {
      const from = latLng2Vec3(HOTSPOTS[fi].lat, HOTSPOTS[fi].lng, GLOBE_RADIUS);
      const to   = latLng2Vec3(HOTSPOTS[ti].lat, HOTSPOTS[ti].lng, GLOBE_RADIUS);
      const mid  = from.clone().add(to).multiplyScalar(0.5);
      mid.normalize().multiplyScalar(GLOBE_RADIUS + 0.35 + Math.random() * 0.3);

      const curve  = new THREE.QuadraticBezierCurve3(from, mid, to);
      const arcMat = new THREE.LineBasicMaterial({
        color: ARC_COLORS[idx % ARC_COLORS.length],
        transparent: true, opacity: 0,
        blending: THREE.AdditiveBlending,
      });
      const line = new THREE.Line(
        new THREE.BufferGeometry().setFromPoints(curve.getPoints(60)),
        arcMat,
      );
      globeGroup.add(line);
      arcLines.push(line);
    });
    live.current.arcLines = arcLines;

    // ── Scroll handler ─────────────────────────────────────────────────────
    const onScroll = () => {
      const total    = container.offsetHeight - window.innerHeight;
      const scrolled = Math.max(0, -container.getBoundingClientRect().top);
      const progress = Math.min(1, scrolled / Math.max(1, total));
      live.current.progress = progress;

      if (progressBarRef.current) {
        progressBarRef.current.style.width = `${progress * 100}%`;
      }

      const newStage = progress < 0.25 ? 0 : progress < 0.5 ? 1 : progress < 0.75 ? 2 : 3;
      setStageIdx(newStage);

      // Stage 1 — Global view (0–0.25)
      if (progress < 0.25) {
        const p = easeInOut(progress / 0.25);
        live.current.targetCamPos.set(
          THREE.MathUtils.lerp(0,   1.2, p),
          THREE.MathUtils.lerp(0,   0.2, p),
          THREE.MathUtils.lerp(7.5, 6.2, p),
        );
        live.current.targetHotOp = p > 0.4 ? (p - 0.4) / 0.6 : 0;
        live.current.targetArcOp = 0;
        if (dashPanelRef.current) {
          dashPanelRef.current.style.opacity      = '0';
          dashPanelRef.current.style.transform    = 'translateX(100%)';
          dashPanelRef.current.style.pointerEvents = 'none';
        }
        if (canvasRef.current) canvasRef.current.style.transform = 'translateX(0%)';

      // Stage 2 — Regional zoom (0.25–0.5)
      } else if (progress < 0.5) {
        const p = easeInOut((progress - 0.25) / 0.25);
        live.current.targetCamPos.set(
          THREE.MathUtils.lerp(1.2, 3.0, p),
          THREE.MathUtils.lerp(0.2, 0.6, p),
          THREE.MathUtils.lerp(6.2, 4.2, p),
        );
        live.current.targetHotOp = 1;
        live.current.targetArcOp = p;
        if (dashPanelRef.current) {
          dashPanelRef.current.style.opacity      = '0';
          dashPanelRef.current.style.transform    = 'translateX(100%)';
          dashPanelRef.current.style.pointerEvents = 'none';
        }
        if (canvasRef.current) canvasRef.current.style.transform = 'translateX(0%)';

      // Stage 3 — State level (0.5–0.75)
      } else if (progress < 0.75) {
        const p = easeInOut((progress - 0.5) / 0.25);
        live.current.targetCamPos.set(
          THREE.MathUtils.lerp(3.0, 3.6, p),
          THREE.MathUtils.lerp(0.6, 0.9, p),
          THREE.MathUtils.lerp(4.2, 3.4, p),
        );
        live.current.targetHotOp = 1;
        live.current.targetArcOp = 1;
        if (dashPanelRef.current) {
          dashPanelRef.current.style.opacity      = '0';
          dashPanelRef.current.style.transform    = 'translateX(100%)';
          dashPanelRef.current.style.pointerEvents = 'none';
        }
        if (canvasRef.current) canvasRef.current.style.transform = 'translateX(0%)';

      // Stage 4 — Dashboard (0.75–1.0)
      } else {
        const p = easeInOut((progress - 0.75) / 0.25);
        live.current.targetCamPos.set(3.6, 0.9, 3.4);
        live.current.targetHotOp = 1;
        live.current.targetArcOp = 1;

        if (canvasRef.current) {
          canvasRef.current.style.transform = `translateX(${-p * 20}%)`;
        }
        if (dashPanelRef.current) {
          dashPanelRef.current.style.opacity      = String(p);
          dashPanelRef.current.style.transform    = `translateX(${(1 - p) * 100}%)`;
          dashPanelRef.current.style.pointerEvents = p > 0.5 ? 'auto' : 'none';
        }
      }
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();

    // ── Animation loop ─────────────────────────────────────────────────────
    const clock = new THREE.Clock();

    const animate = () => {
      rafRef.current = requestAnimationFrame(animate);
      const t     = clock.getElapsedTime();
      const state = live.current;
      if (!state.camera) return;

      // Resize
      const cw = canvas.clientWidth;
      const ch = canvas.clientHeight;
      if (renderer.domElement.width !== cw || renderer.domElement.height !== ch) {
        renderer.setSize(cw, ch, false);
        state.camera.aspect = cw / ch;
        state.camera.updateProjectionMatrix();
      }

      // Smooth camera
      state.currentCamPos.lerp(state.targetCamPos, 0.05);
      state.camera.position.copy(state.currentCamPos);
      state.camera.lookAt(0, 0.15, 0);

      // Globe rotation
      if (state.globeGroup) {
        const spd = state.progress > 0.4 ? 0.04 : 0.18;
        state.globeGroup.rotation.y += spd * 0.006;
      }

      // Hotspot cores — very gentle pulse, no scale exaggeration
      state.hotspotCores.forEach((core, i) => {
        const mat = core.material as THREE.MeshBasicMaterial;
        const pulse = 1 + 0.04 * Math.sin(t * 2.5 + i * 0.85); // very subtle
        core.scale.setScalar(pulse);
        const targetOp = state.targetHotOp * 0.7;
        mat.opacity = THREE.MathUtils.lerp(mat.opacity, targetOp, 0.07);
      });

      // Hotspot rings — gentle fade pulse
      state.hotspotRings.forEach((ring, i) => {
        const mat = ring.material as THREE.MeshBasicMaterial;
        const scale = 1 + 0.08 * Math.sin(t * 1.8 + i * 0.7); // gentle
        ring.scale.setScalar(scale);
        const targetOp = state.targetHotOp * (0.18 + 0.1 * Math.sin(t * 1.8 + i * 0.7));
        mat.opacity = THREE.MathUtils.lerp(mat.opacity, Math.max(0, targetOp), 0.07);
      });

      // Arcs — smooth gentle fade
      state.arcLines.forEach((line, i) => {
        const mat = line.material as THREE.LineBasicMaterial;
        const targetOp = state.targetArcOp * 0.32 * (0.6 + 0.4 * Math.sin(t * 1.4 + i * 1.1));
        mat.opacity = THREE.MathUtils.lerp(mat.opacity, Math.max(0, targetOp), 0.05);
      });

      renderer.render(scene, camera);
    };

    animate();

    return () => {
      window.removeEventListener('scroll', onScroll);
      cancelAnimationFrame(rafRef.current);
      renderer.dispose();
    };
  }, []);

  const stage = STAGES[stageIdx];

  return (
    <section ref={containerRef} style={{ height: '500vh', position: 'relative' }}>
      {/* ── Sticky viewport ─────────────────────────────────────────────────── */}
      <div style={{
        position: 'sticky', top: 0,
        height: '100vh', width: '100%',
        overflow: 'hidden', background: '#000814',
      }}>

        {/* Three.js canvas */}
        <canvas
          ref={canvasRef}
          style={{
            position: 'absolute', inset: 0,
            width: '100%', height: '100%',
            transition: 'transform 0.7s cubic-bezier(0.25, 0.46, 0.45, 0.94)',
            willChange: 'transform',
          }}
        />

        {/* ── Top navigation bar ──────────────────────────────────────────── */}
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10,
          padding: '1.5rem 2.5rem',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          background: 'linear-gradient(to bottom, rgba(0,8,20,0.95) 0%, transparent 100%)',
          pointerEvents: 'none',
        }}>
          {/* Brand */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.9rem' }}>
            <div style={{
              width: 32, height: 32, borderRadius: '50%',
              border: '1.5px solid rgba(0,180,255,0.5)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 0 18px rgba(0,180,255,0.25)',
            }}>
              <span style={{ fontSize: 14, lineHeight: 1 }}>✦</span>
            </div>
            <div>
              <div style={{
                fontFamily: 'Inter, -apple-system, sans-serif',
                fontSize: '0.95rem', fontWeight: 600,
                letterSpacing: '0.12em',
                color: '#e8f4ff',
              }}>
                PATHOSENSE
              </div>
              <div style={{
                fontFamily: 'Inter, -apple-system, sans-serif',
                fontSize: '0.5rem', color: '#4a6785',
                letterSpacing: '0.28em', marginTop: 2,
              }}>
                PANDEMIC INTELLIGENCE SYSTEM
              </div>
            </div>
          </div>

          {/* Status */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: '0.5rem',
            fontFamily: 'Inter, -apple-system, sans-serif',
            fontSize: '0.58rem', letterSpacing: '0.14em', color: '#4a6785',
          }}>
            <div style={{
              width: 5, height: 5, borderRadius: '50%',
              background: '#22c55e', boxShadow: '0 0 6px #22c55e',
            }} />
            <span style={{ color: '#22c55e', fontWeight: 500 }}>LIVE</span>
            <span style={{ margin: '0 0.5rem', opacity: 0.3 }}>|</span>
            <span>GLOBAL SURVEILLANCE ACTIVE</span>
          </div>
        </div>

        {/* ── Stage label — centered, editorial ────────────────────────────── */}
        <AnimatePresence mode="wait">
          <motion.div
            key={stageIdx}
            initial={{ opacity: 0, y: 22 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            transition={{ duration: 0.6, ease: [0.25, 0.46, 0.45, 0.94] }}
            style={{
              position: 'absolute',
              bottom: '14%',
              left: stageIdx === 3 ? '26%' : '50%',
              transform: 'translateX(-50%)',
              textAlign: 'center',
              pointerEvents: 'none',
              zIndex: 10,
              transition: 'left 1s cubic-bezier(0.25, 0.46, 0.45, 0.94)',
            }}
          >
            {/* Stage indicator */}
            <div style={{
              fontFamily: 'Inter, -apple-system, sans-serif',
              fontSize: '0.52rem', letterSpacing: '0.38em',
              color: 'rgba(0,180,255,0.7)', fontWeight: 500,
              marginBottom: '0.6rem',
              textTransform: 'uppercase',
            }}>
              {stage.label}
            </div>

            {/* Title — Inter, executive weight */}
            <div style={{
              fontFamily: 'Inter, -apple-system, sans-serif',
              fontSize: '1.65rem', fontWeight: 300,
              letterSpacing: '0.05em', color: '#f0f8ff',
              textShadow: '0 2px 32px rgba(0,120,255,0.18)',
              lineHeight: 1.2,
            }}>
              {stage.title}
            </div>

            {/* Subtitle */}
            <div style={{
              fontFamily: 'Inter, -apple-system, sans-serif',
              fontSize: '0.7rem', color: '#6b859e',
              marginTop: '0.55rem', fontWeight: 400,
              letterSpacing: '0.01em',
            }}>
              {stage.sub}
            </div>
          </motion.div>
        </AnimatePresence>

        {/* ── Scroll indicator — stage 0 only ──────────────────────────────── */}
        <AnimatePresence>
          {stageIdx === 0 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0, transition: { duration: 0.4 } }}
              style={{
                position: 'absolute', bottom: '5%', left: '50%',
                transform: 'translateX(-50%)', textAlign: 'center',
                zIndex: 10, pointerEvents: 'none',
              }}
            >
              <motion.div
                animate={{ opacity: [0.35, 0.85, 0.35] }}
                transition={{ duration: 2.8, repeat: Infinity }}
                style={{
                  fontFamily: 'Inter, -apple-system, sans-serif',
                  fontSize: '0.52rem', letterSpacing: '0.38em',
                  color: 'rgba(0,160,220,0.65)', fontWeight: 400,
                }}
              >
                SCROLL TO EXPLORE
              </motion.div>
              <motion.div
                animate={{ y: [0, 8, 0] }}
                transition={{ duration: 1.8, repeat: Infinity }}
                style={{ marginTop: '0.5rem', fontSize: '0.9rem', opacity: 0.45, color: '#00a0dc' }}
              >
                ↓
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Progress bar — thin, elegant ──────────────────────────────────── */}
        <div style={{
          position: 'absolute', bottom: 0, left: 0, right: 0,
          height: 1, background: 'rgba(0,160,220,0.08)', zIndex: 20,
        }}>
          <div
            ref={progressBarRef}
            style={{
              height: '100%', width: '0%',
              background: 'linear-gradient(90deg, rgba(0,160,220,0.6), rgba(100,180,255,0.4))',
              transition: 'width 0.06s linear',
            }}
          />
        </div>

        {/* ── Stage 4: Intelligence Dashboard panel ─────────────────────────── */}
        <div
          ref={dashPanelRef}
          style={{
            position: 'absolute', right: 0, top: 0, bottom: 0,
            width: '40%', opacity: 0,
            transform: 'translateX(100%)',
            background: 'rgba(0,6,20,0.96)',
            backdropFilter: 'blur(32px)',
            WebkitBackdropFilter: 'blur(32px)',
            borderLeft: '1px solid rgba(0,140,220,0.15)',
            padding: '2.5rem 2rem',
            overflowY: 'auto',
            zIndex: 15,
            pointerEvents: 'none',
            fontFamily: 'Inter, -apple-system, sans-serif',
            // Smooth transition for the panel itself
            transition: 'opacity 0.05s linear, transform 0.05s linear',
          }}
        >
          {/* Header */}
          <div style={{ marginBottom: '2rem' }}>
            <div style={{
              fontSize: '0.5rem', color: 'rgba(0,160,220,0.6)',
              letterSpacing: '0.32em', fontWeight: 500,
              marginBottom: '0.5rem', textTransform: 'uppercase',
            }}>
              PATHOSENSE · ANALYTICS ENGINE
            </div>
            <div style={{
              fontSize: '1.2rem', fontWeight: 300,
              letterSpacing: '0.04em', color: '#e8f4ff',
              lineHeight: 1.3,
            }}>
              Intelligence Dashboard
            </div>
            <div style={{
              height: 1,
              background: 'linear-gradient(90deg, rgba(0,160,220,0.3), transparent)',
              marginTop: '1rem',
            }} />
          </div>

          {/* Metrics grid */}
          {MINI_METRICS.map((m) => (
            <div
              key={m.label}
              style={{
                background: 'rgba(0,160,220,0.03)',
                border: '1px solid rgba(0,160,220,0.1)',
                borderRadius: 8,
                padding: '0.9rem 1rem',
                marginBottom: '0.5rem',
              }}
            >
              <div style={{
                fontSize: '0.52rem', color: '#4a6785',
                letterSpacing: '0.16em', fontWeight: 500,
                marginBottom: '0.5rem', textTransform: 'uppercase',
              }}>
                {m.label}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                <div style={{ fontSize: '1.6rem', fontWeight: 200, color: '#f0f8ff', letterSpacing: '-0.01em' }}>
                  {m.value}
                </div>
                <div style={{
                  fontSize: '0.6rem', fontWeight: 400,
                  color: m.up === true ? '#22c55e' : m.up === false ? '#f87171' : '#60a5fa',
                  paddingBottom: '0.25rem', letterSpacing: '0.04em',
                }}>
                  {m.change}
                </div>
              </div>
            </div>
          ))}

          {/* Transmission section */}
          <div style={{
            fontSize: '0.5rem', color: 'rgba(0,160,220,0.55)',
            letterSpacing: '0.28em', fontWeight: 500,
            margin: '1.25rem 0 0.6rem', textTransform: 'uppercase',
          }}>
            Active Transmission Routes
          </div>
          <div style={{
            background: 'rgba(0,160,220,0.025)',
            border: '1px solid rgba(0,160,220,0.1)',
            borderRadius: 8, overflow: 'hidden',
          }}>
            {CONNECTIONS.slice(0, 5).map(([fi, ti], i) => (
              <div
                key={i}
                style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '0.55rem 1rem',
                  borderBottom: i < 4 ? '1px solid rgba(0,160,220,0.06)' : 'none',
                }}
              >
                <div style={{ fontSize: '0.62rem', color: '#6b859e', letterSpacing: '0.02em' }}>
                  {HOTSPOTS[fi].name}
                  <span style={{ color: 'rgba(0,160,220,0.4)', margin: '0 0.4rem' }}>→</span>
                  {HOTSPOTS[ti].name}
                </div>
                <div style={{
                  width: 6, height: 6, borderRadius: '50%',
                  background: HOTSPOTS[fi].intensity > 0.85 ? '#f87171' : '#fb923c',
                  boxShadow: `0 0 6px ${HOTSPOTS[fi].intensity > 0.85 ? '#f87171' : '#fb923c'}`,
                  flexShrink: 0,
                }} />
              </div>
            ))}
          </div>

          {/* CTA */}
          <a
            href="#dashboard"
            style={{
              display: 'block', marginTop: '1.75rem',
              padding: '0.85rem 1.5rem',
              background: 'rgba(0,140,220,0.07)',
              border: '1px solid rgba(0,160,220,0.25)',
              borderRadius: 8,
              color: 'rgba(0,180,255,0.85)',
              fontSize: '0.6rem', fontWeight: 500,
              letterSpacing: '0.22em', textAlign: 'center',
              textDecoration: 'none', cursor: 'pointer',
              textTransform: 'uppercase',
              transition: 'background 0.25s ease, border-color 0.25s ease',
            }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLAnchorElement).style.background = 'rgba(0,160,220,0.13)';
              (e.currentTarget as HTMLAnchorElement).style.borderColor = 'rgba(0,180,255,0.4)';
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLAnchorElement).style.background = 'rgba(0,140,220,0.07)';
              (e.currentTarget as HTMLAnchorElement).style.borderColor = 'rgba(0,160,220,0.25)';
            }}
          >
            Enter Full Dashboard ↓
          </a>
        </div>

      </div>
    </section>
  );
}

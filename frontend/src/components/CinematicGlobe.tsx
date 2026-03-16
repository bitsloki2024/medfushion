'use client';

import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { motion, AnimatePresence } from 'framer-motion';

// ─── Constants ────────────────────────────────────────────────────────────────
const GLOBE_RADIUS = 2.0;
const STAR_COUNT = 5000;

// ─── Infection hotspot data ───────────────────────────────────────────────────
const HOTSPOTS = [
  { lat: 35.86,  lng: 104.19, name: 'Eastern China',   intensity: 0.95, cases: '2.1M',  hex: 0xff1133 },
  { lat: 28.61,  lng:  77.20, name: 'Delhi, India',     intensity: 0.88, cases: '850K',  hex: 0xff3300 },
  { lat: 48.85,  lng:   2.35, name: 'Paris, France',    intensity: 0.72, cases: '420K',  hex: 0xff6600 },
  { lat: 40.71,  lng: -74.00, name: 'New York, USA',    intensity: 0.82, cases: '680K',  hex: 0xff3300 },
  { lat: -23.55, lng: -46.63, name: 'São Paulo, BR',    intensity: 0.76, cases: '510K',  hex: 0xff6600 },
  { lat:   1.35, lng: 103.82, name: 'Singapore',        intensity: 0.65, cases: '280K',  hex: 0xffaa00 },
  { lat:  51.51, lng:  -0.13, name: 'London, UK',       intensity: 0.68, cases: '310K',  hex: 0xffaa00 },
  { lat:  35.68, lng: 139.69, name: 'Tokyo, Japan',     intensity: 0.71, cases: '390K',  hex: 0xff6600 },
  { lat:  19.43, lng: -99.13, name: 'Mexico City',      intensity: 0.73, cases: '370K',  hex: 0xff6600 },
  { lat:  22.54, lng: 114.06, name: 'Hong Kong',        intensity: 0.90, cases: '1.5M',  hex: 0xff1133 },
];

const CONNECTIONS = [
  [0, 9], [0, 1], [1, 2], [2, 6],
  [6, 3], [3, 4], [5, 7], [0, 5],
  [1, 5], [7, 2],
];

const STAGES = [
  { label: 'STAGE 1 / 4 — GLOBAL VIEW',       title: 'GLOBAL OUTBREAK MONITOR',      sub: 'Tracking 12 active disease vectors across 47 countries' },
  { label: 'STAGE 2 / 4 — REGIONAL ZOOM',     title: 'REGIONAL TRANSMISSION HUB',    sub: 'High-density clusters detected across Asia & Europe' },
  { label: 'STAGE 3 / 4 — OUTBREAK DETAIL',   title: 'STATE-LEVEL OUTBREAK',         sub: 'Real-time particle spread simulation — Delhi NCR, India' },
  { label: 'STAGE 4 / 4 — DASHBOARD',         title: 'INTELLIGENCE DASHBOARD',       sub: 'AI-powered analytics & predictive outbreak response' },
];

const MINI_METRICS = [
  { label: 'Active Outbreak Regions', value: '47',    change: '+3 this week',       up: true  },
  { label: 'Spread Velocity (R₀)',    value: '2.3×',  change: 'High risk threshold', up: null  },
  { label: 'AI Model Confidence',     value: '94.2%', change: '+1.8% vs last run',  up: true  },
  { label: 'Countries Under Alert',   value: '23',    change: '↑ High Risk Tier',   up: false },
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

  // All fast-updating values live in a plain ref (no re-renders on scroll)
  const live = useRef({
    camera:          null as THREE.PerspectiveCamera | null,
    globeGroup:      null as THREE.Group | null,
    hotspotCores:    [] as THREE.Mesh[],
    hotspotRings:    [] as THREE.Mesh[],
    arcLines:        [] as THREE.Line[],
    targetCamPos:    new THREE.Vector3(0, 0, 7.5),
    currentCamPos:   new THREE.Vector3(0, 0, 7.5),
    targetHotOp:     0,
    targetArcOp:     0,
    progress:        0,
  });

  useEffect(() => {
    const canvas    = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    // ── Scene ──────────────────────────────────────────────────────────────
    const scene = new THREE.Scene();

    // ── Camera ─────────────────────────────────────────────────────────────
    const W = canvas.clientWidth;
    const H = canvas.clientHeight;
    const camera = new THREE.PerspectiveCamera(45, W / H, 0.1, 1000);
    camera.position.set(0, 0, 7.5);
    live.current.camera        = camera;
    live.current.targetCamPos  = new THREE.Vector3(0, 0, 7.5);
    live.current.currentCamPos = new THREE.Vector3(0, 0, 7.5);

    // ── Renderer ───────────────────────────────────────────────────────────
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    renderer.setSize(W, H, false);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x000814, 1);
    renderer.toneMapping         = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.9;

    // ── Lighting ───────────────────────────────────────────────────────────
    scene.add(new THREE.AmbientLight(0x1a2a4a, 0.6));
    const sun = new THREE.DirectionalLight(0x4499ff, 1.2);
    sun.position.set(5, 3, 5);
    scene.add(sun);

    // ── Starfield ──────────────────────────────────────────────────────────
    const starGeo = new THREE.BufferGeometry();
    const starPos = new Float32Array(STAR_COUNT * 3);
    for (let i = 0; i < STAR_COUNT; i++) {
      const r = 80 + Math.random() * 120;
      const t = Math.random() * Math.PI * 2;
      const p = Math.acos(2 * Math.random() - 1);
      starPos[i * 3]     = r * Math.sin(p) * Math.cos(t);
      starPos[i * 3 + 1] = r * Math.sin(p) * Math.sin(t);
      starPos[i * 3 + 2] = r * Math.cos(p);
    }
    starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
    scene.add(new THREE.Points(starGeo, new THREE.PointsMaterial({
      color: 0xffffff, size: 0.12, sizeAttenuation: true,
      transparent: true, opacity: 0.75,
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
      bumpScale: 0.05,
      specular:  new THREE.Color(0x223355),
      shininess: 10,
    });
    globeGroup.add(new THREE.Mesh(new THREE.SphereGeometry(GLOBE_RADIUS, 64, 64), earthMat));

    // ── Atmosphere (Fresnel BackSide glow) ────────────────────────────────
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
          float f = pow(0.6 - dot(vN, vV), 3.0);
          gl_FragColor = vec4(0.0, 0.83, 1.0, max(0.0, f) * 0.65);
        }
      `,
      blending:    THREE.AdditiveBlending,
      side:        THREE.BackSide,
      transparent: true,
      depthWrite:  false,
    });
    globeGroup.add(new THREE.Mesh(new THREE.SphereGeometry(GLOBE_RADIUS * 1.1, 64, 64), atmoMat));

    // ── Subtle neon wireframe overlay ─────────────────────────────────────
    globeGroup.add(new THREE.Mesh(
      new THREE.SphereGeometry(GLOBE_RADIUS * 1.001, 64, 64),
      new THREE.MeshBasicMaterial({ color: 0x00d4ff, wireframe: true, transparent: true, opacity: 0.022 }),
    ));

    // ── Floating particle cloud ────────────────────────────────────────────
    const cloudGeo = new THREE.BufferGeometry();
    const cloudPos = new Float32Array(300 * 3);
    for (let i = 0; i < 300; i++) {
      const r = GLOBE_RADIUS * 1.12 + Math.random() * 0.7;
      const t = Math.random() * Math.PI * 2;
      const p = Math.acos(2 * Math.random() - 1);
      cloudPos[i * 3]     = r * Math.sin(p) * Math.cos(t);
      cloudPos[i * 3 + 1] = r * Math.sin(p) * Math.sin(t);
      cloudPos[i * 3 + 2] = r * Math.cos(p);
    }
    cloudGeo.setAttribute('position', new THREE.BufferAttribute(cloudPos, 3));
    globeGroup.add(new THREE.Points(cloudGeo, new THREE.PointsMaterial({
      color: 0x00d4ff, size: 0.015, sizeAttenuation: true,
      transparent: true, opacity: 0.4, blending: THREE.AdditiveBlending,
    })));

    // ── Infection hotspots ─────────────────────────────────────────────────
    const hotspotCores: THREE.Mesh[] = [];
    const hotspotRings: THREE.Mesh[] = [];

    HOTSPOTS.forEach((hs) => {
      const pos  = latLng2Vec3(hs.lat, hs.lng, GLOBE_RADIUS + 0.015);
      const size = 0.04 + hs.intensity * 0.055;

      const core = new THREE.Mesh(
        new THREE.SphereGeometry(size, 16, 16),
        new THREE.MeshBasicMaterial({ color: hs.hex, transparent: true, opacity: 0 }),
      );
      core.position.copy(pos);
      globeGroup.add(core);
      hotspotCores.push(core);

      const ring = new THREE.Mesh(
        new THREE.RingGeometry(size * 1.8, size * 2.6, 32),
        new THREE.MeshBasicMaterial({ color: hs.hex, transparent: true, opacity: 0, side: THREE.DoubleSide }),
      );
      ring.position.copy(pos);
      ring.lookAt(new THREE.Vector3(0, 0, 0));
      globeGroup.add(ring);
      hotspotRings.push(ring);
    });

    live.current.hotspotCores = hotspotCores;
    live.current.hotspotRings = hotspotRings;

    // ── Transmission arcs ─────────────────────────────────────────────────
    const arcLines: THREE.Line[] = [];
    CONNECTIONS.forEach(([fi, ti]) => {
      const from = latLng2Vec3(HOTSPOTS[fi].lat, HOTSPOTS[fi].lng, GLOBE_RADIUS);
      const to   = latLng2Vec3(HOTSPOTS[ti].lat, HOTSPOTS[ti].lng, GLOBE_RADIUS);
      const mid  = from.clone().add(to).multiplyScalar(0.5);
      mid.normalize().multiplyScalar(GLOBE_RADIUS + 0.4 + Math.random() * 0.4);

      const curve = new THREE.QuadraticBezierCurve3(from, mid, to);
      const line  = new THREE.Line(
        new THREE.BufferGeometry().setFromPoints(curve.getPoints(64)),
        new THREE.LineBasicMaterial({ color: 0x00d4ff, transparent: true, opacity: 0 }),
      );
      globeGroup.add(line);
      arcLines.push(line);
    });
    live.current.arcLines = arcLines;

    // ── Scroll handler ─────────────────────────────────────────────────────
    const onScroll = () => {
      const rect    = container.getBoundingClientRect();
      const total   = container.offsetHeight - window.innerHeight;
      const scrolled = Math.max(0, -rect.top);
      const progress = Math.min(1, scrolled / total);
      live.current.progress = progress;

      // Progress bar (DOM update, no React re-render)
      if (progressBarRef.current) {
        progressBarRef.current.style.width = `${progress * 100}%`;
      }

      // Determine stage
      const newStage = progress < 0.25 ? 0 : progress < 0.5 ? 1 : progress < 0.75 ? 2 : 3;
      setStageIdx(newStage);

      // Stage 1 — Global (0–0.25)
      if (progress < 0.25) {
        const p = easeInOut(progress / 0.25);
        live.current.targetCamPos.set(
          THREE.MathUtils.lerp(0,   1.5, p),
          THREE.MathUtils.lerp(0,   0.3, p),
          THREE.MathUtils.lerp(7.5, 6.0, p),
        );
        live.current.targetHotOp = p > 0.35 ? (p - 0.35) / 0.65 : 0;
        live.current.targetArcOp = 0;

        if (dashPanelRef.current) {
          dashPanelRef.current.style.opacity    = '0';
          dashPanelRef.current.style.transform  = 'translateX(100%)';
          dashPanelRef.current.style.pointerEvents = 'none';
        }

      // Stage 2 — Regional zoom (0.25–0.5)
      } else if (progress < 0.5) {
        const p = easeInOut((progress - 0.25) / 0.25);
        live.current.targetCamPos.set(
          THREE.MathUtils.lerp(1.5, 3.2, p),
          THREE.MathUtils.lerp(0.3, 0.7, p),
          THREE.MathUtils.lerp(6.0, 4.0, p),
        );
        live.current.targetHotOp = 1;
        live.current.targetArcOp = p;

        if (dashPanelRef.current) {
          dashPanelRef.current.style.opacity   = '0';
          dashPanelRef.current.style.transform = 'translateX(100%)';
          dashPanelRef.current.style.pointerEvents = 'none';
        }

      // Stage 3 — State zoom (0.5–0.75)
      } else if (progress < 0.75) {
        const p = easeInOut((progress - 0.5) / 0.25);
        live.current.targetCamPos.set(
          THREE.MathUtils.lerp(3.2, 3.8, p),
          THREE.MathUtils.lerp(0.7, 1.0, p),
          THREE.MathUtils.lerp(4.0, 3.2, p),
        );
        live.current.targetHotOp = 1;
        live.current.targetArcOp = 1;

        if (dashPanelRef.current) {
          dashPanelRef.current.style.opacity   = '0';
          dashPanelRef.current.style.transform = 'translateX(100%)';
          dashPanelRef.current.style.pointerEvents = 'none';
        }

      // Stage 4 — Dashboard (0.75–1.0)
      } else {
        const p = easeInOut((progress - 0.75) / 0.25);
        live.current.targetCamPos.set(3.8, 1.0, 3.2);
        live.current.targetHotOp = 1;
        live.current.targetArcOp = 1;

        if (canvasRef.current) {
          canvasRef.current.style.transform = `translateX(${-p * 18}%)`;
        }

        if (dashPanelRef.current) {
          dashPanelRef.current.style.opacity       = String(p);
          dashPanelRef.current.style.transform     = `translateX(${(1 - p) * 100}%)`;
          dashPanelRef.current.style.pointerEvents = p > 0.5 ? 'auto' : 'none';
        }
      }

      // Reset canvas shift when not in stage 4
      if (progress < 0.75 && canvasRef.current) {
        canvasRef.current.style.transform = 'translateX(0%)';
      }
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();

    // ── Animation loop ─────────────────────────────────────────────────────
    const clock = new THREE.Clock();

    const animate = () => {
      rafRef.current = requestAnimationFrame(animate);
      const t   = clock.getElapsedTime();
      const state = live.current;
      if (!state.camera) return;

      // Resize check
      const cw = canvas.clientWidth;
      const ch = canvas.clientHeight;
      if (renderer.domElement.width !== cw || renderer.domElement.height !== ch) {
        renderer.setSize(cw, ch, false);
        state.camera.aspect = cw / ch;
        state.camera.updateProjectionMatrix();
      }

      // Smooth camera lerp
      state.currentCamPos.lerp(state.targetCamPos, 0.06);
      state.camera.position.copy(state.currentCamPos);
      state.camera.lookAt(0, 0.2, 0);

      // Globe rotation (slower when zoomed in)
      if (state.globeGroup) {
        const spd = state.progress > 0.4 ? 0.05 : 0.2;
        state.globeGroup.rotation.y += spd * 0.006;
      }

      // Hotspot cores pulse
      state.hotspotCores.forEach((core, i) => {
        const mat = core.material as THREE.MeshBasicMaterial;
        core.scale.setScalar(1 + 0.14 * Math.sin(t * 3.0 + i * 0.9));
        mat.opacity = THREE.MathUtils.lerp(mat.opacity, state.targetHotOp * 0.9, 0.08);
      });

      // Hotspot rings pulse
      state.hotspotRings.forEach((ring, i) => {
        const mat   = ring.material as THREE.MeshBasicMaterial;
        const scale = 1 + 0.3 * Math.sin(t * 2.5 + i * 0.7);
        ring.scale.setScalar(scale);
        const targetOp = state.targetHotOp * (0.25 + 0.18 * Math.sin(t * 2.5 + i * 0.7));
        mat.opacity = THREE.MathUtils.lerp(mat.opacity, Math.max(0, targetOp), 0.08);
      });

      // Arc flicker
      state.arcLines.forEach((line, i) => {
        const mat = line.material as THREE.LineBasicMaterial;
        const targetOp = state.targetArcOp * 0.45 * (0.55 + 0.45 * Math.sin(t * 1.8 + i * 1.2));
        mat.opacity = THREE.MathUtils.lerp(mat.opacity, Math.max(0, targetOp), 0.06);
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
      {/* ── Sticky viewport ────────────────────────────────────────────────── */}
      <div style={{
        position: 'sticky',
        top: 0,
        height: '100vh',
        width: '100%',
        overflow: 'hidden',
        background: '#000814',
      }}>

        {/* Three.js canvas */}
        <canvas
          ref={canvasRef}
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            transition: 'transform 0.15s linear',
          }}
        />

        {/* ── Top header ───────────────────────────────────────────────────── */}
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10,
          padding: '1.25rem 2rem',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          background: 'linear-gradient(to bottom, rgba(0,8,20,0.92) 0%, transparent 100%)',
          pointerEvents: 'none',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{
              width: 34, height: 34, borderRadius: '50%',
              border: '2px solid rgba(0,212,255,0.6)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 0 16px rgba(0,212,255,0.35)',
            }}>
              <span style={{ fontSize: 16 }}>🦠</span>
            </div>
            <div>
              <div style={{
                fontFamily: 'Orbitron, sans-serif', fontSize: '1rem', fontWeight: 700,
                background: 'linear-gradient(90deg, #00d4ff, #a855f7)',
                WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
              }}>
                PATHOSENSE
              </div>
              <div style={{ fontSize: '0.55rem', color: '#64748b', letterSpacing: '0.22em', fontFamily: 'JetBrains Mono, monospace' }}>
                PANDEMIC INTELLIGENCE SYSTEM
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', fontSize: '0.6rem', fontFamily: 'JetBrains Mono, monospace' }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#22c55e', boxShadow: '0 0 8px #22c55e', animation: 'pulse 2s infinite' }} />
            <span style={{ color: '#22c55e', letterSpacing: '0.15em' }}>LIVE</span>
            <span style={{ color: '#1e293b', margin: '0 0.4rem' }}>|</span>
            <span style={{ color: '#475569', letterSpacing: '0.1em' }}>GLOBAL DISEASE SURVEILLANCE ACTIVE</span>
          </div>
        </div>

        {/* ── Stage label (center-bottom) ───────────────────────────────────── */}
        <AnimatePresence mode="wait">
          <motion.div
            key={stageIdx}
            initial={{ opacity: 0, y: 28 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.55, ease: [0.23, 1, 0.32, 1] }}
            style={{
              position: 'absolute',
              bottom: '13%',
              left: stageIdx === 3 ? '28%' : '50%',
              transform: 'translateX(-50%)',
              textAlign: 'center',
              pointerEvents: 'none',
              zIndex: 10,
              transition: 'left 0.9s cubic-bezier(0.23, 1, 0.32, 1)',
            }}
          >
            <div style={{
              fontSize: '0.58rem', letterSpacing: '0.38em',
              color: '#00d4ff', fontFamily: 'JetBrains Mono, monospace',
              marginBottom: '0.45rem', opacity: 0.85,
            }}>
              {stage.label}
            </div>
            <div style={{
              fontSize: '1.45rem', fontWeight: 700, letterSpacing: '0.07em',
              fontFamily: 'Orbitron, sans-serif', color: '#ffffff',
              textShadow: '0 0 40px rgba(0,212,255,0.25), 0 2px 4px rgba(0,0,0,0.8)',
            }}>
              {stage.title}
            </div>
            <div style={{
              fontSize: '0.78rem', color: '#94a3b8',
              marginTop: '0.45rem', fontFamily: 'Inter, sans-serif',
              letterSpacing: '0.02em',
            }}>
              {stage.sub}
            </div>
          </motion.div>
        </AnimatePresence>

        {/* ── Scroll indicator (stage 0 only) ──────────────────────────────── */}
        <AnimatePresence>
          {stageIdx === 0 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0, transition: { duration: 0.3 } }}
              style={{
                position: 'absolute', bottom: '5%', left: '50%',
                transform: 'translateX(-50%)', textAlign: 'center',
                color: '#00d4ff', fontSize: '0.58rem', letterSpacing: '0.42em',
                fontFamily: 'JetBrains Mono, monospace', zIndex: 10, pointerEvents: 'none',
              }}
            >
              <motion.div animate={{ opacity: [0.4, 1, 0.4] }} transition={{ duration: 2.5, repeat: Infinity }}>
                SCROLL TO EXPLORE
              </motion.div>
              <motion.div
                animate={{ y: [0, 9, 0] }}
                transition={{ duration: 1.6, repeat: Infinity }}
                style={{ marginTop: '0.5rem', fontSize: '1.1rem', opacity: 0.7 }}
              >
                ↓
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Progress bar ──────────────────────────────────────────────────── */}
        <div style={{
          position: 'absolute', bottom: 0, left: 0, right: 0,
          height: 2, background: 'rgba(0,212,255,0.12)', zIndex: 20,
        }}>
          <div
            ref={progressBarRef}
            style={{
              height: '100%', width: '0%',
              background: 'linear-gradient(90deg, #00d4ff, #a855f7)',
              boxShadow: '0 0 8px rgba(0,212,255,0.5)',
              transition: 'width 0.05s linear',
            }}
          />
        </div>

        {/* ── Stage 4: Dashboard panel ──────────────────────────────────────── */}
        <div
          ref={dashPanelRef}
          style={{
            position: 'absolute', right: 0, top: 0, bottom: 0,
            width: '42%', opacity: 0,
            transform: 'translateX(100%)',
            background: 'rgba(0,8,26,0.97)',
            backdropFilter: 'blur(28px)',
            WebkitBackdropFilter: 'blur(28px)',
            borderLeft: '1px solid rgba(0,212,255,0.2)',
            padding: '2rem 1.5rem',
            overflowY: 'auto',
            zIndex: 15,
            pointerEvents: 'none',
          }}
        >
          {/* Panel header */}
          <div style={{ marginBottom: '1.5rem' }}>
            <div style={{
              fontSize: '0.55rem', color: '#00d4ff',
              letterSpacing: '0.38em', fontFamily: 'JetBrains Mono, monospace',
              marginBottom: '0.3rem', opacity: 0.75,
            }}>
              ■ PATHOSENSE ANALYTICS ENGINE
            </div>
            <div style={{
              fontSize: '1.1rem', fontWeight: 700,
              fontFamily: 'Orbitron, sans-serif', color: '#ffffff',
            }}>
              INTELLIGENCE DASHBOARD
            </div>
            <div style={{ height: 1, background: 'linear-gradient(90deg, rgba(0,212,255,0.4), transparent)', marginTop: '0.75rem' }} />
          </div>

          {/* Metrics */}
          {MINI_METRICS.map((m, i) => (
            <div
              key={m.label}
              style={{
                background: 'rgba(0,212,255,0.04)',
                border: '1px solid rgba(0,212,255,0.15)',
                borderRadius: 10,
                padding: '0.85rem 1rem',
                marginBottom: '0.6rem',
              }}
            >
              <div style={{
                fontSize: '0.58rem', color: '#64748b',
                letterSpacing: '0.12em', fontFamily: 'JetBrains Mono, monospace',
                marginBottom: '0.4rem', textTransform: 'uppercase',
              }}>
                {m.label}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                <div style={{
                  fontSize: '1.55rem', fontWeight: 800,
                  fontFamily: 'Orbitron, sans-serif', color: '#ffffff',
                }}>
                  {m.value}
                </div>
                <div style={{
                  fontSize: '0.62rem', fontFamily: 'JetBrains Mono, monospace',
                  color: m.up === true ? '#22c55e' : m.up === false ? '#ef4444' : '#00d4ff',
                  paddingBottom: '0.2rem',
                }}>
                  {m.change}
                </div>
              </div>
            </div>
          ))}

          {/* Transmission routes */}
          <div style={{
            fontSize: '0.58rem', color: '#00d4ff',
            letterSpacing: '0.25em', fontFamily: 'JetBrains Mono, monospace',
            margin: '1rem 0 0.5rem', opacity: 0.75,
          }}>
            ── ACTIVE TRANSMISSION ROUTES
          </div>
          <div style={{
            background: 'rgba(0,212,255,0.03)',
            border: '1px solid rgba(0,212,255,0.12)',
            borderRadius: 10, overflow: 'hidden',
          }}>
            {CONNECTIONS.slice(0, 5).map(([fi, ti], i) => (
              <div
                key={i}
                style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '0.5rem 0.85rem',
                  borderBottom: i < 4 ? '1px solid rgba(0,212,255,0.07)' : 'none',
                }}
              >
                <div style={{ fontSize: '0.62rem', color: '#94a3b8', fontFamily: 'JetBrains Mono, monospace' }}>
                  {HOTSPOTS[fi].name}&nbsp;
                  <span style={{ color: '#00d4ff', opacity: 0.7 }}>→</span>
                  &nbsp;{HOTSPOTS[ti].name}
                </div>
                <div style={{
                  width: 8, height: 8, borderRadius: '50%',
                  background: HOTSPOTS[fi].intensity > 0.85 ? '#ef4444' : '#f97316',
                  boxShadow: `0 0 8px ${HOTSPOTS[fi].intensity > 0.85 ? '#ef4444' : '#f97316'}`,
                }} />
              </div>
            ))}
          </div>

          {/* CTA button */}
          <a
            href="#dashboard"
            style={{
              display: 'block', marginTop: '1.5rem',
              padding: '0.8rem 1.5rem',
              background: 'linear-gradient(135deg, rgba(0,212,255,0.12), rgba(168,85,247,0.08))',
              border: '1px solid rgba(0,212,255,0.35)',
              borderRadius: 10,
              color: '#00d4ff', fontSize: '0.65rem',
              letterSpacing: '0.22em', fontFamily: 'JetBrains Mono, monospace',
              textAlign: 'center', textDecoration: 'none',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              boxShadow: '0 0 20px rgba(0,212,255,0.08)',
            }}
            onMouseEnter={e => {
              (e.target as HTMLElement).style.background = 'linear-gradient(135deg, rgba(0,212,255,0.2), rgba(168,85,247,0.14))';
              (e.target as HTMLElement).style.boxShadow  = '0 0 30px rgba(0,212,255,0.2)';
            }}
            onMouseLeave={e => {
              (e.target as HTMLElement).style.background = 'linear-gradient(135deg, rgba(0,212,255,0.12), rgba(168,85,247,0.08))';
              (e.target as HTMLElement).style.boxShadow  = '0 0 20px rgba(0,212,255,0.08)';
            }}
          >
            OPEN FULL DASHBOARD ↓
          </a>
        </div>

      </div>
    </section>
  );
}

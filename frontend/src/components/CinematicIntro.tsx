'use client';

import { useRef, useEffect } from 'react';
import * as THREE from 'three';

interface Props {
  onComplete: () => void;
}

export default function CinematicIntro({ onComplete }: Props) {
  const mountRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const progressRef = useRef(0);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const W = window.innerWidth;
    const H = window.innerHeight;

    // ── Renderer ──────────────────────────────────────────────────
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setSize(W, H);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x000814, 1);
    mount.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(75, W / H, 0.1, 2000);
    camera.position.z = 300;

    // ── Particle system ───────────────────────────────────────────
    const COUNT = 3000;
    const spherePos   = new Float32Array(COUNT * 3);
    const explodedPos = new Float32Array(COUNT * 3);
    const currentPos  = new Float32Array(COUNT * 3);
    const colors      = new Float32Array(COUNT * 3);

    for (let i = 0; i < COUNT; i++) {
      // Sphere-surface target position
      const theta = Math.random() * Math.PI * 2;
      const phi   = Math.acos(2 * Math.random() - 1);
      const r     = 100;
      const sx = r * Math.sin(phi) * Math.cos(theta);
      const sy = r * Math.sin(phi) * Math.sin(theta);
      const sz = r * Math.cos(phi);
      spherePos[i * 3]     = sx;
      spherePos[i * 3 + 1] = sy;
      spherePos[i * 3 + 2] = sz;

      // Exploded position: same direction but 3–7× farther
      const dist = 3 + Math.random() * 4;
      explodedPos[i * 3]     = sx * dist;
      explodedPos[i * 3 + 1] = sy * dist;
      explodedPos[i * 3 + 2] = sz * dist;

      // Start at exploded
      currentPos[i * 3]     = explodedPos[i * 3];
      currentPos[i * 3 + 1] = explodedPos[i * 3 + 1];
      currentPos[i * 3 + 2] = explodedPos[i * 3 + 2];

      // Colour: cyan → white gradient based on distance from equator
      const t = Math.abs(sy) / r;
      colors[i * 3]     = 0 + t * 0.6;   // R
      colors[i * 3 + 1] = 0.7 + t * 0.3; // G
      colors[i * 3 + 2] = 1.0;            // B (always 1)
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(currentPos, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const material = new THREE.PointsMaterial({
      vertexColors: true,
      size: 2.2,
      transparent: true,
      opacity: 0.8,
      sizeAttenuation: true,
    });

    const particleMesh = new THREE.Points(geometry, material);
    scene.add(particleMesh);

    // ── Starfield ─────────────────────────────────────────────────
    const starCount = 1800;
    const starPositions = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi   = Math.acos(2 * Math.random() - 1);
      const r     = 600 + Math.random() * 400;
      starPositions[i * 3]     = r * Math.sin(phi) * Math.cos(theta);
      starPositions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      starPositions[i * 3 + 2] = r * Math.cos(phi);
    }
    const starGeo = new THREE.BufferGeometry();
    starGeo.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
    const stars = new THREE.Points(
      starGeo,
      new THREE.PointsMaterial({ color: 0xd0e8ff, size: 0.9, transparent: true, opacity: 0.45, sizeAttenuation: false })
    );
    scene.add(stars);

    // ── Animation loop ────────────────────────────────────────────
    let animId: number;
    let fading = false;
    let fadeProgress = 0;
    let completed = false;

    const easeInOut = (t: number) => t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;

    const tick = () => {
      if (completed) return;
      animId = requestAnimationFrame(tick);

      const p = Math.min(1, progressRef.current);
      const eased = easeInOut(p);

      // Lerp each particle from exploded → sphere
      for (let i = 0; i < COUNT; i++) {
        currentPos[i * 3]     = explodedPos[i * 3]     + (spherePos[i * 3]     - explodedPos[i * 3])     * eased;
        currentPos[i * 3 + 1] = explodedPos[i * 3 + 1] + (spherePos[i * 3 + 1] - explodedPos[i * 3 + 1]) * eased;
        currentPos[i * 3 + 2] = explodedPos[i * 3 + 2] + (spherePos[i * 3 + 2] - explodedPos[i * 3 + 2]) * eased;
      }
      geometry.attributes.position.needsUpdate = true;

      // Slow rotation for cinematic feel
      particleMesh.rotation.y += 0.0015;
      stars.rotation.y += 0.0003;

      // Trigger fade once fully converged
      if (p >= 1 && !fading) {
        fading = true;
      }

      if (fading) {
        fadeProgress += 0.012;
        material.opacity = Math.max(0, 0.8 - fadeProgress);
        if (overlayRef.current) {
          overlayRef.current.style.opacity = String(Math.max(0, 1 - fadeProgress));
        }
        if (fadeProgress >= 1) {
          completed = true;
          cancelAnimationFrame(animId);
          onCompleteRef.current();
          return;
        }
      }

      renderer.render(scene, camera);
    };

    tick();

    // ── Input handlers ────────────────────────────────────────────
    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      progressRef.current = Math.min(1, progressRef.current + Math.abs(e.deltaY) * 0.0014);
    };
    window.addEventListener('wheel', handleWheel, { passive: false });

    // Touch swipe up to converge
    let lastTouchY = 0;
    const handleTouchStart = (e: TouchEvent) => { lastTouchY = e.touches[0].clientY; };
    const handleTouchMove  = (e: TouchEvent) => {
      const dy = lastTouchY - e.touches[0].clientY;
      lastTouchY = e.touches[0].clientY;
      progressRef.current = Math.min(1, progressRef.current + dy * 0.004);
    };
    window.addEventListener('touchstart', handleTouchStart);
    window.addEventListener('touchmove',  handleTouchMove);

    // Any key press skips to converged
    const handleKey = () => { progressRef.current = 1; };
    window.addEventListener('keydown', handleKey);

    const handleResize = () => {
      const w = window.innerWidth, h = window.innerHeight;
      renderer.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    window.addEventListener('resize', handleResize);

    return () => {
      completed = true;
      cancelAnimationFrame(animId);
      window.removeEventListener('wheel', handleWheel);
      window.removeEventListener('touchstart', handleTouchStart);
      window.removeEventListener('touchmove',  handleTouchMove);
      window.removeEventListener('keydown', handleKey);
      window.removeEventListener('resize', handleResize);
      if (mount.contains(renderer.domElement)) mount.removeChild(renderer.domElement);
      renderer.dispose();
      geometry.dispose();
      material.dispose();
    };
  }, []);

  return (
    <div
      ref={overlayRef}
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: '#000814',
        fontFamily: 'Inter, -apple-system, sans-serif',
      }}
    >
      {/* Three.js canvas mount point */}
      <div ref={mountRef} style={{ position: 'absolute', inset: 0 }} />

      {/* Title — top-center */}
      <div style={{
        position: 'absolute',
        top: '38%', left: '50%',
        transform: 'translate(-50%, -50%)',
        textAlign: 'center',
        pointerEvents: 'none',
        zIndex: 1,
      }}>
        <div style={{
          fontSize: 'clamp(1.4rem, 4vw, 2.4rem)',
          fontWeight: 200,
          letterSpacing: '0.55em',
          color: 'rgba(0,212,255,0.92)',
          textTransform: 'uppercase',
          marginBottom: '0.6rem',
        }}>
          CosmoSentinel
        </div>
        <div style={{
          fontSize: '0.62rem',
          letterSpacing: '0.32em',
          color: 'rgba(0,140,180,0.55)',
          textTransform: 'uppercase',
        }}>
          Global Disease Intelligence
        </div>
      </div>

      {/* Scroll hint — bottom-center */}
      <div style={{
        position: 'absolute',
        bottom: 52, left: '50%',
        transform: 'translateX(-50%)',
        textAlign: 'center',
        pointerEvents: 'none',
        zIndex: 1,
      }}>
        <div style={{
          fontSize: '0.58rem',
          color: 'rgba(0,160,220,0.5)',
          letterSpacing: '0.28em',
          textTransform: 'uppercase',
          marginBottom: 10,
          animation: 'cosmoP 2s ease-in-out infinite',
        }}>
          Scroll to initialise
        </div>
        <div style={{
          fontSize: '0.95rem',
          color: 'rgba(0,160,220,0.35)',
          animation: 'cosmoB 1.6s ease-in-out infinite',
        }}>
          ↓
        </div>
      </div>

      <style>{`
        @keyframes cosmoP { 0%,100%{opacity:0.35} 50%{opacity:1} }
        @keyframes cosmoB { 0%,100%{transform:translateY(0)} 50%{transform:translateY(7px)} }
      `}</style>
    </div>
  );
}

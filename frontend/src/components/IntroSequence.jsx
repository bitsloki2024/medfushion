'use client';

import { useRef, useEffect } from 'react';

/**
 * IntroSequence — 2D Canvas particle globe intro
 *
 * Phase 1: Exploded particle sphere auto-rotates + breathes
 * Phase 2: User scrolls → particles converge toward globe position
 * Phase 3: Fade out → handoff to existing Three.js globe
 */
export default function IntroSequence({ onComplete }) {
  const canvasRef  = useRef(null);
  const labelsRef  = useRef(null);
  const stateRef   = useRef({
    particles:     [],
    rotAngle:      0,
    scrollAccum:   0,
    progress:      0,
    phase:         1,   // 1 = rotating, 2 = converging, 3 = done
    animId:        null,
    startTime:     null,
    globeTarget:   null, // { x, y, r, canvas }
  });
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    const W = window.innerWidth;
    const H = window.innerHeight;
    canvas.width  = W;
    canvas.height = H;

    const state      = stateRef.current;
    state.startTime  = performance.now();

    // ─────────────────────────────────────────────────────────
    // PRE-CALCULATE PARTICLE DATA
    // ─────────────────────────────────────────────────────────
    const COUNT = 2500;
    const R     = 160;
    const particles = [];

    for (let i = 0; i < COUNT; i++) {
      // Uniform sphere surface
      const phi   = Math.acos(2 * Math.random() - 1);
      const theta = Math.random() * Math.PI * 2;

      // Rest position (sphere surface at R=160)
      const restX = R * Math.sin(phi) * Math.cos(theta);
      const restY = R * Math.cos(phi);
      const restZ = R * Math.sin(phi) * Math.sin(theta);

      // Exploded start position
      const scatter = 1.8 + Math.random() * 2.2;   // 1.8 – 4.0
      const initX   = restX * scatter + (Math.random() - 0.5) * 60;
      const initY   = restY * scatter + (Math.random() - 0.5) * 60;
      const initZ   = restZ * scatter + (Math.random() - 0.5) * 60;

      // Visual size
      const rndSz = Math.random();
      const size  = rndSz < 0.8
        ? 0.5 + Math.random() * 0.5   // 80% small: 0.5–1.0
        : 1.0 + Math.random() * 0.8;  // 20% large: 1.0–1.8

      // Color — match existing site star palette
      const rndC  = Math.random();
      const color = rndC < 0.70 ? '#c8dff0'
                  : rndC < 0.90 ? '#e8f4ff'
                  : '#88aacc';

      const opacity    = 0.6 + Math.random() * 0.4;
      const driftSpeed = 0.4 + Math.random() * 0.8;
      const driftOff   = Math.random() * Math.PI * 2;

      particles.push({ restX, restY, restZ, initX, initY, initZ, size, color, opacity, driftSpeed, driftOff });
    }
    state.particles = particles;

    // ─────────────────────────────────────────────────────────
    // FIND THREE.JS GLOBE CANVAS (for phase-2 target position)
    // ─────────────────────────────────────────────────────────
    const findGlobeCanvas = () => {
      // react-globe.gl renders a <canvas> inside its container
      const canvases = Array.from(document.querySelectorAll('canvas'));
      const threeCanvas = canvases.find(c => c !== canvas && c.id !== 'intro-canvas');
      if (!threeCanvas) return null;
      const rect = threeCanvas.getBoundingClientRect();
      return {
        x:      rect.left + rect.width  / 2,
        y:      rect.top  + rect.height / 2,
        r:      Math.min(rect.width, rect.height) * 0.36,
        canvas: threeCanvas,
      };
    };

    // ─────────────────────────────────────────────────────────
    // ANIMATION LOOP
    // ─────────────────────────────────────────────────────────
    const PERSPECTIVE = 500;

    const draw = (now) => {
      const time    = (now - state.startTime) / 1000;
      const { progress } = state;
      const ease    = Math.pow(progress, 0.55);

      // Lazily resolve globe target when converging starts
      if (state.phase === 2 && !state.globeTarget) {
        state.globeTarget = findGlobeCanvas();
        // Set Three.js canvas opacity to 0 initially during convergence
        if (state.globeTarget?.canvas) {
          state.globeTarget.canvas.style.opacity = '0';
        }
      }

      const tgt = state.globeTarget;

      // Lerped sphere center and radius
      const targetX = tgt ? tgt.x : W / 2;
      const targetY = tgt ? tgt.y : H / 2;
      const targetR = tgt ? tgt.r : R;

      const centerX  = W / 2 + (targetX - W / 2) * ease;
      const centerY  = H / 2 + (targetY - H / 2) * ease;
      const currentR = R + (targetR - R) * ease;
      const rScale   = currentR / R;   // scale particle positions

      // Rotation slows as convergence progresses
      const rotSpeed = 0.003 * (1 - progress * 0.65);
      state.rotAngle += rotSpeed;
      const angle = state.rotAngle;

      // Breathing fades out during convergence
      const breathStrength = 1.5 * (1 - progress);

      // Reveal Three.js canvas as convergence nears completion
      if (tgt?.canvas) {
        const threeOpacity = Math.max(0, (progress - 0.4) / 0.6);
        tgt.canvas.style.opacity = String(threeOpacity);
      }

      // Draw background
      ctx.fillStyle = '#020a18';
      ctx.fillRect(0, 0, W, H);

      // Draw particles
      for (const p of particles) {
        // Lerp from exploded init toward scaled rest position
        const scaledRestX = p.restX * rScale;
        const scaledRestY = p.restY * rScale;
        const scaledRestZ = p.restZ * rScale;

        const lerpX = p.initX + (scaledRestX - p.initX) * ease;
        const lerpY = p.initY + (scaledRestY - p.initY) * ease;
        const lerpZ = p.initZ + (scaledRestZ - p.initZ) * ease;

        // Y-axis rotation
        const rotX = lerpX * Math.cos(angle) - lerpZ * Math.sin(angle);
        const rotZ = lerpX * Math.sin(angle) + lerpZ * Math.cos(angle);
        const rotY = lerpY + Math.sin(time * p.driftSpeed + p.driftOff) * breathStrength * rScale;

        // Perspective projection
        const pScale  = PERSPECTIVE / (PERSPECTIVE + rotZ);
        const screenX = centerX + rotX * pScale;
        const screenY = centerY + rotY * pScale;

        // Depth-based dimming for back particles
        const depthFactor = rotZ < 0 ? pScale * 0.85 : 1.0;
        const radius      = Math.max(0.3, p.size * pScale * depthFactor);
        // Opacity blends toward brighter as particles converge
        const opacity     = (p.opacity * depthFactor) * (0.9 * ease + 1.0 * (1 - ease));

        ctx.beginPath();
        ctx.arc(screenX, screenY, radius, 0, Math.PI * 2);
        ctx.fillStyle   = p.color;
        ctx.globalAlpha = Math.min(1, opacity);
        ctx.fill();
      }
      ctx.globalAlpha = 1;

      if (state.phase < 3) {
        state.animId = requestAnimationFrame(draw);
      }
    };

    state.animId = requestAnimationFrame(draw);

    // ─────────────────────────────────────────────────────────
    // WHEEL HANDLER — drives Phase 2 convergence
    // ─────────────────────────────────────────────────────────
    const onWheel = (e) => {
      e.preventDefault();
      if (state.phase === 3) return;

      state.phase       = 2;
      state.scrollAccum += Math.abs(e.deltaY);
      state.progress    = Math.min(1.0, state.scrollAccum / 900);

      if (state.progress >= 1.0 && state.phase !== 3) {
        state.phase = 3;

        // Fade out intro overlay
        if (canvas) {
          canvas.style.transition = 'opacity 0.5s ease';
          canvas.style.opacity    = '0';
        }
        if (labelsRef.current) {
          labelsRef.current.style.transition = 'opacity 0.5s ease';
          labelsRef.current.style.opacity    = '0';
        }

        // Ensure Three.js canvas is fully opaque
        if (state.globeTarget?.canvas) {
          state.globeTarget.canvas.style.opacity    = '1';
          state.globeTarget.canvas.style.transition = 'opacity 0.3s ease';
        }

        setTimeout(() => {
          if (state.animId) cancelAnimationFrame(state.animId);
          onCompleteRef.current();
        }, 600);
      }
    };

    window.addEventListener('wheel', onWheel, { passive: false });

    // ─────────────────────────────────────────────────────────
    // CLEANUP
    // ─────────────────────────────────────────────────────────
    return () => {
      if (state.animId) cancelAnimationFrame(state.animId);
      window.removeEventListener('wheel', onWheel);
      // Restore any Three.js canvas opacity we may have altered
      if (state.globeTarget?.canvas) {
        state.globeTarget.canvas.style.opacity = '';
      }
    };
  }, []);

  return (
    <>
      {/* Full-screen 2D canvas overlay */}
      <canvas
        id="intro-canvas"
        ref={canvasRef}
        style={{
          position:   'fixed',
          inset:      0,
          zIndex:     9999,
          width:      '100vw',
          height:     '100vh',
          background: '#020a18',
          display:    'block',
        }}
      />

      {/* Corner label — same font as site header */}
      <div
        ref={labelsRef}
        style={{
          position:      'fixed',
          bottom:        24,
          right:         24,
          zIndex:        10000,
          textAlign:     'right',
          pointerEvents: 'none',
          userSelect:    'none',
        }}
      >
        <div style={{
          fontFamily:    'Inter, -apple-system, sans-serif',
          fontSize:      13,
          letterSpacing: '1px',
          color:         'rgba(150,200,255,0.55)',
          marginBottom:  4,
        }}>
          CosmoSentinel
        </div>
        <div style={{
          fontFamily: 'Inter, -apple-system, sans-serif',
          fontSize:   10,
          color:      'rgba(100,150,200,0.35)',
        }}>
          Global Disease Intelligence
        </div>
        <div style={{
          marginTop:     14,
          fontSize:      10,
          color:         'rgba(80,130,190,0.45)',
          letterSpacing: '0.22em',
          textTransform: 'uppercase',
        }}>
          ↓ Scroll to enter
        </div>
      </div>
    </>
  );
}

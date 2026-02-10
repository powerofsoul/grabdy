import { useEffect, useRef } from 'react';

import { useTheme } from '@mui/material';

interface Particle {
  x: number;
  y: number;
  vy: number;
  vx: number;
  radius: number;
  baseOpacity: number;
  pulse: number;
  side: 'left' | 'right';
}

function hexToRgb(hex: string): [number, number, number] {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return [139, 105, 20];
  return [parseInt(result[1], 16), parseInt(result[2], 16), parseInt(result[3], 16)];
}

function createParticles(width: number, height: number, count: number): Particle[] {
  const marginWidth = width * 0.13;
  const particles: Particle[] = [];

  for (let i = 0; i < count; i++) {
    const side: 'left' | 'right' = i < count / 2 ? 'left' : 'right';
    particles.push({
      x:
        side === 'left'
          ? Math.random() * marginWidth
          : width - marginWidth + Math.random() * marginWidth,
      y: Math.random() * height,
      vy: -(0.12 + Math.random() * 0.25),
      vx: (Math.random() - 0.5) * 0.1,
      radius: 1.5 + Math.random() * 3,
      baseOpacity: 0.03 + Math.random() * 0.07,
      pulse: 0,
      side,
    });
  }

  return particles;
}

function runAnimation(
  canvas: HTMLCanvasElement,
  ctx: CanvasRenderingContext2D,
  color: [number, number, number],
): () => void {
  const dpr = window.devicePixelRatio || 1;
  const [pr, pg, pb] = color;
  const CONNECTION_DIST = 120;
  const PARTICLE_COUNT = 45;

  let width = 0;
  let height = 0;
  let particles: Particle[] = [];
  let running = true;
  let animId = 0;

  function resize() {
    width = window.innerWidth;
    height = window.innerHeight;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    particles = width >= 1200 ? createParticles(width, height, PARTICLE_COUNT) : [];
  }

  function animate() {
    if (!running) return;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);

    if (particles.length === 0) {
      animId = requestAnimationFrame(animate);
      return;
    }

    const marginWidth = width * 0.13;

    // Update particles
    for (const p of particles) {
      p.y += p.vy;
      p.x += p.vx;
      if (p.y < -20) p.y = height + 20;

      if (p.side === 'left') {
        if (p.x < 0) p.vx = Math.abs(p.vx);
        if (p.x > marginWidth) p.vx = -Math.abs(p.vx);
      } else {
        if (p.x < width - marginWidth) p.vx = Math.abs(p.vx);
        if (p.x > width) p.vx = -Math.abs(p.vx);
      }

      // Random processing pulse
      if (Math.random() < 0.001) p.pulse = 1;
      if (p.pulse > 0) p.pulse *= 0.96;
      if (p.pulse < 0.01) p.pulse = 0;
    }

    // Draw connections (same side only)
    ctx.lineWidth = 0.5;
    for (let i = 0; i < particles.length; i++) {
      for (let j = i + 1; j < particles.length; j++) {
        if (particles[i].side !== particles[j].side) continue;
        const dx = particles[i].x - particles[j].x;
        const dy = particles[i].y - particles[j].y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < CONNECTION_DIST) {
          const opacity = 0.05 * (1 - dist / CONNECTION_DIST);
          ctx.beginPath();
          ctx.moveTo(particles[i].x, particles[i].y);
          ctx.lineTo(particles[j].x, particles[j].y);
          ctx.strokeStyle = `rgba(${pr},${pg},${pb},${opacity})`;
          ctx.stroke();
        }
      }
    }

    // Draw particles
    for (const p of particles) {
      const opacity = p.baseOpacity + p.pulse * 0.25;
      const radius = p.radius + p.pulse * 4;

      // Glow on pulse
      if (p.pulse > 0.1) {
        const grad = ctx.createRadialGradient(p.x, p.y, radius, p.x, p.y, radius + 10);
        grad.addColorStop(0, `rgba(${pr},${pg},${pb},${p.pulse * 0.08})`);
        grad.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.beginPath();
        ctx.arc(p.x, p.y, radius + 10, 0, Math.PI * 2);
        ctx.fillStyle = grad;
        ctx.fill();
      }

      ctx.beginPath();
      ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${pr},${pg},${pb},${opacity})`;
      ctx.fill();
    }

    animId = requestAnimationFrame(animate);
  }

  resize();
  animate();
  window.addEventListener('resize', resize);

  return () => {
    running = false;
    cancelAnimationFrame(animId);
    window.removeEventListener('resize', resize);
  };
}

export function ProcessingAnimation() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const theme = useTheme();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const color = hexToRgb(theme.palette.primary.main);
    return runAnimation(canvas, ctx, color);
  }, [theme]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        pointerEvents: 'none',
        zIndex: 0,
      }}
    />
  );
}

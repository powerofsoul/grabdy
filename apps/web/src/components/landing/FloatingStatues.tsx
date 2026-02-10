import { useEffect, useRef } from 'react';

import { Box, useTheme } from '@mui/material';
import gsap from 'gsap';

/**
 * Classical SVG silhouettes that float gently around the hero text.
 * Hidden on mobile (xs) to avoid clutter.
 */

function IonicColumn({ color }: { color: string }) {
  return (
    <svg width="32" height="80" viewBox="0 0 32 80" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Capital — volute scrolls */}
      <ellipse cx="4" cy="8" rx="4" ry="4" fill={color} />
      <ellipse cx="28" cy="8" rx="4" ry="4" fill={color} />
      <rect x="3" y="6" width="26" height="4" rx="1" fill={color} />
      {/* Abacus */}
      <rect x="1" y="12" width="30" height="3" rx="0.5" fill={color} />
      {/* Shaft with fluting hint */}
      <rect x="6" y="15" width="20" height="52" rx="1" fill={color} />
      <line x1="11" y1="17" x2="11" y2="65" stroke="white" strokeOpacity="0.15" strokeWidth="0.5" />
      <line x1="16" y1="17" x2="16" y2="65" stroke="white" strokeOpacity="0.15" strokeWidth="0.5" />
      <line x1="21" y1="17" x2="21" y2="65" stroke="white" strokeOpacity="0.15" strokeWidth="0.5" />
      {/* Base */}
      <rect x="4" y="67" width="24" height="3" rx="0.5" fill={color} />
      <rect x="2" y="70" width="28" height="3" rx="0.5" fill={color} />
      <rect x="0" y="73" width="32" height="4" rx="0.5" fill={color} />
    </svg>
  );
}

function LaurelBranch({ color }: { color: string }) {
  return (
    <svg width="48" height="48" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Left branch */}
      <path d="M24 44 C20 36, 8 30, 6 18" stroke={color} strokeWidth="1.5" fill="none" />
      <ellipse cx="10" cy="28" rx="5" ry="3" transform="rotate(-30 10 28)" fill={color} />
      <ellipse cx="8" cy="22" rx="4.5" ry="2.5" transform="rotate(-40 8 22)" fill={color} />
      <ellipse cx="14" cy="33" rx="4" ry="2.5" transform="rotate(-20 14 33)" fill={color} />
      <ellipse cx="18" cy="37" rx="3.5" ry="2" transform="rotate(-10 18 37)" fill={color} />
      {/* Right branch */}
      <path d="M24 44 C28 36, 40 30, 42 18" stroke={color} strokeWidth="1.5" fill="none" />
      <ellipse cx="38" cy="28" rx="5" ry="3" transform="rotate(30 38 28)" fill={color} />
      <ellipse cx="40" cy="22" rx="4.5" ry="2.5" transform="rotate(40 40 22)" fill={color} />
      <ellipse cx="34" cy="33" rx="4" ry="2.5" transform="rotate(20 34 33)" fill={color} />
      <ellipse cx="30" cy="37" rx="3.5" ry="2" transform="rotate(10 30 37)" fill={color} />
    </svg>
  );
}

function BustSilhouette({ color }: { color: string }) {
  return (
    <svg width="48" height="64" viewBox="0 0 48 64" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Head */}
      <ellipse cx="24" cy="16" rx="10" ry="13" fill={color} />
      {/* Neck */}
      <rect x="20" y="28" width="8" height="8" rx="2" fill={color} />
      {/* Shoulders */}
      <path d="M12 36 Q16 34, 20 36 L28 36 Q32 34, 36 36 L42 44 Q44 48, 40 50 L8 50 Q4 48, 6 44 Z" fill={color} />
      {/* Pedestal */}
      <rect x="6" y="50" width="36" height="4" rx="1" fill={color} />
      <rect x="4" y="54" width="40" height="3" rx="0.5" fill={color} />
      <rect x="2" y="57" width="44" height="4" rx="1" fill={color} />
    </svg>
  );
}

function Amphora({ color }: { color: string }) {
  return (
    <svg width="32" height="56" viewBox="0 0 32 56" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Lip */}
      <rect x="10" y="0" width="12" height="3" rx="1" fill={color} />
      {/* Neck */}
      <path d="M12 3 Q12 8, 14 12 L18 12 Q20 8, 20 3" fill={color} />
      {/* Handles */}
      <path d="M12 8 Q4 12, 6 22 Q8 26, 12 24" stroke={color} strokeWidth="2" fill="none" />
      <path d="M20 8 Q28 12, 26 22 Q24 26, 20 24" stroke={color} strokeWidth="2" fill="none" />
      {/* Body */}
      <path d="M12 12 Q6 20, 6 32 Q6 44, 12 48 L20 48 Q26 44, 26 32 Q26 20, 20 12 Z" fill={color} />
      {/* Foot */}
      <rect x="10" y="48" width="12" height="3" rx="0.5" fill={color} />
      <rect x="8" y="51" width="16" height="3" rx="1" fill={color} />
    </svg>
  );
}

function OpenBook({ color }: { color: string }) {
  return (
    <svg width="56" height="40" viewBox="0 0 56 40" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Left page */}
      <path d="M28 6 Q22 4, 4 6 L4 36 Q22 34, 28 36 Z" fill={color} />
      {/* Right page */}
      <path d="M28 6 Q34 4, 52 6 L52 36 Q34 34, 28 36 Z" fill={color} />
      {/* Spine shadow */}
      <line x1="28" y1="6" x2="28" y2="36" stroke="white" strokeOpacity="0.15" strokeWidth="0.75" />
      {/* Left page lines */}
      <line x1="10" y1="12" x2="24" y2="11" stroke="white" strokeOpacity="0.1" strokeWidth="0.5" />
      <line x1="10" y1="17" x2="24" y2="16" stroke="white" strokeOpacity="0.1" strokeWidth="0.5" />
      <line x1="10" y1="22" x2="24" y2="21" stroke="white" strokeOpacity="0.1" strokeWidth="0.5" />
      <line x1="10" y1="27" x2="24" y2="26" stroke="white" strokeOpacity="0.1" strokeWidth="0.5" />
      {/* Right page lines */}
      <line x1="32" y1="11" x2="46" y2="12" stroke="white" strokeOpacity="0.1" strokeWidth="0.5" />
      <line x1="32" y1="16" x2="46" y2="17" stroke="white" strokeOpacity="0.1" strokeWidth="0.5" />
      <line x1="32" y1="21" x2="46" y2="22" stroke="white" strokeOpacity="0.1" strokeWidth="0.5" />
      <line x1="32" y1="26" x2="46" y2="27" stroke="white" strokeOpacity="0.1" strokeWidth="0.5" />
    </svg>
  );
}

function BookStack({ color }: { color: string }) {
  return (
    <svg width="44" height="52" viewBox="0 0 44 52" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Bottom book — thick, slightly rotated */}
      <rect x="2" y="36" width="38" height="10" rx="1.5" fill={color} transform="rotate(-3 2 36)" />
      <line x1="6" y1="41" x2="6" y2="46" stroke="white" strokeOpacity="0.12" strokeWidth="0.5" transform="rotate(-3 2 36)" />
      {/* Middle book */}
      <rect x="5" y="24" width="36" height="9" rx="1.5" fill={color} transform="rotate(2 5 24)" />
      <line x1="9" y1="28.5" x2="9" y2="33" stroke="white" strokeOpacity="0.12" strokeWidth="0.5" transform="rotate(2 5 24)" />
      {/* Top book — thinner */}
      <rect x="4" y="14" width="34" height="7" rx="1" fill={color} transform="rotate(-1 4 14)" />
      <line x1="8" y1="17.5" x2="8" y2="21" stroke="white" strokeOpacity="0.12" strokeWidth="0.5" transform="rotate(-1 4 14)" />
      {/* Topmost slim book */}
      <rect x="8" y="7" width="28" height="5" rx="1" fill={color} transform="rotate(4 8 7)" />
    </svg>
  );
}

interface FloatingItem {
  El: typeof IonicColumn;
  top: string;
  left?: string;
  right?: string;
  rotate: number;
  scale: number;
  floatY: number;
  floatDuration: number;
  delay: number;
}

const ITEMS: FloatingItem[] = [
  { El: IonicColumn, top: '5%', left: '4%', rotate: -6, scale: 1.8, floatY: 14, floatDuration: 6, delay: 0 },
  { El: BustSilhouette, top: '12%', right: '5%', rotate: 4, scale: 1.6, floatY: 12, floatDuration: 7, delay: 0.5 },
  { El: OpenBook, top: '32%', left: '5%', rotate: -5, scale: 1.9, floatY: 10, floatDuration: 6.2, delay: 0.7 },
  { El: BookStack, top: '28%', right: '4%', rotate: 6, scale: 1.7, floatY: 13, floatDuration: 7.2, delay: 0.2 },
  { El: LaurelBranch, top: '50%', left: '6%', rotate: -12, scale: 2, floatY: 10, floatDuration: 5.5, delay: 1 },
  { El: Amphora, top: '45%', right: '4%', rotate: 8, scale: 1.7, floatY: 16, floatDuration: 6.5, delay: 0.3 },
  { El: OpenBook, top: '65%', right: '6%', rotate: -8, scale: 1.5, floatY: 9, floatDuration: 5.8, delay: 0.9 },
  { El: IonicColumn, top: '72%', left: '3%', rotate: 3, scale: 1.4, floatY: 12, floatDuration: 7.5, delay: 0.8 },
  { El: BookStack, top: '80%', left: '7%', rotate: -4, scale: 1.3, floatY: 11, floatDuration: 6.8, delay: 1.1 },
  { El: LaurelBranch, top: '75%', right: '6%', rotate: 15, scale: 1.5, floatY: 11, floatDuration: 5, delay: 1.2 },
];

export function FloatingStatues() {
  const theme = useTheme();
  const containerRef = useRef<HTMLDivElement>(null);

  const color =
    theme.palette.mode === 'dark'
      ? 'rgba(255,255,255,0.12)'
      : 'rgba(0,0,0,0.08)';

  useEffect(() => {
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion || !containerRef.current) return;

    const ctx = gsap.context(() => {
      // Fade in
      gsap.fromTo('.floating-statue',
        { opacity: 0 },
        { opacity: 1, duration: 1.5, stagger: 0.2, ease: 'power2.out' },
      );

      // Continuous gentle float
      containerRef.current?.querySelectorAll('.floating-statue').forEach((el, i) => {
        const item = ITEMS[i];
        if (!item) return;
        gsap.to(el, {
          y: item.floatY,
          duration: item.floatDuration,
          repeat: -1,
          yoyo: true,
          ease: 'sine.inOut',
          delay: item.delay,
        });
      });
    }, containerRef);

    return () => ctx.revert();
  }, []);

  return (
    <Box
      ref={containerRef}
      sx={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        display: { xs: 'none', md: 'block' },
        zIndex: 0,
      }}
    >
      {ITEMS.map((item, i) => (
        <Box
          key={i}
          className="floating-statue"
          sx={{
            position: 'absolute',
            top: item.top,
            left: item.left,
            right: item.right,
            transform: `rotate(${item.rotate}deg) scale(${item.scale})`,
          }}
        >
          <item.El color={color} />
        </Box>
      ))}
    </Box>
  );
}

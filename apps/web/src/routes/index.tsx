import { useEffect, useRef } from 'react';

import { Box } from '@mui/material';
import { createFileRoute } from '@tanstack/react-router';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';

import { CTASection } from '@/components/landing/CTASection';
import { FeaturesScrollSection } from '@/components/landing/features-scroll';
import { Footer } from '@/components/landing/Footer';
import { HeroSection } from '@/components/landing/hero';
import { LandingNav } from '@/components/landing/LandingNav';
import { PricingSection } from '@/components/landing/PricingSection';

gsap.registerPlugin(ScrollTrigger);

export const Route = createFileRoute('/')({
  component: LandingPage,
});

function LandingPage() {
  const lenisRef = useRef<Lenis | null>(null);

  useEffect(() => {
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) return;

    const lenis = new Lenis({
      duration: 1.2,
      easing: (t: number) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      touchMultiplier: 2,
    });
    lenisRef.current = lenis;

    // Sync Lenis with GSAP ScrollTrigger
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add((time) => lenis.raf(time * 1000));
    gsap.ticker.lagSmoothing(0);

    return () => {
      gsap.ticker.remove(lenis.raf);
      lenis.destroy();
    };
  }, []);

  return (
    <Box sx={{ position: 'relative', zIndex: 1 }}>
      <LandingNav />
      <HeroSection />
      <FeaturesScrollSection />
      <PricingSection />
      <CTASection />
      <Footer />
    </Box>
  );
}

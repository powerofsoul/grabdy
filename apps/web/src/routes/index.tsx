import { useEffect, useRef } from 'react';

import { Box } from '@mui/material';
import { createFileRoute } from '@tanstack/react-router';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';

import { CTASection } from '@/components/landing/CTASection';
import { DevTeaserSection } from '@/components/landing/DevTeaserSection';
import { FeaturesSection } from '@/components/landing/FeaturesSection';
import { Footer } from '@/components/landing/Footer';
import { HeroSection } from '@/components/landing/hero';
import { LandingNav } from '@/components/landing/LandingNav';
import { McpSection } from '@/components/landing/McpSection';
import { PricingSection } from '@/components/landing/PricingSection';
import { WhatYouCanAskSection } from '@/components/landing/WhatYouCanAskSection';

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
      <WhatYouCanAskSection />
      <FeaturesSection />
      <PricingSection />
      <DevTeaserSection />
      <McpSection />
      <CTASection />
      <Footer />
    </Box>
  );
}

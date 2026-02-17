import { Box } from '@mui/material';
import { createFileRoute } from '@tanstack/react-router';

import { CTASection } from '@/components/landing/CTASection';
import { DevTeaserSection } from '@/components/landing/DevTeaserSection';
import { FeaturesSection } from '@/components/landing/FeaturesSection';
import { Footer } from '@/components/landing/Footer';
import { HeroSection } from '@/components/landing/hero';
import { LandingNav } from '@/components/landing/LandingNav';
import { McpSection } from '@/components/landing/McpSection';
import { PricingSection } from '@/components/landing/PricingSection';
import { SlackBotSection } from '@/components/landing/SlackBotSection';
import { ProofStripSection } from '@/components/landing/ProofStripSection';

import { WhatYouCanAskSection } from '@/components/landing/WhatYouCanAskSection';

export const Route = createFileRoute('/')({
  component: LandingPage,
});

function LandingPage() {
  return (
    <Box sx={{ position: 'relative', zIndex: 1 }}>
      <LandingNav />
      <HeroSection />
      <ProofStripSection />
      <WhatYouCanAskSection />
      <FeaturesSection />
      <SlackBotSection />
      <PricingSection />
      <DevTeaserSection />
      <McpSection />
      <CTASection />
      <Footer />
    </Box>
  );
}

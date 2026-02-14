import { Box } from '@mui/material';
import { createFileRoute } from '@tanstack/react-router';

import { CTASection } from '@/components/landing/CTASection';
import { DevTeaserSection } from '@/components/landing/DevTeaserSection';
import { FeaturesSection } from '@/components/landing/FeaturesSection';
import { McpSection } from '@/components/landing/McpSection';
import { PricingSection } from '@/components/landing/PricingSection';
import { Footer } from '@/components/landing/Footer';
import { HeroSection } from '@/components/landing/HeroSection';
import { LandingNav } from '@/components/landing/LandingNav';
import { ProofStripSection } from '@/components/landing/ProofStripSection';
import { WaitlistProvider } from '@/components/landing/WaitlistModal';
import { WhatYouCanAskSection } from '@/components/landing/WhatYouCanAskSection';

export const Route = createFileRoute('/')({
  component: LandingPage,
});

function LandingPage() {
  return (
    <WaitlistProvider>
      <Box sx={{ position: 'relative', zIndex: 1 }}>
        <LandingNav />
        <HeroSection />
        <ProofStripSection />
        <WhatYouCanAskSection />
        <FeaturesSection />
        <PricingSection />
        <DevTeaserSection />
        <McpSection />
        <CTASection />
        <Footer />
      </Box>
    </WaitlistProvider>
  );
}

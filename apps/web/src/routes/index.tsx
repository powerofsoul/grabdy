import { Box } from '@mui/material';
import { createFileRoute } from '@tanstack/react-router';

import { CTASection } from '@/components/landing/CTASection';
import { DevTeaserSection } from '@/components/landing/DevTeaserSection';
import { FeaturesSection } from '@/components/landing/FeaturesSection';
import { Footer } from '@/components/landing/Footer';
import { HeroSection } from '@/components/landing/HeroSection';
import { LandingNav } from '@/components/landing/LandingNav';
import { ProcessingAnimation } from '@/components/landing/ProcessingAnimation';
import { ProofStripSection } from '@/components/landing/ProofStripSection';
import { SectionDivider } from '@/components/landing/SectionDivider';
import { WhatYouCanAskSection } from '@/components/landing/WhatYouCanAskSection';

export const Route = createFileRoute('/')({
  component: LandingPage,
});

function LandingPage() {
  return (
    <>
      <ProcessingAnimation />
      <Box sx={{ position: 'relative', zIndex: 1 }}>
        <LandingNav />
        <HeroSection />
        <ProofStripSection />
        <SectionDivider />
        <WhatYouCanAskSection />
        <SectionDivider glyph="&sect;" />
        <FeaturesSection />
        <SectionDivider />
        <DevTeaserSection />
        <SectionDivider glyph="&mdash;" />
        <CTASection />
        <Footer />
      </Box>
    </>
  );
}

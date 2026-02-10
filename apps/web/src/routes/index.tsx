import { Box } from '@mui/material';
import { createFileRoute } from '@tanstack/react-router';

import { CTASection } from '@/components/landing/CTASection';
import { DemoSection } from '@/components/landing/DemoSection';
import { FeaturesSection } from '@/components/landing/FeaturesSection';
import { Footer } from '@/components/landing/Footer';
import { HeroSection } from '@/components/landing/HeroSection';
import { HowItWorksSection } from '@/components/landing/HowItWorksSection';
import { LandingNav } from '@/components/landing/LandingNav';

export const Route = createFileRoute('/')({
  component: LandingPage,
});

function LandingPage() {
  return (
    <Box>
      <LandingNav />
      <HeroSection />
      <FeaturesSection />
      <HowItWorksSection />
      <DemoSection />
      <CTASection />
      <Footer />
    </Box>
  );
}

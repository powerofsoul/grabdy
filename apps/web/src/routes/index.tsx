import { Box } from '@mui/material';
import { createFileRoute } from '@tanstack/react-router';

import { ChatDemoSection } from '@/components/landing/ChatDemoSection';
import { CTASection } from '@/components/landing/CTASection';
import { FeaturesSection } from '@/components/landing/FeaturesSection';
import { Footer } from '@/components/landing/Footer';
import { HeroSection } from '@/components/landing/HeroSection';
import { IntegrationSection } from '@/components/landing/IntegrationSection';
import { LandingNav } from '@/components/landing/LandingNav';
import { PipelineSection } from '@/components/landing/PipelineSection';
import { ProcessingAnimation } from '@/components/landing/ProcessingAnimation';

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
        <PipelineSection />
        <FeaturesSection />
        <ChatDemoSection />
        <IntegrationSection />
        <CTASection />
        <Footer />
      </Box>
    </>
  );
}

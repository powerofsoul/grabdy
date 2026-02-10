import { Box, Container, Typography } from '@mui/material';
import { createFileRoute } from '@tanstack/react-router';

import { Footer } from '@/components/landing/Footer';
import { LandingNav } from '@/components/landing/LandingNav';

export const Route = createFileRoute('/terms')({
  component: TermsPage,
});

function TermsPage() {
  return (
    <Box>
      <LandingNav />
      <Container maxWidth="md" sx={{ py: 12 }}>
        <Typography variant="h2" sx={{ fontWeight: 800, mb: 4 }}>
          Terms of Service
        </Typography>

        <Typography variant="h5" sx={{ fontWeight: 600, mb: 2, mt: 4 }}>
          1. Acceptance of Terms
        </Typography>
        <Typography variant="body1" color="text.secondary" sx={{ mb: 3, lineHeight: 1.8 }}>
          By accessing or using grabdy.com, you agree to be bound by these Terms of Service. If you
          do not agree, you may not use the platform.
        </Typography>

        <Typography variant="h5" sx={{ fontWeight: 600, mb: 2, mt: 4 }}>
          2. Service Description
        </Typography>
        <Typography variant="body1" color="text.secondary" sx={{ mb: 3, lineHeight: 1.8 }}>
          Grabdy provides document ingestion, embedding, and semantic retrieval services via API
          and web interface. We process your documents to enable AI-powered search and chat
          functionality.
        </Typography>

        <Typography variant="h5" sx={{ fontWeight: 600, mb: 2, mt: 4 }}>
          3. Your Content
        </Typography>
        <Typography variant="body1" color="text.secondary" sx={{ mb: 3, lineHeight: 1.8 }}>
          You retain all rights to the content you upload. You grant us a limited license to
          process, store, and index your content solely for providing the service. We do not claim
          ownership of your data.
        </Typography>

        <Typography variant="h5" sx={{ fontWeight: 600, mb: 2, mt: 4 }}>
          4. Acceptable Use
        </Typography>
        <Typography variant="body1" color="text.secondary" sx={{ mb: 3, lineHeight: 1.8 }}>
          You agree not to upload content that violates applicable laws, infringes on intellectual
          property rights, or contains malicious code. We reserve the right to suspend accounts that
          violate these terms.
        </Typography>

        <Typography variant="h5" sx={{ fontWeight: 600, mb: 2, mt: 4 }}>
          5. Limitation of Liability
        </Typography>
        <Typography variant="body1" color="text.secondary" sx={{ mb: 3, lineHeight: 1.8 }}>
          Grabdy is provided &quot;as is&quot; without warranties of any kind. We are not liable
          for any indirect, incidental, or consequential damages arising from the use of our
          service.
        </Typography>

        <Typography variant="h5" sx={{ fontWeight: 600, mb: 2, mt: 4 }}>
          6. Contact
        </Typography>
        <Typography variant="body1" color="text.secondary" sx={{ mb: 3, lineHeight: 1.8 }}>
          For questions about these terms, contact us at legal@grabdy.com.
        </Typography>
      </Container>
      <Footer />
    </Box>
  );
}

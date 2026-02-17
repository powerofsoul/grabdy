import { Box, Container, Typography } from '@mui/material';
import { createFileRoute } from '@tanstack/react-router';

import { Footer } from '@/components/landing/Footer';
import { LandingNav } from '@/components/landing/LandingNav';


export const Route = createFileRoute('/privacy')({
  component: PrivacyPage,
});

function PrivacyPage() {
  return (
    <Box>
      <LandingNav />
      <Container maxWidth="md" sx={{ py: 12 }}>
        <Typography variant="h2" sx={{ mb: 4 }}>
          Privacy Policy
        </Typography>

        <Typography variant="h5" sx={{ mb: 2, mt: 4 }}>
          1. Information We Collect
        </Typography>
        <Typography variant="body1" color="text.secondary" sx={{ mb: 3, lineHeight: 1.8 }}>
          We collect information you provide directly, such as your name, email address, and
          organization details when you create an account. We also collect data you upload to the
          platform for indexing and retrieval purposes.
        </Typography>

        <Typography variant="h5" sx={{ mb: 2, mt: 4 }}>
          2. How We Use Your Data
        </Typography>
        <Typography variant="body1" color="text.secondary" sx={{ mb: 3, lineHeight: 1.8 }}>
          Your uploaded documents are processed to generate embeddings for vector search. We do not
          use your documents to train AI models. Your data remains isolated within your organization
          and is never shared with other tenants.
        </Typography>

        <Typography variant="h5" sx={{ mb: 2, mt: 4 }}>
          3. Data Storage & Security
        </Typography>
        <Typography variant="body1" color="text.secondary" sx={{ mb: 3, lineHeight: 1.8 }}>
          All data is encrypted at rest and in transit. Documents and embeddings are stored in
          isolated, multi-tenant infrastructure with strict access controls. We retain your data
          only for as long as your account is active.
        </Typography>

        <Typography variant="h5" sx={{ mb: 2, mt: 4 }}>
          4. Your Rights
        </Typography>
        <Typography variant="body1" color="text.secondary" sx={{ mb: 3, lineHeight: 1.8 }}>
          You can export or delete your data at any time through the dashboard. Upon account
          deletion, all associated documents, embeddings, and metadata are permanently removed
          within 30 days.
        </Typography>

        <Typography variant="h5" sx={{ mb: 2, mt: 4 }}>
          5. Contact
        </Typography>
        <Typography variant="body1" color="text.secondary" sx={{ mb: 3, lineHeight: 1.8 }}>
          For privacy-related inquiries, contact us at privacy@grabdy.com.
        </Typography>
      </Container>
      <Footer />
    </Box>
  );
}

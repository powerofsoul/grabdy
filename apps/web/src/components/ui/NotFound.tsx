import { useState } from 'react';

import { alpha, Box, Button, Typography, useTheme } from '@mui/material';
import { useRouter } from '@tanstack/react-router';
import { House, MagnifyingGlass } from '@phosphor-icons/react';

const PHRASES = [
  'We searched every chunk. Nothing.',
  "Our vectors couldn't find this one.",
  'This page has a similarity score of 0.',
  "Even our embeddings can't make sense of this URL.",
  'We indexed the entire internet. This page wasn\u2019t in it.',
  'Our retrieval pipeline returned: undefined.',
  '0 results. 0 chunks. 0 clues.',
];

export function NotFound() {
  const router = useRouter();
  const theme = useTheme();
  const ct = theme.palette.text.primary;
  const [phraseIndex] = useState(() => Math.floor(Math.random() * PHRASES.length));

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        textAlign: 'center',
        bgcolor: 'background.default',
        px: 3,
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Decorative background dots */}
      <Box
        sx={{
          position: 'absolute',
          inset: 0,
          backgroundImage: `radial-gradient(${alpha(ct, 0.04)} 1px, transparent 1px)`,
          backgroundSize: '24px 24px',
          pointerEvents: 'none',
        }}
      />

      {/* Magnifying glass icon */}
      <Box
        sx={{
          width: 80,
          height: 80,
          borderRadius: '50%',
          bgcolor: alpha(ct, 0.04),
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          mb: 4,
        }}
      >
        <MagnifyingGlass size={36} weight="light" color={alpha(ct, 0.2)} />
      </Box>

      {/* 404 */}
      <Typography
        variant="h1"
        sx={{
          fontSize: { xs: '5rem', sm: '7rem' },
          color: alpha(ct, 0.08),
          lineHeight: 1,
          letterSpacing: '-0.04em',
          mb: 1,
          userSelect: 'none',
        }}
      >
        404
      </Typography>

      {/* Funny phrase */}
      <Typography
        sx={{
          fontSize: { xs: 18, sm: 22 },
          fontWeight: 500,
          color: 'text.primary',
          mb: 1,
          maxWidth: 440,
        }}
      >
        {PHRASES[phraseIndex]}
      </Typography>

      <Typography
        sx={{
          fontSize: 14,
          color: alpha(ct, 0.4),
          mb: 5,
          maxWidth: 360,
        }}
      >
        The page you're looking for doesn't exist, was moved, or is hiding from our crawlers.
      </Typography>

      {/* CTA */}
      <Button
        variant="contained"
        startIcon={<House size={16} weight="light" color="currentColor" />}
        onClick={() => router.navigate({ to: '/dashboard' })}
        sx={{
          fontWeight: 600,
          fontSize: 14,
          px: 3,
          py: 1,
        }}
      >
        Back to safety
      </Button>

      {/* Wordmark */}
      <Typography
        variant="h5"
        sx={{
          position: 'absolute',
          bottom: 24,
          fontSize: 16,
          color: alpha(ct, 0.12),
          userSelect: 'none',
        }}
      >
        grabdy.
      </Typography>
    </Box>
  );
}

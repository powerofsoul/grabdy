import { alpha, Box, Container, Typography, useTheme } from '@mui/material';

import { Logo } from '../ui/Logo';

export function Footer() {
  const theme = useTheme();

  return (
    <Box
      component="footer"
      sx={{
        py: { xs: 4, md: 5 },
        bgcolor: 'grey.50',
        borderTop: '1px solid',
        borderColor: 'divider',
      }}
    >
      <Container maxWidth="lg">
        <Box
          sx={{
            display: 'flex',
            flexDirection: { xs: 'column', md: 'row' },
            alignItems: { xs: 'flex-start', md: 'center' },
            justifyContent: 'space-between',
            gap: 3,
          }}
        >
          {/* Left: logo + tagline */}
          <Box>
            <Logo size="sm" />
            <Typography sx={{ mt: 0.75, fontSize: '0.78rem', color: 'text.secondary', maxWidth: 280 }}>
              Smart document retrieval for teams that move fast.
            </Typography>
          </Box>

          {/* Right: links row */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 2.5, md: 3.5 }, flexWrap: 'wrap' }}>
            <Typography
              component="a"
              href="mailto:hello@grabdy.com"
              sx={{
                fontSize: '0.82rem',
                color: 'text.secondary',
                textDecoration: 'none',
                transition: 'color 0.2s',
                '&:hover': { color: 'text.primary' },
              }}
            >
              Contact
            </Typography>
            <Typography
              component="a"
              href="/privacy"
              sx={{
                fontSize: '0.82rem',
                color: 'text.secondary',
                textDecoration: 'none',
                transition: 'color 0.2s',
                '&:hover': { color: 'text.primary' },
              }}
            >
              Privacy
            </Typography>
            <Typography
              component="a"
              href="/terms"
              sx={{
                fontSize: '0.82rem',
                color: 'text.secondary',
                textDecoration: 'none',
                transition: 'color 0.2s',
                '&:hover': { color: 'text.primary' },
              }}
            >
              Terms
            </Typography>
          </Box>
        </Box>

        {/* Bottom copyright */}
        <Box sx={{ mt: 3, pt: 2.5, borderTop: '1px solid', borderColor: 'divider' }}>
          <Typography sx={{ fontSize: '0.72rem', color: alpha(theme.palette.text.secondary, 0.6) }}>
            &copy; {new Date().getFullYear()} Grabdy. All rights reserved.
          </Typography>
        </Box>
      </Container>
    </Box>
  );
}

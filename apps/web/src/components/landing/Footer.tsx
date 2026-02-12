import { alpha, Box, Container, Typography, useTheme } from '@mui/material';

import { Logo } from '../ui/Logo';

const linkSx = {
  fontSize: '0.82rem',
  color: 'text.secondary',
  textDecoration: 'none',
  transition: 'color 0.2s',
  '&:hover': { color: 'text.primary' },
};

export function Footer() {
  const theme = useTheme();

  return (
    <Box
      component="footer"
      sx={{
        py: { xs: 5, md: 6 },
        bgcolor: 'grey.50',
        borderTop: '1px solid',
        borderColor: 'divider',
      }}
    >
      <Container maxWidth="lg">
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', md: '2fr 1fr 1fr' },
            gap: { xs: 4, md: 6 },
          }}
        >
          {/* Logo + tagline */}
          <Box>
            <Logo size="sm" />
            <Typography sx={{ mt: 0.75, fontSize: '0.78rem', color: 'text.secondary', maxWidth: 280 }}>
              Smart document retrieval for teams that move fast.
            </Typography>
          </Box>

          {/* Product column */}
          <Box>
            <Typography sx={{ fontSize: '0.75rem', fontWeight: 700, color: 'text.primary', mb: 1.5, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Product
            </Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              <Typography component="a" href="#features" sx={linkSx}>
                Features
              </Typography>
              <Typography component="a" href="#integrations" sx={linkSx}>
                Integrations
              </Typography>
              <Typography component="a" href="/developers" sx={linkSx}>
                Developers
              </Typography>
            </Box>
          </Box>

          {/* Company column */}
          <Box>
            <Typography sx={{ fontSize: '0.75rem', fontWeight: 700, color: 'text.primary', mb: 1.5, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Company
            </Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              <Typography component="a" href="mailto:hello@grabdy.com" sx={linkSx}>
                Contact
              </Typography>
              <Typography component="a" href="/privacy" sx={linkSx}>
                Privacy
              </Typography>
              <Typography component="a" href="/terms" sx={linkSx}>
                Terms
              </Typography>
            </Box>
          </Box>
        </Box>

        {/* Bottom copyright */}
        <Box sx={{ mt: 4, pt: 2.5, borderTop: '1px solid', borderColor: 'divider' }}>
          <Typography sx={{ fontSize: '0.72rem', color: alpha(theme.palette.text.secondary, 0.6) }}>
            &copy; {new Date().getFullYear()} Grabdy. All rights reserved.
          </Typography>
        </Box>
      </Container>
    </Box>
  );
}

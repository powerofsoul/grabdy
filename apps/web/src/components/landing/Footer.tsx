import { alpha, Box, Container, Typography, useTheme } from '@mui/material';

import { Logo } from '../ui/Logo';

export function Footer() {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const muted = isDark ? 'text.secondary' : alpha(theme.palette.common.white, 0.45);
  const mutedHover = isDark ? 'text.primary' : alpha(theme.palette.common.white, 0.85);

  return (
    <Box
      component="footer"
      sx={{
        py: { xs: 4, md: 5 },
        bgcolor: isDark ? 'grey.50' : 'grey.900',
        borderTop: '1px solid',
        borderColor: isDark ? 'divider' : alpha(theme.palette.common.white, 0.05),
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
          <Box sx={{ color: isDark ? 'text.primary' : alpha(theme.palette.common.white, 0.9) }}>
            <Logo size="sm" />
            <Typography sx={{ mt: 0.75, fontSize: '0.78rem', color: muted, maxWidth: 280 }}>
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
                color: muted,
                textDecoration: 'none',
                transition: 'color 0.2s',
                '&:hover': { color: mutedHover },
              }}
            >
              Contact
            </Typography>
            <Typography
              component="a"
              href="/privacy"
              sx={{
                fontSize: '0.82rem',
                color: muted,
                textDecoration: 'none',
                transition: 'color 0.2s',
                '&:hover': { color: mutedHover },
              }}
            >
              Privacy
            </Typography>
            <Typography
              component="a"
              href="/terms"
              sx={{
                fontSize: '0.82rem',
                color: muted,
                textDecoration: 'none',
                transition: 'color 0.2s',
                '&:hover': { color: mutedHover },
              }}
            >
              Terms
            </Typography>
          </Box>
        </Box>

        {/* Bottom copyright */}
        <Box sx={{ mt: 3, pt: 2.5, borderTop: '1px solid', borderColor: isDark ? 'divider' : alpha(theme.palette.common.white, 0.06) }}>
          <Typography sx={{ fontSize: '0.72rem', color: isDark ? alpha(theme.palette.text.secondary, 0.6) : alpha(theme.palette.common.white, 0.25) }}>
            &copy; {new Date().getFullYear()} Grabdy. All rights reserved.
          </Typography>
        </Box>
      </Container>
    </Box>
  );
}

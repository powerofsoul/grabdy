import { alpha, Box, Container, Typography, useTheme } from '@mui/material';
import { Link } from '@tanstack/react-router';

import { Logo } from '../ui/Logo';

export function Footer() {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

  const linkSx = {
    color: isDark ? 'text.secondary' : alpha(theme.palette.common.white, 0.5),
    cursor: 'pointer',
    fontSize: '0.85rem',
    transition: 'color 0.2s',
    '&:hover': { color: isDark ? 'text.primary' : alpha(theme.palette.common.white, 0.9) },
  };

  return (
    <Box
      component="footer"
      sx={{
        py: 5,
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
            justifyContent: 'space-between',
            alignItems: { xs: 'center', md: 'flex-start' },
            gap: { xs: 3, md: 0 },
          }}
        >
          {/* Logo + tagline */}
          <Box sx={{ color: isDark ? 'text.primary' : alpha(theme.palette.common.white, 0.9) }}>
            <Logo size="sm" />
            <Typography
              sx={{
                mt: 1,
                fontSize: '0.8rem',
                color: isDark ? 'text.secondary' : alpha(theme.palette.common.white, 0.4),
                maxWidth: 240,
              }}
            >
              Smart document search for your entire organization.
            </Typography>
          </Box>

          {/* Links */}
          <Box
            sx={{
              display: 'flex',
              gap: { xs: 3, md: 6 },
              flexWrap: 'wrap',
              justifyContent: 'center',
            }}
          >
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              <Typography
                sx={{
                  fontSize: '0.72rem',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em',
                  color: isDark ? 'text.primary' : alpha(theme.palette.common.white, 0.7),
                  mb: 0.5,
                }}
              >
                Legal
              </Typography>
              <Link to="/privacy" style={{ textDecoration: 'none' }}>
                <Typography sx={linkSx}>Privacy</Typography>
              </Link>
              <Link to="/terms" style={{ textDecoration: 'none' }}>
                <Typography sx={linkSx}>Terms</Typography>
              </Link>
            </Box>
          </Box>
        </Box>

        {/* Bottom bar */}
        <Box
          sx={{
            mt: 4,
            pt: 3,
            borderTop: '1px solid',
            borderColor: isDark ? 'divider' : alpha(theme.palette.common.white, 0.08),
            display: 'flex',
            flexDirection: { xs: 'column', md: 'row' },
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 1.5,
          }}
        >
          <Typography
            sx={{
              fontSize: '0.78rem',
              color: isDark ? 'text.secondary' : alpha(theme.palette.common.white, 0.35),
            }}
          >
            &copy; {new Date().getFullYear()} grabdy. All rights reserved.
          </Typography>
        </Box>
      </Container>
    </Box>
  );
}

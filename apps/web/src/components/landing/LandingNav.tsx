import { alpha, AppBar, Box, Button, Container, Toolbar, Typography, useScrollTrigger, useTheme } from '@mui/material';
import { Link } from '@tanstack/react-router';

import { Logo } from '../ui/Logo';
import { ThemeToggle } from '../ui/ThemeToggle';

const NAV_LINKS = [] satisfies ReadonlyArray<{ label: string; href: string }>;

export function LandingNav() {
  const theme = useTheme();
  const trigger = useScrollTrigger({ disableHysteresis: true, threshold: 50 });

  return (
    <AppBar
      position="sticky"
      elevation={0}
      sx={{
        bgcolor: trigger
          ? alpha(theme.palette.background.paper, 0.8)
          : 'transparent',
        backdropFilter: trigger ? 'blur(12px)' : 'none',
        borderBottom: trigger ? '1px solid' : 'none',
        borderColor: 'divider',
        transition: 'background-color 0.3s, backdrop-filter 0.3s, border 0.3s',
      }}
    >
      <Container maxWidth="lg">
        <Toolbar
          sx={{
            justifyContent: 'space-between',
            px: { xs: 0 },
            minHeight: { xs: trigger ? 56 : 64 },
            transition: 'min-height 0.3s',
          }}
        >
          <Logo />

          {/* Center nav links */}
          <Box
            sx={{
              display: { xs: 'none', md: 'flex' },
              alignItems: 'center',
              gap: 4,
              position: 'absolute',
              left: '50%',
              transform: 'translateX(-50%)',
            }}
          >
            {NAV_LINKS.map((link) => (
              <Typography
                key={link.label}
                component="a"
                href={link.href}
                sx={{
                  fontSize: '0.85rem',
                  fontWeight: 500,
                  color: 'text.secondary',
                  textDecoration: 'none',
                  transition: 'color 0.2s',
                  '&:hover': { color: 'text.primary' },
                }}
              >
                {link.label}
              </Typography>
            ))}
          </Box>

          {/* Right actions */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <ThemeToggle />
            <Link to="/auth/login" style={{ textDecoration: 'none' }}>
              <Button
                variant="text"
                size="small"
                sx={{ color: 'text.secondary', '&:hover': { color: 'text.primary' } }}
              >
                Login
              </Button>
            </Link>
            <Link to="/auth/register" style={{ textDecoration: 'none' }}>
              <Button
                variant="contained"
                size="small"
                sx={{
                  boxShadow: `0 2px 8px ${alpha(theme.palette.primary.main, 0.2)}`,
                  '&:hover': {
                    boxShadow: `0 4px 12px ${alpha(theme.palette.primary.main, 0.3)}`,
                  },
                }}
              >
                Get Started
              </Button>
            </Link>
          </Box>
        </Toolbar>
      </Container>
    </AppBar>
  );
}

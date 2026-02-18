import {
  alpha,
  AppBar,
  Box,
  Button,
  Container,
  Toolbar,
  Typography,
  useScrollTrigger,
  useTheme,
} from '@mui/material';
import { Link } from '@tanstack/react-router';

import { Logo } from '../ui/Logo';
import { ThemeToggle } from '../ui/ThemeToggle';

const NAV_LINKS = [
  { label: 'Features', href: '#features' },
  { label: 'Integrations', href: '#integrations' },
  { label: 'Developers', href: '#developers' },
  { label: 'Pricing', href: '#pricing' },
] as const;

const navLinkSx = {
  fontSize: '0.82rem',
  color: 'text.secondary',
  textDecoration: 'none',
  transition: 'color 0.2s',
  '&:hover': { color: 'text.primary' },
};

export function LandingNav() {
  const theme = useTheme();
  const trigger = useScrollTrigger({ disableHysteresis: true, threshold: 50 });

  return (
    <AppBar
      position="sticky"
      elevation={0}
      sx={{
        bgcolor: trigger ? alpha(theme.palette.background.paper, 0.8) : 'transparent',
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
          <Logo size="lg" />

          {/* Center nav links — desktop only */}
          <Box
            sx={{
              display: { xs: 'none', md: 'flex' },
              alignItems: 'center',
              gap: 3,
            }}
          >
            {NAV_LINKS.map((link) => (
              <Typography key={link.href} component="a" href={link.href} sx={navLinkSx}>
                {link.label}
              </Typography>
            ))}
          </Box>

          {/* Right actions */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <ThemeToggle />
            <Link to="/auth/login" style={{ textDecoration: 'none' }}>
              <Button
                variant="text"
                size="small"
                sx={{
                  color: 'text.secondary',
                  '&:hover': { color: 'text.primary' },
                }}
              >
                Login
              </Button>
            </Link>
            <Link to="/auth/signup" style={{ textDecoration: 'none' }}>
              <Button variant="contained" size="small">
                Get Started
              </Button>
            </Link>
          </Box>
        </Toolbar>
      </Container>
    </AppBar>
  );
}

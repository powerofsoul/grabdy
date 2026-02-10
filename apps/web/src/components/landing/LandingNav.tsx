import { alpha, AppBar, Box, Button, Container, Toolbar, useScrollTrigger, useTheme } from '@mui/material';
import { Link } from '@tanstack/react-router';

import { Logo } from '../ui/Logo';
import { ThemeToggle } from '../ui/ThemeToggle';

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

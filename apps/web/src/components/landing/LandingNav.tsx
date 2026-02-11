import { alpha, AppBar, Box, Button, Container, Toolbar, useScrollTrigger, useTheme } from '@mui/material';
import { Link } from '@tanstack/react-router';

import { Logo } from '../ui/Logo';
import { ThemeToggle } from '../ui/ThemeToggle';

import { useWaitlist } from './WaitlistModal';

export function LandingNav() {
  const theme = useTheme();
  const trigger = useScrollTrigger({ disableHysteresis: true, threshold: 50 });
  const { open } = useWaitlist();

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
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
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
            <Button
              variant="contained"
              size="small"
              onClick={open}
              sx={{
                boxShadow: 'none',
              }}
            >
              Join Waitlist
            </Button>
          </Box>
        </Toolbar>
      </Container>
    </AppBar>
  );
}

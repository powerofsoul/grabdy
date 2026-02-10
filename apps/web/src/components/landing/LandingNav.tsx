import { AppBar, Box, Button, Container, Toolbar, useScrollTrigger } from '@mui/material';
import { Link } from '@tanstack/react-router';

import { Logo } from '../ui/Logo';
import { ThemeToggle } from '../ui/ThemeToggle';

function scrollToSection(id: string) {
  const element = document.getElementById(id);
  if (element) {
    element.scrollIntoView({ behavior: 'smooth' });
  }
}

export function LandingNav() {
  const trigger = useScrollTrigger({ disableHysteresis: true, threshold: 50 });

  return (
    <AppBar
      position="sticky"
      elevation={0}
      sx={{
        bgcolor: trigger ? 'background.paper' : 'transparent',
        borderBottom: trigger ? '1px solid' : 'none',
        borderColor: 'divider',
        transition: 'all 0.3s',
      }}
    >
      <Container maxWidth="lg">
        <Toolbar sx={{ justifyContent: 'space-between', px: { xs: 0 } }}>
          <Logo />

          <Box sx={{ display: { xs: 'none', md: 'flex' }, alignItems: 'center', gap: 3 }}>
            <Button
              color="inherit"
              sx={{ color: 'text.secondary' }}
              onClick={() => scrollToSection('features')}
            >
              Features
            </Button>
            <Button
              color="inherit"
              sx={{ color: 'text.secondary' }}
              onClick={() => scrollToSection('how-it-works')}
            >
              How it Works
            </Button>
            <Button
              color="inherit"
              sx={{ color: 'text.secondary' }}
              onClick={() => scrollToSection('demo')}
            >
              Demo
            </Button>
          </Box>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <ThemeToggle />
            <Link to="/auth/login" style={{ textDecoration: 'none' }}>
              <Button variant="outlined" size="small">
                Login
              </Button>
            </Link>
            <Link to="/auth/register" style={{ textDecoration: 'none' }}>
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

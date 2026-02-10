import { Box, Container, Typography, useTheme } from '@mui/material';

import { Logo } from '../ui/Logo';

export function Footer() {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

  return (
    <Box
      component="footer"
      sx={{
        py: 4,
        bgcolor: isDark ? '#09090b' : '#18181b',
        color: '#a1a1aa',
      }}
    >
      <Container maxWidth="lg">
        <Box
          sx={{
            display: 'flex',
            flexDirection: { xs: 'column', sm: 'row' },
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 2,
          }}
        >
          <Box sx={{ color: '#fff' }}>
            <Logo size="sm" />
          </Box>

          <Box sx={{ display: 'flex', gap: 3 }}>
            <Typography variant="body2" sx={{ cursor: 'pointer', '&:hover': { color: '#fff' } }}>
              Privacy
            </Typography>
            <Typography variant="body2" sx={{ cursor: 'pointer', '&:hover': { color: '#fff' } }}>
              Terms
            </Typography>
            <Typography variant="body2" sx={{ cursor: 'pointer', '&:hover': { color: '#fff' } }}>
              GitHub
            </Typography>
          </Box>

          <Typography variant="body2">
            &copy; {new Date().getFullYear()} fastdex.io
          </Typography>
        </Box>
      </Container>
    </Box>
  );
}

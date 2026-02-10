import { createTheme, type PaletteMode } from '@mui/material';

const TRANSITION = 'all 0.2s ease-in-out';

const RADIUS = {
  xs: 4,
  sm: 6,
  md: 8,
  lg: 12,
  xl: 16,
};

export function createAppTheme(mode: PaletteMode) {
  const isDark = mode === 'dark';

  return createTheme({
    palette: {
      mode,
      primary: {
        main: '#3b82f6',
        light: '#60a5fa',
        dark: '#2563eb',
      },
      secondary: {
        main: '#6366f1',
        light: '#818cf8',
        dark: '#4f46e5',
      },
      background: {
        default: isDark ? '#09090b' : '#fafafa',
        paper: isDark ? '#18181b' : '#ffffff',
      },
      grey: {
        50: isDark ? '#18181b' : '#fafafa',
        100: isDark ? '#27272a' : '#f4f4f5',
        200: isDark ? '#3f3f46' : '#e4e4e7',
        300: isDark ? '#52525b' : '#d4d4d8',
        400: isDark ? '#71717a' : '#a1a1aa',
        500: '#71717a',
        600: isDark ? '#a1a1aa' : '#52525b',
        700: isDark ? '#d4d4d8' : '#3f3f46',
        800: isDark ? '#e4e4e7' : '#27272a',
        900: isDark ? '#f4f4f5' : '#18181b',
      },
      divider: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
    },
    typography: {
      fontFamily: '"Inter", "Helvetica", "Arial", sans-serif',
      h1: { fontSize: '3rem', fontWeight: 700 },
      h2: { fontSize: '2.25rem', fontWeight: 700 },
      h3: { fontSize: '1.875rem', fontWeight: 600 },
      h4: { fontSize: '1.5rem', fontWeight: 600 },
      h5: { fontSize: '1.25rem', fontWeight: 600 },
      h6: { fontSize: '1.125rem', fontWeight: 600 },
      body1: { fontSize: '0.938rem' },
      body2: { fontSize: '0.875rem' },
    },
    shape: {
      borderRadius: RADIUS.md,
    },
    components: {
      MuiButton: {
        styleOverrides: {
          root: {
            textTransform: 'none',
            fontWeight: 600,
            borderRadius: RADIUS.md,
            transition: TRANSITION,
          },
        },
      },
      MuiPaper: {
        styleOverrides: {
          root: {
            backgroundImage: 'none',
          },
        },
      },
      MuiTextField: {
        defaultProps: {
          size: 'small',
        },
      },
      MuiCard: {
        styleOverrides: {
          root: {
            borderRadius: RADIUS.lg,
            border: '1px solid',
            borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
            boxShadow: 'none',
          },
        },
      },
      MuiTooltip: {
        defaultProps: {
          arrow: true,
        },
      },
    },
  });
}

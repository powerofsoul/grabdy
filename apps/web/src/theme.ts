import { createTheme, type PaletteMode } from '@mui/material';

const TRANSITION = 'all 0.15s ease';

const RADIUS = {
  xs: 2,
  sm: 3,
  md: 4,
  lg: 6,
  xl: 8,
};

const SERIF_FAMILY = '"Newsreader", "Georgia", serif';

export const PIXEL_FAMILY = '"Silkscreen", monospace';

export function createAppTheme(mode: PaletteMode) {
  const isDark = mode === 'dark';

  return createTheme({
    palette: {
      mode,
      primary: isDark
        ? { main: '#9AB894', light: '#B5CCAF', dark: '#7A9E73' }
        : { main: '#4A6741', light: '#6B8C62', dark: '#34502D' },
      secondary: isDark
        ? { main: '#C4998A', light: '#D4B0A3', dark: '#A87B6C' }
        : { main: '#96705E', light: '#B08E7E', dark: '#7A5A4A' },
      background: {
        default: isDark ? '#0A0A0A' : '#FFFFFF',
        paper: isDark ? '#111111' : '#FFFFFF',
      },
      text: {
        primary: isDark ? '#E0E0E0' : '#1A1A1A',
        secondary: isDark ? '#888888' : '#6B6B6B',
      },
      grey: {
        50: isDark ? '#111111' : '#FAFAFA',
        100: isDark ? '#1A1A1A' : '#F5F5F5',
        200: isDark ? '#262626' : '#EEEEEE',
        300: isDark ? '#333333' : '#E0E0E0',
        400: isDark ? '#555555' : '#BDBDBD',
        500: '#888888',
        600: isDark ? '#999999' : '#757575',
        700: isDark ? '#BBBBBB' : '#616161',
        800: isDark ? '#DDDDDD' : '#333333',
        900: isDark ? '#EEEEEE' : '#1A1A1A',
      },
      divider: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
      kindle: {
        cream: isDark ? '#111111' : '#FAFAFA',
        parchment: isDark ? '#1A1A1A' : '#F5F5F5',
        sepia: isDark ? '#262626' : '#EEEEEE',
        inkBrown: isDark ? '#E0E0E0' : '#1A1A1A',
        codeBlockBg: isDark ? '#0A0A0A' : '#141414',
        codeBlockText: isDark ? '#D4D4D4' : '#D4D4D4',
        // Syntax highlighting (always bright — code blocks are always dark)
        syntaxMethod: '#A5C97F',
        syntaxKey: '#EACB7B',
        syntaxString: '#D4A177',
        syntaxNumber: '#7FB8A4',
      },
    },
    typography: {
      fontFamily: '"Inter", "Helvetica", "Arial", sans-serif',
      h1: { fontSize: '3rem', fontWeight: 600, fontFamily: SERIF_FAMILY, letterSpacing: '-0.02em' },
      h2: { fontSize: '2.25rem', fontWeight: 600, fontFamily: SERIF_FAMILY, letterSpacing: '-0.01em' },
      h3: { fontSize: '1.875rem', fontWeight: 500, fontFamily: SERIF_FAMILY },
      h4: { fontSize: '1.5rem', fontWeight: 500, fontFamily: SERIF_FAMILY },
      h5: { fontSize: '1.25rem', fontWeight: 500, fontFamily: SERIF_FAMILY },
      h6: { fontSize: '1.125rem', fontWeight: 500, fontFamily: SERIF_FAMILY },
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
            fontWeight: 500,
            borderRadius: RADIUS.md,
            transition: TRANSITION,
          },
          contained: {
            boxShadow: 'none',
            '&:hover': {
              boxShadow: 'none',
            },
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
            borderColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)',
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

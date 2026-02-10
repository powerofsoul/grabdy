import { alpha, createTheme, type PaletteMode } from '@mui/material';

const TRANSITION = 'all 0.2s ease-in-out';

const RADIUS = {
  xs: 4,
  sm: 6,
  md: 8,
  lg: 12,
  xl: 16,
};

const SERIF_FAMILY = '"Literata", "Georgia", serif';

export function createAppTheme(mode: PaletteMode) {
  const isDark = mode === 'dark';

  return createTheme({
    palette: {
      mode,
      primary: isDark
        ? { main: '#C9A84C', light: '#DFC06A', dark: '#A08030' }
        : { main: '#8B6914', light: '#B8941F', dark: '#6B4F0E' },
      secondary: isDark
        ? { main: '#C4775A', light: '#D99A82', dark: '#A0522D' }
        : { main: '#A0522D', light: '#C4775A', dark: '#7A3B1E' },
      background: {
        default: isDark ? '#1C1812' : '#FAFAF9',
        paper: isDark ? '#28221A' : '#FFFFFF',
      },
      text: {
        primary: isDark ? '#E8E0D0' : '#1C1917',
        secondary: isDark ? '#A89880' : '#78716C',
      },
      grey: {
        50: isDark ? '#28221A' : '#FAFAF9',
        100: isDark ? '#332B21' : '#F5F5F4',
        200: isDark ? '#4A3F30' : '#E7E5E4',
        300: isDark ? '#605040' : '#D6D3D1',
        400: isDark ? '#7A6A55' : '#A8A29E',
        500: '#78716C',
        600: isDark ? '#A89880' : '#57534E',
        700: isDark ? '#D4C8B4' : '#44403C',
        800: isDark ? '#E8DFD0' : '#292524',
        900: isDark ? '#F5EFE3' : '#1C1917',
      },
      divider: isDark ? 'rgba(201,168,76,0.12)' : 'rgba(28,25,23,0.08)',
      kindle: {
        cream: isDark ? '#28221A' : '#FAFAF9',
        parchment: isDark ? '#332B21' : '#F5F5F4',
        sepia: isDark ? '#4A3F30' : '#EEEDEB',
        inkBrown: isDark ? '#E8E0D0' : '#1C1917',
        codeBlockBg: isDark ? '#141210' : '#1C1916',
        codeBlockText: isDark ? '#E0D8C4' : '#E8E0D0',
        // Syntax highlighting (always bright — code blocks are always dark)
        syntaxMethod: '#A5C97F',
        syntaxKey: '#EACB7B',
        syntaxString: '#D4A177',
        syntaxNumber: '#7FB8A4',
      },
    },
    typography: {
      fontFamily: '"Inter", "Helvetica", "Arial", sans-serif',
      h1: { fontSize: '3rem', fontWeight: 700, fontFamily: SERIF_FAMILY },
      h2: { fontSize: '2.25rem', fontWeight: 700, fontFamily: SERIF_FAMILY },
      h3: { fontSize: '1.875rem', fontWeight: 600, fontFamily: SERIF_FAMILY },
      h4: { fontSize: '1.5rem', fontWeight: 600, fontFamily: SERIF_FAMILY },
      h5: { fontSize: '1.25rem', fontWeight: 600, fontFamily: SERIF_FAMILY },
      h6: { fontSize: '1.125rem', fontWeight: 600, fontFamily: SERIF_FAMILY },
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
          contained: {
            '&:hover': {
              boxShadow: isDark
                ? `0 4px 16px ${alpha('#C9A84C', 0.3)}`
                : `0 4px 16px ${alpha('#8B6914', 0.25)}`,
            },
          },
        },
      },
      MuiPaper: {
        styleOverrides: {
          root: {
            backgroundImage: isDark
              ? 'none'
              : `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.015'/%3E%3C/svg%3E")`,
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
            borderColor: isDark
              ? 'rgba(201,168,76,0.1)'
              : 'rgba(0,0,0,0.06)',
            boxShadow: isDark
              ? 'none'
              : `0 1px 3px ${alpha('#000', 0.04)}`,
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

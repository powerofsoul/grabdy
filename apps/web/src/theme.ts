import { createTheme, type PaletteMode } from '@mui/material';

const FONT_SERIF = '"Source Serif 4", "Georgia", serif';
const FONT_SANS = '"Inter", "SF Pro", system-ui, sans-serif';

const RADIUS = {
  sm: 6,
  md: 8,
  lg: 10,
  xl: 14,
};

const light = {
  bg: '#FFFFFF',
  text: '#111111',
  textSecondary: '#555555',
  textTertiary: '#888888',
  textDisabled: '#CCCCCC',
  border: '#E5E5E2',
  borderSubtle: '#EEEEEB',
  surface: '#F5F5F3',
  hover: '#F0F0EE',
  active: '#EAEAE7',
  primary: '#4A7C59',
  primaryLight: '#EDF3EF',
  primaryDark: '#3D6A4B',
  secondary: { main: '#96705E', light: '#B08E7E', dark: '#7A5A4A' },
  error: '#9E3B3B',
  success: '#4A7C59',
  warning: '#8B7332',
  codeBg: '#1C1B1A',
  codeText: '#E8E6E2',
  shadow: '0 12px 40px rgba(0,0,0,0.08), 0 4px 12px rgba(0,0,0,0.04)',
  scrollThumb: 'rgba(155,155,155,0.4)',
  scrollThumbHover: 'rgba(155,155,155,0.6)',
  grey: {
    50: '#F8F7F4', 100: '#F3F2EF', 200: '#E8E6E2', 300: '#D4D2CE',
    400: '#B5B0A8', 500: '#8A8A8A', 600: '#6A6A6A', 700: '#5A5A5A',
    800: '#333333', 900: '#1A1A1A',
  },
  kindle: {
    cream: '#F8F7F4', parchment: '#F3F2EF', sepia: '#E8E6E2',
    inkBrown: '#1A1A1A',
  },
};

const dark = {
  bg: '#0F0F0E',
  text: '#EEEEEC',
  textSecondary: '#AAAAAA',
  textTertiary: '#7A7A7A',
  textDisabled: '#4A4A4A',
  border: '#333330',
  borderSubtle: '#2A2A27',
  surface: '#1A1A18',
  hover: '#252523',
  active: '#2E2E2B',
  primary: '#6B9E7A',
  primaryLight: '#1A2E20',
  primaryDark: '#7DB38D',
  secondary: { main: '#C4998A', light: '#D4B0A3', dark: '#A87B6C' },
  error: '#C46B6B',
  success: '#6B9E7A',
  warning: '#C4A84B',
  codeBg: '#080807',
  codeText: '#CCCCCA',
  shadow: '0 12px 40px rgba(0,0,0,0.4), 0 4px 12px rgba(0,0,0,0.25)',
  scrollThumb: 'rgba(122,122,122,0.4)',
  scrollThumbHover: 'rgba(170,170,170,0.5)',
  grey: {
    50: '#1E1C18', 100: '#15130F', 200: '#2E2C28', 300: '#3A3834',
    400: '#555550', 500: '#8A8A8A', 600: '#999999', 700: '#BBBBBB',
    800: '#DDDDDD', 900: '#EEEEEE',
  },
  kindle: {
    cream: '#1E1C18', parchment: '#252320', sepia: '#2E2C28',
    inkBrown: 'rgba(255,255,255,0.88)',
  },
};

export function createAppTheme(mode: PaletteMode) {
  const t = mode === 'dark' ? dark : light;

  return createTheme({
    palette: {
      mode,
      primary: {
        main: t.primary,
        light: t.primaryLight,
        dark: t.primaryDark,
        contrastText: '#FFFFFF',
      },
      secondary: t.secondary,
      background: { default: t.bg, paper: t.bg },
      text: { primary: t.text, secondary: t.textSecondary, disabled: t.textDisabled },
      divider: t.border,
      error: { main: t.error },
      success: { main: t.success },
      warning: { main: t.warning },
      action: { hover: t.hover, active: t.active },
      grey: t.grey,
      kindle: {
        ...t.kindle,
        codeBlockBg: t.codeBg,
        codeBlockText: t.codeText,
        syntaxMethod: '#A5C97F',
        syntaxKey: '#EACB7B',
        syntaxString: '#D4A177',
        syntaxNumber: '#7FB8A4',
      },
    },
    typography: {
      fontFamily: FONT_SANS,
      h1: { fontSize: '3rem', fontWeight: 600, letterSpacing: '-0.02em' },
      h2: { fontSize: '2.25rem', fontWeight: 600, letterSpacing: '-0.01em' },
      h3: { fontSize: '1.875rem', fontWeight: 500 },
      h4: { fontSize: '1.5rem', fontWeight: 500 },
      h5: {
        fontFamily: FONT_SERIF,
        fontSize: '1.625rem',
        fontWeight: 500,
        lineHeight: 1.2,
        letterSpacing: '-0.01em',
      },
      h6: { fontSize: '1rem', fontWeight: 600, lineHeight: 1.4 },
      body1: { fontSize: '0.938rem', lineHeight: 1.7 },
      body2: { fontSize: '0.875rem', lineHeight: 1.6 },
      caption: { fontSize: '0.75rem', lineHeight: 1.4 },
    },
    shape: { borderRadius: RADIUS.md },
    components: {
      MuiCssBaseline: {
        styleOverrides: {
          ':root': {
            '--scrollbar-thumb': t.scrollThumb,
            '--scrollbar-thumb-hover': t.scrollThumbHover,
          },
        },
      },
      MuiButton: {
        styleOverrides: {
          root: {
            textTransform: 'none',
            fontWeight: 500,
            fontSize: '0.875rem',
            borderRadius: RADIUS.md,
            transition: 'all 0.12s ease',
          },
          sizeSmall: { fontWeight: 500 },
          contained: {
            boxShadow: 'none',
            '&:hover': { boxShadow: 'none' },
          },
          outlined: {
            borderColor: t.border,
            color: t.textSecondary,
            '&:hover': {
              borderColor: t.textTertiary,
              backgroundColor: t.hover,
            },
          },
        },
      },
      MuiPaper: {
        styleOverrides: { root: { backgroundImage: 'none' } },
      },
      MuiTextField: {
        defaultProps: { size: 'small' },
      },
      MuiOutlinedInput: {
        styleOverrides: {
          root: {
            borderRadius: RADIUS.md,
            fontSize: '0.875rem',
            '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
              borderColor: t.text,
              borderWidth: 1,
            },
          },
          notchedOutline: { borderColor: t.border },
        },
      },
      MuiCard: {
        styleOverrides: {
          root: {
            borderRadius: RADIUS.lg,
            border: '1px solid',
            borderColor: t.borderSubtle,
            boxShadow: 'none',
            backgroundColor: t.surface,
          },
        },
      },
      MuiDialog: {
        styleOverrides: {
          paper: { borderRadius: RADIUS.xl, boxShadow: t.shadow },
        },
      },
      MuiDialogTitle: {
        styleOverrides: {
          root: { fontSize: '1.375rem', fontWeight: 500, fontFamily: FONT_SERIF },
        },
      },
      MuiTooltip: {
        defaultProps: { arrow: true },
      },
      MuiTableHead: {
        styleOverrides: {
          root: {
            '& .MuiTableCell-head': {
              fontWeight: 600,
              fontSize: '0.75rem',
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
              backgroundColor: t.surface,
              color: t.textTertiary,
            },
          },
        },
      },
      MuiTableRow: {
        styleOverrides: {
          root: { '&:hover': { backgroundColor: t.hover } },
        },
      },
      MuiTableCell: {
        styleOverrides: {
          root: { borderColor: t.borderSubtle },
        },
      },
      MuiChip: {
        styleOverrides: { root: { fontWeight: 500 } },
      },
    },
  });
}

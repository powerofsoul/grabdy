import { createTheme, type PaletteMode } from '@mui/material';

const FONT_SERIF = '"Inter", "SF Pro", system-ui, sans-serif';
const FONT_SANS = '"Inter", "SF Pro", system-ui, sans-serif';
const FONT_MONO = '"Geist Mono", "JetBrains Mono", monospace';

export { FONT_MONO, FONT_SERIF };

const light = {
  bg: '#FAFAF8',
  text: '#33302B',
  textSecondary: '#635D56',
  textTertiary: '#7A746D',
  textDisabled: '#A8A29E',
  border: '#33302B',
  borderSubtle: '#E5E4E1',
  surface: '#F5F5F2',
  hover: '#F0F0ED',
  active: '#EAEAE7',
  primary: '#33302B',
  primaryLight: '#F0F0ED',
  primaryDark: '#241F1B',
  secondary: { main: '#635D56', light: '#7A746D', dark: '#4D4842' },
  error: '#9E3B3B',
  success: '#16A34A',
  warning: '#8B7332',
  codeBg: '#1C1B1A',
  codeText: '#E8E6E2',
  shadow: 'none',
  scrollThumb: 'rgba(51,48,43,0.15)',
  scrollThumbHover: 'rgba(51,48,43,0.25)',
  grey: {
    50: '#FAFAF8',
    100: '#F0F0ED',
    200: '#E5E4E1',
    300: '#D5D4D1',
    400: '#A8A29E',
    500: '#7A746D',
    600: '#635D56',
    700: '#4D4842',
    800: '#33302B',
    900: '#241F1B',
  },
  kindle: {
    cream: '#FAFAF8',
    parchment: '#F0F0ED',
    sepia: '#E5E4E1',
    inkBrown: '#33302B',
  },
};

const dark = {
  bg: '#141414',
  text: '#D4D4D4',
  textSecondary: '#9A9A9A',
  textTertiary: '#717171',
  textDisabled: '#525252',
  border: '#3D3D3D',
  borderSubtle: '#272727',
  surface: '#1C1C1C',
  hover: '#222222',
  active: '#2C2C2C',
  primary: '#D4D4D4',
  primaryLight: '#222222',
  primaryDark: '#F4F1EC',
  secondary: { main: '#9A9A9A', light: '#C4C4C4', dark: '#717171' },
  error: '#C46B6B',
  success: '#6B9E7A',
  warning: '#C4A84B',
  codeBg: '#0E0E0E',
  codeText: '#C4C4C4',
  shadow: 'none',
  scrollThumb: 'rgba(212,212,212,0.12)',
  scrollThumbHover: 'rgba(212,212,212,0.2)',
  grey: {
    50: '#1C1C1C',
    100: '#222222',
    200: '#272727',
    300: '#3D3D3D',
    400: '#525252',
    500: '#717171',
    600: '#9A9A9A',
    700: '#C4C4C4',
    800: '#D9D9D9',
    900: '#F4F1EC',
  },
  kindle: {
    cream: '#141414',
    parchment: '#1C1C1C',
    sepia: '#272727',
    inkBrown: 'rgba(212,212,212,0.88)',
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
        contrastText: mode === 'dark' ? '#141414' : '#FAFAF8',
      },
      secondary: t.secondary,
      background: { default: t.bg, paper: t.bg },
      text: { primary: t.text, secondary: t.textSecondary, disabled: t.textDisabled },
      divider: t.borderSubtle,
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
      h1: { fontFamily: FONT_SERIF, fontSize: '3rem', fontWeight: 700, letterSpacing: '-0.04em', lineHeight: 1.1 },
      h2: {
        fontFamily: FONT_SERIF,
        fontSize: '2.25rem',
        fontWeight: 700,
        letterSpacing: '-0.03em',
        lineHeight: 1.15,
      },
      h3: {
        fontFamily: FONT_SERIF,
        fontSize: '1.875rem',
        fontWeight: 600,
        letterSpacing: '-0.02em',
        lineHeight: 1.2,
      },
      h4: { fontFamily: FONT_SERIF, fontSize: '1.5rem', fontWeight: 600, letterSpacing: '-0.02em', lineHeight: 1.25 },
      h5: {
        fontFamily: FONT_SERIF,
        fontSize: '1.25rem',
        fontWeight: 600,
        lineHeight: 1.3,
        letterSpacing: '-0.01em',
      },
      h6: {
        fontFamily: FONT_SERIF,
        fontSize: '1.125rem',
        fontWeight: 600,
        lineHeight: 1.3,
        letterSpacing: '-0.01em',
      },
      subtitle1: { fontSize: '0.875rem', fontWeight: 600, lineHeight: 1.4 },
      subtitle2: { fontSize: '0.82rem', fontWeight: 600, lineHeight: 1.4 },
      body1: { fontSize: '0.938rem', lineHeight: 1.7 },
      body2: { fontSize: '0.875rem', lineHeight: 1.6 },
      caption: { fontSize: '0.75rem', lineHeight: 1.4 },
      overline: {
        fontFamily: FONT_SANS,
        fontSize: '0.75rem',
        fontWeight: 500,
        lineHeight: 1.4,
        textTransform: 'uppercase' as const,
        letterSpacing: '0.08em',
      },
    },
    shape: { borderRadius: 0 },
    components: {
      MuiCssBaseline: {
        styleOverrides: {
          ':root': {
            '--scrollbar-thumb': t.scrollThumb,
            '--scrollbar-thumb-hover': t.scrollThumbHover,
            '--border-color': t.border,
            '--border-subtle': t.borderSubtle,
            '--bg': t.bg,
            '--text': t.text,
            '--text-secondary': t.textSecondary,
          },
        },
      },
      MuiButton: {
        styleOverrides: {
          root: {
            textTransform: 'none',
            fontWeight: 500,
            fontSize: '0.875rem',
            transition: 'all 0.12s ease',
          },
          sizeSmall: { fontWeight: 500 },
          contained: {
            backgroundColor: t.text,
            color: mode === 'dark' ? '#141414' : '#FAFAF8',
            boxShadow: 'none',
            '&:hover': {
              backgroundColor: mode === 'dark' ? '#C4C4C4' : '#4D4842',
              boxShadow: 'none',
            },
          },
          outlined: {
            backgroundColor: mode === 'dark' ? t.bg : t.surface,
            borderColor: t.border,
            color: t.text,
            '&:hover': {
              borderColor: t.text,
              backgroundColor: t.hover,
            },
          },
        },
      },
      MuiPaper: {
        styleOverrides: { root: { backgroundImage: 'none' } },
      },
      MuiTextField: {
        defaultProps: {
          size: 'small',
          variant: 'outlined',
          InputLabelProps: { shrink: true },
        },
      },
      MuiOutlinedInput: {
        styleOverrides: {
          root: {
            fontSize: '0.875rem',
            backgroundColor: mode === 'dark' ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
            transition: 'border-color 0.15s ease, background-color 0.15s ease',
            '&:hover': {
              backgroundColor: mode === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)',
              '& .MuiOutlinedInput-notchedOutline': {
                borderColor: t.border,
              },
            },
            '&.Mui-focused': {
              backgroundColor: 'transparent',
              '& .MuiOutlinedInput-notchedOutline': {
                borderColor: t.text,
                borderWidth: 1,
              },
            },
          },
          notchedOutline: {
            borderColor: t.borderSubtle,
            '& legend': {
              display: 'none',
            },
          },
          input: {
            '&::placeholder': {
              color: t.textTertiary,
              opacity: 1,
            },
          },
        },
      },
      MuiCard: {
        styleOverrides: {
          root: {
            border: `1px solid ${t.border}`,
            boxShadow: 'none',
            backgroundColor: 'transparent',
          },
        },
      },
      MuiDialog: {
        styleOverrides: {
          paper: { border: `1px solid ${t.border}`, boxShadow: 'none' },
        },
      },
      MuiDialogTitle: {
        styleOverrides: {
          root: { fontSize: '1.375rem', fontWeight: 400, fontFamily: FONT_SERIF },
        },
      },
      MuiTooltip: {
        defaultProps: { arrow: true },
        styleOverrides: {
          tooltip: {
            fontSize: '0.72rem',
            fontWeight: 500,
            letterSpacing: '0.01em',
            backgroundColor: t.text,
            color: mode === 'dark' ? '#141414' : '#FAFAF8',
            padding: '4px 10px',
          },
          arrow: {
            color: t.text,
          },
        },
      },
      MuiTableHead: {
        styleOverrides: {
          root: {
            '& .MuiTableCell-head': {
              fontFamily: FONT_SERIF,
              fontWeight: 400,
              fontSize: '0.75rem',
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              backgroundColor: 'transparent',
              color: t.textSecondary,
              borderBottom: `1px solid ${t.border}`,
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
        styleOverrides: {
          root: {
            fontWeight: 500,
            fontSize: '0.75rem',
            height: 24,
          },
          sizeSmall: {
            height: 20,
            fontSize: '0.7rem',
          },
          outlined: {
            borderColor: t.borderSubtle,
          },
          colorPrimary: {
            backgroundColor: t.text,
            color: mode === 'dark' ? '#141414' : '#FAFAF8',
          },
        },
      },
      MuiSelect: {
        defaultProps: { size: 'small' },
        styleOverrides: {
          root: {
            fontSize: '0.875rem',
            backgroundColor: mode === 'dark' ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
            '&:hover': {
              backgroundColor: mode === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)',
            },
          },
          icon: {
            color: t.textSecondary,
            right: 8,
            transition: 'transform 0.15s ease',
          },
        },
      },
      MuiMenu: {
        styleOverrides: {
          paper: {
            border: `1px solid ${t.border}`,
            boxShadow: 'none',
            marginTop: 2,
          },
          list: {
            padding: '4px 0',
          },
        },
      },
      MuiMenuItem: {
        styleOverrides: {
          root: {
            fontSize: '0.84rem',
            minHeight: 36,
            transition: 'background-color 0.1s ease',
            '&:hover': {
              backgroundColor: t.hover,
            },
            '&.Mui-selected': {
              backgroundColor: t.active,
              '&:hover': {
                backgroundColor: t.active,
              },
            },
          },
        },
      },
      MuiInputLabel: {
        defaultProps: { shrink: true },
        styleOverrides: {
          root: {
            fontSize: '0.75rem',
            fontWeight: 500,
            letterSpacing: '0.04em',
            color: t.textSecondary,
            position: 'relative',
            transform: 'none',
            marginBottom: 6,
            '&.Mui-focused': {
              color: t.text,
            },
            '&.MuiInputLabel-shrink': {
              transform: 'none',
            },
          },
        },
      },
      MuiFormControl: {
        defaultProps: { size: 'small' },
      },
      MuiInputAdornment: {
        styleOverrides: {
          root: {
            color: t.textSecondary,
          },
        },
      },
      MuiSwitch: {
        styleOverrides: {
          root: {
            width: 40,
            height: 22,
            padding: 0,
          },
          switchBase: {
            padding: 3,
            '&.Mui-checked': {
              transform: 'translateX(18px)',
              color: mode === 'dark' ? '#141414' : '#FAFAF8',
              '& + .MuiSwitch-track': {
                backgroundColor: t.text,
                opacity: 1,
              },
            },
          },
          thumb: {
            width: 16,
            height: 16,
            boxShadow: 'none',
          },
          track: {
            backgroundColor: t.borderSubtle,
            opacity: 1,
          },
        },
      },
      MuiRadio: {
        styleOverrides: {
          root: {
            color: t.border,
            padding: 6,
            '&.Mui-checked': {
              color: t.text,
            },
            '& .MuiSvgIcon-root': {
              fontSize: 18,
            },
          },
        },
      },
      MuiFormControlLabel: {
        styleOverrides: {
          root: {
            gap: 4,
          },
        },
      },
      MuiCheckbox: {
        styleOverrides: {
          root: {
            color: t.border,
            padding: 6,
            '&.Mui-checked': {
              color: t.text,
            },
            '& .MuiSvgIcon-root': {
              fontSize: 18,
            },
          },
        },
      },
      MuiAlert: {
        styleOverrides: {
          root: {
            border: `1px solid`,
            boxShadow: 'none',
            fontSize: '0.84rem',
          },
          standardError: {
            borderColor: t.error,
            backgroundColor: mode === 'dark' ? 'rgba(196,107,107,0.08)' : 'rgba(158,59,59,0.06)',
          },
          standardSuccess: {
            borderColor: t.success,
            backgroundColor: mode === 'dark' ? 'rgba(107,158,122,0.08)' : 'rgba(22,163,74,0.06)',
          },
          standardWarning: {
            borderColor: t.warning,
            backgroundColor: mode === 'dark' ? 'rgba(196,168,75,0.08)' : 'rgba(139,115,50,0.06)',
          },
          standardInfo: {
            borderColor: t.textSecondary,
            backgroundColor: mode === 'dark' ? 'rgba(163,163,163,0.06)' : 'rgba(82,82,82,0.04)',
          },
        },
      },
      MuiLinearProgress: {
        styleOverrides: {
          root: {
            height: 3,
            backgroundColor: t.borderSubtle,
          },
          bar: {
            backgroundColor: t.text,
          },
        },
      },
      MuiCircularProgress: {
        defaultProps: { thickness: 3 },
        styleOverrides: {
          root: {
            color: t.text,
          },
        },
      },
      MuiDivider: {
        styleOverrides: {
          root: {
            borderColor: t.borderSubtle,
          },
        },
      },
      MuiDrawer: {
        styleOverrides: {
          paper: {
            boxShadow: 'none',
            backgroundImage: 'none',
            backgroundColor: t.bg,
          },
        },
      },
      MuiAvatar: {
        styleOverrides: {
          root: {
            fontSize: '0.78rem',
            fontWeight: 600,
            letterSpacing: '0.02em',
          },
        },
      },
      MuiPopover: {
        styleOverrides: {
          paper: {
            border: `1px solid ${t.border}`,
            boxShadow: 'none',
            backgroundImage: 'none',
          },
        },
      },
      MuiToggleButtonGroup: {
        styleOverrides: {
          root: {
            gap: 0,
          },
        },
      },
      MuiToggleButton: {
        styleOverrides: {
          root: {
            borderColor: t.border,
            textTransform: 'none',
            fontWeight: 500,
            fontSize: '0.82rem',
            padding: '4px 12px',
            transition: 'all 0.12s ease',
            '&.Mui-selected': {
              backgroundColor: t.text,
              color: mode === 'dark' ? '#141414' : '#FAFAF8',
              '&:hover': {
                backgroundColor: mode === 'dark' ? '#C4C4C4' : '#4D4842',
              },
            },
          },
        },
      },
      MuiFab: {
        styleOverrides: {
          root: {
            boxShadow: 'none',
            '&:hover': {
              boxShadow: 'none',
            },
          },
        },
      },
      MuiAppBar: {
        styleOverrides: {
          root: {
            boxShadow: 'none',
            backgroundImage: 'none',
            borderBottom: `1px solid ${t.borderSubtle}`,
            backgroundColor: t.bg,
          },
        },
      },
      MuiToolbar: {
        styleOverrides: {
          root: {
            minHeight: '48px !important',
          },
        },
      },
      MuiTablePagination: {
        styleOverrides: {
          root: {
            fontSize: '0.82rem',
            borderTop: `1px solid ${t.borderSubtle}`,
          },
          selectLabel: {
            fontSize: '0.82rem',
            color: t.textSecondary,
          },
          displayedRows: {
            fontSize: '0.82rem',
            color: t.textSecondary,
          },
          select: {
            fontSize: '0.82rem',
          },
          actions: {
            '& .MuiIconButton-root': {
              color: t.textSecondary,
              '&:hover': {
                color: t.text,
                backgroundColor: t.hover,
              },
            },
          },
        },
      },
      MuiLink: {
        styleOverrides: {
          root: {
            color: t.text,
            textDecorationColor: t.borderSubtle,
            fontWeight: 500,
            transition: 'text-decoration-color 0.15s ease',
            '&:hover': {
              textDecorationColor: t.text,
            },
          },
        },
      },
      MuiListItemIcon: {
        styleOverrides: {
          root: {
            color: t.textSecondary,
            minWidth: 36,
          },
        },
      },
      MuiListItemText: {
        styleOverrides: {
          primary: {
            fontSize: '0.875rem',
            fontWeight: 500,
          },
          secondary: {
            fontSize: '0.78rem',
          },
        },
      },
      MuiSkeleton: {
        styleOverrides: {
          root: {
            backgroundColor: t.borderSubtle,
          },
        },
      },
      MuiBadge: {
        styleOverrides: {
          badge: {
            fontSize: '0.65rem',
            fontWeight: 600,
            minWidth: 16,
            height: 16,
          },
        },
      },
      MuiIconButton: {
        styleOverrides: {
          root: {
            color: t.textSecondary,
            transition: 'all 0.12s ease',
            '&:hover': {
              color: t.text,
            },
          },
        },
      },
    },
  });
}

import { createTheme, type PaletteMode } from '@mui/material';

const FONT_SERIF = '"Instrument Serif", "Source Serif 4", "Georgia", serif';
const FONT_SANS = '"Inter", "SF Pro", system-ui, sans-serif';
const FONT_MONO = '"Geist Mono", "JetBrains Mono", monospace';

export { FONT_MONO, FONT_SERIF };

const light = {
  bg: '#FAFAF9',
  text: '#000000',
  textSecondary: '#525252',
  textTertiary: '#737373',
  textDisabled: '#A3A3A3',
  border: '#171717',
  borderSubtle: '#E5E5E5',
  surface: '#FFFFFF',
  hover: '#F5F5F4',
  active: '#EBEBEA',
  primary: '#000000',
  primaryLight: '#F5F5F4',
  primaryDark: '#171717',
  secondary: { main: '#525252', light: '#737373', dark: '#404040' },
  error: '#9E3B3B',
  success: '#16A34A',
  warning: '#8B7332',
  codeBg: '#1C1B1A',
  codeText: '#E8E6E2',
  shadow: 'none',
  scrollThumb: 'rgba(0,0,0,0.15)',
  scrollThumbHover: 'rgba(0,0,0,0.25)',
  grey: {
    50: '#FAFAF9', 100: '#F5F5F4', 200: '#E5E5E5', 300: '#D4D4D4',
    400: '#A3A3A3', 500: '#737373', 600: '#525252', 700: '#404040',
    800: '#262626', 900: '#171717',
  },
  kindle: {
    cream: '#FAFAF9', parchment: '#F5F5F4', sepia: '#E5E5E5',
    inkBrown: '#000000',
  },
};

const dark = {
  bg: '#0F0F0E',
  text: '#EEEEEC',
  textSecondary: '#A3A3A3',
  textTertiary: '#737373',
  textDisabled: '#6B6B6B',
  border: '#404040',
  borderSubtle: '#262626',
  surface: '#171717',
  hover: '#1C1C1A',
  active: '#262624',
  primary: '#EEEEEC',
  primaryLight: '#1C1C1A',
  primaryDark: '#FAFAF9',
  secondary: { main: '#A3A3A3', light: '#D4D4D4', dark: '#737373' },
  error: '#C46B6B',
  success: '#6B9E7A',
  warning: '#C4A84B',
  codeBg: '#080807',
  codeText: '#CCCCCA',
  shadow: 'none',
  scrollThumb: 'rgba(255,255,255,0.12)',
  scrollThumbHover: 'rgba(255,255,255,0.2)',
  grey: {
    50: '#171717', 100: '#1C1C1A', 200: '#262626', 300: '#404040',
    400: '#525252', 500: '#737373', 600: '#A3A3A3', 700: '#D4D4D4',
    800: '#E5E5E5', 900: '#FAFAF9',
  },
  kindle: {
    cream: '#0F0F0E', parchment: '#171717', sepia: '#262626',
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
        contrastText: mode === 'dark' ? '#000000' : '#FFFFFF',
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
      h1: { fontFamily: FONT_SERIF, fontSize: '3rem', fontWeight: 400, letterSpacing: '-0.02em' },
      h2: { fontFamily: FONT_SERIF, fontSize: '2.25rem', fontWeight: 400, letterSpacing: '-0.02em' },
      h3: { fontFamily: FONT_SERIF, fontSize: '1.875rem', fontWeight: 400, letterSpacing: '-0.02em' },
      h4: { fontFamily: FONT_SERIF, fontSize: '1.5rem', fontWeight: 400, letterSpacing: '-0.02em' },
      h5: {
        fontFamily: FONT_SERIF,
        fontSize: '1.25rem',
        fontWeight: 400,
        lineHeight: 1.3,
        letterSpacing: '-0.01em',
      },
      h6: {
        fontFamily: FONT_SERIF,
        fontSize: '1.125rem',
        fontWeight: 400,
        lineHeight: 1.3,
        letterSpacing: '-0.01em',
      },
      subtitle1: { fontSize: '0.875rem', fontWeight: 600, lineHeight: 1.4 },
      subtitle2: { fontSize: '0.82rem', fontWeight: 600, lineHeight: 1.4 },
      body1: { fontSize: '0.938rem', lineHeight: 1.7 },
      body2: { fontSize: '0.875rem', lineHeight: 1.6 },
      caption: { fontSize: '0.75rem', lineHeight: 1.4 },
      overline: {
        fontFamily: FONT_SERIF,
        fontSize: '0.75rem',
        fontWeight: 400,
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
            color: mode === 'dark' ? '#000000' : '#FFFFFF',
            boxShadow: 'none',
            '&:hover': {
              backgroundColor: mode === 'dark' ? '#D4D4D4' : '#262626',
              boxShadow: 'none',
            },
          },
          outlined: {
            backgroundColor: mode === 'dark' ? t.bg : '#FFFFFF',
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
            color: mode === 'dark' ? '#000000' : '#FFFFFF',
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
            color: mode === 'dark' ? '#000000' : '#FFFFFF',
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
              color: mode === 'dark' ? '#000000' : '#FFFFFF',
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
            borderLeft: `1px solid ${t.border}`,
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
              color: mode === 'dark' ? '#000000' : '#FFFFFF',
              '&:hover': {
                backgroundColor: mode === 'dark' ? '#D4D4D4' : '#262626',
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
            transition: 'all 0.12s ease',
          },
        },
      },
    },
  });
}

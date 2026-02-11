import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

import { PaletteMode, ThemeProvider as MuiThemeProvider } from '@mui/material';

import { STORAGE_KEYS } from '../lib/storage-keys';
import { createAppTheme } from '../theme';

export type ThemePreference = 'light' | 'dark' | 'system';

interface ThemeContextValue {
  mode: PaletteMode;
  preference: ThemePreference;
  setPreference: (preference: ThemePreference) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

function getSystemMode(): PaletteMode {
  if (typeof window !== 'undefined' && window.matchMedia) {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  return 'light';
}

function getInitialPreference(): ThemePreference {
  const stored = localStorage.getItem(STORAGE_KEYS.THEME_MODE);
  if (stored === 'dark' || stored === 'light' || stored === 'system') {
    return stored;
  }
  return 'light';
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [preference, setPreferenceState] = useState<ThemePreference>(getInitialPreference);
  const [systemMode, setSystemMode] = useState<PaletteMode>(getSystemMode);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = (e: MediaQueryListEvent) => {
      setSystemMode(e.matches ? 'dark' : 'light');
    };
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  const mode = preference === 'system' ? systemMode : preference;

  const setPreference = useCallback((newPreference: ThemePreference) => {
    setPreferenceState(newPreference);
    localStorage.setItem(STORAGE_KEYS.THEME_MODE, newPreference);
  }, []);

  const theme = useMemo(() => createAppTheme(mode), [mode]);

  useEffect(() => {
    const color = theme.palette.grey[200];
    const metaThemeColor = document.querySelector('meta[name="theme-color"]');
    if (metaThemeColor) {
      const parent = metaThemeColor.parentNode;
      if (parent) {
        parent.removeChild(metaThemeColor);
        const newMeta = document.createElement('meta');
        newMeta.name = 'theme-color';
        newMeta.content = color;
        parent.appendChild(newMeta);
      }
    }
  }, [theme]);

  const value = useMemo(
    () => ({ mode, preference, setPreference }),
    [mode, preference, setPreference]
  );

  return (
    <ThemeContext.Provider value={value}>
      <MuiThemeProvider theme={theme}>{children}</MuiThemeProvider>
    </ThemeContext.Provider>
  );
}

export function useThemeMode() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useThemeMode must be used within ThemeProvider');
  }
  return context;
}

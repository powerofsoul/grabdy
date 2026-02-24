import { type ReactNode, useMemo } from 'react';

import type { SdkChatStyle } from '@grabdy/contracts';
import { createTheme, CssBaseline, ThemeProvider } from '@mui/material';

import { createAppTheme } from '@/theme';

interface EmbedThemeProviderProps {
  style: SdkChatStyle | undefined;
  children: ReactNode;
}

export function EmbedThemeProvider({ style, children }: EmbedThemeProviderProps) {
  const primaryColor = style?.primaryColor;
  const theme = useMemo(() => {
    const base = createAppTheme('light');
    if (!primaryColor) return base;

    return createTheme(base, {
      palette: { primary: { main: primaryColor } },
    });
  }, [primaryColor]);

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      {children}
    </ThemeProvider>
  );
}

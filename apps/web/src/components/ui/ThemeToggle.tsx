import { Box, IconButton, Typography } from '@mui/material';
import { MoonIcon, SunIcon } from '@phosphor-icons/react';

import { useThemeMode } from '@/context/ThemeContext';

export function ThemeToggle({ collapsed }: { collapsed?: boolean }) {
  const { preference, setPreference } = useThemeMode();

  const isDark = preference === 'dark';

  const toggle = () => {
    setPreference(isDark ? 'light' : 'dark');
  };

  if (collapsed) {
    return (
      <IconButton size="small" onClick={toggle} sx={{ color: 'text.secondary' }}>
        {isDark ? <MoonIcon size={20} weight="light" color="currentColor" /> : <SunIcon size={20} weight="light" color="currentColor" />}
      </IconButton>
    );
  }

  return (
    <Box
      onClick={toggle}
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1,
        cursor: 'pointer',
        color: 'text.secondary',
        '&:hover': { color: 'text.primary' },
      }}
    >
      {isDark ? <MoonIcon size={18} weight="light" color="currentColor" /> : <SunIcon size={18} weight="light" color="currentColor" />}
      <Typography sx={{ fontSize: '0.82rem' }}>
        {isDark ? 'Dark' : 'Light'}
      </Typography>
    </Box>
  );
}

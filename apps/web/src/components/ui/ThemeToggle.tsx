import { Box, IconButton, Typography } from '@mui/material';
import { Moon, Sun } from '@phosphor-icons/react';

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
        {isDark ? <Moon size={20} weight="light" color="currentColor" /> : <Sun size={20} weight="light" color="currentColor" />}
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
      {isDark ? <Moon size={18} weight="light" color="currentColor" /> : <Sun size={18} weight="light" color="currentColor" />}
      <Typography sx={{ fontSize: '0.82rem' }}>
        {isDark ? 'Dark' : 'Light'}
      </Typography>
    </Box>
  );
}

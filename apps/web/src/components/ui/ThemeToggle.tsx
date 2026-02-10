import { IconButton, Tooltip } from '@mui/material';
import { Monitor, Moon, Sun } from 'lucide-react';

import { type ThemePreference, useThemeMode } from '@/context/ThemeContext';

const CYCLE: ThemePreference[] = ['light', 'dark', 'system'];
const LABELS: Record<ThemePreference, string> = {
  light: 'Light mode',
  dark: 'Dark mode',
  system: 'System theme',
};

export function ThemeToggle() {
  const { preference, setPreference } = useThemeMode();

  const handleClick = () => {
    const currentIndex = CYCLE.indexOf(preference);
    const next = CYCLE[(currentIndex + 1) % CYCLE.length];
    setPreference(next);
  };

  const icon =
    preference === 'light' ? (
      <Sun size={20} />
    ) : preference === 'dark' ? (
      <Moon size={20} />
    ) : (
      <Monitor size={20} />
    );

  return (
    <Tooltip title={LABELS[preference]}>
      <IconButton onClick={handleClick} size="small" sx={{ color: 'text.secondary' }}>
        {icon}
      </IconButton>
    </Tooltip>
  );
}

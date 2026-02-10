import { useState } from 'react';
import { IconButton, Menu, MenuItem, ListItemIcon, ListItemText, Tooltip } from '@mui/material';
import { Moon, MoonStar, Sun } from 'lucide-react';

import { type ThemePreference, useThemeMode } from '@/context/ThemeContext';

const OPTIONS: { value: ThemePreference; label: string; icon: React.ReactNode }[] = [
  { value: 'light', label: 'Light', icon: <Sun size={16} /> },
  { value: 'dark', label: 'Dark', icon: <Moon size={16} /> },
  { value: 'system', label: 'System', icon: <MoonStar size={16} /> },
];

export function ThemeToggle() {
  const { preference, setPreference } = useThemeMode();
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);

  const currentIcon =
    preference === 'light' ? (
      <Sun size={20} />
    ) : preference === 'dark' ? (
      <Moon size={20} />
    ) : (
      <MoonStar size={20} />
    );

  return (
    <>
      <Tooltip title="Theme">
        <IconButton
          onClick={(e) => setAnchorEl(e.currentTarget)}
          size="small"
          sx={{ color: 'text.secondary' }}
        >
          {currentIcon}
        </IconButton>
      </Tooltip>
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={() => setAnchorEl(null)}
        slotProps={{ paper: { sx: { minWidth: 140 } } }}
      >
        {OPTIONS.map((opt) => (
          <MenuItem
            key={opt.value}
            selected={preference === opt.value}
            onClick={() => {
              setPreference(opt.value);
              setAnchorEl(null);
            }}
          >
            <ListItemIcon sx={{ minWidth: 32 }}>{opt.icon}</ListItemIcon>
            <ListItemText>{opt.label}</ListItemText>
          </MenuItem>
        ))}
      </Menu>
    </>
  );
}

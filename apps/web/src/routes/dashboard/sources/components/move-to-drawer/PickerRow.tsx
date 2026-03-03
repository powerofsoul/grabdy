import type { ReactNode } from 'react';

import { alpha, Box, Typography } from '@mui/material';

interface PickerRowProps {
  label: string;
  icon: ReactNode;
  selected: boolean;
  onClick: () => void;
  ct: string;
  depth: number;
}

export function PickerRow({ label, icon, selected, onClick, ct, depth }: PickerRowProps) {
  return (
    <Box
      onClick={onClick}
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 0.75,
        height: 32,
        pl: 2 + depth * 2,
        pr: 2,
        cursor: 'pointer',
        bgcolor: selected ? alpha(ct, 0.08) : 'transparent',
        '&:hover': { bgcolor: alpha(ct, selected ? 0.1 : 0.03) },
      }}
    >
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          color: selected ? 'text.primary' : alpha(ct, 0.5),
        }}
      >
        {icon}
      </Box>
      <Typography
        noWrap
        sx={{
          fontSize: 13,
          fontWeight: selected ? 600 : 400,
          color: selected ? 'text.primary' : 'text.secondary',
        }}
      >
        {label}
      </Typography>
    </Box>
  );
}

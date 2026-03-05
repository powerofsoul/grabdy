import { type ReactNode, useState } from 'react';

import { alpha, Box, Collapse, Typography, useTheme } from '@mui/material';
import { CaretDownIcon } from '@phosphor-icons/react';

interface MetadataSectionProps {
  title: string;
  icon: ReactNode;
  children: ReactNode;
  defaultOpen?: boolean;
}

export function MetadataSection({
  title,
  icon,
  children,
  defaultOpen = true,
}: MetadataSectionProps) {
  const [open, setOpen] = useState(defaultOpen);
  const theme = useTheme();
  const ct = theme.palette.text.primary;

  return (
    <Box sx={{ mb: 0.5 }}>
      <Box
        onClick={() => setOpen((p) => !p)}
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          py: 1,
          px: 0.5,
          cursor: 'pointer',
          '&:hover': { bgcolor: alpha(ct, 0.03) },
        }}
      >
        <Box sx={{ color: 'text.secondary', display: 'flex' }}>{icon}</Box>
        <Typography
          variant="caption"
          sx={{
            flex: 1,
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
            color: 'text.secondary',
          }}
        >
          {title}
        </Typography>
        <CaretDownIcon
          size={14}
          weight="bold"
          style={{
            transform: open ? 'rotate(0deg)' : 'rotate(-90deg)',
            transition: 'transform 0.15s',
            color: theme.palette.text.disabled,
          }}
        />
      </Box>
      <Collapse in={open}>
        <Box sx={{ pl: 0.5, pb: 1.5 }}>{children}</Box>
      </Collapse>
    </Box>
  );
}

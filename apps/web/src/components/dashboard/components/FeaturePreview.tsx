import { type ReactNode } from 'react';

import { Box, Typography } from '@mui/material';

interface FeaturePreviewProps {
  icon: ReactNode;
  title: string;
  description: string;
  color: string;
}

export function FeaturePreview({ icon, title, description, color }: FeaturePreviewProps) {
  return (
    <Box sx={{ flex: 1 }}>
      <Box
        sx={{
          width: 36,
          height: 36,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          bgcolor: color,
          mb: 1.5,
          color: 'text.secondary',
        }}
      >
        {icon}
      </Box>
      <Typography sx={{ fontSize: '0.875rem', fontWeight: 500, color: 'text.primary', mb: 0.5 }}>
        {title}
      </Typography>
      <Typography sx={{ fontSize: '0.8125rem', color: 'text.secondary' }}>{description}</Typography>
    </Box>
  );
}

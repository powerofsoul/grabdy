import { type ReactNode } from 'react';

import { Box, Button, Typography } from '@mui/material';

interface EmptyStateProps {
  icon: ReactNode;
  message: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function EmptyState({ icon, message, description, actionLabel, onAction }: EmptyStateProps) {
  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        py: 8,
        px: 3,
        textAlign: 'center',
        color: 'text.secondary',
      }}
    >
      <Box sx={{ mb: 2, opacity: 0.5 }}>{icon}</Box>
      <Typography variant="h6" sx={{ mb: 0.5, color: 'text.primary' }}>
        {message}
      </Typography>
      {description && (
        <Typography variant="body2" sx={{ mb: 2 }}>
          {description}
        </Typography>
      )}
      {actionLabel && onAction && (
        <Button variant="contained" onClick={onAction}>
          {actionLabel}
        </Button>
      )}
    </Box>
  );
}

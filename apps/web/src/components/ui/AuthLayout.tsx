import { type ReactNode } from 'react';

import { Box, IconButton, Tooltip, Typography } from '@mui/material';
import { useRouter } from '@tanstack/react-router';
import { ArrowLeft } from '@phosphor-icons/react';

interface AuthLayoutProps {
  children: ReactNode;
  title: string;
  subtitle?: string;
  showBack?: boolean;
  maxWidth?: number;
}

export function AuthLayout({
  children,
  title,
  subtitle,
  showBack = true,
  maxWidth = 400,
}: AuthLayoutProps) {
  const router = useRouter();

  return (
    <Box
      sx={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        bgcolor: 'background.default',
        overflow: 'auto',
        WebkitOverflowScrolling: 'touch',
      }}
    >
      {showBack && (
        <Box
          sx={{
            position: 'sticky',
            top: 0,
            zIndex: 10,
            bgcolor: 'background.default',
            px: 1,
            py: 1,
          }}
        >
          <Tooltip title="Go back">
            <IconButton
              onClick={() => router.history.back()}
              sx={{ color: 'text.secondary', '&:hover': { bgcolor: 'action.hover' } }}
            >
              <ArrowLeft size={22} weight="light" color="currentColor" />
            </IconButton>
          </Tooltip>
        </Box>
      )}

      <Box
        sx={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          px: 3,
          pb: 4,
          pt: showBack ? 0 : 4,
        }}
      >
        <Box sx={{ width: '100%', maxWidth }}>
          <Box sx={{ mb: 4 }}>
            <Typography
              variant="h4"
              sx={{
                color: 'text.primary',
                mb: subtitle ? 1 : 0,
              }}
            >
              {title}
            </Typography>
            {subtitle && (
              <Typography variant="body2" color="text.secondary">
                {subtitle}
              </Typography>
            )}
          </Box>
          {children}
        </Box>
      </Box>
    </Box>
  );
}

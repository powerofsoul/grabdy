import { type ReactNode } from 'react';

import { alpha, Box, IconButton, Tooltip, Typography, useTheme } from '@mui/material';
import { useRouter } from '@tanstack/react-router';
import { ArrowLeft } from 'lucide-react';

interface DashboardPageProps {
  title?: string;
  subtitle?: string;
  icon?: ReactNode;
  actions?: ReactNode;
  maxWidth?: number | false;
  noPadding?: boolean;
  showBack?: boolean;
  children: ReactNode;
}

export function DashboardPage({
  title,
  subtitle,
  icon,
  actions,
  maxWidth,
  noPadding,
  showBack,
  children,
}: DashboardPageProps) {
  const theme = useTheme();
  const router = useRouter();
  const ct = theme.palette.text.primary;

  const contentMaxWidth = maxWidth !== undefined
    ? maxWidth || undefined
    : { xs: '100%', lg: 960, xl: 1120 };

  return (
    <Box
      sx={{
        bgcolor: 'background.default',
        minHeight: '100%',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Header */}
      {title && (
        <Box
          sx={{
            px: { xs: 2, md: '32px' },
            pt: { xs: 2, md: '28px' },
            pb: { xs: 1.5, md: '20px' },
          }}
        >
          <Box sx={{ maxWidth: contentMaxWidth, mx: 'auto', width: '100%' }}>
            {/* Title row: back + icon + title + actions */}
            <Box
              sx={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: { xs: 1.5, md: 2 },
                flexWrap: 'wrap',
              }}
            >
              {/* Left side: back + icon + title */}
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flex: 1, minWidth: 0 }}>
                {showBack && (
                  <Tooltip title="Go back">
                    <IconButton
                      onClick={() => router.history.back()}
                      size="small"
                      sx={{
                        color: alpha(ct, 0.35),
                        flexShrink: 0,
                        '&:hover': { color: 'text.primary' },
                      }}
                    >
                      <ArrowLeft size={20} />
                    </IconButton>
                  </Tooltip>
                )}
                {icon && (
                  <Box
                    sx={{
                      width: 40,
                      height: 40,
                      borderRadius: 1,
                      bgcolor: 'grey.100',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'text.secondary',
                      flexShrink: 0,
                    }}
                  >
                    {icon}
                  </Box>
                )}
                <Box sx={{ minWidth: 0 }}>
                  <Typography
                    variant="h5"
                    className="font-serif"
                    sx={{ fontWeight: 500, fontSize: '1.625rem', letterSpacing: '-0.01em', lineHeight: 1.2 }}
                    noWrap
                  >
                    {title}
                  </Typography>
                  {subtitle && (
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                      {subtitle}
                    </Typography>
                  )}
                </Box>
              </Box>

              {/* Right side: actions */}
              {actions && (
                <Box sx={{ display: 'flex', gap: 1, flexShrink: 0, alignItems: 'center' }}>
                  {actions}
                </Box>
              )}
            </Box>
          </Box>
        </Box>
      )}

      {/* Content */}
      <Box
        sx={{
          flex: 1,
          px: noPadding ? 0 : { xs: 2, md: '32px' },
          pb: noPadding ? 0 : { xs: 2, md: '32px' },
          pt: noPadding ? 0 : { xs: 1, md: '12px' },
        }}
      >
        <Box sx={{ maxWidth: contentMaxWidth, mx: 'auto', width: '100%' }}>
          {children}
        </Box>
      </Box>
    </Box>
  );
}

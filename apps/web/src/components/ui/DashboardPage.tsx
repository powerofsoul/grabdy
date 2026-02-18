import { type ReactNode } from 'react';

import {
  alpha,
  Box,
  IconButton,
  Tooltip,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import { ArrowLeftIcon, ListIcon } from '@phosphor-icons/react';
import { useRouter } from '@tanstack/react-router';

import { useMobileSidebar } from '@/components/ui/Sidebar';

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
  const isMobile = useMediaQuery('(max-width:767px)');
  const { toggle: toggleMobileSidebar } = useMobileSidebar();

  const contentMaxWidth =
    maxWidth !== undefined ? maxWidth || undefined : { xs: '100%', lg: 960, xl: 1120 };

  return (
    <Box
      sx={{
        bgcolor: 'background.default',
        minHeight: '100%',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Header — on mobile, only show if there's a title (pages without titles handle their own header) */}
      {title && (
        <Box
          sx={{
            px: { xs: 2, md: '32px' },
            pt: { xs: 2, md: '28px' },
            pb: { xs: 1.5, md: '20px' },
          }}
        >
          <Box sx={{ maxWidth: contentMaxWidth, mx: 'auto', width: '100%' }}>
            {/* Title row: title left, hamburger right on mobile */}
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: { xs: 1, md: 2 },
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
                      <ArrowLeftIcon size={20} weight="light" color="currentColor" />
                    </IconButton>
                  </Tooltip>
                )}
                {icon && (
                  <Box
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      color: 'text.secondary',
                      flexShrink: 0,
                    }}
                  >
                    {icon}
                  </Box>
                )}
                {title && (
                  <Box sx={{ minWidth: 0 }}>
                    <Typography variant="h3" noWrap>
                      {title}
                    </Typography>
                    {subtitle && !isMobile && (
                      <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                        {subtitle}
                      </Typography>
                    )}
                  </Box>
                )}
              </Box>

              {/* Right side: actions on desktop, hamburger on mobile */}
              {isMobile ? (
                <IconButton
                  onClick={toggleMobileSidebar}
                  size="small"
                  sx={{ flexShrink: 0, color: 'text.primary' }}
                >
                  <ListIcon size={22} weight="regular" />
                </IconButton>
              ) : (
                actions && (
                  <Box sx={{ display: 'flex', gap: 1, flexShrink: 0, alignItems: 'center' }}>
                    {actions}
                  </Box>
                )
              )}
            </Box>

            {/* Mobile subtitle below title row */}
            {isMobile && subtitle && title && (
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                {subtitle}
              </Typography>
            )}

            {/* Mobile actions row below */}
            {isMobile && actions && (
              <Box sx={{ display: 'flex', gap: 1, mt: 1.5, flexWrap: 'wrap' }}>{actions}</Box>
            )}
          </Box>
        </Box>
      )}

      {/* Content */}
      {noPadding ? (
        <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          {children}
        </Box>
      ) : (
        <Box
          sx={{
            flex: 1,
            px: { xs: 2, md: '32px' },
            pb: { xs: 2, md: '32px' },
            pt: { xs: 1, md: '12px' },
          }}
        >
          <Box sx={{ maxWidth: contentMaxWidth, mx: 'auto', width: '100%' }}>{children}</Box>
        </Box>
      )}
    </Box>
  );
}

import { alpha, Box, Typography, useTheme } from '@mui/material';
import { LockSimpleIcon } from '@phosphor-icons/react';

import { MOCK_URL } from '../constants';

import { MockWebpage } from './MockWebpage';
import { MockWidget } from './MockWidget';

export function MockBrowserFrame() {
  const theme = useTheme();
  const dotColor = alpha(theme.palette.text.primary, 0.15);

  return (
    <Box
      className="widget-browser"
      sx={{
        borderRadius: 2.5,
        border: 1,
        borderColor: 'divider',
        bgcolor: 'background.paper',
      }}
    >
      {/* Title bar */}
      <Box
        sx={{
          px: 2,
          py: 1.25,
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          bgcolor: alpha(theme.palette.text.primary, 0.03),
          borderBottom: 1,
          borderColor: 'divider',
        }}
      >
        {/* Traffic light dots */}
        <Box sx={{ display: 'flex', gap: 0.75, mr: 1 }}>
          {[0, 1, 2].map((i) => (
            <Box
              key={i}
              sx={{
                width: 10,
                height: 10,
                borderRadius: '50%',
                bgcolor: dotColor,
              }}
            />
          ))}
        </Box>

        {/* Address bar */}
        <Box
          sx={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            gap: 0.75,
            px: 1.5,
            py: 0.5,
            borderRadius: 1.5,
            bgcolor: alpha(theme.palette.text.primary, 0.04),
          }}
        >
          <LockSimpleIcon size={12} weight="fill" color={theme.palette.success.main} />
          <Typography sx={{ fontSize: '0.72rem', color: 'text.secondary' }}>{MOCK_URL}</Typography>
        </Box>
      </Box>

      {/* Page content area - no overflow hidden so the widget is visible */}
      <Box sx={{ position: 'relative', minHeight: { xs: 400, md: 480 } }}>
        <MockWebpage />
        <MockWidget />
      </Box>
    </Box>
  );
}

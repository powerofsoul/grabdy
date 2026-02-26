import { alpha, Box, Button, Typography, useTheme } from '@mui/material';
import { ArrowRightIcon } from '@phosphor-icons/react';
import { Link } from '@tanstack/react-router';

import { FEATURE_TABS } from '../constants';

export function FeatureNav({ activeIndex }: { activeIndex: number }) {
  const theme = useTheme();
  const ct = theme.palette.text.primary;

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        height: '100%',
        gap: 0.5,
      }}
    >
      {FEATURE_TABS.map((tab, i) => {
        const isActive = i === activeIndex;
        return (
          <Box
            key={tab.number}
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 2,
              py: 1.5,
              px: 2,
              borderLeft: '2px solid',
              borderColor: isActive ? 'primary.main' : 'transparent',
              transition: 'all 0.3s ease',
            }}
          >
            <Typography
              sx={{
                fontWeight: 500,
                fontSize: '0.75rem',
                color: isActive ? 'primary.main' : alpha(ct, 0.3),
                transition: 'color 0.3s ease',
                flexShrink: 0,
              }}
            >
              {tab.number}
            </Typography>
            <Typography
              sx={{
                fontWeight: isActive ? 600 : 400,
                fontSize: '0.95rem',
                color: isActive ? 'text.primary' : alpha(ct, 0.4),
                transition: 'all 0.3s ease',
              }}
            >
              {tab.title}
            </Typography>
          </Box>
        );
      })}

      <Box sx={{ mt: 3, pl: 2 }}>
        <Link to="/auth/signup" style={{ textDecoration: 'none' }}>
          <Button
            variant="contained"
            size="small"
            endIcon={<ArrowRightIcon size={16} weight="light" />}
            sx={{ px: 3, py: 1 }}
          >
            Get started
          </Button>
        </Link>
      </Box>
    </Box>
  );
}

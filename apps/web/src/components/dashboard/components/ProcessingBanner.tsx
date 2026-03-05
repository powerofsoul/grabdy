import { alpha, Box, keyframes, LinearProgress, Typography, useTheme } from '@mui/material';
import { CircleNotchIcon } from '@phosphor-icons/react';

const spin = keyframes`
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
`;

interface ProcessingBannerProps {
  processingCount: number;
  totalCount: number;
}

export function ProcessingBanner({ processingCount, totalCount }: ProcessingBannerProps) {
  const theme = useTheme();
  const ct = theme.palette.text.primary;
  const doneCount = totalCount - processingCount;
  const progress = totalCount > 0 ? (doneCount / totalCount) * 100 : 0;

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 2,
        p: 2,
        mb: 3,
        border: '1px solid',
        borderColor: 'divider',
        bgcolor: alpha(ct, 0.02),
      }}
    >
      <Box
        sx={{
          display: 'flex',
          animation: `${spin} 1s linear infinite`,
          color: 'text.secondary',
          flexShrink: 0,
        }}
      >
        <CircleNotchIcon size={18} weight="light" color="currentColor" />
      </Box>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography sx={{ fontSize: '0.875rem', color: 'text.primary', mb: 0.5 }}>
          Analyzing contracts... {doneCount} of {totalCount} complete
        </Typography>
        <LinearProgress
          variant="determinate"
          value={progress}
          sx={{
            height: 3,
            bgcolor: alpha(ct, 0.06),
            '& .MuiLinearProgress-bar': {
              bgcolor: 'text.primary',
            },
          }}
        />
      </Box>
    </Box>
  );
}

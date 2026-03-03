import { Box, Skeleton } from '@mui/material';

export function PickerSkeleton() {
  return (
    <Box>
      <Skeleton variant="text" width={60} height={16} sx={{ mb: 1.5 }} />
      {[120, 90, 140].map((w, i) => (
        <Box key={i} sx={{ display: 'flex', alignItems: 'center', gap: 1, height: 32, pl: 1 }}>
          <Skeleton variant="circular" width={16} height={16} />
          <Skeleton variant="rectangular" width={16} height={16} />
          <Skeleton variant="text" width={w} height={16} />
        </Box>
      ))}
    </Box>
  );
}

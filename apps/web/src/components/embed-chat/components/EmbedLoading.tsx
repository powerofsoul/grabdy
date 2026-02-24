import { Box, CircularProgress } from '@mui/material';

export function EmbedLoading() {
  return (
    <Box
      sx={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        bgcolor: 'background.default',
      }}
    >
      <CircularProgress size={24} />
    </Box>
  );
}

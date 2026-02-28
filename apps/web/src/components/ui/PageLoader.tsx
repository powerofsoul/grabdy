import { Box, keyframes, Typography } from '@mui/material';

const pulse = keyframes`
  0%, 100% { opacity: 0.2; }
  50% { opacity: 0.6; }
`;

export function PageLoader() {
  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        py: 12,
      }}
    >
      <Typography
        sx={{
          fontSize: 18,
          fontWeight: 700,
          color: 'text.primary',
          letterSpacing: '-0.03em',
          animation: `${pulse} 1.8s ease-in-out infinite`,
        }}
      >
        grabdy
      </Typography>
    </Box>
  );
}

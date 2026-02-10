import { Box, Typography } from '@mui/material';

export function SectionDivider({ glyph = '***' }: { glyph?: string }) {
  return (
    <Box sx={{ display: 'flex', justifyContent: 'center', py: { xs: 3, md: 4 } }}>
      <Typography
        sx={{
          fontSize: '0.9rem',
          color: 'text.secondary',
          letterSpacing: '0.4em',
          opacity: 0.4,
          fontStyle: 'italic',
          userSelect: 'none',
        }}
      >
        {glyph}
      </Typography>
    </Box>
  );
}

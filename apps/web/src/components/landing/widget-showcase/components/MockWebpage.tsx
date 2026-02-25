import { alpha, Box, useTheme } from '@mui/material';

export function MockWebpage() {
  const theme = useTheme();
  const blockColor = alpha(theme.palette.text.primary, 0.06);

  return (
    <Box sx={{ p: { xs: 2, md: 3 }, display: 'flex', flexDirection: 'column', gap: 2 }}>
      {/* Nav bar placeholder */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1 }}>
        <Box sx={{ width: 24, height: 24, borderRadius: '50%', bgcolor: blockColor }} />
        <Box sx={{ width: 80, height: 10, borderRadius: 1, bgcolor: blockColor }} />
        <Box sx={{ flex: 1 }} />
        <Box sx={{ width: 48, height: 10, borderRadius: 1, bgcolor: blockColor }} />
        <Box sx={{ width: 48, height: 10, borderRadius: 1, bgcolor: blockColor }} />
        <Box sx={{ width: 48, height: 10, borderRadius: 1, bgcolor: blockColor }} />
      </Box>

      {/* Hero placeholder */}
      <Box
        sx={{
          width: '60%',
          height: { xs: 14, md: 18 },
          borderRadius: 1,
          bgcolor: blockColor,
          mb: 0.5,
        }}
      />
      <Box sx={{ width: '80%', height: 10, borderRadius: 1, bgcolor: blockColor }} />
      <Box sx={{ width: '70%', height: 10, borderRadius: 1, bgcolor: blockColor }} />

      {/* Card grid placeholder */}
      <Box sx={{ display: 'flex', gap: 1.5, mt: 2 }}>
        {[0, 1, 2].map((i) => (
          <Box
            key={i}
            sx={{
              flex: 1,
              height: { xs: 60, md: 80 },
              borderRadius: 1.5,
              bgcolor: blockColor,
            }}
          />
        ))}
      </Box>

      {/* Text lines */}
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, mt: 1 }}>
        <Box sx={{ width: '90%', height: 8, borderRadius: 1, bgcolor: blockColor }} />
        <Box sx={{ width: '75%', height: 8, borderRadius: 1, bgcolor: blockColor }} />
        <Box sx={{ width: '85%', height: 8, borderRadius: 1, bgcolor: blockColor }} />
      </Box>
    </Box>
  );
}

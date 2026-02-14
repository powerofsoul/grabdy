import { alpha, Box, Chip, Typography, useTheme } from '@mui/material';
import { MagnifyingGlassIcon } from '@phosphor-icons/react';

interface SearchFilterComponentProps {
  data: {
    query: string;
    filters: Array<{ label: string; value: string }>;
  };
}

export function SearchFilterComponent({ data }: SearchFilterComponentProps) {
  const theme = useTheme();

  return (
    <Box sx={{ p: 1.5 }}>
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          p: 1,
          borderRadius: 1,
          bgcolor: alpha(theme.palette.text.primary, 0.04),
          mb: 1,
        }}
      >
        <MagnifyingGlassIcon size={14} weight="light" color="currentColor" style={{ opacity: 0.5 }} />
        <Typography sx={{ fontSize: 12 }}>{data.query}</Typography>
      </Box>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
        {data.filters.map((filter, i) => (
          <Chip key={i} label={`${filter.label}: ${filter.value}`} size="small" sx={{ fontSize: 11 }} />
        ))}
      </Box>
    </Box>
  );
}

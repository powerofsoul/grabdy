import { useState } from 'react';

import type { ContractType } from '@grabdy/contracts';
import { alpha, Box, Typography, useTheme } from '@mui/material';
import { useNavigate } from '@tanstack/react-router';
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';

import { ActiveShape } from './ActiveShape';
import { ChartTooltip } from './ChartTooltip';
import { TYPE_CHART_OPACITIES } from './constants';

import { FONT_MONO } from '@/theme';

interface TypeCount {
  type: ContractType;
  label: string;
  count: number;
}

interface TypeBreakdownChartProps {
  breakdown: TypeCount[];
}

export function TypeBreakdownChart({ breakdown }: TypeBreakdownChartProps) {
  const theme = useTheme();
  const navigate = useNavigate();
  const ct = theme.palette.text.primary;
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  const handleTypeClick = (type: ContractType) => {
    navigate({ to: '/dashboard/contracts', search: { contractType: type } });
  };

  if (breakdown.length === 0) return null;

  const total = breakdown.reduce((sum, b) => sum + b.count, 0);

  return (
    <Box>
      <Typography
        variant="caption"
        sx={{
          color: 'text.secondary',
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
          mb: 2,
          display: 'block',
        }}
      >
        Contract types
      </Typography>

      <Box sx={{ width: '100%', height: 180, position: 'relative' }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={breakdown}
              dataKey="count"
              nameKey="label"
              cx="50%"
              cy="50%"
              innerRadius={50}
              outerRadius={75}
              strokeWidth={0}
              style={{ cursor: 'pointer' }}
              activeShape={ActiveShape}
              onMouseEnter={(_, index) => setHoveredIndex(index)}
              onMouseLeave={() => setHoveredIndex(null)}
              onClick={(_, index) => handleTypeClick(breakdown[index].type)}
            >
              {breakdown.map((entry, i) => (
                <Cell
                  key={entry.type}
                  fill={alpha(ct, TYPE_CHART_OPACITIES[i % TYPE_CHART_OPACITIES.length])}
                />
              ))}
            </Pie>
            <Tooltip content={<ChartTooltip />} />
          </PieChart>
        </ResponsiveContainer>
        <Box
          sx={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            textAlign: 'center',
            pointerEvents: 'none',
            zIndex: 0,
          }}
        >
          <Typography
            sx={{
              fontFamily: FONT_MONO,
              fontSize: '1.25rem',
              fontWeight: 500,
              color: 'text.primary',
              lineHeight: 1,
            }}
          >
            {total}
          </Typography>
        </Box>
      </Box>

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75, mt: 2 }}>
        {breakdown.map((entry, i) => (
          <Box
            key={entry.type}
            onClick={() => handleTypeClick(entry.type)}
            onMouseEnter={() => setHoveredIndex(i)}
            onMouseLeave={() => setHoveredIndex(null)}
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1,
              cursor: 'pointer',
              px: 0.5,
              mx: -0.5,
              bgcolor: hoveredIndex === i ? 'action.hover' : 'transparent',
              '&:hover': { bgcolor: 'action.hover' },
            }}
          >
            <Box
              sx={{
                width: 10,
                height: 10,
                flexShrink: 0,
                bgcolor: alpha(ct, TYPE_CHART_OPACITIES[i % TYPE_CHART_OPACITIES.length]),
              }}
            />
            <Typography variant="body2" sx={{ color: 'text.secondary', flex: 1 }} noWrap>
              {entry.label}
            </Typography>
            <Typography
              variant="body2"
              sx={{ fontFamily: FONT_MONO, color: 'text.primary', flexShrink: 0 }}
            >
              {entry.count}
            </Typography>
          </Box>
        ))}
      </Box>
    </Box>
  );
}

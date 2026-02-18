import { useCallback, useState } from 'react';

import { alpha, Box, IconButton, TextField, Typography, useTheme } from '@mui/material';
import { MinusIcon, PlusIcon, TrashIcon, TrendDownIcon, TrendUpIcon } from '@phosphor-icons/react';

import { useEditMode } from '../hooks/useEditMode';

interface KpiRowComponentProps {
  data: {
    metrics: Array<{
      value: string | number;
      label: string;
      unit?: string;
      color?: string;
      trend?: {
        direction: 'up' | 'down' | 'flat';
        value: string;
      };
    }>;
  };
  onSave?: (data: Record<string, unknown>) => void;
}

export function KpiRowComponent({ data, onSave }: KpiRowComponentProps) {
  const theme = useTheme();
  const [isEditing, setIsEditing] = useState(false);
  const [draftMetrics, setDraftMetrics] = useState(data.metrics);

  const handleSave = useCallback(() => {
    onSave?.({ metrics: draftMetrics });
    setIsEditing(false);
  }, [draftMetrics, onSave]);

  const handleCancel = useCallback(() => {
    setIsEditing(false);
  }, []);

  useEditMode(handleSave, handleCancel, () => {
    setDraftMetrics(data.metrics.map((m) => ({ ...m })));
    setIsEditing(true);
  });

  const handleMetricChange = (index: number, field: 'value' | 'label', val: string) => {
    setDraftMetrics((prev) => prev.map((m, i) => (i === index ? { ...m, [field]: val } : m)));
  };

  const handleAddMetric = () => {
    setDraftMetrics((prev) => [...prev, { value: '0', label: 'New KPI' }]);
  };

  const handleDeleteMetric = (index: number) => {
    setDraftMetrics((prev) => prev.filter((_, i) => i !== index));
  };

  if (isEditing) {
    return (
      <Box className="nodrag nowheel nopan" sx={{ p: 1.5, outline: 'none' }}>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          {draftMetrics.map((m, i) => (
            <Box key={i} sx={{ display: 'flex', gap: 0.5, alignItems: 'center' }}>
              <TextField
                size="small"
                value={m.label}
                onChange={(e) => handleMetricChange(i, 'label', e.target.value)}
                placeholder="Label"
                sx={{ flex: 1, '& .MuiInputBase-input': { fontSize: 11, py: 0.25 } }}
              />
              <TextField
                size="small"
                value={String(m.value)}
                onChange={(e) => handleMetricChange(i, 'value', e.target.value)}
                placeholder="Value"
                sx={{ width: 80, '& .MuiInputBase-input': { fontSize: 11, py: 0.25 } }}
              />
              <IconButton
                size="small"
                onClick={() => handleDeleteMetric(i)}
                sx={{ width: 20, height: 20, color: alpha(theme.palette.text.primary, 0.3) }}
              >
                <TrashIcon size={12} weight="light" color="currentColor" />
              </IconButton>
            </Box>
          ))}
        </Box>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 0.5 }}>
          <IconButton size="small" onClick={handleAddMetric} sx={{ color: 'primary.main' }}>
            <PlusIcon size={14} weight="light" color="currentColor" />
          </IconButton>
        </Box>
      </Box>
    );
  }

  return (
    <Box
      sx={{
        display: 'flex',
        gap: 0,
        position: 'relative',
      }}
    >
      {data.metrics.map((metric, i) => {
        const trendColor =
          metric.trend?.direction === 'up'
            ? theme.palette.success.main
            : metric.trend?.direction === 'down'
              ? theme.palette.error.main
              : theme.palette.text.secondary;

        const TrendIcon =
          metric.trend?.direction === 'up'
            ? TrendUpIcon
            : metric.trend?.direction === 'down'
              ? TrendDownIcon
              : MinusIcon;

        return (
          <Box
            key={i}
            sx={{
              flex: 1,
              p: 1.5,
              textAlign: 'center',
              borderRight: i < data.metrics.length - 1 ? '1px solid' : 'none',
              borderColor: alpha(theme.palette.text.primary, 0.08),
            }}
          >
            <Typography sx={{ fontSize: 11, color: 'text.secondary', fontWeight: 500, mb: 0.25 }}>
              {metric.label}
            </Typography>
            <Typography
              sx={{
                fontSize: 20,
                fontWeight: 700,
                lineHeight: 1.2,
                color: metric.color ?? 'text.primary',
              }}
            >
              {metric.value}
              {metric.unit && (
                <Typography
                  component="span"
                  sx={{ fontSize: 11, fontWeight: 400, color: 'text.secondary', ml: 0.25 }}
                >
                  {metric.unit}
                </Typography>
              )}
            </Typography>
            {metric.trend && (
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 0.25,
                  mt: 0.25,
                }}
              >
                <TrendIcon size={12} weight="light" color={trendColor} />
                <Typography sx={{ fontSize: 11, color: alpha(trendColor, 0.9), fontWeight: 500 }}>
                  {metric.trend.value}
                </Typography>
              </Box>
            )}
          </Box>
        );
      })}
    </Box>
  );
}

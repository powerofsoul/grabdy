import { useCallback, useState } from 'react';

import { alpha, Box, TextField, Typography, useTheme } from '@mui/material';

import { resolveColor } from '../hooks/resolveColor';
import { useEditMode } from '../hooks/useEditMode';

interface ProgressComponentProps {
  data: {
    value: number;
    max: number;
    label: string;
    sublabel?: string;
    color?: string;
    showPercent: boolean;
    size: 'sm' | 'md' | 'lg';
  };
  onSave?: (data: Record<string, unknown>) => void;
}

const SIZE_MAP = { sm: 4, md: 8, lg: 14 } as const;

export function ProgressComponent({ data, onSave }: ProgressComponentProps) {
  const theme = useTheme();
  const [isEditing, setIsEditing] = useState(false);
  const [draftValue, setDraftValue] = useState(String(data.value));
  const [draftMax, setDraftMax] = useState(String(data.max));
  const [draftLabel, setDraftLabel] = useState(data.label);

  const barColor = resolveColor(data.color, theme.palette.primary.main);
  const percent = data.max > 0 ? Math.round((data.value / data.max) * 100) : 0;
  const height = SIZE_MAP[data.size] ?? SIZE_MAP.md;

  const handleSave = useCallback(() => {
    onSave?.({
      ...data,
      value: parseFloat(draftValue) || 0,
      max: parseFloat(draftMax) || 100,
      label: draftLabel,
    });
    setIsEditing(false);
  }, [data, draftValue, draftMax, draftLabel, onSave]);

  const handleCancel = useCallback(() => {
    setIsEditing(false);
  }, []);

  const { endEdit } = useEditMode(handleSave, handleCancel, () => {
    setDraftValue(String(data.value));
    setDraftMax(String(data.max));
    setDraftLabel(data.label);
    setIsEditing(true);
  });

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSave();
      endEdit();
    }
    if (e.key === 'Escape') {
      handleCancel();
      endEdit();
    }
  };

  if (isEditing) {
    return (
      <Box
        sx={{ p: 1.5, display: 'flex', flexDirection: 'column', gap: 0.75 }}
        className="nodrag nowheel nopan"
      >
        <TextField
          size="small"
          fullWidth
          value={draftLabel}
          onChange={(e) => setDraftLabel(e.target.value)}
          placeholder="Label"
          autoFocus
          onKeyDown={handleKeyDown}
          sx={{ '& .MuiInputBase-input': { fontSize: 12, py: 0.5 } }}
        />
        <Box sx={{ display: 'flex', gap: 0.5 }}>
          <TextField
            size="small"
            type="number"
            value={draftValue}
            onChange={(e) => setDraftValue(e.target.value)}
            placeholder="Value"
            onKeyDown={handleKeyDown}
            sx={{ flex: 1, '& .MuiInputBase-input': { fontSize: 12, py: 0.5 } }}
          />
          <TextField
            size="small"
            type="number"
            value={draftMax}
            onChange={(e) => setDraftMax(e.target.value)}
            placeholder="Max"
            onKeyDown={handleKeyDown}
            sx={{ flex: 1, '& .MuiInputBase-input': { fontSize: 12, py: 0.5 } }}
          />
        </Box>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 1.5, position: 'relative' }}>
      <Box
        sx={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', mb: 0.5 }}
      >
        <Typography sx={{ fontSize: 12, fontWeight: 500 }}>{data.label}</Typography>
        {data.showPercent && (
          <Typography sx={{ fontSize: 11, fontWeight: 600, color: barColor }}>
            {percent}%
          </Typography>
        )}
      </Box>
      {data.sublabel && (
        <Typography sx={{ fontSize: 11, color: 'text.secondary', mb: 0.5 }}>
          {data.sublabel}
        </Typography>
      )}
      <Box
        sx={{
          height,
          borderRadius: height / 2,
          bgcolor: alpha(barColor, 0.12),
          overflow: 'hidden',
        }}
      >
        <Box
          sx={{
            height: '100%',
            width: `${Math.min(percent, 100)}%`,
            bgcolor: barColor,
            borderRadius: height / 2,
            transition: 'width 400ms ease',
          }}
        />
      </Box>
    </Box>
  );
}

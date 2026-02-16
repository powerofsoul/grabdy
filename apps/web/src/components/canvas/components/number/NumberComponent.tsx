import { useCallback, useState } from 'react';

import { Box, MenuItem, Select, TextField, Typography, useTheme } from '@mui/material';

import { resolveColor } from '../../hooks/resolveColor';
import { useEditMode } from '../../hooks/useEditMode';

import { AFFIX_RATIO, SIZE_FONT_MAP, SIZE_OPTIONS } from './constants';
import type { SizeOption } from './constants';

interface NumberComponentProps {
  data: {
    value: number | string;
    prefix?: string;
    suffix?: string;
    color?: string;
    size?: SizeOption;
  };
  onSave?: (data: Record<string, unknown>) => void;
}

export function NumberComponent({ data, onSave }: NumberComponentProps) {
  const theme = useTheme();
  const [isEditing, setIsEditing] = useState(false);
  const [draftValue, setDraftValue] = useState(String(data.value));
  const [draftPrefix, setDraftPrefix] = useState(data.prefix ?? '');
  const [draftSuffix, setDraftSuffix] = useState(data.suffix ?? '');
  const [draftSize, setDraftSize] = useState<SizeOption>(data.size ?? 'md');

  const size = data.size ?? 'md';
  const fontSize = SIZE_FONT_MAP[size] ?? SIZE_FONT_MAP.md;
  const affixSize = Math.round(fontSize * AFFIX_RATIO);
  const numberColor = resolveColor(data.color, theme.palette.text.primary);

  const handleSave = useCallback(() => {
    onSave?.({
      ...data,
      value: draftValue,
      prefix: draftPrefix || undefined,
      suffix: draftSuffix || undefined,
      size: draftSize,
    });
    setIsEditing(false);
  }, [data, draftValue, draftPrefix, draftSuffix, draftSize, onSave]);

  const handleCancel = useCallback(() => {
    setIsEditing(false);
  }, []);

  useEditMode(handleSave, handleCancel, () => {
    setDraftValue(String(data.value));
    setDraftPrefix(data.prefix ?? '');
    setDraftSuffix(data.suffix ?? '');
    setDraftSize(data.size ?? 'md');
    setIsEditing(true);
  });

  if (isEditing) {
    return (
      <Box
        className="nodrag nowheel nopan"
        sx={{ p: 1.5, display: 'flex', flexDirection: 'column', gap: 0.75, outline: 'none' }}
      >
        <TextField
          size="small"
          fullWidth
          value={draftValue}
          onChange={(e) => setDraftValue(e.target.value)}
          placeholder="Value"
          autoFocus
          sx={{ '& .MuiInputBase-input': { fontSize: 12, py: 0.5 } }}
        />
        <Box sx={{ display: 'flex', gap: 0.5 }}>
          <TextField
            size="small"
            value={draftPrefix}
            onChange={(e) => setDraftPrefix(e.target.value)}
            placeholder="Prefix"
            sx={{ flex: 1, '& .MuiInputBase-input': { fontSize: 12, py: 0.5 } }}
          />
          <TextField
            size="small"
            value={draftSuffix}
            onChange={(e) => setDraftSuffix(e.target.value)}
            placeholder="Suffix"
            sx={{ flex: 1, '& .MuiInputBase-input': { fontSize: 12, py: 0.5 } }}
          />
        </Box>
        <Select
          size="small"
          value={draftSize}
          onChange={(e) => {
            const val = e.target.value;
            if (val === 'sm' || val === 'md' || val === 'lg') {
              setDraftSize(val);
            }
          }}
          MenuProps={{ onClick: (e) => e.stopPropagation() }}
          sx={{ fontSize: 11, '& .MuiSelect-select': { py: 0.25 } }}
        >
          {SIZE_OPTIONS.map((opt) => (
            <MenuItem key={opt.value} value={opt.value} sx={{ fontSize: 11 }}>
              {opt.label}
            </MenuItem>
          ))}
        </Select>
      </Box>
    );
  }

  return (
    <Box
      sx={{
        p: 1.5,
        position: 'relative',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'baseline',
      }}
    >
      {data.prefix && (
        <Typography
          component="span"
          sx={{ fontSize: affixSize, color: 'text.secondary', fontWeight: 400, mr: 0.5 }}
        >
          {data.prefix}
        </Typography>
      )}
      <Typography
        component="span"
        sx={{ fontSize, fontWeight: 700, lineHeight: 1.2, color: numberColor }}
      >
        {data.value}
      </Typography>
      {data.suffix && (
        <Typography
          component="span"
          sx={{ fontSize: affixSize, color: 'text.secondary', fontWeight: 400, ml: 0.5 }}
        >
          {data.suffix}
        </Typography>
      )}
    </Box>
  );
}

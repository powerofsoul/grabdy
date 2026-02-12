import { useCallback, useState } from 'react';

import { alpha, Box, TextField, Typography, useTheme } from '@mui/material';
import { Star } from 'lucide-react';

import { useEditMode } from '../hooks/useEditMode';

interface RatingComponentProps {
  data: {
    items: Array<{
      label: string;
      value: number;
      max: number;
      color?: string;
    }>;
    variant: 'stars' | 'bars' | 'dots';
  };
  onSave?: (data: Record<string, unknown>) => void;
}

export function RatingComponent({ data, onSave }: RatingComponentProps) {
  const theme = useTheme();
  const [isEditing, setIsEditing] = useState(false);
  const [draftItems, setDraftItems] = useState(data.items);

  const handleSave = useCallback(() => {
    onSave?.({ ...data, items: draftItems });
    setIsEditing(false);
  }, [data, draftItems, onSave]);

  const handleCancel = useCallback(() => {
    setIsEditing(false);
  }, []);

  const { startEdit, endEdit, editHandlerRef } = useEditMode(handleSave, handleCancel);

  const handleStartEdit = () => {
    setDraftItems(data.items.map((i) => ({ ...i })));
    setIsEditing(true);
    startEdit();
  };
  editHandlerRef.current = handleStartEdit;

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') { handleSave(); endEdit(); }
    if (e.key === 'Escape') { handleCancel(); endEdit(); }
  };

  if (isEditing) {
    return (
      <Box sx={{ p: 1.5 }} className="nodrag nowheel nopan">
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
          {draftItems.map((item, i) => (
            <Box key={i} sx={{ display: 'flex', gap: 0.5, alignItems: 'center' }}>
              <TextField
                size="small"
                value={item.label}
                onChange={(e) =>
                  setDraftItems((prev) =>
                    prev.map((it, j) => (j === i ? { ...it, label: e.target.value } : it)),
                  )
                }
                onKeyDown={handleKeyDown}
                sx={{ flex: 1, '& .MuiInputBase-input': { fontSize: 12, py: 0.25 } }}
              />
              <TextField
                size="small"
                type="number"
                value={item.value}
                onChange={(e) =>
                  setDraftItems((prev) =>
                    prev.map((it, j) =>
                      j === i ? { ...it, value: parseFloat(e.target.value) || 0 } : it,
                    ),
                  )
                }
                onKeyDown={handleKeyDown}
                sx={{ width: 60, '& .MuiInputBase-input': { fontSize: 12, py: 0.25 } }}
              />
              <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>/ {item.max}</Typography>
            </Box>
          ))}
        </Box>
      </Box>
    );
  }

  const handleClickRating = (itemIndex: number, newValue: number) => {
    if (!onSave) return;
    const updatedItems = data.items.map((it, j) =>
      j === itemIndex ? { ...it, value: newValue } : it,
    );
    onSave({ ...data, items: updatedItems });
  };

  const renderRating = (item: RatingComponentProps['data']['items'][number], itemIndex: number) => {
    const color = item.color ?? theme.palette.warning.main;
    const pct = item.max > 0 ? (item.value / item.max) * 100 : 0;

    if (data.variant === 'stars') {
      return (
        <Box sx={{ display: 'flex', gap: 0.25 }}>
          {Array.from({ length: item.max }, (_, i) => (
            <Box
              key={i}
              onClick={onSave ? () => handleClickRating(itemIndex, i + 1) : undefined}
              sx={{ cursor: onSave ? 'pointer' : 'default', display: 'flex' }}
            >
              <Star
                size={14}
                fill={i < item.value ? color : 'transparent'}
                color={i < item.value ? color : alpha(theme.palette.text.primary, 0.15)}
              />
            </Box>
          ))}
        </Box>
      );
    }

    if (data.variant === 'dots') {
      return (
        <Box sx={{ display: 'flex', gap: 0.5 }}>
          {Array.from({ length: item.max }, (_, i) => (
            <Box
              key={i}
              onClick={onSave ? () => handleClickRating(itemIndex, i + 1) : undefined}
              sx={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                bgcolor: i < item.value ? color : alpha(theme.palette.text.primary, 0.1),
                transition: 'background-color 200ms ease',
                cursor: onSave ? 'pointer' : 'default',
              }}
            />
          ))}
        </Box>
      );
    }

    // bars (default)
    return (
      <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', gap: 0.75 }}>
        <Box
          sx={{
            flex: 1,
            height: 6,
            borderRadius: 3,
            bgcolor: alpha(color, 0.12),
            overflow: 'hidden',
          }}
        >
          <Box
            sx={{
              height: '100%',
              width: `${Math.min(pct, 100)}%`,
              bgcolor: color,
              borderRadius: 3,
              transition: 'width 300ms ease',
            }}
          />
        </Box>
        <Typography sx={{ fontSize: 11, fontWeight: 600, color, minWidth: 28, textAlign: 'right' }}>
          {item.value}/{item.max}
        </Typography>
      </Box>
    );
  };

  return (
    <Box
      sx={{ p: 1.5, position: 'relative' }}
    >
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
        {data.items.map((item, i) => (
          <Box key={i} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography
              sx={{
                fontSize: 12,
                fontWeight: 500,
                minWidth: 80,
                color: 'text.primary',
              }}
            >
              {item.label}
            </Typography>
            {renderRating(item, i)}
          </Box>
        ))}
      </Box>
    </Box>
  );
}

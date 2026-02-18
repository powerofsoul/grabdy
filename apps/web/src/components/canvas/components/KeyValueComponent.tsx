import { useCallback, useState } from 'react';

import { alpha, Box, IconButton, TextField, Typography, useTheme } from '@mui/material';
import { PlusIcon, TrashIcon } from '@phosphor-icons/react';

import { useEditMode } from '../hooks/useEditMode';

interface KeyValueComponentProps {
  data: {
    pairs: Array<{ key: string; value: string }>;
  };
  onSave?: (data: Record<string, unknown>) => void;
}

export function KeyValueComponent({ data, onSave }: KeyValueComponentProps) {
  const theme = useTheme();
  const [isEditing, setIsEditing] = useState(false);
  const [draftPairs, setDraftPairs] = useState(data.pairs);

  const handleSave = useCallback(() => {
    onSave?.({ pairs: draftPairs });
    setIsEditing(false);
  }, [draftPairs, onSave]);

  const handleCancel = useCallback(() => {
    setIsEditing(false);
  }, []);

  const { endEdit } = useEditMode(handleSave, handleCancel, () => {
    setDraftPairs(data.pairs.map((p) => ({ ...p })));
    setIsEditing(true);
  });

  const handleKeyChange = (index: number, key: string) => {
    setDraftPairs((prev) => prev.map((pair, i) => (i === index ? { ...pair, key } : pair)));
  };

  const handleValueChange = (index: number, value: string) => {
    setDraftPairs((prev) => prev.map((pair, i) => (i === index ? { ...pair, value } : pair)));
  };

  const handleAddPair = () => {
    setDraftPairs((prev) => [...prev, { key: '', value: '' }]);
  };

  const handleDeletePair = (index: number) => {
    setDraftPairs((prev) => prev.filter((_, i) => i !== index));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      handleCancel();
      endEdit();
    }
  };

  if (isEditing) {
    return (
      <Box
        className="nodrag nowheel nopan"
        onKeyDown={handleKeyDown}
        sx={{ p: 1.5, outline: 'none' }}
      >
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
          {draftPairs.map((pair, i) => (
            <Box key={i} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <TextField
                size="small"
                value={pair.key}
                onChange={(e) => handleKeyChange(i, e.target.value)}
                placeholder="KeyIcon"
                autoFocus={i === 0}
                sx={{
                  flex: 1,
                  '& .MuiInputBase-input': { fontSize: 12, py: 0.25, px: 0.5, fontWeight: 600 },
                }}
              />
              <TextField
                size="small"
                value={pair.value}
                onChange={(e) => handleValueChange(i, e.target.value)}
                placeholder="Value"
                sx={{ flex: 2, '& .MuiInputBase-input': { fontSize: 12, py: 0.25, px: 0.5 } }}
              />
              <IconButton
                size="small"
                onClick={() => handleDeletePair(i)}
                sx={{ width: 20, height: 20, color: alpha(theme.palette.text.primary, 0.3) }}
              >
                <TrashIcon size={12} weight="light" color="currentColor" />
              </IconButton>
            </Box>
          ))}
        </Box>
        <Box sx={{ display: 'flex', justifyContent: 'flex-start', mt: 0.5 }}>
          <IconButton size="small" onClick={handleAddPair} sx={{ color: 'primary.main' }}>
            <PlusIcon size={14} weight="light" color="currentColor" />
          </IconButton>
        </Box>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 1.5, position: 'relative' }}>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.35 }}>
        {data.pairs.map((pair, i) => (
          <Box key={i} sx={{ display: 'flex', alignItems: 'baseline', gap: 0.75 }}>
            <Typography
              sx={{
                fontSize: 12,
                fontWeight: 600,
                color: 'text.secondary',
                flexShrink: 0,
              }}
            >
              {pair.key}:
            </Typography>
            <Typography sx={{ fontSize: 12, color: 'text.primary' }}>{pair.value}</Typography>
          </Box>
        ))}
      </Box>
    </Box>
  );
}

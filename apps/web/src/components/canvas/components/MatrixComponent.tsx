import { useCallback, useState } from 'react';

import { alpha, Box, IconButton, TextField, Typography, useTheme } from '@mui/material';
import { Plus, Trash } from '@phosphor-icons/react';

import { useEditMode } from '../hooks/useEditMode';

interface QuadrantData {
  topLeft: string[];
  topRight: string[];
  bottomLeft: string[];
  bottomRight: string[];
}

interface LabelData {
  topLeft: string;
  topRight: string;
  bottomLeft: string;
  bottomRight: string;
}

interface MatrixComponentProps {
  data: {
    labels: LabelData;
    quadrants: QuadrantData;
  };
  onSave?: (data: Record<string, unknown>) => void;
}

const QUADRANT_KEYS = ['topLeft', 'topRight', 'bottomLeft', 'bottomRight'] as const;

const QUADRANT_PALETTE_KEYS: Record<keyof QuadrantData, 'info' | 'success' | 'warning' | 'error'> = {
  topLeft: 'info',
  topRight: 'success',
  bottomLeft: 'warning',
  bottomRight: 'error',
};

export function MatrixComponent({ data, onSave }: MatrixComponentProps) {
  const theme = useTheme();
  const [isEditing, setIsEditing] = useState(false);
  const [draftLabels, setDraftLabels] = useState(data.labels);
  const [draftQuadrants, setDraftQuadrants] = useState(data.quadrants);

  const handleSave = useCallback(() => {
    onSave?.({ labels: draftLabels, quadrants: draftQuadrants });
    setIsEditing(false);
  }, [draftLabels, draftQuadrants, onSave]);

  const handleCancel = useCallback(() => {
    setIsEditing(false);
  }, []);

  const { startEdit, endEdit, editHandlerRef } = useEditMode(handleSave, handleCancel);

  const handleStartEdit = () => {
    setDraftLabels({ ...data.labels });
    setDraftQuadrants({
      topLeft: [...data.quadrants.topLeft],
      topRight: [...data.quadrants.topRight],
      bottomLeft: [...data.quadrants.bottomLeft],
      bottomRight: [...data.quadrants.bottomRight],
    });
    setIsEditing(true);
    startEdit();
  };
  editHandlerRef.current = handleStartEdit;

  const handleLabelChange = (key: keyof LabelData, value: string) => {
    setDraftLabels((prev) => ({ ...prev, [key]: value }));
  };

  const handleItemChange = (key: keyof QuadrantData, index: number, value: string) => {
    setDraftQuadrants((prev) => ({
      ...prev,
      [key]: prev[key].map((item, i) => (i === index ? value : item)),
    }));
  };

  const handleAddItem = (key: keyof QuadrantData) => {
    setDraftQuadrants((prev) => ({ ...prev, [key]: [...prev[key], ''] }));
  };

  const handleDeleteItem = (key: keyof QuadrantData, index: number) => {
    setDraftQuadrants((prev) => ({
      ...prev,
      [key]: prev[key].filter((_, i) => i !== index),
    }));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') { handleCancel(); endEdit(); }
  };

  if (isEditing) {
    return (
      <Box
        className="nodrag nowheel nopan"
        onKeyDown={handleKeyDown}
        sx={{ p: 1, outline: 'none' }}
      >
        <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0.75 }}>
          {QUADRANT_KEYS.map((key) => (
            <Box key={key}>
              <TextField
                size="small"
                fullWidth
                value={draftLabels[key]}
                onChange={(e) => handleLabelChange(key, e.target.value)}
                placeholder="Label"
                sx={{ mb: 0.5, '& .MuiInputBase-input': { fontSize: 10, fontWeight: 700, py: 0.15, px: 0.5, textTransform: 'uppercase' } }}
              />
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.25 }}>
                {draftQuadrants[key].map((item, i) => (
                  <Box key={i} sx={{ display: 'flex', gap: 0.25, alignItems: 'center' }}>
                    <TextField
                      size="small"
                      fullWidth
                      value={item}
                      onChange={(e) => handleItemChange(key, i, e.target.value)}
                      sx={{ '& .MuiInputBase-input': { fontSize: 11, py: 0.15, px: 0.5 } }}
                    />
                    <IconButton
                      size="small"
                      onClick={() => handleDeleteItem(key, i)}
                      sx={{ width: 16, height: 16, p: 0 }}
                    >
                      <Trash size={10} weight="light" color="currentColor" />
                    </IconButton>
                  </Box>
                ))}
                <IconButton size="small" onClick={() => handleAddItem(key)} sx={{ width: 20, height: 20, alignSelf: 'flex-start' }}>
                  <Plus size={12} weight="light" color="currentColor" />
                </IconButton>
              </Box>
            </Box>
          ))}
        </Box>
      </Box>
    );
  }

  return (
    <Box
      sx={{ position: 'relative' }}
    >
      <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0 }}>
        {QUADRANT_KEYS.map((key, qi) => {
          const paletteKey = QUADRANT_PALETTE_KEYS[key];
          const color = theme.palette[paletteKey].main;
          const items = data.quadrants[key];
          const label = data.labels[key];
          const isTop = qi < 2;
          const isLeft = qi % 2 === 0;

          return (
            <Box
              key={key}
              sx={{
                p: 1.25,
                borderRight: isLeft ? '1px solid' : 'none',
                borderBottom: isTop ? '1px solid' : 'none',
                borderColor: alpha(theme.palette.text.primary, 0.08),
                bgcolor: qi % 2 === 0 ? 'transparent' : alpha(theme.palette.text.primary, 0.02),
              }}
            >
              <Typography
                sx={{
                  fontSize: 10,
                  fontWeight: 700,
                  color,
                  textTransform: 'uppercase',
                  letterSpacing: 0.5,
                  mb: 0.75,
                }}
              >
                {label}
              </Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.35 }}>
                {items.map((item, i) => (
                  <Box key={i} sx={{ display: 'flex', alignItems: 'flex-start', gap: 0.5 }}>
                    <Box
                      sx={{
                        width: 4,
                        height: 4,
                        borderRadius: '50%',
                        bgcolor: color,
                        mt: 0.6,
                        flexShrink: 0,
                      }}
                    />
                    <Typography sx={{ fontSize: 11, lineHeight: 1.4 }}>{item}</Typography>
                  </Box>
                ))}
              </Box>
            </Box>
          );
        })}
      </Box>
    </Box>
  );
}

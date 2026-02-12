import { useCallback, useState } from 'react';

import { alpha, Box, IconButton, TextField, Typography, useTheme } from '@mui/material';
import { Plus, Trash2 } from 'lucide-react';

import { useEditMode } from '../hooks/useEditMode';

interface SwotComponentProps {
  data: {
    strengths: string[];
    weaknesses: string[];
    opportunities: string[];
    threats: string[];
  };
  onSave?: (data: Record<string, unknown>) => void;
}

const QUADRANTS = [
  { key: 'strengths', label: 'Strengths', paletteKey: 'success' },
  { key: 'weaknesses', label: 'Weaknesses', paletteKey: 'error' },
  { key: 'opportunities', label: 'Opportunities', paletteKey: 'info' },
  { key: 'threats', label: 'Threats', paletteKey: 'warning' },
] as const;

type QuadrantKey = (typeof QUADRANTS)[number]['key'];

export function SwotComponent({ data, onSave }: SwotComponentProps) {
  const theme = useTheme();
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(data);

  const handleSave = useCallback(() => {
    onSave?.(draft);
    setIsEditing(false);
  }, [draft, onSave]);

  const handleCancel = useCallback(() => {
    setIsEditing(false);
  }, []);

  const { startEdit, endEdit, editHandlerRef } = useEditMode(handleSave, handleCancel);

  const handleStartEdit = () => {
    setDraft({
      strengths: [...data.strengths],
      weaknesses: [...data.weaknesses],
      opportunities: [...data.opportunities],
      threats: [...data.threats],
    });
    setIsEditing(true);
    startEdit();
  };
  editHandlerRef.current = handleStartEdit;

  const handleItemChange = (quad: QuadrantKey, index: number, value: string) => {
    setDraft((prev) => ({
      ...prev,
      [quad]: prev[quad].map((item, i) => (i === index ? value : item)),
    }));
  };

  const handleAddItem = (quad: QuadrantKey) => {
    setDraft((prev) => ({ ...prev, [quad]: [...prev[quad], ''] }));
  };

  const handleDeleteItem = (quad: QuadrantKey, index: number) => {
    setDraft((prev) => ({ ...prev, [quad]: prev[quad].filter((_, i) => i !== index) }));
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
          {QUADRANTS.map(({ key, label }) => (
            <Box key={key}>
              <Typography sx={{ fontSize: 10, fontWeight: 700, mb: 0.5, textTransform: 'uppercase' }}>
                {label}
              </Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.25 }}>
                {draft[key].map((item, i) => (
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
                      <Trash2 size={10} />
                    </IconButton>
                  </Box>
                ))}
                <IconButton size="small" onClick={() => handleAddItem(key)} sx={{ width: 20, height: 20, alignSelf: 'flex-start' }}>
                  <Plus size={12} />
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
        {QUADRANTS.map(({ key, label, paletteKey }, qi) => {
          const color = theme.palette[paletteKey].main;
          const items = data[key];
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

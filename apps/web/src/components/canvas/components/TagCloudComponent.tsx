import { useCallback, useState } from 'react';

import { alpha, Box, IconButton, TextField, Typography, useTheme } from '@mui/material';
import { Plus, Trash } from '@phosphor-icons/react';

import { useEditMode } from '../hooks/useEditMode';

interface TagCloudComponentProps {
  data: {
    tags: Array<{ label: string; color?: string }>;
  };
  onSave?: (data: Record<string, unknown>) => void;
}

export function TagCloudComponent({ data, onSave }: TagCloudComponentProps) {
  const theme = useTheme();
  const [isEditing, setIsEditing] = useState(false);
  const [draftTags, setDraftTags] = useState(data.tags);

  const handleSave = useCallback(() => {
    onSave?.({ tags: draftTags });
    setIsEditing(false);
  }, [draftTags, onSave]);

  const handleCancel = useCallback(() => {
    setIsEditing(false);
  }, []);

  const { startEdit, endEdit, editHandlerRef } = useEditMode(handleSave, handleCancel);

  const handleStartEdit = () => {
    setDraftTags(data.tags.map((t) => ({ ...t })));
    setIsEditing(true);
    startEdit();
  };
  editHandlerRef.current = handleStartEdit;

  const handleLabelChange = (index: number, label: string) => {
    setDraftTags((prev) => prev.map((tag, i) => (i === index ? { ...tag, label } : tag)));
  };

  const handleAddTag = () => {
    setDraftTags((prev) => [...prev, { label: '' }]);
  };

  const handleDeleteTag = (index: number) => {
    setDraftTags((prev) => prev.filter((_, i) => i !== index));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') { handleCancel(); endEdit(); }
  };

  if (isEditing) {
    return (
      <Box
        className="nodrag nowheel nopan"
        onKeyDown={handleKeyDown}
        sx={{ p: 1.5, outline: 'none' }}
      >
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
          {draftTags.map((tag, i) => (
            <Box key={i} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <TextField
                size="small"
                fullWidth
                value={tag.label}
                onChange={(e) => handleLabelChange(i, e.target.value)}
                autoFocus={i === 0}
                placeholder="Tag label"
                sx={{ '& .MuiInputBase-input': { fontSize: 12, py: 0.25, px: 0.5 } }}
              />
              <IconButton
                size="small"
                onClick={() => handleDeleteTag(i)}
                sx={{ width: 20, height: 20, color: alpha(theme.palette.text.primary, 0.3) }}
              >
                <Trash size={12} weight="light" color="currentColor" />
              </IconButton>
            </Box>
          ))}
        </Box>
        <Box sx={{ display: 'flex', justifyContent: 'flex-start', mt: 0.5 }}>
          <IconButton size="small" onClick={handleAddTag} sx={{ color: 'primary.main' }}>
            <Plus size={14} weight="light" color="currentColor" />
          </IconButton>
        </Box>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 1.5, position: 'relative' }}>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
        {data.tags.map((tag, i) => {
          const accent = tag.color ?? theme.palette.primary.main;
          return (
            <Typography
              key={i}
              sx={{
                fontSize: 12,
                px: 1,
                py: 0.25,
                borderRadius: 3,
                bgcolor: alpha(accent, 0.1),
                color: accent,
                fontWeight: 500,
                lineHeight: 1.6,
              }}
            >
              {tag.label}
            </Typography>
          );
        })}
      </Box>
    </Box>
  );
}

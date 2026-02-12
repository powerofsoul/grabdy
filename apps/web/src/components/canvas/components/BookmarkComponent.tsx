import { useCallback, useState } from 'react';

import { alpha, Box, TextField, Typography, useTheme } from '@mui/material';

import { useEditMode } from '../hooks/useEditMode';

interface BookmarkComponentProps {
  data: {
    label: string;
    note?: string;
  };
  onSave?: (data: Record<string, unknown>) => void;
}

export function BookmarkComponent({ data, onSave }: BookmarkComponentProps) {
  const theme = useTheme();
  const [isEditing, setIsEditing] = useState(false);
  const [draftLabel, setDraftLabel] = useState(data.label);
  const [draftNote, setDraftNote] = useState(data.note ?? '');

  const handleSave = useCallback(() => {
    onSave?.({ label: draftLabel, note: draftNote || undefined });
    setIsEditing(false);
  }, [draftLabel, draftNote, onSave]);

  const handleCancel = useCallback(() => {
    setIsEditing(false);
  }, []);

  const { startEdit, endEdit, editHandlerRef } = useEditMode(handleSave, handleCancel);

  const handleStartEdit = () => {
    if (!onSave) return;
    setDraftLabel(data.label);
    setDraftNote(data.note ?? '');
    setIsEditing(true);
    startEdit();
  };

  editHandlerRef.current = handleStartEdit;

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') { handleCancel(); endEdit(); }
  };

  if (isEditing) {
    return (
      <Box
        className="nodrag nowheel nopan"
        onKeyDown={handleKeyDown}
        sx={{
          p: 1.5,
          display: 'flex',
          alignItems: 'flex-start',
          gap: 1,
          bgcolor: alpha(theme.palette.primary.main, 0.04),
          borderRadius: 'inherit',
        }}
      >
        <Box sx={{ width: 3, alignSelf: 'stretch', flexShrink: 0, bgcolor: theme.palette.primary.main, borderRadius: 1 }} />
        <Box sx={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 0.5 }}>
          <TextField
            size="small"
            fullWidth
            value={draftLabel}
            onChange={(e) => setDraftLabel(e.target.value)}
            autoFocus
            placeholder="Label"
            onClick={(e) => e.stopPropagation()}
            sx={{ '& .MuiInputBase-input': { fontSize: 13, fontWeight: 600, py: 0.25, px: 0.5 } }}
          />
          <TextField
            size="small"
            fullWidth
            value={draftNote}
            onChange={(e) => setDraftNote(e.target.value)}
            placeholder="Note (optional)"
            onClick={(e) => e.stopPropagation()}
            sx={{ '& .MuiInputBase-input': { fontSize: 12, py: 0.25, px: 0.5 } }}
          />
        </Box>
      </Box>
    );
  }

  return (
    <Box
      sx={{
        p: 1.5,
        display: 'flex',
        alignItems: 'flex-start',
        gap: 1,
        bgcolor: alpha(theme.palette.primary.main, 0.04),
        borderRadius: 'inherit',
      }}
    >
      <Box sx={{ width: 3, alignSelf: 'stretch', flexShrink: 0, bgcolor: theme.palette.primary.main, borderRadius: 1 }} />
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography
          sx={{
            fontSize: 13,
            fontWeight: 600,
            borderRadius: 0.5,
          }}
        >
          {data.label}
        </Typography>
        <Typography
          sx={{
            fontSize: 12,
            color: 'text.secondary',
            mt: 0.25,
            borderRadius: 0.5,
          }}
        >
          {data.note ?? (onSave ? <span style={{ fontStyle: 'italic', opacity: 0.5 }}>Add note...</span> : '')}
        </Typography>
      </Box>
    </Box>
  );
}

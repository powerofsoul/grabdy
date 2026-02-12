import { useCallback, useState } from 'react';

import { Box, TextField, Typography } from '@mui/material';

import { useEditMode } from '../hooks/useEditMode';

interface HeaderComponentProps {
  data: {
    title: string;
    subtitle?: string;
    align?: 'left' | 'center' | 'right';
  };
  onSave?: (data: Record<string, unknown>) => void;
}

export function HeaderComponent({ data, onSave }: HeaderComponentProps) {
  const [editingField, setEditingField] = useState<'title' | 'subtitle' | null>(null);
  const [draftTitle, setDraftTitle] = useState(data.title);
  const [draftSubtitle, setDraftSubtitle] = useState(data.subtitle ?? '');

  const align = data.align ?? 'left';

  const handleSave = useCallback(() => {
    if (editingField === 'title') {
      onSave?.({ title: draftTitle, subtitle: data.subtitle, align: data.align });
    } else if (editingField === 'subtitle') {
      onSave?.({ title: data.title, subtitle: draftSubtitle || undefined, align: data.align });
    }
    setEditingField(null);
  }, [editingField, draftTitle, draftSubtitle, data, onSave]);

  const handleCancel = useCallback(() => {
    setEditingField(null);
  }, []);

  const { startEdit, endEdit, editHandlerRef } = useEditMode(handleSave, handleCancel);

  const handleStartEdit = () => {
    if (!onSave) return;
    setDraftTitle(data.title);
    setEditingField('title');
    startEdit();
  };

  editHandlerRef.current = handleStartEdit;

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') { handleSave(); endEdit(); }
    if (e.key === 'Escape') { handleCancel(); endEdit(); }
  };

  return (
    <Box sx={{ p: 1.5, textAlign: align }}>
      {editingField === 'title' ? (
        <TextField
          size="small"
          fullWidth
          value={draftTitle}
          onChange={(e) => setDraftTitle(e.target.value)}
          onKeyDown={handleKeyDown}
          autoFocus
          placeholder="Title"
          onClick={(e) => e.stopPropagation()}
          className="nodrag nowheel nopan"
          sx={{ '& .MuiInputBase-input': { fontSize: 20, fontWeight: 700, py: 0.5, px: 0.5, textAlign: align } }}
        />
      ) : (
        <Typography
          sx={{
            fontSize: 20,
            fontWeight: 700,
            lineHeight: 1.3,
            borderRadius: 0.5,
          }}
        >
          {data.title}
        </Typography>
      )}

      {editingField === 'subtitle' ? (
        <TextField
          size="small"
          fullWidth
          value={draftSubtitle}
          onChange={(e) => setDraftSubtitle(e.target.value)}
          onKeyDown={handleKeyDown}
          autoFocus
          placeholder="Subtitle (optional)"
          onClick={(e) => e.stopPropagation()}
          className="nodrag nowheel nopan"
          sx={{ mt: 0.5, '& .MuiInputBase-input': { fontSize: 13, py: 0.25, px: 0.5, textAlign: align } }}
        />
      ) : (
        <Typography
          sx={{
            fontSize: 13,
            color: 'text.secondary',
            mt: 0.5,
            lineHeight: 1.4,
            borderRadius: 0.5,
          }}
        >
          {data.subtitle ?? (onSave ? <span style={{ fontStyle: 'italic', opacity: 0.5 }}>Add subtitle...</span> : '')}
        </Typography>
      )}
    </Box>
  );
}

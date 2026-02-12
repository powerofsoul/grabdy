import { useCallback, useState } from 'react';

import { alpha, Box, TextField, Typography, useTheme } from '@mui/material';
import { ImageOff } from 'lucide-react';

import { useEditMode } from '../hooks/useEditMode';

interface ImageComponentProps {
  data: {
    src: string;
    alt?: string;
    caption?: string;
    fit: 'contain' | 'cover' | 'fill';
    height?: number;
    borderRadius?: number;
  };
  onSave?: (data: Record<string, unknown>) => void;
}

export function ImageComponent({ data, onSave }: ImageComponentProps) {
  const theme = useTheme();
  const [isEditing, setIsEditing] = useState(false);
  const [draftSrc, setDraftSrc] = useState(data.src);
  const [draftCaption, setDraftCaption] = useState(data.caption ?? '');
  const [hasError, setHasError] = useState(false);

  const handleSave = useCallback(() => {
    onSave?.({ ...data, src: draftSrc, caption: draftCaption || undefined });
    setIsEditing(false);
    setHasError(false);
  }, [data, draftSrc, draftCaption, onSave]);

  const handleCancel = useCallback(() => {
    setIsEditing(false);
  }, []);

  const { startEdit, endEdit, editHandlerRef } = useEditMode(handleSave, handleCancel);

  const handleStartEdit = () => {
    setDraftSrc(data.src);
    setDraftCaption(data.caption ?? '');
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
      <Box
        sx={{ p: 1.5, display: 'flex', flexDirection: 'column', gap: 0.5 }}
        className="nodrag nowheel nopan"
      >
        <TextField
          size="small"
          fullWidth
          value={draftSrc}
          onChange={(e) => setDraftSrc(e.target.value)}
          placeholder="Image URL"
          autoFocus
          onKeyDown={handleKeyDown}
          sx={{ '& .MuiInputBase-input': { fontSize: 12, py: 0.5 } }}
        />
        <TextField
          size="small"
          fullWidth
          value={draftCaption}
          onChange={(e) => setDraftCaption(e.target.value)}
          placeholder="Caption (optional)"
          onKeyDown={handleKeyDown}
          sx={{ '& .MuiInputBase-input': { fontSize: 12, py: 0.5 } }}
        />
      </Box>
    );
  }

  return (
    <Box
      sx={{ position: 'relative' }}
    >
      {hasError ? (
        <Box
          sx={{
            height: data.height ?? 160,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 0.5,
            bgcolor: alpha(theme.palette.text.primary, 0.03),
            borderRadius: `${data.borderRadius ?? 0}px`,
          }}
        >
          <ImageOff size={24} color={alpha(theme.palette.text.primary, 0.2)} />
          <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>Image failed to load</Typography>
        </Box>
      ) : (
        <Box
          component="img"
          src={data.src}
          alt={data.alt ?? ''}
          onError={() => setHasError(true)}
          sx={{
            width: '100%',
            height: data.height ?? 'auto',
            maxHeight: 400,
            objectFit: data.fit,
            borderRadius: `${data.borderRadius ?? 0}px`,
            display: 'block',
          }}
        />
      )}
      {data.caption && (
        <Typography
          sx={{
            fontSize: 11,
            color: 'text.secondary',
            textAlign: 'center',
            mt: 0.5,
            px: 1,
            fontStyle: 'italic',
          }}
        >
          {data.caption}
        </Typography>
      )}
    </Box>
  );
}

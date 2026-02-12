import { useCallback, useRef, useState } from 'react';

import { alpha, Box, TextField, Typography, useTheme } from '@mui/material';

import { resolveColor } from '../hooks/resolveColor';
import { useEditMode } from '../hooks/useEditMode';

import { CanvasEditor } from './CanvasEditor';
import { MarkdownContent } from './MarkdownContent';

interface QuoteComponentProps {
  data: {
    text: string;
    source?: string;
    color?: string;
  };
  onSave?: (data: Record<string, unknown>) => void;
}

export function QuoteComponent({ data, onSave }: QuoteComponentProps) {
  const theme = useTheme();
  const [isEditing, setIsEditing] = useState(false);
  const [draftSource, setDraftSource] = useState(data.source ?? '');
  const contentRef = useRef(data.text);

  const accentColor = resolveColor(data.color, theme.palette.primary.main);

  const handleSave = useCallback(() => {
    onSave?.({ ...data, text: contentRef.current, source: draftSource || undefined });
    setIsEditing(false);
  }, [data, draftSource, onSave]);

  const handleCancel = useCallback(() => {
    setIsEditing(false);
  }, []);

  const { startEdit, endEdit, editHandlerRef } = useEditMode(handleSave, handleCancel);

  const handleStartEdit = () => {
    if (!onSave) return;
    contentRef.current = data.text;
    setDraftSource(data.source ?? '');
    setIsEditing(true);
    startEdit();
  };
  editHandlerRef.current = handleStartEdit;

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') { handleCancel(); endEdit(); }
  };

  return (
    <Box
      sx={{
        p: 1.5,
        display: 'flex',
        gap: 1,
        borderRadius: 'inherit',
      }}
    >
      <Box sx={{ width: 3, alignSelf: 'stretch', flexShrink: 0, bgcolor: accentColor, borderRadius: 1 }} />
      <Box sx={{ flex: 1, minWidth: 0 }}>
        {isEditing ? (
          <CanvasEditor
            content={data.text}
            contentRef={contentRef}
            onCancel={() => { handleCancel(); endEdit(); }}
            fontSize={13}
            placeholder="Quote text..."
          />
        ) : (
          <Box sx={{ fontStyle: 'italic', color: alpha(theme.palette.text.primary, 0.8) }}>
            <MarkdownContent content={data.text} fontSize={13} />
          </Box>
        )}

        {isEditing ? (
          <TextField
            size="small"
            fullWidth
            className="nodrag nowheel nopan"
            value={draftSource}
            onChange={(e) => setDraftSource(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Source (optional)"
            onClick={(e) => e.stopPropagation()}
            sx={{ mt: 0.75, '& .MuiInputBase-input': { fontSize: 11, py: 0.25, px: 0.5 } }}
          />
        ) : (
          <Typography
            sx={{
              fontSize: 11,
              color: 'text.secondary',
              mt: 0.75,
              fontWeight: 500,
              borderRadius: 0.5,
            }}
          >
            {data.source ? `— ${data.source}` : onSave ? <span style={{ fontStyle: 'italic', opacity: 0.5 }}>— Add source...</span> : ''}
          </Typography>
        )}
      </Box>
    </Box>
  );
}

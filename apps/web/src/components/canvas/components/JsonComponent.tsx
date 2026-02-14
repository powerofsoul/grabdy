import { useCallback, useMemo, useState } from 'react';

import { Box, TextField, Typography } from '@mui/material';

import { useEditMode } from '../hooks/useEditMode';

import { JsonTreeView } from '@/components/ui/JsonTreeView';

interface JsonComponentProps {
  data: {
    content: string;
  };
  onSave?: (data: Record<string, unknown>) => void;
}

export function JsonComponent({ data, onSave }: JsonComponentProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [draftContent, setDraftContent] = useState(data.content);
  const [parseError, setParseError] = useState('');

  const handleSave = useCallback(() => {
    try {
      JSON.parse(draftContent);
      setParseError('');
      onSave?.({ content: draftContent });
      setIsEditing(false);
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Invalid JSON';
      setParseError(message);
    }
  }, [draftContent, onSave]);

  const handleCancel = useCallback(() => {
    setIsEditing(false);
  }, []);

  const { endEdit } = useEditMode(handleSave, handleCancel, () => {
    setDraftContent(data.content);
    setParseError('');
    setIsEditing(true);
  });

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      handleCancel();
      endEdit();
    }
  };

  const parsedValue = useMemo(() => {
    try {
      return JSON.parse(data.content);
    } catch {
      return null;
    }
  }, [data.content]);

  if (isEditing) {
    return (
      <Box
        className="nodrag nowheel nopan"
        onKeyDown={handleKeyDown}
        sx={{ p: 1.5, display: 'flex', flexDirection: 'column', gap: 0.75 }}
      >
        <TextField
          multiline
          fullWidth
          minRows={3}
          maxRows={15}
          value={draftContent}
          onChange={(e) => setDraftContent(e.target.value)}
          autoFocus
          sx={{
            '& .MuiInputBase-root': { fontFamily: 'monospace', fontSize: 12 },
            '& .MuiInputBase-input': { py: 0.5 },
          }}
        />
        {parseError && (
          <Typography sx={{ fontSize: 11, color: 'error.main' }}>{parseError}</Typography>
        )}
      </Box>
    );
  }

  return (
    <Box
      sx={{
        p: 1.5,
        position: 'relative',
        overflow: 'auto',
        maxHeight: 400,
      }}
    >
      {parsedValue !== null ? (
        <JsonTreeView value={parsedValue} />
      ) : (
        <Typography sx={{ fontSize: 12, fontFamily: 'monospace', color: 'error.main' }}>
          Invalid JSON
        </Typography>
      )}
    </Box>
  );
}

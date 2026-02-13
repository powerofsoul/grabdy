import { useCallback, useState } from 'react';

import { alpha, Box, IconButton, Link, TextField, Typography, useTheme } from '@mui/material';
import { ArrowSquareOut, Plus, Trash } from '@phosphor-icons/react';

import { useEditMode } from '../hooks/useEditMode';

interface LinkListComponentProps {
  data: {
    links: Array<{
      label: string;
      url: string;
      description?: string;
    }>;
  };
  onSave?: (data: Record<string, unknown>) => void;
}

export function LinkListComponent({ data, onSave }: LinkListComponentProps) {
  const theme = useTheme();
  const [isEditing, setIsEditing] = useState(false);
  const [draftLinks, setDraftLinks] = useState(data.links);

  const handleSave = useCallback(() => {
    onSave?.({ links: draftLinks });
    setIsEditing(false);
  }, [draftLinks, onSave]);

  const handleCancel = useCallback(() => {
    setIsEditing(false);
  }, []);

  const { startEdit, endEdit, editHandlerRef } = useEditMode(handleSave, handleCancel);

  const handleStartEdit = () => {
    setDraftLinks(data.links.map((l) => ({ ...l })));
    setIsEditing(true);
    startEdit();
  };
  editHandlerRef.current = handleStartEdit;

  const handleLinkChange = (index: number, field: string, value: string) => {
    setDraftLinks((prev) =>
      prev.map((l, i) => (i === index ? { ...l, [field]: value } : l)),
    );
  };

  const handleAddLink = () => {
    setDraftLinks((prev) => [...prev, { label: '', url: '' }]);
  };

  const handleDeleteLink = (index: number) => {
    setDraftLinks((prev) => prev.filter((_, i) => i !== index));
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
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          {draftLinks.map((link, i) => (
            <Box key={i} sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
              <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center' }}>
                <TextField
                  size="small"
                  value={link.label}
                  onChange={(e) => handleLinkChange(i, 'label', e.target.value)}
                  placeholder="Label"
                  autoFocus={i === 0}
                  sx={{ flex: 1, '& .MuiInputBase-input': { fontSize: 12, py: 0.25 } }}
                />
                <IconButton
                  size="small"
                  onClick={() => handleDeleteLink(i)}
                  sx={{ width: 20, height: 20, color: alpha(theme.palette.text.primary, 0.3) }}
                >
                  <Trash size={12} weight="light" color="currentColor" />
                </IconButton>
              </Box>
              <TextField
                size="small"
                fullWidth
                value={link.url}
                onChange={(e) => handleLinkChange(i, 'url', e.target.value)}
                placeholder="https://..."
                sx={{ '& .MuiInputBase-input': { fontSize: 11, py: 0.25 } }}
              />
              <TextField
                size="small"
                fullWidth
                value={link.description ?? ''}
                onChange={(e) => handleLinkChange(i, 'description', e.target.value)}
                placeholder="Description (optional)"
                sx={{ '& .MuiInputBase-input': { fontSize: 11, py: 0.25 } }}
              />
            </Box>
          ))}
        </Box>
        <Box sx={{ display: 'flex', justifyContent: 'flex-start', mt: 0.5 }}>
          <IconButton size="small" onClick={handleAddLink} sx={{ color: 'primary.main' }}>
            <Plus size={14} weight="light" color="currentColor" />
          </IconButton>
        </Box>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 1.5, position: 'relative' }}>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
        {data.links.map((link, i) => (
          <Box key={i} sx={{ py: 0.25 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <ArrowSquareOut size={12} weight="light" color={theme.palette.primary.main} style={{ flexShrink: 0 }} />
              <Link
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                sx={{
                  fontSize: 12,
                  fontWeight: 500,
                  color: 'primary.main',
                  textDecoration: 'none',
                  '&:hover': { textDecoration: 'underline' },
                }}
              >
                {link.label}
              </Link>
            </Box>
            {link.description && (
              <Typography sx={{ fontSize: 11, color: 'text.secondary', mt: 0.25, pl: 2.25 }}>
                {link.description}
              </Typography>
            )}
          </Box>
        ))}
      </Box>
    </Box>
  );
}

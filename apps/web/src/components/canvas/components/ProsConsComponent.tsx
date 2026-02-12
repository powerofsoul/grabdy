import { useCallback, useState } from 'react';

import { alpha, Box, IconButton, TextField, Typography, useTheme } from '@mui/material';
import { Plus, ThumbsDown, ThumbsUp, Trash2 } from 'lucide-react';

import { useEditMode } from '../hooks/useEditMode';

interface ProsConsComponentProps {
  data: {
    pros: string[];
    cons: string[];
  };
  onSave?: (data: Record<string, unknown>) => void;
}

export function ProsConsComponent({ data, onSave }: ProsConsComponentProps) {
  const theme = useTheme();
  const [isEditing, setIsEditing] = useState(false);
  const [draftPros, setDraftPros] = useState(data.pros);
  const [draftCons, setDraftCons] = useState(data.cons);

  const handleSave = useCallback(() => {
    onSave?.({ pros: draftPros, cons: draftCons });
    setIsEditing(false);
  }, [draftPros, draftCons, onSave]);

  const handleCancel = useCallback(() => {
    setIsEditing(false);
  }, []);

  const { startEdit, endEdit, editHandlerRef } = useEditMode(handleSave, handleCancel);

  const handleStartEdit = () => {
    setDraftPros([...data.pros]);
    setDraftCons([...data.cons]);
    setIsEditing(true);
    startEdit();
  };
  editHandlerRef.current = handleStartEdit;

  const handleProChange = (index: number, value: string) => {
    setDraftPros((prev) => prev.map((item, i) => (i === index ? value : item)));
  };

  const handleConChange = (index: number, value: string) => {
    setDraftCons((prev) => prev.map((item, i) => (i === index ? value : item)));
  };

  const handleAddPro = () => {
    setDraftPros((prev) => [...prev, '']);
  };

  const handleAddCon = () => {
    setDraftCons((prev) => [...prev, '']);
  };

  const handleDeletePro = (index: number) => {
    setDraftPros((prev) => prev.filter((_, i) => i !== index));
  };

  const handleDeleteCon = (index: number) => {
    setDraftCons((prev) => prev.filter((_, i) => i !== index));
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
        <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1 }}>
          {/* Pros edit */}
          <Box>
            <Typography sx={{ fontSize: 10, fontWeight: 700, mb: 0.5, textTransform: 'uppercase', color: 'success.main' }}>
              Pros
            </Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.25 }}>
              {draftPros.map((item, i) => (
                <Box key={i} sx={{ display: 'flex', gap: 0.25, alignItems: 'center' }}>
                  <TextField
                    size="small"
                    fullWidth
                    value={item}
                    onChange={(e) => handleProChange(i, e.target.value)}
                    autoFocus={i === 0}
                    sx={{ '& .MuiInputBase-input': { fontSize: 11, py: 0.15, px: 0.5 } }}
                  />
                  <IconButton
                    size="small"
                    onClick={() => handleDeletePro(i)}
                    sx={{ width: 16, height: 16, p: 0 }}
                  >
                    <Trash2 size={10} />
                  </IconButton>
                </Box>
              ))}
              <IconButton size="small" onClick={handleAddPro} sx={{ width: 20, height: 20, alignSelf: 'flex-start' }}>
                <Plus size={12} />
              </IconButton>
            </Box>
          </Box>
          {/* Cons edit */}
          <Box>
            <Typography sx={{ fontSize: 10, fontWeight: 700, mb: 0.5, textTransform: 'uppercase', color: 'error.main' }}>
              Cons
            </Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.25 }}>
              {draftCons.map((item, i) => (
                <Box key={i} sx={{ display: 'flex', gap: 0.25, alignItems: 'center' }}>
                  <TextField
                    size="small"
                    fullWidth
                    value={item}
                    onChange={(e) => handleConChange(i, e.target.value)}
                    sx={{ '& .MuiInputBase-input': { fontSize: 11, py: 0.15, px: 0.5 } }}
                  />
                  <IconButton
                    size="small"
                    onClick={() => handleDeleteCon(i)}
                    sx={{ width: 16, height: 16, p: 0 }}
                  >
                    <Trash2 size={10} />
                  </IconButton>
                </Box>
              ))}
              <IconButton size="small" onClick={handleAddCon} sx={{ width: 20, height: 20, alignSelf: 'flex-start' }}>
                <Plus size={12} />
              </IconButton>
            </Box>
          </Box>
        </Box>
      </Box>
    );
  }

  return (
    <Box sx={{ position: 'relative' }}>
      <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0 }}>
        {/* Pros column */}
        <Box
          sx={{
            p: 1.25,
            borderRight: '1px solid',
            borderColor: alpha(theme.palette.text.primary, 0.08),
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.75 }}>
            <ThumbsUp size={12} color={theme.palette.success.main} />
            <Typography
              sx={{
                fontSize: 10,
                fontWeight: 700,
                color: 'success.main',
                textTransform: 'uppercase',
                letterSpacing: 0.5,
              }}
            >
              Pros
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.35 }}>
            {data.pros.map((item, i) => (
              <Box key={i} sx={{ display: 'flex', alignItems: 'flex-start', gap: 0.5 }}>
                <Box
                  sx={{
                    width: 4,
                    height: 4,
                    borderRadius: '50%',
                    bgcolor: 'success.main',
                    mt: 0.6,
                    flexShrink: 0,
                  }}
                />
                <Typography sx={{ fontSize: 11, lineHeight: 1.4 }}>{item}</Typography>
              </Box>
            ))}
          </Box>
        </Box>
        {/* Cons column */}
        <Box sx={{ p: 1.25 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.75 }}>
            <ThumbsDown size={12} color={theme.palette.error.main} />
            <Typography
              sx={{
                fontSize: 10,
                fontWeight: 700,
                color: 'error.main',
                textTransform: 'uppercase',
                letterSpacing: 0.5,
              }}
            >
              Cons
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.35 }}>
            {data.cons.map((item, i) => (
              <Box key={i} sx={{ display: 'flex', alignItems: 'flex-start', gap: 0.5 }}>
                <Box
                  sx={{
                    width: 4,
                    height: 4,
                    borderRadius: '50%',
                    bgcolor: 'error.main',
                    mt: 0.6,
                    flexShrink: 0,
                  }}
                />
                <Typography sx={{ fontSize: 11, lineHeight: 1.4 }}>{item}</Typography>
              </Box>
            ))}
          </Box>
        </Box>
      </Box>
    </Box>
  );
}

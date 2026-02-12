import { useCallback, useState } from 'react';

import { alpha, Box, Checkbox, IconButton, TextField, Typography, useTheme } from '@mui/material';
import { Plus, Trash2 } from 'lucide-react';

import { resolveColor } from '../hooks/resolveColor';
import { useEditMode } from '../hooks/useEditMode';

interface ChecklistComponentProps {
  data: {
    title?: string;
    items: Array<{
      label: string;
      checked: boolean;
      indent?: number;
    }>;
    color?: string;
  };
  onSave?: (data: Record<string, unknown>) => void;
}

export function ChecklistComponent({ data, onSave }: ChecklistComponentProps) {
  const theme = useTheme();
  const [isEditing, setIsEditing] = useState(false);
  const [draftItems, setDraftItems] = useState(data.items);

  const accentColor = resolveColor(data.color, theme.palette.primary.main);

  const handleToggle = useCallback(
    (index: number) => {
      if (!onSave) return;
      const updated = data.items.map((item, i) =>
        i === index ? { ...item, checked: !item.checked } : item,
      );
      onSave({ ...data, items: updated });
    },
    [data, onSave],
  );

  const handleSave = useCallback(() => {
    onSave?.({ ...data, items: draftItems });
    setIsEditing(false);
  }, [data, draftItems, onSave]);

  const handleCancel = useCallback(() => {
    setIsEditing(false);
  }, []);

  const { startEdit, editHandlerRef } = useEditMode(handleSave, handleCancel);

  const handleStartEdit = () => {
    setDraftItems(data.items.map((i) => ({ ...i })));
    setIsEditing(true);
    startEdit();
  };
  editHandlerRef.current = handleStartEdit;

  const handleItemChange = (index: number, label: string) => {
    setDraftItems((prev) => prev.map((item, i) => (i === index ? { ...item, label } : item)));
  };

  const handleAddItem = () => {
    setDraftItems((prev) => [...prev, { label: '', checked: false }]);
  };

  const handleDeleteItem = (index: number) => {
    setDraftItems((prev) => prev.filter((_, i) => i !== index));
  };

  if (isEditing) {
    return (
      <Box
        className="nodrag nowheel nopan"
        sx={{ p: 1.5, outline: 'none' }}
      >
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
          {draftItems.map((item, i) => (
            <Box key={i} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <TextField
                size="small"
                fullWidth
                value={item.label}
                onChange={(e) => handleItemChange(i, e.target.value)}
                autoFocus={i === 0}
                sx={{ '& .MuiInputBase-input': { fontSize: 12, py: 0.25, px: 0.5 } }}
              />
              <IconButton
                size="small"
                onClick={() => handleDeleteItem(i)}
                sx={{ width: 20, height: 20, color: alpha(theme.palette.text.primary, 0.3) }}
              >
                <Trash2 size={12} />
              </IconButton>
            </Box>
          ))}
        </Box>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 0.5 }}>
          <IconButton size="small" onClick={handleAddItem} sx={{ color: 'primary.main' }}>
            <Plus size={14} />
          </IconButton>
        </Box>
      </Box>
    );
  }

  const completed = data.items.filter((i) => i.checked).length;
  const total = data.items.length;

  return (
    <Box sx={{ p: 1.5, position: 'relative' }}>
      {/* Progress bar */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
        <Box
          sx={{
            flex: 1,
            height: 3,
            borderRadius: 1.5,
            bgcolor: alpha(accentColor, 0.12),
            overflow: 'hidden',
          }}
        >
          <Box
            sx={{
              height: '100%',
              width: total > 0 ? `${(completed / total) * 100}%` : '0%',
              bgcolor: accentColor,
              borderRadius: 1.5,
              transition: 'width 300ms ease',
            }}
          />
        </Box>
        <Typography sx={{ fontSize: 11, color: 'text.secondary', flexShrink: 0 }}>
          {completed}/{total}
        </Typography>
      </Box>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
        {data.items.map((item, i) => (
          <Box
            key={i}
            sx={{
              display: 'flex',
              alignItems: 'center',
              ml: (item.indent ?? 0) * 2,
              gap: 0.25,
            }}
          >
            <Checkbox
              checked={item.checked}
              onChange={() => handleToggle(i)}
              disabled={!onSave}
              size="small"
              sx={{
                p: 0.25,
                color: alpha(theme.palette.text.primary, 0.2),
                '&.Mui-checked': { color: accentColor },
              }}
            />
            <Typography
              sx={{
                fontSize: 12,
                textDecoration: item.checked ? 'line-through' : 'none',
                color: item.checked ? 'text.secondary' : 'text.primary',
                transition: 'all 150ms ease',
              }}
            >
              {item.label}
            </Typography>
          </Box>
        ))}
      </Box>
    </Box>
  );
}

import { useCallback, useState } from 'react';

import { alpha, Box, IconButton, MenuItem, Select, TextField, Typography, useTheme } from '@mui/material';
import { Circle, CircleCheck, CircleDot, Plus, Trash2 } from 'lucide-react';

import { useEditMode } from '../hooks/useEditMode';

type StatusType = 'success' | 'warning' | 'error' | 'info' | 'neutral';

interface StatusItem {
  label: string;
  status: StatusType;
  description?: string;
  date?: string;
}

interface StatusListComponentProps {
  data: {
    items: Array<StatusItem>;
  };
  variant?: 'list' | 'timeline';
  onSave?: (data: Record<string, unknown>) => void;
}

const STATUS_OPTIONS = [
  { value: 'success', label: 'Success' },
  { value: 'warning', label: 'Warning' },
  { value: 'error', label: 'Error' },
  { value: 'info', label: 'Info' },
  { value: 'neutral', label: 'Neutral' },
] as const;

const TIMELINE_ICONS = {
  success: CircleCheck,
  info: CircleDot,
  warning: CircleDot,
  neutral: Circle,
  error: Circle,
} as const;

export function StatusListComponent({ data, variant = 'list', onSave }: StatusListComponentProps) {
  const theme = useTheme();
  const isTimeline = variant === 'timeline';
  const [isEditing, setIsEditing] = useState(false);
  const [draftItems, setDraftItems] = useState(data.items);

  const getStatusColor = (status: StatusType): string => {
    switch (status) {
      case 'success':
        return theme.palette.success.main;
      case 'warning':
        return theme.palette.warning.main;
      case 'error':
        return theme.palette.error.main;
      case 'info':
        return theme.palette.info.main;
      case 'neutral':
        return alpha(theme.palette.text.primary, 0.3);
    }
  };

  const handleSave = useCallback(() => {
    onSave?.({ items: draftItems });
    setIsEditing(false);
  }, [draftItems, onSave]);

  const handleCancel = useCallback(() => {
    setIsEditing(false);
  }, []);

  const { startEdit, endEdit, editHandlerRef } = useEditMode(handleSave, handleCancel);

  const handleStartEdit = () => {
    setDraftItems(data.items.map((item) => ({ ...item })));
    setIsEditing(true);
    startEdit();
  };
  editHandlerRef.current = handleStartEdit;

  const handleItemChange = (index: number, field: string, value: string) => {
    setDraftItems((prev) =>
      prev.map((item, i) => (i === index ? { ...item, [field]: value } : item)),
    );
  };

  const handleAddItem = () => {
    setDraftItems((prev) => [...prev, { label: '', status: 'neutral' satisfies StatusType }]);
  };

  const handleDeleteItem = (index: number) => {
    setDraftItems((prev) => prev.filter((_, i) => i !== index));
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
          {draftItems.map((item, i) => (
            <Box key={i} sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
              <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center' }}>
                <TextField
                  size="small"
                  value={item.label}
                  onChange={(e) => handleItemChange(i, 'label', e.target.value)}
                  placeholder="Label"
                  autoFocus={i === 0}
                  sx={{ flex: 1, '& .MuiInputBase-input': { fontSize: 12, py: 0.25 } }}
                />
                {isTimeline && (
                  <TextField
                    size="small"
                    value={item.date ?? ''}
                    onChange={(e) => handleItemChange(i, 'date', e.target.value)}
                    placeholder="Date"
                    sx={{ width: 80, '& .MuiInputBase-input': { fontSize: 11, py: 0.25 } }}
                  />
                )}
                <Select
                  size="small"
                  value={item.status}
                  onChange={(e) => handleItemChange(i, 'status', e.target.value)}
                  sx={{ minWidth: 90, fontSize: 11, '& .MuiSelect-select': { py: 0.25 } }}
                  MenuProps={{ onClick: (e) => e.stopPropagation() }}
                >
                  {STATUS_OPTIONS.map((opt) => (
                    <MenuItem key={opt.value} value={opt.value} sx={{ fontSize: 11 }}>
                      {opt.label}
                    </MenuItem>
                  ))}
                </Select>
                <IconButton
                  size="small"
                  onClick={() => handleDeleteItem(i)}
                  sx={{ width: 20, height: 20, color: alpha(theme.palette.text.primary, 0.3) }}
                >
                  <Trash2 size={12} />
                </IconButton>
              </Box>
              <TextField
                size="small"
                fullWidth
                value={item.description ?? ''}
                onChange={(e) => handleItemChange(i, 'description', e.target.value)}
                placeholder="Description (optional)"
                sx={{ '& .MuiInputBase-input': { fontSize: 11, py: 0.25 } }}
              />
            </Box>
          ))}
        </Box>
        <Box sx={{ display: 'flex', justifyContent: 'flex-start', mt: 0.5 }}>
          <IconButton size="small" onClick={handleAddItem} sx={{ color: 'primary.main' }}>
            <Plus size={14} />
          </IconButton>
        </Box>
      </Box>
    );
  }

  if (isTimeline) {
    return (
      <Box sx={{ p: 1.5, position: 'relative' }}>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
          {data.items.map((item, i) => {
            const color = getStatusColor(item.status);
            const StatusIcon = TIMELINE_ICONS[item.status];
            const isLast = i === data.items.length - 1;

            return (
              <Box key={i} sx={{ display: 'flex', gap: 1.25 }}>
                <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 16 }}>
                  <StatusIcon size={16} color={color} fill={item.status === 'success' ? color : 'transparent'} />
                  {!isLast && (
                    <Box
                      sx={{
                        width: 2,
                        flex: 1,
                        bgcolor: item.status === 'success' ? color : alpha(theme.palette.text.primary, 0.1),
                        my: 0.25,
                      }}
                    />
                  )}
                </Box>
                <Box sx={{ pb: isLast ? 0 : 1.5, flex: 1, minWidth: 0 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                    <Typography
                      sx={{
                        fontSize: 12,
                        fontWeight: 600,
                        color: item.status === 'neutral' ? 'text.secondary' : 'text.primary',
                      }}
                    >
                      {item.label}
                    </Typography>
                    {item.date && (
                      <Typography sx={{ fontSize: 10, color: 'text.secondary' }}>{item.date}</Typography>
                    )}
                  </Box>
                  {item.description && (
                    <Typography sx={{ fontSize: 11, color: 'text.secondary', mt: 0.25, lineHeight: 1.4 }}>
                      {item.description}
                    </Typography>
                  )}
                </Box>
              </Box>
            );
          })}
        </Box>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 1.5, position: 'relative' }}>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
        {data.items.map((item, i) => (
          <Box key={i} sx={{ display: 'flex', alignItems: 'flex-start', gap: 0.75, py: 0.25 }}>
            <Box
              sx={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                bgcolor: getStatusColor(item.status),
                flexShrink: 0,
                mt: 0.5,
              }}
            />
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography sx={{ fontSize: 12, fontWeight: 500 }}>{item.label}</Typography>
              {item.description && (
                <Typography sx={{ fontSize: 11, color: 'text.secondary', mt: 0.25 }}>
                  {item.description}
                </Typography>
              )}
            </Box>
          </Box>
        ))}
      </Box>
    </Box>
  );
}

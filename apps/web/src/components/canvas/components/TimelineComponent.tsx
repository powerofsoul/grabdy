import { useCallback, useState } from 'react';

import {
  alpha,
  Box,
  IconButton,
  MenuItem,
  Select,
  TextField,
  Typography,
  useTheme,
} from '@mui/material';
import {
  CheckCircleIcon,
  CircleIcon,
  PlusIcon,
  RadioButtonIcon,
  TrashIcon,
} from '@phosphor-icons/react';

import { useEditMode } from '../hooks/useEditMode';

interface TimelineComponentProps {
  data: {
    events: Array<{
      title: string;
      description?: string;
      date?: string;
      status: 'completed' | 'in_progress' | 'pending';
      color?: string;
    }>;
  };
  onSave?: (data: Record<string, unknown>) => void;
}

const STATUS_ICONS = {
  completed: CheckCircleIcon,
  in_progress: RadioButtonIcon,
  pending: CircleIcon,
} as const;

const STATUS_OPTIONS = [
  { value: 'completed', label: 'Done' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'pending', label: 'Pending' },
] as const;

export function TimelineComponent({ data, onSave }: TimelineComponentProps) {
  const theme = useTheme();
  const [isEditing, setIsEditing] = useState(false);
  const [draftEvents, setDraftEvents] = useState(data.events);

  const handleSave = useCallback(() => {
    onSave?.({ events: draftEvents });
    setIsEditing(false);
  }, [draftEvents, onSave]);

  const handleCancel = useCallback(() => {
    setIsEditing(false);
  }, []);

  useEditMode(handleSave, handleCancel, () => {
    setDraftEvents(data.events.map((e) => ({ ...e })));
    setIsEditing(true);
  });

  const handleEventChange = (index: number, field: string, value: string) => {
    setDraftEvents((prev) => prev.map((e, i) => (i === index ? { ...e, [field]: value } : e)));
  };

  const handleAddEvent = () => {
    setDraftEvents((prev) => [...prev, { title: '', status: 'pending' as const }]);
  };

  const handleDeleteEvent = (index: number) => {
    setDraftEvents((prev) => prev.filter((_, i) => i !== index));
  };

  if (isEditing) {
    return (
      <Box className="nodrag nowheel nopan" sx={{ p: 1.5, outline: 'none' }}>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          {draftEvents.map((event, i) => (
            <Box key={i} sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
              <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center' }}>
                <TextField
                  size="small"
                  value={event.title}
                  onChange={(e) => handleEventChange(i, 'title', e.target.value)}
                  placeholder="Event title"
                  sx={{ flex: 1, '& .MuiInputBase-input': { fontSize: 12, py: 0.25 } }}
                />
                <TextField
                  size="small"
                  value={event.date ?? ''}
                  onChange={(e) => handleEventChange(i, 'date', e.target.value)}
                  placeholder="Date"
                  sx={{ width: 80, '& .MuiInputBase-input': { fontSize: 11, py: 0.25 } }}
                />
                <Select
                  size="small"
                  value={event.status}
                  onChange={(e) => handleEventChange(i, 'status', e.target.value)}
                  MenuProps={{ onClick: (e) => e.stopPropagation() }}
                  sx={{ minWidth: 90, fontSize: 11, '& .MuiSelect-select': { py: 0.25 } }}
                >
                  {STATUS_OPTIONS.map((opt) => (
                    <MenuItem key={opt.value} value={opt.value} sx={{ fontSize: 11 }}>
                      {opt.label}
                    </MenuItem>
                  ))}
                </Select>
                <IconButton
                  size="small"
                  onClick={() => handleDeleteEvent(i)}
                  sx={{ width: 20, height: 20, color: alpha(theme.palette.text.primary, 0.3) }}
                >
                  <TrashIcon size={12} weight="light" color="currentColor" />
                </IconButton>
              </Box>
              <TextField
                size="small"
                fullWidth
                value={event.description ?? ''}
                onChange={(e) => handleEventChange(i, 'description', e.target.value)}
                placeholder="Description (optional)"
                sx={{ '& .MuiInputBase-input': { fontSize: 11, py: 0.25 } }}
              />
            </Box>
          ))}
        </Box>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 0.5 }}>
          <IconButton size="small" onClick={handleAddEvent} sx={{ color: 'primary.main' }}>
            <PlusIcon size={14} weight="light" color="currentColor" />
          </IconButton>
        </Box>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 1.5, position: 'relative' }}>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
        {data.events.map((event, i) => {
          const color =
            event.color ??
            (event.status === 'completed'
              ? theme.palette.success.main
              : event.status === 'in_progress'
                ? theme.palette.primary.main
                : alpha(theme.palette.text.primary, 0.25));

          const StatusIcon = STATUS_ICONS[event.status];
          const isLast = i === data.events.length - 1;

          return (
            <Box key={i} sx={{ display: 'flex', gap: 1.25 }}>
              <Box
                sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 16 }}
              >
                <StatusIcon
                  size={16}
                  weight="light"
                  color={color}
                  fill={event.status === 'completed' ? color : 'transparent'}
                />
                {!isLast && (
                  <Box
                    sx={{
                      width: 2,
                      flex: 1,
                      bgcolor:
                        event.status === 'completed'
                          ? color
                          : alpha(theme.palette.text.primary, 0.1),
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
                      color: event.status === 'pending' ? 'text.secondary' : 'text.primary',
                    }}
                  >
                    {event.title}
                  </Typography>
                  {event.date && (
                    <Typography sx={{ fontSize: 10, color: 'text.secondary' }}>
                      {event.date}
                    </Typography>
                  )}
                </Box>
                {event.description && (
                  <Typography
                    sx={{ fontSize: 11, color: 'text.secondary', mt: 0.25, lineHeight: 1.4 }}
                  >
                    {event.description}
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

import { useCallback, useRef, useState } from 'react';

import { alpha, Box, TextField, Typography, useTheme } from '@mui/material';
import { CheckCircleIcon, InfoIcon, WarningCircleIcon, WarningIcon } from '@phosphor-icons/react';

import { useEditMode } from '../hooks/useEditMode';

import { CanvasEditor } from './CanvasEditor';
import { MarkdownContent } from './MarkdownContent';

interface CalloutComponentProps {
  data: {
    variant: 'info' | 'success' | 'warning' | 'error';
    title?: string;
    message: string;
    icon?: string;
  };
  onSave?: (data: Record<string, unknown>) => void;
}

const VARIANT_CONFIG = {
  info: { Icon: InfoIcon, paletteKey: 'info' as const },
  success: { Icon: CheckCircleIcon, paletteKey: 'success' as const },
  warning: { Icon: WarningIcon, paletteKey: 'warning' as const },
  error: { Icon: WarningCircleIcon, paletteKey: 'error' as const },
};

export function CalloutComponent({ data, onSave }: CalloutComponentProps) {
  const theme = useTheme();
  const [isEditing, setIsEditing] = useState(false);
  const [draftTitle, setDraftTitle] = useState(data.title ?? '');
  const contentRef = useRef(data.message);

  const config = VARIANT_CONFIG[data.variant] ?? VARIANT_CONFIG.info;
  const variantColor = theme.palette[config.paletteKey].main;
  const Icon = config.Icon;

  const handleSave = useCallback(() => {
    onSave?.({ ...data, title: draftTitle || undefined, message: contentRef.current });
    setIsEditing(false);
  }, [data, draftTitle, onSave]);

  const handleCancel = useCallback(() => {
    setIsEditing(false);
  }, []);

  const { endEdit } = useEditMode(handleSave, handleCancel, () => {
    if (!onSave) return;
    setDraftTitle(data.title ?? '');
    contentRef.current = data.message;
    setIsEditing(true);
  });

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      handleCancel();
      endEdit();
    }
  };

  return (
    <Box
      sx={{
        p: 1.5,
        display: 'flex',
        gap: 1,
        bgcolor: alpha(variantColor, 0.06),
        borderRadius: 'inherit',
      }}
    >
      <Box
        sx={{
          width: 3,
          alignSelf: 'stretch',
          flexShrink: 0,
          bgcolor: variantColor,
          borderRadius: 1,
        }}
      />
      <Box sx={{ flexShrink: 0, mt: 0.25 }}>
        {data.icon ? (
          <Typography sx={{ fontSize: 16 }}>{data.icon}</Typography>
        ) : (
          <Icon size={16} weight="light" color={variantColor} />
        )}
      </Box>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        {isEditing ? (
          <TextField
            size="small"
            fullWidth
            className="nodrag nowheel nopan"
            value={draftTitle}
            onChange={(e) => setDraftTitle(e.target.value)}
            onKeyDown={handleKeyDown}
            autoFocus
            placeholder="Title (optional)"
            onClick={(e) => e.stopPropagation()}
            sx={{
              mb: 0.5,
              '& .MuiInputBase-input': { fontSize: 12, fontWeight: 600, py: 0.25, px: 0.5 },
            }}
          />
        ) : (
          <Typography
            sx={{
              fontSize: 12,
              fontWeight: 600,
              mb: 0.25,
              color: variantColor,
              borderRadius: 0.5,
            }}
          >
            {data.title ??
              (onSave ? (
                <span style={{ fontStyle: 'italic', opacity: 0.5 }}>Add title...</span>
              ) : (
                ''
              ))}
          </Typography>
        )}

        {isEditing ? (
          <CanvasEditor
            content={data.message}
            contentRef={contentRef}
            onCancel={() => {
              handleCancel();
              endEdit();
            }}
            fontSize={12}
            placeholder="Message..."
          />
        ) : (
          <MarkdownContent content={data.message} fontSize={12} />
        )}
      </Box>
    </Box>
  );
}

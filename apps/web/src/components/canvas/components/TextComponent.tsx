import { useCallback, useRef, useState } from 'react';

import { Box, Typography } from '@mui/material';

import { useEditMode } from '../hooks/useEditMode';

import { CanvasEditor } from './CanvasEditor';
import { MarkdownContent } from './MarkdownContent';

interface TextComponentProps {
  data: {
    content: string;
    fontSize?: number;
    color?: string;
    align?: 'left' | 'center' | 'right';
    icon?: string;
  };
  onSave?: (data: Record<string, unknown>) => void;
}

export function TextComponent({ data, onSave }: TextComponentProps) {
  const [isEditing, setIsEditing] = useState(false);
  const contentRef = useRef(data.content);

  const handleSave = useCallback(() => {
    onSave?.({ ...data, content: contentRef.current, icon: data.icon });
    setIsEditing(false);
  }, [data, onSave]);

  const handleCancel = useCallback(() => {
    setIsEditing(false);
  }, []);

  const { endEdit } = useEditMode(handleSave, handleCancel, () => {
    if (!onSave) return;
    contentRef.current = data.content;
    setIsEditing(true);
  });

  const handleEditorCancel = () => {
    handleCancel();
    endEdit();
  };

  if (isEditing) {
    return (
      <Box>
        {data.icon && (
          <Typography sx={{ fontSize: 20, mb: 0.5, px: 1.5, pt: 1.5 }}>{data.icon}</Typography>
        )}
        <CanvasEditor
          content={data.content}
          contentRef={contentRef}
          onCancel={handleEditorCancel}
          fontSize={data.fontSize}
          placeholder="Type something..."
        />
      </Box>
    );
  }

  return (
    <Box
      sx={{
        p: 1.5,
        borderRadius: 1,
      }}
    >
      {data.icon && <Typography sx={{ fontSize: 20, mb: 0.5 }}>{data.icon}</Typography>}
      <MarkdownContent
        content={data.content}
        fontSize={data.fontSize}
        color={data.color}
        align={data.align}
      />
    </Box>
  );
}

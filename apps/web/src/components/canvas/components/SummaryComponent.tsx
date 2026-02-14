import { useCallback, useRef, useState } from 'react';

import { Box, Typography } from '@mui/material';

import { useEditMode } from '../hooks/useEditMode';

import { CanvasEditor } from './CanvasEditor';
import { MarkdownContent } from './MarkdownContent';

interface SummaryComponentProps {
  data: {
    content: string;
    icon?: string;
  };
  onSave?: (data: Record<string, unknown>) => void;
}

export function SummaryComponent({ data, onSave }: SummaryComponentProps) {
  const [isEditing, setIsEditing] = useState(false);
  const contentRef = useRef(data.content);

  const handleSave = useCallback(() => {
    onSave?.({ content: contentRef.current, icon: data.icon });
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
          placeholder="Summary content..."
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
      {data.icon && (
        <Typography sx={{ fontSize: 20, mb: 0.5 }}>{data.icon}</Typography>
      )}
      <MarkdownContent content={data.content} />
    </Box>
  );
}

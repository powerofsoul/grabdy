import { useCallback, useMemo, useRef, useState } from 'react';

import { alpha, Box, useTheme } from '@mui/material';

import { useEditMode } from '../hooks/useEditMode';

import { CanvasEditor } from './CanvasEditor';
import { MarkdownContent } from './MarkdownContent';

type StickyNoteColor = 'yellow' | 'pink' | 'blue' | 'green' | 'purple' | 'orange';

interface StickyNoteComponentProps {
  data: {
    content: string;
    color: StickyNoteColor;
  };
  onSave?: (data: Record<string, unknown>) => void;
}

// Sticky note background palette — intentionally hardcoded (not UI chrome)
const COLOR_MAP: Record<StickyNoteColor, string> = {
  yellow: '#ffecb3',
  pink: '#fce4ec',
  blue: '#e3f2fd',
  green: '#e8f5e9',
  purple: '#f3e5f5',
  orange: '#fff3e0',
};

const COLOR_OPTIONS = [
  'yellow', 'pink', 'blue', 'green', 'purple', 'orange',
] as const satisfies readonly StickyNoteColor[];

export function StickyNoteComponent({ data, onSave }: StickyNoteComponentProps) {
  const theme = useTheme();
  const [isEditing, setIsEditing] = useState(false);
  const [draftColor, setDraftColor] = useState(data.color);
  const contentRef = useRef(data.content);

  const bgcolor = COLOR_MAP[data.color] ?? COLOR_MAP.yellow;
  const textColor = useMemo(() => alpha(theme.palette.common.black, 0.8), [theme]);

  const handleSave = useCallback(() => {
    onSave?.({ content: contentRef.current, color: draftColor });
    setIsEditing(false);
  }, [data, draftColor, onSave]);

  const handleCancel = useCallback(() => {
    setIsEditing(false);
  }, []);

  const { endEdit } = useEditMode(handleSave, handleCancel, () => {
    if (!onSave) return;
    setDraftColor(data.color);
    contentRef.current = data.content;
    setIsEditing(true);
  });

  const handleEditorCancel = () => {
    handleCancel();
    endEdit();
  };

  if (isEditing) {
    return (
      <Box sx={{ bgcolor: COLOR_MAP[draftColor] ?? COLOR_MAP.yellow, borderRadius: 'inherit' }}>
        <CanvasEditor
          content={data.content}
          contentRef={contentRef}
          onCancel={handleEditorCancel}
          fontSize={12}
          minHeight={40}
          placeholder="Type here..."
          color={textColor}
        />
        <Box
          sx={{ display: 'flex', gap: 0.5, px: 1.5, pb: 1 }}
          onMouseDown={(e) => e.preventDefault()}
        >
          {COLOR_OPTIONS.map((c) => (
            <Box
              key={c}
              onClick={(e) => { e.stopPropagation(); setDraftColor(c); }}
              sx={{
                width: 18,
                height: 18,
                borderRadius: '50%',
                bgcolor: COLOR_MAP[c],
                cursor: 'pointer',
                border: c === draftColor ? '2px solid' : '1px solid',
                borderColor: c === draftColor ? 'primary.main' : alpha(theme.palette.common.black, 0.15),
                transition: 'border-color 150ms ease',
              }}
            />
          ))}
        </Box>
      </Box>
    );
  }

  return (
    <Box
      sx={{
        p: 1.5,
        bgcolor,
        minHeight: 60,
        transition: 'filter 150ms ease',
        borderRadius: 'inherit',
      }}
    >
      <MarkdownContent
        content={data.content}
        fontSize={12}
        color={alpha(theme.palette.common.black, 0.8)}
      />
    </Box>
  );
}

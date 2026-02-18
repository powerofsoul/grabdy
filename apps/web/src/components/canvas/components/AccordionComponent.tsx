import { useCallback, useState } from 'react';

import { alpha, Box, IconButton, TextField, Typography, useTheme } from '@mui/material';
import { CaretDownIcon, CaretRightIcon, PlusIcon, TrashIcon } from '@phosphor-icons/react';

import { useEditMode } from '../hooks/useEditMode';

import { MarkdownContent } from './MarkdownContent';

interface AccordionComponentProps {
  data: {
    sections: Array<{ title: string; content: string; defaultOpen?: boolean }>;
  };
  onSave?: (data: Record<string, unknown>) => void;
}

export function AccordionComponent({ data, onSave }: AccordionComponentProps) {
  const theme = useTheme();
  const [isEditing, setIsEditing] = useState(false);
  const [draftSections, setDraftSections] = useState(data.sections);
  const [openSections, setOpenSections] = useState<Record<number, boolean>>(() => {
    const initial: Record<number, boolean> = {};
    data.sections.forEach((section, i) => {
      initial[i] = section.defaultOpen ?? false;
    });
    return initial;
  });

  const toggleSection = (index: number) => {
    setOpenSections((prev) => ({ ...prev, [index]: !prev[index] }));
  };

  const handleSave = useCallback(() => {
    onSave?.({ sections: draftSections });
    setIsEditing(false);
  }, [draftSections, onSave]);

  const handleCancel = useCallback(() => {
    setIsEditing(false);
  }, []);

  const { endEdit } = useEditMode(handleSave, handleCancel, () => {
    setDraftSections(data.sections.map((s) => ({ ...s })));
    setIsEditing(true);
  });

  const handleTitleChange = (index: number, title: string) => {
    setDraftSections((prev) => prev.map((s, i) => (i === index ? { ...s, title } : s)));
  };

  const handleContentChange = (index: number, content: string) => {
    setDraftSections((prev) => prev.map((s, i) => (i === index ? { ...s, content } : s)));
  };

  const handleAddSection = () => {
    setDraftSections((prev) => [...prev, { title: '', content: '' }]);
  };

  const handleDeleteSection = (index: number) => {
    setDraftSections((prev) => prev.filter((_, i) => i !== index));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      handleCancel();
      endEdit();
    }
  };

  if (isEditing) {
    return (
      <Box
        className="nodrag nowheel nopan"
        onKeyDown={handleKeyDown}
        sx={{ p: 1.5, outline: 'none' }}
      >
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          {draftSections.map((section, i) => (
            <Box key={i}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <TextField
                  size="small"
                  fullWidth
                  value={section.title}
                  onChange={(e) => handleTitleChange(i, e.target.value)}
                  placeholder="Section title"
                  sx={{
                    '& .MuiInputBase-input': { fontSize: 12, fontWeight: 600, py: 0.25, px: 0.5 },
                  }}
                />
                <IconButton
                  size="small"
                  onClick={() => handleDeleteSection(i)}
                  sx={{ width: 20, height: 20, color: alpha(theme.palette.text.primary, 0.3) }}
                >
                  <TrashIcon size={12} weight="light" color="currentColor" />
                </IconButton>
              </Box>
              <TextField
                size="small"
                fullWidth
                multiline
                minRows={2}
                value={section.content}
                onChange={(e) => handleContentChange(i, e.target.value)}
                placeholder="Section content"
                sx={{ mt: 0.5, '& .MuiInputBase-input': { fontSize: 11, py: 0.25, px: 0.5 } }}
              />
            </Box>
          ))}
        </Box>
        <Box sx={{ display: 'flex', justifyContent: 'flex-start', mt: 0.5 }}>
          <IconButton size="small" onClick={handleAddSection} sx={{ color: 'primary.main' }}>
            <PlusIcon size={14} weight="light" color="currentColor" />
          </IconButton>
        </Box>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 1, position: 'relative' }}>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
        {data.sections.map((section, i) => {
          const isOpen = openSections[i] ?? false;
          return (
            <Box
              key={i}
              sx={{
                borderBottom: i < data.sections.length - 1 ? '1px solid' : 'none',
                borderColor: alpha(theme.palette.text.primary, 0.08),
              }}
            >
              <Box
                onClick={() => toggleSection(i)}
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 0.5,
                  py: 0.75,
                  px: 0.5,
                  cursor: 'pointer',
                  borderRadius: 0.5,
                  '&:hover': { bgcolor: alpha(theme.palette.text.primary, 0.04) },
                }}
              >
                {isOpen ? (
                  <CaretDownIcon size={14} weight="light" color={theme.palette.text.secondary} />
                ) : (
                  <CaretRightIcon size={14} weight="light" color={theme.palette.text.secondary} />
                )}
                <Typography sx={{ fontSize: 12, fontWeight: 600, lineHeight: 1.4 }}>
                  {section.title}
                </Typography>
              </Box>
              {isOpen && (
                <Box sx={{ px: 1, pb: 0.75, pl: 3.5 }}>
                  <Box sx={{ color: 'text.secondary' }}>
                    <MarkdownContent content={section.content} fontSize={11} />
                  </Box>
                </Box>
              )}
            </Box>
          );
        })}
      </Box>
    </Box>
  );
}

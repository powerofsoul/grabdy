import { useCallback, useState } from 'react';

import { alpha, Box, IconButton, TextField, Typography, useTheme } from '@mui/material';
import { PlusIcon, TrashIcon } from '@phosphor-icons/react';

import { useEditMode } from '../hooks/useEditMode';

interface KanbanComponentProps {
  data: {
    columns: Array<{ title: string; items: string[] }>;
  };
  onSave?: (data: Record<string, unknown>) => void;
}

export function KanbanComponent({ data, onSave }: KanbanComponentProps) {
  const theme = useTheme();
  const [isEditing, setIsEditing] = useState(false);
  const [draftColumns, setDraftColumns] = useState(data.columns);

  const handleSave = useCallback(() => {
    onSave?.({ columns: draftColumns });
    setIsEditing(false);
  }, [draftColumns, onSave]);

  const handleCancel = useCallback(() => {
    setIsEditing(false);
  }, []);

  const { endEdit } = useEditMode(handleSave, handleCancel, () => {
    setDraftColumns(data.columns.map((c) => ({ ...c, items: [...c.items] })));
    setIsEditing(true);
  });

  const handleColumnTitleChange = (colIndex: number, title: string) => {
    setDraftColumns((prev) =>
      prev.map((col, i) => (i === colIndex ? { ...col, title } : col)),
    );
  };

  const handleItemChange = (colIndex: number, itemIndex: number, value: string) => {
    setDraftColumns((prev) =>
      prev.map((col, i) =>
        i === colIndex
          ? { ...col, items: col.items.map((item, j) => (j === itemIndex ? value : item)) }
          : col,
      ),
    );
  };

  const handleAddItem = (colIndex: number) => {
    setDraftColumns((prev) =>
      prev.map((col, i) =>
        i === colIndex ? { ...col, items: [...col.items, ''] } : col,
      ),
    );
  };

  const handleDeleteItem = (colIndex: number, itemIndex: number) => {
    setDraftColumns((prev) =>
      prev.map((col, i) =>
        i === colIndex ? { ...col, items: col.items.filter((_, j) => j !== itemIndex) } : col,
      ),
    );
  };

  const handleAddColumn = () => {
    setDraftColumns((prev) => [...prev, { title: '', items: [] }]);
  };

  const handleDeleteColumn = (colIndex: number) => {
    setDraftColumns((prev) => prev.filter((_, i) => i !== colIndex));
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
          {draftColumns.map((col, ci) => (
            <Box key={ci}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <TextField
                  size="small"
                  fullWidth
                  value={col.title}
                  onChange={(e) => handleColumnTitleChange(ci, e.target.value)}
                  placeholder="Column title"
                  sx={{ '& .MuiInputBase-input': { fontSize: 12, fontWeight: 600, py: 0.25, px: 0.5 } }}
                />
                <IconButton
                  size="small"
                  onClick={() => handleDeleteColumn(ci)}
                  sx={{ width: 20, height: 20, color: alpha(theme.palette.text.primary, 0.3) }}
                >
                  <TrashIcon size={12} weight="light" color="currentColor" />
                </IconButton>
              </Box>
              <Box sx={{ pl: 2, mt: 0.5, display: 'flex', flexDirection: 'column', gap: 0.25 }}>
                {col.items.map((item, ii) => (
                  <Box key={ii} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <TextField
                      size="small"
                      fullWidth
                      value={item}
                      onChange={(e) => handleItemChange(ci, ii, e.target.value)}
                      placeholder="Item"
                      sx={{ '& .MuiInputBase-input': { fontSize: 11, py: 0.15, px: 0.5 } }}
                    />
                    <IconButton
                      size="small"
                      onClick={() => handleDeleteItem(ci, ii)}
                      sx={{ width: 16, height: 16, color: alpha(theme.palette.text.primary, 0.25) }}
                    >
                      <TrashIcon size={10} weight="light" color="currentColor" />
                    </IconButton>
                  </Box>
                ))}
                <IconButton
                  size="small"
                  onClick={() => handleAddItem(ci)}
                  sx={{ width: 20, height: 20, color: alpha(theme.palette.primary.main, 0.6), alignSelf: 'flex-start' }}
                >
                  <PlusIcon size={12} weight="light" color="currentColor" />
                </IconButton>
              </Box>
            </Box>
          ))}
        </Box>
        <Box sx={{ display: 'flex', justifyContent: 'flex-start', mt: 0.5 }}>
          <IconButton size="small" onClick={handleAddColumn} sx={{ color: 'primary.main' }}>
            <PlusIcon size={14} weight="light" color="currentColor" />
          </IconButton>
        </Box>
      </Box>
    );
  }

  return (
    <Box
      sx={{ position: 'relative' }}
    >
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: `repeat(${data.columns.length}, 1fr)`,
          gap: 0,
        }}
      >
        {data.columns.map((col, ci) => (
          <Box
            key={ci}
            sx={{
              p: 1,
              borderRight: ci < data.columns.length - 1 ? '1px solid' : 'none',
              borderColor: alpha(theme.palette.text.primary, 0.08),
            }}
          >
            <Typography
              sx={{
                fontSize: 11,
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: 0.5,
                color: 'text.secondary',
                mb: 0.75,
              }}
            >
              {col.title}
            </Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
              {col.items.map((item, ii) => (
                <Box
                  key={ii}
                  sx={{
                    px: 0.75,
                    py: 0.5,
                    borderRadius: 0.5,
                    bgcolor: alpha(theme.palette.text.primary, 0.04),
                  }}
                >
                  <Typography sx={{ fontSize: 12, lineHeight: 1.4 }}>{item}</Typography>
                </Box>
              ))}
            </Box>
          </Box>
        ))}
      </Box>
    </Box>
  );
}

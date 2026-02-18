import { useCallback, useState } from 'react';

import { alpha, Box, Button, IconButton, TextField, Typography, useTheme } from '@mui/material';
import { PlusIcon, TrashIcon } from '@phosphor-icons/react';

import { useEditMode } from '../hooks/useEditMode';

interface TopicMapComponentProps {
  data: {
    centralTopic: string;
    branches: Array<{
      label: string;
      children?: string[];
    }>;
  };
  onSave?: (data: Record<string, unknown>) => void;
}

export function TopicMapComponent({ data, onSave }: TopicMapComponentProps) {
  const theme = useTheme();
  const [isEditing, setIsEditing] = useState(false);
  const [draftTopic, setDraftTopic] = useState(data.centralTopic);
  const [draftBranches, setDraftBranches] = useState(data.branches);

  const handleSave = useCallback(() => {
    onSave?.({ centralTopic: draftTopic, branches: draftBranches });
    setIsEditing(false);
  }, [draftTopic, draftBranches, onSave]);

  const handleCancel = useCallback(() => {
    setIsEditing(false);
  }, []);

  const { endEdit } = useEditMode(handleSave, handleCancel, () => {
    setDraftTopic(data.centralTopic);
    setDraftBranches(
      data.branches.map((b) => ({ ...b, children: b.children ? [...b.children] : [] }))
    );
    setIsEditing(true);
  });

  const handleBranchLabelChange = (index: number, label: string) => {
    setDraftBranches((prev) => {
      const updated = prev.map((b) => ({ ...b, children: b.children ? [...b.children] : [] }));
      updated[index].label = label;
      return updated;
    });
  };

  const handleAddBranch = () => {
    setDraftBranches((prev) => [...prev, { label: '', children: [] }]);
  };

  const handleDeleteBranch = (index: number) => {
    setDraftBranches((prev) => prev.filter((_, i) => i !== index));
  };

  const handleChildChange = (branchIndex: number, childIndex: number, value: string) => {
    setDraftBranches((prev) =>
      prev.map((b, i) =>
        i === branchIndex
          ? { ...b, children: (b.children ?? []).map((c, j) => (j === childIndex ? value : c)) }
          : b
      )
    );
  };

  const handleAddChild = (branchIndex: number) => {
    setDraftBranches((prev) =>
      prev.map((b, i) => (i === branchIndex ? { ...b, children: [...(b.children ?? []), ''] } : b))
    );
  };

  const handleDeleteChild = (branchIndex: number, childIndex: number) => {
    setDraftBranches((prev) =>
      prev.map((b, i) =>
        i === branchIndex
          ? { ...b, children: (b.children ?? []).filter((_, j) => j !== childIndex) }
          : b
      )
    );
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      handleCancel();
      endEdit();
    }
  };

  if (isEditing) {
    return (
      <Box className="nodrag nowheel nopan" onKeyDown={handleKeyDown} sx={{ p: 1.5 }}>
        <TextField
          size="small"
          fullWidth
          value={draftTopic}
          onChange={(e) => setDraftTopic(e.target.value)}
          autoFocus
          placeholder="Central topic"
          sx={{
            mb: 1.5,
            '& .MuiInputBase-input': {
              fontSize: 14,
              fontWeight: 700,
              textAlign: 'center',
              py: 0.75,
            },
          }}
        />
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          {draftBranches.map((branch, i) => (
            <Box
              key={i}
              sx={{
                borderRadius: 1,
                border: '1px solid',
                borderColor: alpha(theme.palette.text.primary, 0.08),
                p: 1,
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.75 }}>
                <TextField
                  size="small"
                  fullWidth
                  value={branch.label}
                  onChange={(e) => handleBranchLabelChange(i, e.target.value)}
                  placeholder="Category name"
                  sx={{
                    '& .MuiInputBase-input': { fontSize: 13, fontWeight: 600, py: 0.5, px: 0.75 },
                  }}
                />
                <IconButton
                  size="small"
                  onClick={() => handleDeleteBranch(i)}
                  sx={{
                    width: 28,
                    height: 28,
                    color: alpha(theme.palette.error.main, 0.5),
                    '&:hover': { color: 'error.main' },
                  }}
                >
                  <TrashIcon size={15} weight="light" color="currentColor" />
                </IconButton>
              </Box>
              {/* Children tags */}
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, pl: 0.5 }}>
                {(branch.children ?? []).map((child, j) => (
                  <Box
                    key={j}
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 0.25,
                      bgcolor: alpha(theme.palette.text.primary, 0.05),
                      borderRadius: 1,
                      pl: 0.75,
                      pr: 0.25,
                      py: 0.25,
                    }}
                  >
                    <TextField
                      size="small"
                      variant="standard"
                      value={child}
                      onChange={(e) => handleChildChange(i, j, e.target.value)}
                      placeholder="Item"
                      slotProps={{ input: { disableUnderline: true } }}
                      sx={{
                        '& .MuiInputBase-input': {
                          fontSize: 12,
                          py: 0,
                          px: 0.25,
                          width: Math.max(40, child.length * 7),
                        },
                      }}
                    />
                    <IconButton
                      size="small"
                      onClick={() => handleDeleteChild(i, j)}
                      sx={{
                        width: 20,
                        height: 20,
                        color: alpha(theme.palette.text.primary, 0.3),
                        '&:hover': { color: 'error.main' },
                      }}
                    >
                      <TrashIcon size={12} weight="light" color="currentColor" />
                    </IconButton>
                  </Box>
                ))}
                <Button
                  size="small"
                  variant="text"
                  startIcon={<PlusIcon size={14} weight="light" color="currentColor" />}
                  onClick={() => handleAddChild(i)}
                  sx={{
                    fontSize: 11,
                    color: alpha(theme.palette.primary.main, 0.7),
                    minWidth: 0,
                    px: 1,
                    py: 0.25,
                    '&:hover': { bgcolor: alpha(theme.palette.primary.main, 0.08) },
                  }}
                >
                  Add item
                </Button>
              </Box>
            </Box>
          ))}
        </Box>
        <Button
          size="small"
          variant="outlined"
          startIcon={<PlusIcon size={16} weight="light" color="currentColor" />}
          onClick={handleAddBranch}
          fullWidth
          sx={{
            mt: 1.5,
            fontSize: 12,
            borderStyle: 'dashed',
            color: alpha(theme.palette.primary.main, 0.7),
            borderColor: alpha(theme.palette.primary.main, 0.3),
            '&:hover': {
              borderColor: 'primary.main',
              bgcolor: alpha(theme.palette.primary.main, 0.04),
            },
          }}
        >
          Add category
        </Button>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 1.5, position: 'relative' }}>
      <Typography
        sx={{
          fontSize: 14,
          fontWeight: 700,
          textAlign: 'center',
          p: 1,
          mb: 1.5,
          borderRadius: 1,
          bgcolor: alpha(theme.palette.primary.main, 0.1),
          color: 'primary.main',
        }}
      >
        {data.centralTopic}
      </Typography>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        {data.branches.map((branch, i) => (
          <Box key={i}>
            <Typography sx={{ fontSize: 12, fontWeight: 600, mb: 0.5 }}>{branch.label}</Typography>
            {branch.children && (
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, pl: 1.5 }}>
                {branch.children.map((child, j) => (
                  <Typography
                    key={j}
                    sx={{
                      fontSize: 11,
                      px: 1,
                      py: 0.25,
                      borderRadius: 0.5,
                      bgcolor: alpha(theme.palette.text.primary, 0.06),
                      color: 'text.secondary',
                    }}
                  >
                    {child}
                  </Typography>
                ))}
              </Box>
            )}
          </Box>
        ))}
      </Box>
    </Box>
  );
}

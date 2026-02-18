import { useCallback, useState } from 'react';

import {
  alpha,
  Box,
  IconButton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  useTheme,
} from '@mui/material';
import { PlusIcon, TrashIcon } from '@phosphor-icons/react';

import { useEditMode } from '../hooks/useEditMode';

interface ComparisonComponentProps {
  data: {
    items: string[];
    attributes: Array<{
      name: string;
      values: string[];
    }>;
    highlightBest: boolean;
  };
  onSave?: (data: Record<string, unknown>) => void;
}

export function ComparisonComponent({ data, onSave }: ComparisonComponentProps) {
  const theme = useTheme();
  const [isEditing, setIsEditing] = useState(false);
  const [draftItems, setDraftItems] = useState(data.items);
  const [draftAttrs, setDraftAttrs] = useState(data.attributes);

  const handleSave = useCallback(() => {
    onSave?.({ ...data, items: draftItems, attributes: draftAttrs });
    setIsEditing(false);
  }, [data, draftItems, draftAttrs, onSave]);

  const handleCancel = useCallback(() => {
    setIsEditing(false);
  }, []);

  const { endEdit } = useEditMode(handleSave, handleCancel, () => {
    setDraftItems([...data.items]);
    setDraftAttrs(data.attributes.map((a) => ({ ...a, values: [...a.values] })));
    setIsEditing(true);
  });

  const handleAddColumn = () => {
    setDraftItems((prev) => [...prev, `Option ${prev.length + 1}`]);
    setDraftAttrs((prev) => prev.map((a) => ({ ...a, values: [...a.values, ''] })));
  };

  const handleDeleteColumn = (colIndex: number) => {
    setDraftItems((prev) => prev.filter((_, i) => i !== colIndex));
    setDraftAttrs((prev) =>
      prev.map((a) => ({ ...a, values: a.values.filter((_, i) => i !== colIndex) }))
    );
  };

  const handleAddRow = () => {
    setDraftAttrs((prev) => [...prev, { name: '', values: draftItems.map(() => '') }]);
  };

  const handleDeleteRow = (rowIndex: number) => {
    setDraftAttrs((prev) => prev.filter((_, i) => i !== rowIndex));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      handleCancel();
      endEdit();
    }
  };

  if (isEditing) {
    return (
      <Box className="nodrag nowheel nopan" onKeyDown={handleKeyDown} sx={{ outline: 'none' }}>
        <TableContainer sx={{ maxHeight: 300 }}>
          <Table size="small" stickyHeader>
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontSize: 11, fontWeight: 600 }} />
                {draftItems.map((item, i) => (
                  <TableCell key={i} sx={{ p: 0.5 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25 }}>
                      <TextField
                        size="small"
                        value={item}
                        onChange={(e) =>
                          setDraftItems((prev) =>
                            prev.map((it, j) => (j === i ? e.target.value : it))
                          )
                        }
                        sx={{
                          '& .MuiInputBase-input': {
                            fontSize: 11,
                            py: 0.25,
                            px: 0.5,
                            fontWeight: 600,
                          },
                        }}
                      />
                      <IconButton
                        size="small"
                        onClick={() => handleDeleteColumn(i)}
                        sx={{
                          width: 16,
                          height: 16,
                          color: alpha(theme.palette.text.primary, 0.25),
                        }}
                      >
                        <TrashIcon size={10} weight="light" color="currentColor" />
                      </IconButton>
                    </Box>
                  </TableCell>
                ))}
                <TableCell sx={{ p: 0.5, width: 30 }}>
                  <IconButton
                    size="small"
                    onClick={handleAddColumn}
                    sx={{ width: 20, height: 20, color: 'primary.main' }}
                  >
                    <PlusIcon size={12} weight="light" color="currentColor" />
                  </IconButton>
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {draftAttrs.map((attr, ai) => (
                <TableRow key={ai}>
                  <TableCell sx={{ p: 0.5 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25 }}>
                      <TextField
                        size="small"
                        value={attr.name}
                        onChange={(e) =>
                          setDraftAttrs((prev) =>
                            prev.map((a, j) => (j === ai ? { ...a, name: e.target.value } : a))
                          )
                        }
                        sx={{ '& .MuiInputBase-input': { fontSize: 11, py: 0.25, px: 0.5 } }}
                      />
                      <IconButton
                        size="small"
                        onClick={() => handleDeleteRow(ai)}
                        sx={{
                          width: 16,
                          height: 16,
                          color: alpha(theme.palette.text.primary, 0.25),
                        }}
                      >
                        <TrashIcon size={10} weight="light" color="currentColor" />
                      </IconButton>
                    </Box>
                  </TableCell>
                  {attr.values.map((val, vi) => (
                    <TableCell key={vi} sx={{ p: 0.5 }}>
                      <TextField
                        size="small"
                        value={val}
                        onChange={(e) =>
                          setDraftAttrs((prev) =>
                            prev.map((a, j) =>
                              j === ai
                                ? {
                                    ...a,
                                    values: a.values.map((v, k) => (k === vi ? e.target.value : v)),
                                  }
                                : a
                            )
                          )
                        }
                        sx={{ '& .MuiInputBase-input': { fontSize: 11, py: 0.25, px: 0.5 } }}
                      />
                    </TableCell>
                  ))}
                  <TableCell />
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', px: 1, py: 0.5 }}>
          <IconButton size="small" onClick={handleAddRow} sx={{ color: 'primary.main' }}>
            <PlusIcon size={14} weight="light" color="currentColor" />
          </IconButton>
        </Box>
      </Box>
    );
  }

  return (
    <Box sx={{ position: 'relative' }}>
      <TableContainer sx={{ maxHeight: 300 }}>
        <Table size="small" stickyHeader>
          <TableHead>
            <TableRow>
              <TableCell sx={{ fontSize: 11, fontWeight: 600, color: 'text.secondary' }} />
              {data.items.map((item, i) => (
                <TableCell key={i} align="center" sx={{ fontSize: 12, fontWeight: 700 }}>
                  {item}
                </TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {data.attributes.map((attr, ai) => (
              <TableRow key={ai}>
                <TableCell sx={{ fontSize: 11, fontWeight: 600, color: 'text.secondary' }}>
                  {attr.name}
                </TableCell>
                {attr.values.map((val, vi) => {
                  const isBest =
                    data.highlightBest &&
                    attr.values.length > 1 &&
                    val ===
                      attr.values.reduce((a, b) => {
                        const na = parseFloat(a);
                        const nb = parseFloat(b);
                        if (!isNaN(na) && !isNaN(nb)) return na > nb ? a : b;
                        return a;
                      });

                  return (
                    <TableCell
                      key={vi}
                      align="center"
                      sx={{
                        fontSize: 12,
                        fontWeight: isBest ? 700 : 400,
                        color: isBest ? 'primary.main' : 'text.primary',
                        bgcolor: isBest ? alpha(theme.palette.primary.main, 0.04) : 'transparent',
                      }}
                    >
                      {val}
                    </TableCell>
                  );
                })}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
}

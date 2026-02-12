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
  Tooltip,
  useTheme,
} from '@mui/material';
import { Plus, Trash2, X } from 'lucide-react';

import { useEditMode } from '../hooks/useEditMode';

interface TableComponentProps {
  data: {
    columns: Array<{ key: string; label: string }>;
    rows: Array<Record<string, unknown>>;
  };
  onSave?: (data: Record<string, unknown>) => void;
}

export function TableComponent({ data, onSave }: TableComponentProps) {
  const theme = useTheme();
  const [isEditing, setIsEditing] = useState(false);
  const [draftColumns, setDraftColumns] = useState(data.columns);
  const [draftRows, setDraftRows] = useState(data.rows);

  const handleSave = useCallback(() => {
    onSave?.({ columns: draftColumns, rows: draftRows });
    setIsEditing(false);
  }, [draftColumns, draftRows, onSave]);

  const handleCancel = useCallback(() => {
    setDraftColumns(data.columns);
    setDraftRows(data.rows);
    setIsEditing(false);
  }, [data.columns, data.rows]);

  const { startEdit, editHandlerRef } = useEditMode(handleSave, handleCancel);

  const handleStartEdit = () => {
    setDraftColumns(data.columns.map((c) => ({ ...c })));
    setDraftRows(data.rows.map((r) => ({ ...r })));
    setIsEditing(true);
    startEdit();
  };
  editHandlerRef.current = handleStartEdit;

  const handleCellChange = (rowIndex: number, key: string, value: string) => {
    setDraftRows((prev) => {
      const updated = prev.map((r) => ({ ...r }));
      updated[rowIndex] = { ...updated[rowIndex], [key]: value };
      return updated;
    });
  };

  const handleColumnLabelChange = (colIndex: number, label: string) => {
    setDraftColumns((prev) => prev.map((c, i) => (i === colIndex ? { ...c, label } : c)));
  };

  const handleAddRow = () => {
    const emptyRow: Record<string, unknown> = {};
    for (const col of draftColumns) {
      emptyRow[col.key] = '';
    }
    setDraftRows((prev) => [...prev, emptyRow]);
  };

  const handleDeleteRow = (rowIndex: number) => {
    setDraftRows((prev) => prev.filter((_, i) => i !== rowIndex));
  };

  const handleAddColumn = () => {
    const newKey = `col_${Date.now()}`;
    setDraftColumns((prev) => [...prev, { key: newKey, label: `Column ${prev.length + 1}` }]);
    setDraftRows((prev) => prev.map((row) => ({ ...row, [newKey]: '' })));
  };

  const handleDeleteColumn = (colIndex: number) => {
    const colKey = draftColumns[colIndex].key;
    setDraftColumns((prev) => prev.filter((_, i) => i !== colIndex));
    setDraftRows((prev) => prev.map((row) => {
      const { [colKey]: _, ...rest } = row;
      return rest;
    }));
  };

  if (isEditing) {
    return (
      <Box
        className="nodrag nowheel nopan"
        sx={{ outline: 'none' }}
      >
        <TableContainer sx={{ maxHeight: 350 }}>
          <Table size="small" stickyHeader>
            <TableHead>
              <TableRow>
                {draftColumns.map((col, ci) => (
                  <TableCell key={col.key} sx={{ p: 0.5 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25 }}>
                      <TextField
                        size="small"
                        value={col.label}
                        onChange={(e) => handleColumnLabelChange(ci, e.target.value)}
                        sx={{ '& .MuiInputBase-input': { fontSize: 11, fontWeight: 600, py: 0.25, px: 0.5 } }}
                      />
                      {draftColumns.length > 1 && (
                        <IconButton
                          size="small"
                          onClick={() => handleDeleteColumn(ci)}
                          sx={{ width: 16, height: 16, p: 0, color: alpha(theme.palette.text.primary, 0.25) }}
                        >
                          <X size={10} />
                        </IconButton>
                      )}
                    </Box>
                  </TableCell>
                ))}
                <TableCell sx={{ width: 56, p: 0.5 }}>
                  <Tooltip title="Add column">
                    <IconButton
                      size="small"
                      onClick={handleAddColumn}
                      sx={{ width: 22, height: 22, color: 'primary.main' }}
                    >
                      <Plus size={12} />
                    </IconButton>
                  </Tooltip>
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {draftRows.map((row, i) => (
                <TableRow key={i}>
                  {draftColumns.map((col) => (
                    <TableCell key={col.key} sx={{ p: 0.5 }}>
                      <TextField
                        size="small"
                        fullWidth
                        value={String(row[col.key] ?? '')}
                        onChange={(e) => handleCellChange(i, col.key, e.target.value)}
                        sx={{ '& .MuiInputBase-input': { fontSize: 12, py: 0.5, px: 1 } }}
                      />
                    </TableCell>
                  ))}
                  <TableCell sx={{ p: 0.5 }}>
                    <IconButton
                      size="small"
                      onClick={() => handleDeleteRow(i)}
                      sx={{ width: 24, height: 24, color: alpha(theme.palette.text.primary, 0.3) }}
                    >
                      <Trash2 size={12} />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', px: 1, py: 0.5 }}>
          <Tooltip title="Add row">
            <IconButton size="small" onClick={handleAddRow} sx={{ color: 'primary.main' }}>
              <Plus size={14} />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>
    );
  }

  return (
    <Table size="small">
      <TableHead>
        <TableRow>
          {data.columns.map((col) => (
            <TableCell key={col.key} sx={{ fontSize: 12, fontWeight: 600 }}>
              {col.label}
            </TableCell>
          ))}
        </TableRow>
      </TableHead>
      <TableBody>
        {data.rows.map((row, i) => (
          <TableRow key={i}>
            {data.columns.map((col) => (
              <TableCell key={col.key} sx={{ fontSize: 12 }}>
                {String(row[col.key] ?? '')}
              </TableCell>
            ))}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

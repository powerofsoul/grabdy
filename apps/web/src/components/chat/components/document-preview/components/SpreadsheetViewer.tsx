import { useMemo } from 'react';

import { Box, Typography } from '@mui/material';
import { DataGrid, type GridColDef } from '@mui/x-data-grid';

export function SpreadsheetViewer({ rows }: { rows: string[][] }) {
  const { columns, gridRows } = useMemo(() => {
    if (rows.length === 0) {
      const empty: { columns: GridColDef[]; gridRows: never[] } = { columns: [], gridRows: [] };
      return empty;
    }

    const header = rows[0];
    const body = rows.slice(1);

    const cols: GridColDef[] = header.map((name, i) => ({
      field: `col_${i}`,
      headerName: name || `Column ${i + 1}`,
      flex: 1,
      minWidth: 100,
      sortable: true,
    }));

    const gRows = body.map((row, ri) => {
      const obj: Record<string, string | number> = { id: ri };
      row.forEach((cell, ci) => {
        obj[`col_${ci}`] = cell;
      });
      return obj;
    });

    return { columns: cols, gridRows: gRows };
  }, [rows]);

  if (rows.length === 0) {
    return (
      <Box sx={{ p: 3 }}>
        <Typography color="text.secondary">Empty file</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ flex: 1, minHeight: 0 }}>
      <DataGrid
        rows={gridRows}
        columns={columns}
        density="compact"
        disableRowSelectionOnClick
        sx={{
          border: 'none',
          fontSize: '0.8rem',
          '& .MuiDataGrid-columnHeader': {
            fontWeight: 600,
            fontSize: '0.75rem',
          },
        }}
      />
    </Box>
  );
}

import { useState } from 'react';

import { Box, Tab, Tabs, Typography } from '@mui/material';

import { SpreadsheetViewer } from './SpreadsheetViewer';

export function XlsxViewer({ sheets }: { sheets: { name: string; rows: string[][] }[] }) {
  const [activeSheet, setActiveSheet] = useState(0);

  if (sheets.length === 0) {
    return (
      <Box sx={{ p: 3 }}>
        <Typography color="text.secondary">Empty workbook</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {sheets.length > 1 && (
        <Tabs
          value={activeSheet}
          onChange={(_, v: number) => setActiveSheet(v)}
          variant="scrollable"
          scrollButtons="auto"
          sx={{ borderBottom: 1, borderColor: 'divider', minHeight: 36 }}
        >
          {sheets.map((sheet, i) => (
            <Tab
              key={i}
              label={sheet.name}
              sx={{ textTransform: 'none', minHeight: 36, py: 0.5 }}
            />
          ))}
        </Tabs>
      )}
      <SpreadsheetViewer rows={sheets[activeSheet].rows} />
    </Box>
  );
}

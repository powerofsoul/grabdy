import { Box } from '@mui/material';

import { JsonTreeView } from '@/components/ui/JsonTreeView';

export function JsonViewer({ content }: { content: string }) {
  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    parsed = null;
  }

  if (parsed === null) {
    return (
      <Box sx={{ flex: 1, overflow: 'auto', p: 2 }}>
        <Box
          component="pre"
          sx={{
            fontSize: '0.78rem',
            fontFamily: 'monospace',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
            color: 'text.primary',
            m: 0,
          }}
        >
          {content}
        </Box>
      </Box>
    );
  }

  return (
    <Box sx={{ flex: 1, overflow: 'auto', p: 2 }}>
      <JsonTreeView value={parsed} />
    </Box>
  );
}

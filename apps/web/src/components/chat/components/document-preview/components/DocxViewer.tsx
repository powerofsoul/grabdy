import { useCallback, useEffect, useRef, useState } from 'react';

import { Box, CircularProgress } from '@mui/material';
import { renderAsync } from 'docx-preview';

export function DocxViewer({ blob }: { blob: Blob }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [rendering, setRendering] = useState(true);

  const render = useCallback(async (container: HTMLDivElement, docBlob: Blob) => {
    try {
      await renderAsync(docBlob, container, undefined, {
        className: 'docx-preview',
        inWrapper: true,
        ignoreWidth: false,
        ignoreHeight: false,
        ignoreFonts: false,
        breakPages: true,
        renderHeaders: true,
        renderFooters: true,
        renderFootnotes: true,
      });
    } catch {
      // Render failed
    } finally {
      setRendering(false);
    }
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    render(el, blob);
  }, [blob, render]);

  return (
    <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {rendering && (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
          <CircularProgress size={24} />
        </Box>
      )}
      <Box
        ref={containerRef}
        sx={{
          flex: 1,
          overflow: 'auto',
          '& .docx-wrapper': {
            background: 'transparent',
            padding: '16px',
          },
          '& .docx-wrapper > section.docx': {
            boxShadow: '0 0 0 1px',
            borderColor: 'divider',
            marginBottom: '16px',
            mx: 'auto',
          },
        }}
      />
    </Box>
  );
}

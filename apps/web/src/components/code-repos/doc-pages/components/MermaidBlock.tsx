import { useEffect, useRef, useState } from 'react';

import { Box, useTheme } from '@mui/material';
import DOMPurify from 'dompurify';
import mermaid from 'mermaid';

let mermaidInitialized = false;

interface MermaidBlockProps {
  code: string;
}

export function MermaidBlock({ code }: MermaidBlockProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [svg, setSvg] = useState('');
  const [error, setError] = useState(false);
  const theme = useTheme();

  useEffect(() => {
    if (!mermaidInitialized) {
      mermaid.initialize({
        startOnLoad: false,
        theme: theme.palette.mode === 'dark' ? 'dark' : 'default',
        securityLevel: 'strict',
        suppressErrorRendering: true,
      });
      mermaidInitialized = true;
    }

    const id = `mermaid-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    let cancelled = false;

    mermaid
      .render(id, code)
      .then((result) => {
        if (cancelled) return;
        setSvg(result.svg);
        setError(false);
      })
      .catch(() => {
        if (cancelled) return;
        setError(true);
        // Clean up any error elements mermaid may have injected into the DOM
        const errorEl = document.getElementById(id);
        if (errorEl) errorEl.remove();
        // Also remove the container div mermaid creates (d prefix)
        const container = document.getElementById(`d${id}`);
        if (container) container.remove();
      });

    return () => {
      cancelled = true;
    };
  }, [code, theme.palette.mode]);

  if (error) {
    return (
      <Box
        component="pre"
        sx={{
          bgcolor: 'action.hover',
          p: 2,
          borderRadius: 1.5,
          overflow: 'auto',
          fontSize: '0.82rem',
          my: 1,
        }}
      >
        <code>{code}</code>
      </Box>
    );
  }

  return (
    <Box
      ref={containerRef}
      sx={{
        my: 1.5,
        display: 'flex',
        justifyContent: 'center',
        '& svg': { maxWidth: '100%', height: 'auto' },
      }}
      dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(svg, { USE_PROFILES: { svg: true, svgFilters: true } }) }}
    />
  );
}

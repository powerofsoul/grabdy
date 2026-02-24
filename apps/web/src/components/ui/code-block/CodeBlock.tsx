import { useMemo } from 'react';

import { Box, Typography, useTheme } from '@mui/material';
import { common, createLowlight } from 'lowlight';

import type { HastNode } from './code-constants';
import {
  CODE_FONT,
  CODE_FONT_SIZE,
  CODE_LINE_HEIGHT,
  hastToReact,
  HIGHLIGHT_SX_DARK,
  HIGHLIGHT_SX_LIGHT,
} from './code-constants';

import { CopyButton } from '@/components/ui/CopyButton';

const lowlight = createLowlight(common);

interface CodeBlockProps {
  code: string;
  language: string;
  filename?: string;
}

export function CodeBlock({ code, language, filename }: CodeBlockProps) {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const highlightSx = isDark ? HIGHLIGHT_SX_DARK : HIGHLIGHT_SX_LIGHT;

  const lines = code.split('\n');

  const highlighted = useMemo(() => {
    try {
      const tree = language ? lowlight.highlight(language, code) : lowlight.highlightAuto(code);
      const root: HastNode = tree;
      return hastToReact(root);
    } catch {
      return null;
    }
  }, [code, language]);

  return (
    <Box
      sx={{
        mb: 3,
        borderRadius: 1.5,
        overflow: 'hidden',
        border: '1px solid',
        borderColor: 'divider',
      }}
    >
      {/* Header */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          px: 2,
          py: 0.75,
          bgcolor: 'action.hover',
          borderBottom: '1px solid',
          borderColor: 'divider',
        }}
      >
        <Typography
          variant="caption"
          sx={{ fontFamily: CODE_FONT, fontSize: 11, color: 'text.secondary' }}
        >
          {filename ?? language}
        </Typography>
        <CopyButton text={code} size={14} />
      </Box>

      {/* Code area */}
      <Box
        sx={{
          display: 'flex',
          overflow: 'auto',
          bgcolor: 'kindle.codeBlockBg',
          ...highlightSx,
        }}
      >
        {/* Line numbers */}
        <Box
          component="pre"
          aria-hidden
          sx={{
            m: 0,
            py: 1.5,
            pl: 1.5,
            pr: 1,
            fontFamily: CODE_FONT,
            fontSize: CODE_FONT_SIZE,
            lineHeight: CODE_LINE_HEIGHT,
            color: 'kindle.codeBlockText',
            opacity: 0.3,
            textAlign: 'right',
            userSelect: 'none',
            flexShrink: 0,
          }}
        >
          {lines.map((_, i) => (
            <div key={i}>{i + 1}</div>
          ))}
        </Box>

        {/* Highlighted code */}
        <Box
          component="pre"
          sx={{
            m: 0,
            py: 1.5,
            pl: 1.5,
            pr: 2,
            fontFamily: CODE_FONT,
            fontSize: CODE_FONT_SIZE,
            lineHeight: CODE_LINE_HEIGHT,
            color: 'kindle.codeBlockText',
            whiteSpace: 'pre',
            flex: 1,
            minWidth: 0,
          }}
        >
          <code>{highlighted ?? code}</code>
        </Box>
      </Box>
    </Box>
  );
}

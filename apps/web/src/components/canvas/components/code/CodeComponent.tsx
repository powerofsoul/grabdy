import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { alpha, Box, IconButton, MenuItem, Select, useTheme } from '@mui/material';
import { CheckIcon, CopyIcon } from '@phosphor-icons/react';
import { common, createLowlight } from 'lowlight';

import { useEditMode } from '../../hooks/useEditMode';

import type { HastNode } from './constants';
import {
  CODE_FONT,
  CODE_FONT_SIZE,
  CODE_LINE_HEIGHT,
  hastToReact,
  HIGHLIGHT_SX_DARK,
  LANGUAGES,
} from './constants';

interface CodeComponentProps {
  data: {
    code: string;
    language?: string;
    title?: string;
    showLineNumbers: boolean;
  };
  onSave?: (data: Record<string, unknown>) => void;
}

const lowlight = createLowlight(common);

const HIGHLIGHT_SX_LIGHT = {
  '& .hljs-keyword': { color: '#a626a4' },
  '& .hljs-string': { color: '#50a14f' },
  '& .hljs-number': { color: '#986801' },
  '& .hljs-comment': { color: '#a0a1a7', fontStyle: 'italic' },
  '& .hljs-function': { color: '#4078f2' },
  '& .hljs-title': { color: '#4078f2' },
  '& .hljs-params': { color: '#383a42' },
  '& .hljs-built_in': { color: '#c18401' },
  '& .hljs-literal': { color: '#0184bc' },
  '& .hljs-type': { color: '#c18401' },
  '& .hljs-attr': { color: '#986801' },
  '& .hljs-selector-class': { color: '#986801' },
  '& .hljs-selector-tag': { color: '#e45649' },
  '& .hljs-tag': { color: '#e45649' },
  '& .hljs-name': { color: '#e45649' },
  '& .hljs-variable': { color: '#e45649' },
  '& .hljs-meta': { color: '#4078f2' },
  '& .hljs-property': { color: '#e45649' },
  '& .hljs-punctuation': { color: '#383a42' },
} as const;

export function CodeComponent({ data, onSave }: CodeComponentProps) {
  const theme = useTheme();
  const [isEditing, setIsEditing] = useState(false);
  const [code, setCode] = useState(data.code);
  const [title, setTitle] = useState(data.title ?? '');
  const [language, setLanguage] = useState(data.language ?? '');
  const [copied, setCopied] = useState(false);
  const highlightSx = theme.palette.mode === 'dark' ? HIGHLIGHT_SX_DARK : HIGHLIGHT_SX_LIGHT;
  const lastSavedRef = useRef(data.code);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Sync when data changes from outside
  useEffect(() => {
    if (data.code !== lastSavedRef.current) {
      lastSavedRef.current = data.code;
      const newCode = data.code;
      queueMicrotask(() => setCode(newCode));
    }
  }, [data.code]);

  const highlightedContent = useMemo((): ReactNode | null => {
    try {
      const tree = language ? lowlight.highlight(language, code) : lowlight.highlightAuto(code);
      const root: HastNode = tree;
      return hastToReact(root);
    } catch {
      return null;
    }
  }, [code, language]);

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const handleSave = useCallback(() => {
    const next = { ...data, code, title: title || undefined, language: language || undefined };
    onSave?.(next);
    lastSavedRef.current = next.code ?? code;
    setIsEditing(false);
  }, [code, title, language, data, onSave]);

  const handleCancel = useCallback(() => {
    setCode(data.code);
    setTitle(data.title ?? '');
    setLanguage(data.language ?? '');
    setIsEditing(false);
  }, [data]);

  const { endEdit } = useEditMode(handleSave, handleCancel, () => {
    setCode(data.code);
    setTitle(data.title ?? '');
    setLanguage(data.language ?? '');
    setIsEditing(true);
  });

  const handleCodeChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setCode(e.target.value);
  }, []);

  const handleLanguageChange = useCallback((lang: string) => {
    setLanguage(lang);
  }, []);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Tab') {
        e.preventDefault();
        const ta = e.currentTarget;
        const start = ta.selectionStart;
        const end = ta.selectionEnd;
        const newVal = code.slice(0, start) + '  ' + code.slice(end);
        setCode(newVal);
        requestAnimationFrame(() => {
          ta.selectionStart = start + 2;
          ta.selectionEnd = start + 2;
        });
      }
      if (e.key === 'Escape') {
        handleCancel();
        endEdit();
      }
    },
    [code, handleCancel, endEdit]
  );

  const lines = code.split('\n');
  const lineNumberWidth = data.showLineNumbers ? 32 : 0;
  const hasHeader = data.title || data.language;

  return (
    <Box
      sx={{
        position: 'relative',
        '&:hover .copy-btn': { opacity: 1 },
      }}
    >
      {/* Header bar */}
      {(hasHeader || isEditing) && (
        <Box
          sx={{
            px: 1,
            py: 0.5,
            display: 'flex',
            alignItems: 'center',
            gap: 0.5,
          }}
        >
          {isEditing ? (
            <>
              <Box
                component="input"
                value={title}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTitle(e.target.value)}
                placeholder="Title..."
                className="nodrag nopan"
                sx={{
                  width: 'fit-content',
                  minWidth: 60,
                  maxWidth: '50%',
                  border: 'none',
                  outline: 'none',
                  background: 'transparent',
                  fontSize: 11,
                  fontWeight: 600,
                  color: 'text.secondary',
                  p: 0,
                  '&::placeholder': { color: alpha(theme.palette.text.primary, 0.25) },
                }}
              />
              <Select
                size="small"
                value={language}
                onChange={(e) => handleLanguageChange(e.target.value)}
                displayEmpty
                className="nodrag nopan"
                MenuProps={{ onClick: (e) => e.stopPropagation() }}
                sx={{
                  ml: 'auto',
                  minWidth: 90,
                  fontSize: 10,
                  color: alpha(theme.palette.text.primary, 0.4),
                  '& .MuiSelect-select': { py: 0.25, px: 0.5 },
                  '& .MuiOutlinedInput-notchedOutline': { border: 'none' },
                  '&:hover .MuiOutlinedInput-notchedOutline': {
                    border: '1px solid',
                    borderColor: alpha(theme.palette.text.primary, 0.12),
                  },
                }}
              >
                <MenuItem value="" sx={{ fontSize: 11 }}>
                  Auto
                </MenuItem>
                {LANGUAGES.filter(Boolean).map((lang) => (
                  <MenuItem key={lang} value={lang} sx={{ fontSize: 11 }}>
                    {lang}
                  </MenuItem>
                ))}
              </Select>
            </>
          ) : (
            <>
              {data.title && (
                <Box sx={{ fontSize: 11, fontWeight: 600, color: 'text.secondary' }}>
                  {data.title}
                </Box>
              )}
              {data.language && (
                <Box
                  sx={{ ml: 'auto', fontSize: 10, color: alpha(theme.palette.text.primary, 0.35) }}
                >
                  {data.language}
                </Box>
              )}
            </>
          )}
        </Box>
      )}

      <Box
        sx={{
          position: 'relative',
          p: 1.5,
          overflow: 'auto',
          maxHeight: 300,
        }}
      >
        {/* Highlighted code layer (visible, behind textarea) */}
        <Box
          sx={{
            fontFamily: CODE_FONT,
            fontSize: CODE_FONT_SIZE,
            lineHeight: CODE_LINE_HEIGHT,
            whiteSpace: 'pre',
            pointerEvents: 'none',
            pl: lineNumberWidth ? `${lineNumberWidth + 12}px` : 0,
            ...highlightSx,
          }}
          aria-hidden
        >
          {highlightedContent ? <Box component="code">{highlightedContent}</Box> : code}
          {'\n'}
        </Box>

        {/* Line numbers (if enabled) */}
        {data.showLineNumbers && (
          <Box
            sx={{
              position: 'absolute',
              top: 12,
              left: 12,
              fontFamily: CODE_FONT,
              fontSize: CODE_FONT_SIZE,
              lineHeight: CODE_LINE_HEIGHT,
              whiteSpace: 'pre',
              color: alpha(theme.palette.text.primary, 0.2),
              userSelect: 'none',
              pointerEvents: 'none',
              textAlign: 'right',
              width: lineNumberWidth,
            }}
          >
            {lines.map((_, i) => (
              <div key={i}>{i + 1}</div>
            ))}
          </Box>
        )}

        {/* Editable textarea overlay — only in edit mode */}
        {isEditing && (
          <Box
            component="textarea"
            ref={textareaRef}
            value={code}
            onChange={handleCodeChange}
            onKeyDown={handleKeyDown}
            spellCheck={false}
            className="nodrag nowheel nopan"
            sx={{
              position: 'absolute',
              top: 12,
              left: 12,
              right: 12,
              bottom: 12,
              pl: lineNumberWidth ? `${lineNumberWidth + 12}px` : 0,
              fontFamily: CODE_FONT,
              fontSize: CODE_FONT_SIZE,
              lineHeight: CODE_LINE_HEIGHT,
              whiteSpace: 'pre',
              background: 'transparent',
              color: 'transparent',
              caretColor: theme.palette.text.primary,
              border: 'none',
              outline: 'none',
              resize: 'none',
              overflow: 'hidden',
              m: 0,
              width: `calc(100% - 24px${lineNumberWidth ? ` - ${lineNumberWidth}px` : ''})`,
            }}
          />
        )}
      </Box>
      <IconButton
        className="copy-btn"
        size="small"
        onClick={handleCopy}
        sx={{
          position: 'absolute',
          top: hasHeader ? 32 : 4,
          right: 4,
          opacity: 0,
          transition: 'opacity 150ms ease',
          width: 24,
          height: 24,
          bgcolor: alpha(theme.palette.text.primary, 0.08),
          color: copied ? 'success.main' : alpha(theme.palette.text.primary, 0.5),
        }}
      >
        {copied ? (
          <CheckIcon size={12} weight="light" color="currentColor" />
        ) : (
          <CopyIcon size={12} weight="light" color="currentColor" />
        )}
      </IconButton>
    </Box>
  );
}

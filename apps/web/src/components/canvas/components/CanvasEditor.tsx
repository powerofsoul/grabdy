import { useEffect } from 'react';

import { alpha, Box, IconButton, Tooltip, useTheme } from '@mui/material';
import {
  TextB,
  Code,
  TextHOne,
  TextHTwo,
  TextHThree,
  TextItalic,
  ListBullets,
  ListNumbers,
  Quotes,
  TextStrikethrough,
} from '@phosphor-icons/react';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import { Markdown } from 'tiptap-markdown';

import type { Editor } from '@tiptap/core';

function getEditorMarkdown(editor: Editor): string {
  // tiptap-markdown extension adds getMarkdown() on editor.storage.markdown
  // but TipTap's Storage type is empty, so we access via Object.assign
  const store: Record<string, unknown> = Object.assign(Object.create(null), editor.storage);
  const md = store['markdown'];
  if (md && typeof md === 'object' && 'getMarkdown' in md) {
    const fn = (md satisfies Record<string, unknown>)['getMarkdown'];
    if (typeof fn === 'function') return fn.call(md);
  }
  return editor.getText();
}

function EditorToolbar({ editor }: { editor: Editor }) {
  const theme = useTheme();

  const btnSx = {
    width: 28,
    height: 28,
    color: alpha(theme.palette.text.primary, 0.5),
    '&:hover': { color: 'text.primary', bgcolor: alpha(theme.palette.text.primary, 0.08) },
  };

  const activeBtnSx = {
    ...btnSx,
    color: 'primary.main',
    bgcolor: alpha(theme.palette.primary.main, 0.1),
  };

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 0.25,
        px: 0.5,
        py: 0.25,
        borderRadius: 2,
        bgcolor: 'background.paper',
        border: '1px solid',
        borderColor: alpha(theme.palette.text.primary, 0.12),
        boxShadow: `0 2px 12px ${alpha(theme.palette.text.primary, 0.15)}`,
        position: 'absolute',
        top: 0,
        left: '50%',
        transform: 'translate(-50%, calc(-100% - 8px))',
        zIndex: 10,
        whiteSpace: 'nowrap',
      }}
      onMouseDown={(e) => e.preventDefault()}
    >
      <Tooltip title="Bold">
        <IconButton
          size="small"
          onClick={() => editor.chain().focus().toggleBold().run()}
          sx={editor.isActive('bold') ? activeBtnSx : btnSx}
        >
          <TextB size={14} weight="light" />
        </IconButton>
      </Tooltip>
      <Tooltip title="Italic">
        <IconButton
          size="small"
          onClick={() => editor.chain().focus().toggleItalic().run()}
          sx={editor.isActive('italic') ? activeBtnSx : btnSx}
        >
          <TextItalic size={14} weight="light" />
        </IconButton>
      </Tooltip>
      <Tooltip title="Strikethrough">
        <IconButton
          size="small"
          onClick={() => editor.chain().focus().toggleStrike().run()}
          sx={editor.isActive('strike') ? activeBtnSx : btnSx}
        >
          <TextStrikethrough size={14} weight="light" />
        </IconButton>
      </Tooltip>
      <Tooltip title="Code">
        <IconButton
          size="small"
          onClick={() => editor.chain().focus().toggleCode().run()}
          sx={editor.isActive('code') ? activeBtnSx : btnSx}
        >
          <Code size={14} weight="light" />
        </IconButton>
      </Tooltip>

      <Box sx={{ width: '1px', height: 18, bgcolor: alpha(theme.palette.text.primary, 0.12), mx: 0.25 }} />

      <Tooltip title="Heading 1">
        <IconButton
          size="small"
          onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
          sx={editor.isActive('heading', { level: 1 }) ? activeBtnSx : btnSx}
        >
          <TextHOne size={14} weight="light" />
        </IconButton>
      </Tooltip>
      <Tooltip title="Heading 2">
        <IconButton
          size="small"
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          sx={editor.isActive('heading', { level: 2 }) ? activeBtnSx : btnSx}
        >
          <TextHTwo size={14} weight="light" />
        </IconButton>
      </Tooltip>
      <Tooltip title="Heading 3">
        <IconButton
          size="small"
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
          sx={editor.isActive('heading', { level: 3 }) ? activeBtnSx : btnSx}
        >
          <TextHThree size={14} weight="light" />
        </IconButton>
      </Tooltip>

      <Box sx={{ width: '1px', height: 18, bgcolor: alpha(theme.palette.text.primary, 0.12), mx: 0.25 }} />

      <Tooltip title="Bullet list">
        <IconButton
          size="small"
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          sx={editor.isActive('bulletList') ? activeBtnSx : btnSx}
        >
          <ListBullets size={14} weight="light" />
        </IconButton>
      </Tooltip>
      <Tooltip title="Ordered list">
        <IconButton
          size="small"
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          sx={editor.isActive('orderedList') ? activeBtnSx : btnSx}
        >
          <ListNumbers size={14} weight="light" />
        </IconButton>
      </Tooltip>
      <Tooltip title="Blockquote">
        <IconButton
          size="small"
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          sx={editor.isActive('blockquote') ? activeBtnSx : btnSx}
        >
          <Quotes size={14} weight="light" />
        </IconButton>
      </Tooltip>
    </Box>
  );
}

interface CanvasEditorProps {
  content: string;
  /** Ref that always holds the latest editor markdown. Use this to read content on save. */
  contentRef?: React.MutableRefObject<string>;
  onCancel?: () => void;
  placeholder?: string;
  fontSize?: number;
  minHeight?: number;
  autoFocus?: boolean;
  /** Override text color (e.g. force dark text on light sticky note backgrounds) */
  color?: string;
}

export function CanvasEditor({
  content,
  contentRef,
  onCancel,
  placeholder = 'Type something...',
  fontSize = 13,
  minHeight = 60,
  autoFocus = true,
  color,
}: CanvasEditorProps) {
  const theme = useTheme();

  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({ placeholder }),
      Markdown,
    ],
    content,
    autofocus: autoFocus ? 'end' : false,
    editorProps: {
      handleKeyDown: (_view, event) => {
        if (event.key === 'Escape') {
          onCancel?.();
          return true;
        }
        return false;
      },
    },
    parseOptions: {
      preserveWhitespace: 'full',
    },
  });

  // Keep contentRef in sync with editor content so callers can read current markdown
  useEffect(() => {
    if (!editor || !contentRef) return;
    contentRef.current = getEditorMarkdown(editor);
    const handler = () => {
      contentRef.current = getEditorMarkdown(editor);
    };
    editor.on('update', handler);
    return () => { editor.off('update', handler); };
  }, [editor, contentRef]);

  if (!editor) return null;

  return (
    <Box
      className="nodrag nowheel nopan"
      sx={{
        position: 'relative',
        '& .tiptap': {
          outline: 'none',
          fontSize,
          lineHeight: 1.6,
          minHeight,
          p: 1.5,
          color: color ?? 'text.primary',
          '& p': { m: 0, mb: 1 },
          '& p:last-child': { mb: 0 },
          '& h1': { fontSize: '1.4em', fontWeight: 700, mt: 0, mb: 0.5 },
          '& h2': { fontSize: '1.2em', fontWeight: 600, mt: 0, mb: 0.5 },
          '& h3': { fontSize: '1.05em', fontWeight: 600, mt: 0, mb: 0.5 },
          '& ul, & ol': { m: 0, pl: 2.5 },
          '& blockquote': {
            m: 0,
            pl: 1.5,
            borderLeft: '3px solid',
            borderColor: alpha(theme.palette.text.primary, 0.15),
            color: 'text.secondary',
          },
          '& code': {
            fontSize: '0.9em',
            bgcolor: alpha(theme.palette.text.primary, 0.06),
            px: 0.5,
            py: 0.1,
            borderRadius: 0.5,
          },
          '& hr': {
            border: 'none',
            borderTop: '1px solid',
            borderColor: alpha(theme.palette.text.primary, 0.1),
            my: 1,
          },
          '& a': { color: 'primary.main', textDecoration: 'underline' },
          '& p.is-editor-empty:first-of-type::before': {
            content: 'attr(data-placeholder)',
            float: 'left',
            color: color ? alpha(color, 0.4) : alpha(theme.palette.text.primary, 0.3),
            pointerEvents: 'none',
            height: 0,
          },
        },
      }}
      onClick={(e) => e.stopPropagation()}
    >
      <EditorToolbar editor={editor} />
      <EditorContent editor={editor} />
    </Box>
  );
}

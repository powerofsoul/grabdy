import { useEffect } from 'react';

import { alpha, Box, useTheme } from '@mui/material';
import type { Editor } from '@tiptap/core';
import Placeholder from '@tiptap/extension-placeholder';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { Markdown } from 'tiptap-markdown';
import { z } from 'zod';

import { EditorToolbar } from './EditorToolbar';

const markdownStorageSchema = z.object({
  markdown: z.object({
    getMarkdown: z.custom<() => string>((val) => typeof val === 'function'),
  }),
});

function getEditorMarkdown(editor: Editor): string {
  const parsed = markdownStorageSchema.safeParse(editor.storage);
  if (parsed.success) return parsed.data.markdown.getMarkdown();
  return editor.getText();
}

interface DocPageEditorProps {
  content: string;
  contentRef: React.MutableRefObject<string>;
  placeholder?: string;
}

export function DocPageEditor({
  content,
  contentRef,
  placeholder = 'Start writing...',
}: DocPageEditorProps) {
  const theme = useTheme();

  const editor = useEditor({
    extensions: [StarterKit, Placeholder.configure({ placeholder }), Markdown],
    content,
    autofocus: 'end',
    parseOptions: {
      preserveWhitespace: 'full',
    },
  });

  useEffect(() => {
    if (!editor) return;
    contentRef.current = getEditorMarkdown(editor);
    const handler = () => {
      contentRef.current = getEditorMarkdown(editor);
    };
    editor.on('update', handler);
    return () => {
      editor.off('update', handler);
    };
  }, [editor, contentRef]);

  if (!editor) return null;

  return (
    <Box
      sx={{
        '& .tiptap': {
          outline: 'none',
          fontSize: 14,
          lineHeight: 1.7,
          minHeight: 400,
          p: 2.5,
          color: 'text.primary',
          '& p': { m: 0, mb: 1 },
          '& p:last-child': { mb: 0 },
          '& h1': { typography: 'h5', mt: 0, mb: 1.5, color: 'text.primary' },
          '& h2': { typography: 'h6', mt: 2, mb: 1, color: 'text.primary' },
          '& h3': { typography: 'subtitle1', mt: 1.5, mb: 0.75, color: 'text.primary' },
          '& ul, & ol': { m: 0, pl: 2.5 },
          '& li': { mb: 0.25, color: 'text.secondary' },
          '& blockquote': {
            m: 0,
            pl: 1.5,
            borderLeft: '3px solid',
            borderColor: alpha(theme.palette.text.primary, 0.15),
            color: 'text.secondary',
          },
          '& code': {
            fontFamily: 'monospace',
            fontSize: '0.85em',
            bgcolor: alpha(theme.palette.text.primary, 0.06),
            px: 0.5,
            py: 0.1,
            borderRadius: 0.5,
          },
          '& pre': {
            bgcolor: alpha(theme.palette.text.primary, 0.04),
            p: 1.5,
            borderRadius: 1,
            overflow: 'auto',
            mb: 1.5,
            '& code': { bgcolor: 'transparent', p: 0 },
          },
          '& a': { color: 'primary.main', textDecoration: 'underline' },
          '& hr': {
            border: 'none',
            borderTop: '1px solid',
            borderColor: alpha(theme.palette.text.primary, 0.1),
            my: 1,
          },
          '& p.is-editor-empty:first-of-type::before': {
            content: 'attr(data-placeholder)',
            float: 'left',
            color: alpha(theme.palette.text.primary, 0.3),
            pointerEvents: 'none',
            height: 0,
          },
        },
      }}
    >
      <EditorToolbar editor={editor} />
      <EditorContent editor={editor} />
    </Box>
  );
}

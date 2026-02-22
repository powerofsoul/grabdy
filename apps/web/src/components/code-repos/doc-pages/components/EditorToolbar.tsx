import { alpha, Box, IconButton, Tooltip, useTheme } from '@mui/material';
import {
  CodeIcon,
  ListBulletsIcon,
  ListNumbersIcon,
  QuotesIcon,
  TextBIcon,
  TextHOneIcon,
  TextHThreeIcon,
  TextHTwoIcon,
  TextItalicIcon,
  TextStrikethroughIcon,
} from '@phosphor-icons/react';
import type { Editor } from '@tiptap/core';

export function EditorToolbar({ editor }: { editor: Editor }) {
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
        position: 'sticky',
        top: 0,
        zIndex: 10,
        mb: 1,
      }}
      onMouseDown={(e) => e.preventDefault()}
    >
      <Tooltip title="Bold">
        <IconButton
          size="small"
          onClick={() => editor.chain().focus().toggleBold().run()}
          sx={editor.isActive('bold') ? activeBtnSx : btnSx}
        >
          <TextBIcon size={14} weight="light" />
        </IconButton>
      </Tooltip>
      <Tooltip title="Italic">
        <IconButton
          size="small"
          onClick={() => editor.chain().focus().toggleItalic().run()}
          sx={editor.isActive('italic') ? activeBtnSx : btnSx}
        >
          <TextItalicIcon size={14} weight="light" />
        </IconButton>
      </Tooltip>
      <Tooltip title="Strikethrough">
        <IconButton
          size="small"
          onClick={() => editor.chain().focus().toggleStrike().run()}
          sx={editor.isActive('strike') ? activeBtnSx : btnSx}
        >
          <TextStrikethroughIcon size={14} weight="light" />
        </IconButton>
      </Tooltip>
      <Tooltip title="Code">
        <IconButton
          size="small"
          onClick={() => editor.chain().focus().toggleCode().run()}
          sx={editor.isActive('code') ? activeBtnSx : btnSx}
        >
          <CodeIcon size={14} weight="light" />
        </IconButton>
      </Tooltip>

      <Box
        sx={{
          width: '1px',
          height: 18,
          bgcolor: alpha(theme.palette.text.primary, 0.12),
          mx: 0.25,
        }}
      />

      <Tooltip title="Heading 1">
        <IconButton
          size="small"
          onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
          sx={editor.isActive('heading', { level: 1 }) ? activeBtnSx : btnSx}
        >
          <TextHOneIcon size={14} weight="light" />
        </IconButton>
      </Tooltip>
      <Tooltip title="Heading 2">
        <IconButton
          size="small"
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          sx={editor.isActive('heading', { level: 2 }) ? activeBtnSx : btnSx}
        >
          <TextHTwoIcon size={14} weight="light" />
        </IconButton>
      </Tooltip>
      <Tooltip title="Heading 3">
        <IconButton
          size="small"
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
          sx={editor.isActive('heading', { level: 3 }) ? activeBtnSx : btnSx}
        >
          <TextHThreeIcon size={14} weight="light" />
        </IconButton>
      </Tooltip>

      <Box
        sx={{
          width: '1px',
          height: 18,
          bgcolor: alpha(theme.palette.text.primary, 0.12),
          mx: 0.25,
        }}
      />

      <Tooltip title="Bullet list">
        <IconButton
          size="small"
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          sx={editor.isActive('bulletList') ? activeBtnSx : btnSx}
        >
          <ListBulletsIcon size={14} weight="light" />
        </IconButton>
      </Tooltip>
      <Tooltip title="Ordered list">
        <IconButton
          size="small"
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          sx={editor.isActive('orderedList') ? activeBtnSx : btnSx}
        >
          <ListNumbersIcon size={14} weight="light" />
        </IconButton>
      </Tooltip>
      <Tooltip title="Blockquote">
        <IconButton
          size="small"
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          sx={editor.isActive('blockquote') ? activeBtnSx : btnSx}
        >
          <QuotesIcon size={14} weight="light" />
        </IconButton>
      </Tooltip>
    </Box>
  );
}

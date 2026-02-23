import { useCallback, useEffect, useRef, useState } from 'react';
import Markdown from 'react-markdown';

import type { DbId } from '@grabdy/common';
import { Box, CircularProgress, Typography, useTheme } from '@mui/material';
import { FileTextIcon } from '@phosphor-icons/react';
import rehypeHighlight from 'rehype-highlight';
import rehypeRaw from 'rehype-raw';
import remarkGfm from 'remark-gfm';

import { useDocPage } from '../hooks/useDocPage';
import { useUpdateDocPage } from '../hooks/useUpdateDocPage';
import { docPageMarkdownStyles } from '../styles';

import { DocPageEditor } from './DocPageEditor';
import { DocPageToolbar } from './DocPageToolbar';
import { MarkdownPre } from './MarkdownPre';

const AUTO_SAVE_DELAY_MS = 2000;

interface DocPageContentProps {
  orgId: DbId<'Org'>;
  dataSourceId: DbId<'DataSource'>;
  pageId: DbId<'DocPage'> | undefined;
  showVersions: boolean;
  onToggleVersions: () => void;
}

export function DocPageContent({
  orgId,
  dataSourceId,
  pageId,
  showVersions,
  onToggleVersions,
}: DocPageContentProps) {
  const theme = useTheme();
  const { page, loading } = useDocPage(orgId, dataSourceId, pageId);
  const { updatePage, isUpdating } = useUpdateDocPage(orgId, dataSourceId, pageId);
  const [isEditing, setIsEditing] = useState(false);
  const contentRef = useRef('');
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSavedRef = useRef('');
  const editorContainerRef = useRef<HTMLDivElement>(null);

  // Track content for auto-save
  useEffect(() => {
    if (!isEditing || !page) return;

    lastSavedRef.current = page.content;
    contentRef.current = page.content;

    const interval = setInterval(() => {
      const current = contentRef.current;
      if (current !== lastSavedRef.current) {
        lastSavedRef.current = current;

        if (saveTimerRef.current) {
          clearTimeout(saveTimerRef.current);
        }
        saveTimerRef.current = setTimeout(() => {
          updatePage({ content: current });
          saveTimerRef.current = null;
        }, AUTO_SAVE_DELAY_MS);
      }
    }, 500);

    return () => {
      clearInterval(interval);
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
      }
    };
  }, [isEditing, page, updatePage]);

  const exitEditMode = useCallback(() => {
    const current = contentRef.current;
    if (page && current !== page.content) {
      updatePage({ content: current });
    }
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
    setIsEditing(false);
  }, [page, updatePage]);

  const enterEditMode = useCallback(() => {
    setIsEditing(true);
  }, []);

  // Exit edit mode on Escape
  useEffect(() => {
    if (!isEditing) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        exitEditMode();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isEditing, exitEditMode]);

  // Exit edit mode on click outside
  useEffect(() => {
    if (!isEditing) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (
        editorContainerRef.current &&
        !editorContainerRef.current.contains(e.target instanceof Node ? e.target : null)
      ) {
        exitEditMode();
      }
    };

    // Use setTimeout to avoid the click that entered edit mode from immediately exiting
    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside);
    }, 0);

    return () => {
      clearTimeout(timer);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isEditing, exitEditMode]);

  if (!pageId) {
    return (
      <Box
        sx={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Box sx={{ textAlign: 'center' }}>
          <FileTextIcon size={40} weight="light" color={theme.palette.text.disabled} />
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            Select a page from the sidebar
          </Typography>
        </Box>
      </Box>
    );
  }

  if (loading) {
    return (
      <Box
        sx={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <CircularProgress size={28} />
      </Box>
    );
  }

  if (!page) {
    return (
      <Box
        sx={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Typography variant="body2" color="text.secondary">
          Page not found.
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
      <DocPageToolbar
        title={page.title}
        isUserEdited={page.isUserEdited}
        isSaving={isUpdating}
        isEditing={isEditing}
        onEdit={enterEditMode}
        onCloseEdit={exitEditMode}
        onSave={() => {
          const current = contentRef.current;
          if (current !== page.content) {
            updatePage({ content: current });
          }
        }}
        showVersions={showVersions}
        onToggleVersions={onToggleVersions}
      />

      <Box sx={{ flex: 1, overflow: 'auto' }}>
        {isEditing ? (
          <Box ref={editorContainerRef}>
            <DocPageEditor
              content={page.content}
              contentRef={contentRef}
              placeholder="Start writing documentation..."
            />
          </Box>
        ) : (
          <Box
            sx={{
              p: 2.5,
              ...docPageMarkdownStyles,
            }}
          >
            <Markdown
              remarkPlugins={[remarkGfm]}
              rehypePlugins={[[rehypeHighlight, { plainText: ['mermaid'] }], rehypeRaw]}
              components={{
                pre: MarkdownPre,
              }}
            >
              {page.content}
            </Markdown>
          </Box>
        )}

        {/* Meta info */}
        <Box
          sx={{
            px: 2.5,
            py: 1.5,
            borderTop: 1,
            borderColor: 'divider',
            display: 'flex',
            alignItems: 'center',
            gap: 2,
          }}
        >
          <Typography variant="caption" color="text.secondary">
            v{page.version}
          </Typography>
          {page.commitSha && (
            <Typography variant="caption" color="text.disabled">
              {page.commitSha.slice(0, 7)}
            </Typography>
          )}
        </Box>
      </Box>
    </Box>
  );
}

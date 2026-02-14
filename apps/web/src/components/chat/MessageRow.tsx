import { memo, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';

import { dbIdSchema } from '@grabdy/common';
import { alpha, Box, Typography } from '@mui/material';
import rehypeHighlight from 'rehype-highlight';
import remarkGfm from 'remark-gfm';

import { DocumentPreviewDrawer } from './DocumentPreviewDrawer';
import { SourcesRow } from './SourcesRow';
import { markdownStyles } from './styles';
import { ThinkingSteps } from './ThinkingSteps';

import { useDrawer } from '@/context/DrawerContext';

export interface Source {
  dataSourceId: string;
  dataSourceName: string;
  score: number;
  pages?: number[];
}

export interface ThinkingStep {
  toolName: string;
  label: string;
  summary?: string;
  status: 'active' | 'done';
}

export interface ChatMessage {
  id?: string;
  role: 'user' | 'assistant';
  content: string;
  sources?: Source[];
  thinkingSteps?: ThinkingStep[];
}

interface MessageRowProps {
  message: ChatMessage;
}

export const MessageRow = memo(
  function MessageRow({ message }: MessageRowProps) {
    const isUser = message.role === 'user';
    const { pushDrawer } = useDrawer();

    const handleSourceClick = useCallback(
      (source: Source, page?: number) => {
        const parsed = dbIdSchema('DataSource').safeParse(source.dataSourceId);
        if (!parsed.success) return;
        pushDrawer(
          (onClose) => <DocumentPreviewDrawer onClose={onClose} dataSourceId={parsed.data} page={page} />,
          { title: source.dataSourceName, mode: 'dialog', maxWidth: 'lg' },
        );
      },
      [pushDrawer],
    );

    return (
      <Box>
        {/* Persisted thinking steps */}
        {!isUser && message.thinkingSteps && message.thinkingSteps.length > 0 && (
          <Box sx={{ mb: 0.75 }}>
            <ThinkingSteps steps={message.thinkingSteps} />
          </Box>
        )}

        {/* Message bubble */}
        <Box
          sx={{
            display: 'flex',
            justifyContent: isUser ? 'flex-end' : 'stretch',
          }}
        >
          <Box
            sx={{
              px: 2,
              py: 1.25,
              maxWidth: '85%',
              ...(isUser
                ? {
                    bgcolor: (t) => alpha(t.palette.primary.main, 0.04),
                    color: 'text.primary',
                  }
                : {
                    borderLeft: '2px solid',
                    borderColor: 'primary.main',
                    width: '100%',
                    maxWidth: '100%',
                  }),
            }}
          >
            {isUser ? (
              <Typography
                sx={{ fontSize: '0.82rem', whiteSpace: 'pre-wrap', lineHeight: 1.6 }}
              >
                {message.content}
              </Typography>
            ) : (
              <Box sx={markdownStyles}>
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  rehypePlugins={[rehypeHighlight]}
                >
                  {message.content || '...'}
                </ReactMarkdown>
              </Box>
            )}
          </Box>
        </Box>

        {/* Sources */}
        {message.sources && message.sources.length > 0 && (
          <SourcesRow sources={message.sources} onSourceClick={handleSourceClick} />
        )}
      </Box>
    );
  },
  (prev, next) => {
    if (prev.message.id !== next.message.id) return false;
    if (prev.message.content !== next.message.content) return false;
    if (prev.message.sources !== next.message.sources) return false;
    if (prev.message.thinkingSteps !== next.message.thinkingSteps) return false;
    return true;
  }
);

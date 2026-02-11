import { memo } from 'react';
import ReactMarkdown from 'react-markdown';

import { alpha, Box, Typography } from '@mui/material';
import rehypeHighlight from 'rehype-highlight';
import remarkGfm from 'remark-gfm';

import { SourcesRow } from './SourcesRow';
import { markdownStyles } from './styles';

export interface Source {
  content: string;
  score: number;
  dataSourceName: string;
}

export interface ChatMessage {
  id?: string;
  role: 'user' | 'assistant';
  content: string;
  sources?: Source[];
}

interface MessageRowProps {
  message: ChatMessage;
}

export const MessageRow = memo(
  function MessageRow({ message }: MessageRowProps) {
    const isUser = message.role === 'user';

    return (
      <Box>
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
                    bgcolor: (t) => alpha(t.palette.primary.main, 0.08),
                    color: 'text.primary',
                    borderRadius: '12px 4px 12px 12px',
                  }
                : {
                    bgcolor: 'grey.50',
                    borderLeft: '3px solid',
                    borderColor: 'primary.main',
                    borderRadius: '0 12px 12px 0',
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
          <SourcesRow sources={message.sources} />
        )}
      </Box>
    );
  },
  (prev, next) => {
    if (prev.message.id !== next.message.id) return false;
    if (prev.message.content !== next.message.content) return false;
    if (prev.message.sources !== next.message.sources) return false;
    return true;
  }
);

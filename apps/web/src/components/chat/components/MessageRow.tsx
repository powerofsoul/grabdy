import { memo, useState } from 'react';
import ReactMarkdown from 'react-markdown';

import { alpha, Box, Collapse, Typography } from '@mui/material';
import { CaretDownIcon, CaretRightIcon } from '@phosphor-icons/react';
import rehypeHighlight from 'rehype-highlight';
import remarkGfm from 'remark-gfm';

import { parseBlocks } from '../parse-blocks';
import { SourceChips } from './source-chips';
import { markdownStyles } from '../styles';
import type { ChatMessage } from '../types';

interface MessageRowProps {
  message: ChatMessage;
}

export const MessageRow = memo(
  function MessageRow({ message }: MessageRowProps) {
    const isUser = message.role === 'user';
    const [thinkingExpanded, setThinkingExpanded] = useState(false);

    // Parse blocks from content for display (handles both streamed and persisted messages)
    const parsed = !isUser ? parseBlocks(message.content) : null;
    const displayContent = parsed ? parsed.text : message.content;

    // Merge: explicit thinkingTexts (from done callback) take priority, else use parsed
    const thinkingTexts =
      message.thinkingTexts ?? (parsed?.thinkingTexts.length ? parsed.thinkingTexts : undefined);
    const sources = message.sources ?? (parsed?.sources.length ? parsed.sources : undefined);

    const hasThinking = thinkingTexts && thinkingTexts.length > 0;
    // Show the thinking indicator during streaming (even without texts yet) or when there are texts
    const showThinkingSection = !isUser && (message.isStreaming || hasThinking);
    // During streaming: always expanded. After: collapsed by default.
    const showThinkingContent = message.isStreaming || thinkingExpanded;

    return (
      <Box>
        {/* Thinking section */}
        {showThinkingSection && (
          <Box sx={{ mb: 0.75 }}>
            <Box
              onClick={!message.isStreaming ? () => setThinkingExpanded((p) => !p) : undefined}
              sx={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 0.5,
                cursor: !message.isStreaming ? 'pointer' : undefined,
                userSelect: 'none',
              }}
            >
              <Typography
                sx={{
                  fontSize: '0.7rem',
                  fontWeight: 500,
                  color: 'text.disabled',
                }}
              >
                Thinking
              </Typography>
              {!message.isStreaming &&
                hasThinking &&
                (showThinkingContent ? (
                  <CaretDownIcon size={10} style={{ opacity: 0.4 }} />
                ) : (
                  <CaretRightIcon size={10} style={{ opacity: 0.4 }} />
                ))}
              {message.isStreaming && (
                <Box sx={{ display: 'flex', gap: '3px', ml: 0.25 }}>
                  {[0, 1, 2].map((d) => (
                    <Box
                      key={d}
                      sx={{
                        width: 3,
                        height: 3,
                        borderRadius: '50%',
                        bgcolor: 'text.disabled',
                        animation: `dotPulse 1.2s ease-in-out ${d * 0.2}s infinite`,
                      }}
                    />
                  ))}
                </Box>
              )}
            </Box>
            {hasThinking && (
              <Collapse in={showThinkingContent}>
                <Box
                  sx={{
                    mt: 0.5,
                    px: 1.5,
                    py: 0.75,
                    bgcolor: (t) => alpha(t.palette.text.primary, 0.03),
                    borderRadius: 1,
                  }}
                >
                  {thinkingTexts.map((text, i) => (
                    <Typography
                      key={i}
                      sx={{
                        fontSize: '0.75rem',
                        fontStyle: 'italic',
                        color: 'text.secondary',
                        lineHeight: 1.5,
                        '& + &': { mt: 0.5 },
                      }}
                    >
                      {text}
                    </Typography>
                  ))}
                </Box>
              </Collapse>
            )}
          </Box>
        )}

        {/* Message bubble — hidden when there's no content yet (e.g. only thinking blocks so far) */}
        {(isUser || displayContent) && (
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
                <Typography sx={{ fontSize: '0.82rem', whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>
                  {message.content}
                </Typography>
              ) : (
                <Box sx={markdownStyles}>
                  <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeHighlight]}>
                    {displayContent}
                  </ReactMarkdown>
                </Box>
              )}
            </Box>
          </Box>
        )}

        {/* Sources */}
        {!isUser && sources && sources.length > 0 && (
          <Box sx={{ mt: 0.75, pl: 2 }}>
            <SourceChips sources={sources} />
          </Box>
        )}
      </Box>
    );
  },
  (prev, next) => {
    if (prev.message.id !== next.message.id) return false;
    if (prev.message.content !== next.message.content) return false;
    if (prev.message.sources !== next.message.sources) return false;
    if (prev.message.thinkingTexts !== next.message.thinkingTexts) return false;
    if (prev.message.isStreaming !== next.message.isStreaming) return false;
    return true;
  }
);

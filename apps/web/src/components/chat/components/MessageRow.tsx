import { memo, useCallback, useMemo, useState } from 'react';
import type { Components } from 'react-markdown';
import ReactMarkdown from 'react-markdown';

import type { ChatSource } from '@grabdy/contracts';
import { alpha, Backdrop, Box, Collapse, IconButton, Typography } from '@mui/material';
import { CaretDownIcon, CaretRightIcon, CheckIcon, CopyIcon } from '@phosphor-icons/react';
import rehypeHighlight from 'rehype-highlight';
import rehypeRaw from 'rehype-raw';
import remarkGfm from 'remark-gfm';

import { markdownStyles } from '../styles';
import type { ChatMessage } from '../types';

import { InlineSourceRef } from './InlineSourceRef';
import { MessageAttachments } from './MessageAttachments';
import { ThinkingBlock } from './ThinkingBlock';

import { useAuth } from '@/context/AuthContext';
import { getChatAttachmentUrl } from '@/lib/api';

interface MessageRowProps {
  message: ChatMessage;
  accentColor?: string;
  shareToken?: string;
}

/** Regex to strip the fenced ```sources ... ``` block from display text. */
const SOURCES_BLOCK_RE = /\n*```sources\s*\n[\s\S]*?```\s*$/;
/** Regex to strip a partial/in-progress ```sources block (no closing ```). */
const SOURCES_PARTIAL_RE = /\n*```sources[\s\S]*$/;
/** Regex to strip trailing plain-text "Sources:" sections. */
const TRAILING_SOURCES_RE = /\n*(?:Sources?(?:\s+used)?:|References?:)\s*\n[\s\S]*$/i;
/** Matches inline citation markers: {{1}}, {{2}}, etc. Also handles {{ref:1}} variant. */
const CITE_MARKER_RE = /\{\{(?:ref:)?(\d+)\}\}/g;
/** Fallback: matches markdown link citations [1](#s1) or 【1】(#s1) the AI sometimes writes. */
const CITE_LINK_RE = /[[【](\d+)[\]】]\(#s\d+\)/g;
/** Fallback: matches fullwidth bracket citations 【...N...】 with any content, extracts last number. */
const CITE_FULLWIDTH_RE = /【[^】]*?(\d+)\s*】/g;
function prepareContent(text: string): string {
  let cleaned = text
    .replace(SOURCES_BLOCK_RE, '')
    .replace(SOURCES_PARTIAL_RE, '')
    .replace(TRAILING_SOURCES_RE, '')
    .trimEnd();
  // Convert {{1}} markers to HTML cite tags for rehype-raw
  cleaned = cleaned.replace(CITE_MARKER_RE, (_, ref) => `<cite data-ref="${ref}"></cite>`);
  // Fallback: convert [1](#s1) style markers too
  cleaned = cleaned.replace(CITE_LINK_RE, (_, ref) => `<cite data-ref="${ref}"></cite>`);
  // Fallback: convert 【...N...】 markers (AI sometimes puts extra content inside)
  cleaned = cleaned.replace(CITE_FULLWIDTH_RE, (_, ref) => `<cite data-ref="${ref}"></cite>`);
  return cleaned;
}

function buildSourceMap(sources: ChatSource[] | undefined): Map<number, ChatSource> {
  const map = new Map<number, ChatSource>();
  if (!sources) return map;
  sources.forEach((source, i) => {
    const ref = source.ref ?? i + 1;
    map.set(ref, source);
  });
  return map;
}

/** Matches image proxy URLs: /orgs/<orgId>/img/<imageId>. See also IMAGE_URL_RE in shared-chat.service.ts. */
const IMAGE_PROXY_RE = /\/orgs\/[^/]+\/img\/[0-9a-f-]+/;

export const MessageRow = memo(
  function MessageRow({ message, accentColor, shareToken }: MessageRowProps) {
    const isUser = message.role === 'user';
    const [thinkingExpanded, setThinkingExpanded] = useState(false);
    const [expandedImage, setExpandedImage] = useState<string | null>(null);
    const { selectedOrgId } = useAuth();

    const displayContent = useMemo(
      () => (isUser ? message.content : prepareContent(message.content)),
      [isUser, message.content]
    );

    const thinkingTexts = message.thinkingTexts;
    const sources = message.sources;

    const sourceMap = useMemo(() => buildSourceMap(sources), [sources]);

    const [copied, setCopied] = useState(false);

    const handleCopy = useCallback(() => {
      navigator.clipboard.writeText(message.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }, [message.content]);

    const hasThinking = thinkingTexts && thinkingTexts.length > 0;
    const showThinkingSection = !isUser && (message.isStreaming || hasThinking);
    const showThinkingContent = message.isStreaming || thinkingExpanded;

    const getUrl = useCallback(
      (storageKey: string) => {
        if (selectedOrgId) {
          return getChatAttachmentUrl(selectedOrgId, storageKey);
        }
        return Promise.reject(new Error('No org context'));
      },
      [selectedOrgId]
    );

    const markdownComponents = useMemo(
      (): Components => ({
        cite({ node }) {
          const ref = Number(node?.properties?.dataRef);
          if (!ref) return null;
          return (
            <InlineSourceRef refNumber={ref} source={sourceMap.get(ref)} shareToken={shareToken} />
          );
        },
        img({ src, alt }) {
          if (!src) return null;
          const imgSrc =
            shareToken && IMAGE_PROXY_RE.test(src)
              ? `${src}${src.includes('?') ? '&' : '?'}share_token=${shareToken}`
              : src;
          return (
            <Box
              component="img"
              src={imgSrc}
              alt={alt ?? ''}
              onClick={() => setExpandedImage(imgSrc)}
              sx={{
                height: 100,
                maxWidth: '100%',
                objectFit: 'contain',
                borderRadius: 1,
                cursor: 'pointer',
                display: 'block',
                my: 1,
                border: '1px solid',
                borderColor: 'divider',
                transition: 'opacity 150ms ease',
                '&:hover': { opacity: 0.85 },
              }}
            />
          );
        },
        // Hide the sources code block if it somehow renders
        code({ className, children }) {
          if (className === 'language-sources') {
            return null;
          }
          return <code className={className}>{children}</code>;
        },
      }),
      [sourceMap, shareToken]
    );

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
                    <ThinkingBlock
                      key={i}
                      text={text}
                      animate={message.isStreaming === true && i === thinkingTexts.length - 1}
                    />
                  ))}
                </Box>
              </Collapse>
            )}
          </Box>
        )}

        {/* Attachments above user message */}
        {isUser && message.attachments && message.attachments.length > 0 && (
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 0.5 }}>
            <MessageAttachments attachments={message.attachments} getUrl={getUrl} />
          </Box>
        )}

        {/* Message bubble */}
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
                position: 'relative',
                ...(isUser
                  ? {
                      bgcolor: (t) => alpha(t.palette.primary.main, 0.04),
                      color: 'text.primary',
                    }
                  : {
                      borderLeft: '2px solid',
                      borderColor: accentColor ?? 'primary.main',
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
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    rehypePlugins={[rehypeRaw, rehypeHighlight]}
                    components={markdownComponents}
                  >
                    {displayContent}
                  </ReactMarkdown>
                </Box>
              )}
              {/* Copy button - sticky top right */}
              {!isUser && !message.isStreaming && (
                <IconButton
                  size="small"
                  onClick={handleCopy}
                  sx={{
                    position: 'sticky',
                    top: 8,
                    float: 'right',
                    mt: -3.5,
                    mr: -1,
                    p: 0.5,
                    opacity: 0.4,
                    transition: 'opacity 150ms ease',
                    '&:hover': { opacity: 1 },
                  }}
                >
                  {copied ? (
                    <CheckIcon size={14} weight="bold" color="var(--mui-palette-success-main)" />
                  ) : (
                    <CopyIcon size={14} weight="light" />
                  )}
                </IconButton>
              )}
            </Box>
          </Box>
        )}

        {/* Sources list */}
        {!isUser && sources && sources.length > 0 && (
          <Box sx={{ mt: 0.75, pl: 2, display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
            {sources.map((source, i) => (
              <InlineSourceRef
                key={`${source.dataSourceId}-${source.ref ?? i}`}
                refNumber={source.ref ?? i + 1}
                source={source}
                shareToken={shareToken}
              />
            ))}
          </Box>
        )}

        {/* Response time */}
        {!isUser && !message.isStreaming && message.durationMs != null && (
          <Typography
            sx={{
              mt: 0.5,
              pl: 2,
              fontSize: '0.65rem',
              color: 'text.disabled',
            }}
          >
            {(message.durationMs / 1000).toFixed(1)}s
          </Typography>
        )}

        {/* Expanded image overlay */}
        {expandedImage && (
          <Backdrop
            open
            onClick={() => setExpandedImage(null)}
            sx={{ zIndex: (t) => t.zIndex.modal + 1, cursor: 'zoom-out' }}
          >
            <Box
              component="img"
              src={expandedImage}
              alt=""
              sx={{
                maxWidth: '90vw',
                maxHeight: '90vh',
                objectFit: 'contain',
                borderRadius: 2,
              }}
            />
          </Backdrop>
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
    if (prev.message.durationMs !== next.message.durationMs) return false;
    if (prev.message.attachments !== next.message.attachments) return false;
    if (prev.accentColor !== next.accentColor) return false;
    if (prev.shareToken !== next.shareToken) return false;
    return true;
  }
);

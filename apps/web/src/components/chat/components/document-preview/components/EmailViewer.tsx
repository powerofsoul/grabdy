import { useMemo } from 'react';

import { Box, Divider, Typography } from '@mui/material';
import DOMPurify from 'dompurify';

interface EmailParsed {
  from: string;
  to: string;
  subject: string;
  date: string;
  body: string;
  bodyHtml: string;
}

/** Decode quoted-printable encoded text. */
function decodeQuotedPrintable(text: string): string {
  return text
    .replace(/=\r?\n/g, '') // soft line breaks
    .replace(/=([0-9A-Fa-f]{2})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
}

/** Decode base64 encoded text. */
function decodeBase64(text: string): string {
  try {
    return atob(text.replace(/\s/g, ''));
  } catch {
    return text;
  }
}

/** Decode body based on content-transfer-encoding header. */
function decodeBody(body: string, encoding: string): string {
  const enc = encoding.toLowerCase().trim();
  if (enc === 'quoted-printable') return decodeQuotedPrintable(body);
  if (enc === 'base64') return decodeBase64(body);
  return body;
}

/** Decode RFC 2047 encoded-word tokens in header values (e.g. =?UTF-8?B?...?=). */
function decodeHeaderValue(value: string): string {
  return value.replace(/=\?([^?]+)\?([BbQq])\?([^?]*)\?=/g, (_, _charset, encoding, encoded) => {
    if (encoding.toUpperCase() === 'B') return decodeBase64(encoded);
    // Q encoding is like quoted-printable but _ means space
    return decodeQuotedPrintable(encoded.replace(/_/g, ' '));
  });
}

function parseHeaders(block: string): Record<string, string> {
  // Unfold continued header lines (lines starting with whitespace are continuations)
  const unfolded = block.replace(/\r?\n[ \t]+/g, ' ');
  const lines = unfolded.split(/\r?\n/);

  const headers: Record<string, string> = {};
  for (const line of lines) {
    const colonIdx = line.indexOf(':');
    if (colonIdx > 0) {
      const key = line.slice(0, colonIdx).trim().toLowerCase();
      const value = line.slice(colonIdx + 1).trim();
      headers[key] = decodeHeaderValue(value);
    }
  }
  return headers;
}

function extractMimePart(
  partRaw: string
): { headers: Record<string, string>; body: string } | null {
  // Find the blank line separating part headers from body
  const sep = partRaw.match(/\r?\n\r?\n/);
  if (!sep) return null;
  const splitIdx = sep.index ?? -1;
  if (splitIdx < 0) return null;
  const headers = parseHeaders(partRaw.slice(0, splitIdx));
  const body = partRaw.slice(splitIdx + sep[0].length);
  return { headers, body };
}

function parseEml(raw: string): EmailParsed {
  // Normalize line endings - handle \r\n and \r
  const normalized = raw.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  // Split headers from body at first blank line
  const headerEnd = normalized.indexOf('\n\n');
  const headerBlock = headerEnd > -1 ? normalized.slice(0, headerEnd) : normalized;
  const bodyRaw = headerEnd > -1 ? normalized.slice(headerEnd + 2) : '';

  const headers = parseHeaders(headerBlock);

  const contentType = headers['content-type'] ?? '';
  const encoding = headers['content-transfer-encoding'] ?? '';

  let body = '';
  let bodyHtml = '';

  // Check if multipart
  const boundaryMatch = contentType.match(/boundary="?([^";\s]+)"?/);
  if (boundaryMatch) {
    const boundary = boundaryMatch[1];
    const parts = bodyRaw.split(`--${boundary}`);

    // Try to find text/plain and text/html parts
    for (const partStr of parts) {
      const part = extractMimePart(partStr);
      if (!part) continue;
      const partType = (part.headers['content-type'] ?? '').toLowerCase();
      const partEnc = part.headers['content-transfer-encoding'] ?? '';

      // Check for nested multipart (e.g. multipart/alternative inside multipart/mixed)
      const nestedBoundary = partType.match(/boundary="?([^";\s]+)"?/);
      if (nestedBoundary) {
        const nestedParts = part.body.split(`--${nestedBoundary[1]}`);
        for (const nestedStr of nestedParts) {
          const nested = extractMimePart(nestedStr);
          if (!nested) continue;
          const nestedType = (nested.headers['content-type'] ?? '').toLowerCase();
          const nestedEnc = nested.headers['content-transfer-encoding'] ?? '';
          if (nestedType.includes('text/plain') && !body) {
            body = decodeBody(nested.body, nestedEnc).trim();
          } else if (nestedType.includes('text/html') && !bodyHtml) {
            bodyHtml = decodeBody(nested.body, nestedEnc).trim();
          }
        }
        continue;
      }

      if (partType.includes('text/plain') && !body) {
        body = decodeBody(part.body, partEnc).trim();
      } else if (partType.includes('text/html') && !bodyHtml) {
        bodyHtml = decodeBody(part.body, partEnc).trim();
      }
    }

    // Fallback: if only HTML, strip tags
    if (!body && bodyHtml) {
      body = bodyHtml
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s{2,}/g, ' ')
        .trim();
    }
  } else if (contentType.includes('text/html')) {
    // Single-part HTML email
    bodyHtml = decodeBody(bodyRaw, encoding).trim();
    body = bodyHtml
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s{2,}/g, ' ')
      .trim();
  } else {
    // Single-part text email (or no content-type)
    body = decodeBody(bodyRaw, encoding).trim();
  }

  // Strip trailing MIME boundary markers
  body = body.replace(/--[^\n]+--\s*$/, '').trim();

  return {
    from: headers['from'] ?? '',
    to: headers['to'] ?? '',
    subject: headers['subject'] ?? '(no subject)',
    date: headers['date'] ?? '',
    body,
    bodyHtml,
  };
}

interface EmailViewerProps {
  content: string;
}

export function EmailViewer({ content }: EmailViewerProps) {
  const email = useMemo(() => parseEml(content), [content]);

  return (
    <Box sx={{ flex: 1, overflow: 'auto', p: 2 }}>
      {/* Email headers */}
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, mb: 1.5 }}>
        {email.subject && (
          <Typography sx={{ fontSize: '0.95rem', fontWeight: 600, color: 'text.primary' }}>
            {email.subject}
          </Typography>
        )}
        {email.from && <HeaderRow label="From" value={email.from} />}
        {email.to && <HeaderRow label="To" value={email.to} />}
        {email.date && <HeaderRow label="Date" value={email.date} />}
      </Box>

      <Divider sx={{ mb: 1.5 }} />

      {/* Email body - prefer HTML if available for rich formatting */}
      {email.bodyHtml ? (
        <Box
          dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(email.bodyHtml) }}
          sx={{
            fontSize: '0.8rem',
            color: 'text.primary',
            lineHeight: 1.6,
            '& img': { maxWidth: '100%' },
            '& a': { color: 'primary.main' },
            '& table': { borderCollapse: 'collapse', maxWidth: '100%' },
          }}
        />
      ) : (
        <Box
          component="pre"
          sx={{
            fontSize: '0.8rem',
            fontFamily: 'inherit',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
            color: 'text.primary',
            lineHeight: 1.6,
            m: 0,
          }}
        >
          {email.body}
        </Box>
      )}
    </Box>
  );
}

function HeaderRow({ label, value }: { label: string; value: string }) {
  return (
    <Box sx={{ display: 'flex', gap: 1 }}>
      <Typography
        sx={{
          fontSize: '0.75rem',
          fontWeight: 600,
          color: 'text.disabled',
          minWidth: 40,
          flexShrink: 0,
        }}
      >
        {label}
      </Typography>
      <Typography
        sx={{
          fontSize: '0.75rem',
          color: 'text.secondary',
          wordBreak: 'break-word',
        }}
      >
        {value}
      </Typography>
    </Box>
  );
}

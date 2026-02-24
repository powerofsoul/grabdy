import { Box, CircularProgress, Typography } from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import Papa from 'papaparse';
import { read, utils } from 'xlsx';

import { DocxViewer } from './components/DocxViewer';
import { JsonViewer } from './components/JsonViewer';
import { SpreadsheetViewer } from './components/SpreadsheetViewer';
import { XlsxViewer } from './components/XlsxViewer';

interface DocumentPreviewProps {
  url: string;
  mimeType: string;
  title: string;
  page?: number;
}

type ContentResult =
  | { kind: 'text'; text: string }
  | { kind: 'csv'; rows: string[][] }
  | { kind: 'docx'; blob: Blob }
  | { kind: 'xlsx'; sheets: { name: string; rows: string[][] }[] }
  | { kind: 'none' };

async function fetchContent(url: string, mimeType: string): Promise<ContentResult> {
  // Text-based: TXT, JSON
  if (mimeType === 'text/plain' || mimeType === 'application/json') {
    const res = await fetch(url);
    if (res.ok) return { kind: 'text', text: await res.text() };
  }

  // CSV
  if (mimeType === 'text/csv') {
    const res = await fetch(url);
    if (res.ok) {
      const text = await res.text();
      const result = Papa.parse<string[]>(text, { header: false });
      return { kind: 'csv', rows: result.data };
    }
  }

  // DOCX / DOC
  if (
    mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    mimeType === 'application/msword'
  ) {
    const res = await fetch(url);
    if (res.ok) return { kind: 'docx', blob: await res.blob() };
  }

  // XLSX
  if (
    mimeType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
    mimeType === 'application/vnd.ms-excel'
  ) {
    const res = await fetch(url);
    if (res.ok) {
      const buffer = await res.arrayBuffer();
      const workbook = read(buffer, { type: 'array' });
      const sheets = workbook.SheetNames.map((name) => ({
        name,
        rows: utils.sheet_to_json<string[]>(workbook.Sheets[name], {
          header: 1,
          defval: '',
        }),
      }));
      return { kind: 'xlsx', sheets };
    }
  }

  return { kind: 'none' };
}

export function DocumentPreview({ url, mimeType, title, page }: DocumentPreviewProps) {
  const needsFetch = mimeType !== 'application/pdf' && !mimeType.startsWith('image/');

  const { data: content, isLoading } = useQuery({
    queryKey: ['documentContent', url, mimeType],
    // Fetch signed S3 URLs directly (no ts-rest contract for pre-signed S3 access)
    queryFn: () => fetchContent(url, mimeType),
    enabled: needsFetch,
  });

  if (needsFetch && isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', flex: 1, p: 4 }}>
        <CircularProgress size={28} />
      </Box>
    );
  }

  // PDF
  if (mimeType === 'application/pdf') {
    const pdfUrl = page ? `${url}#page=${page}` : url;
    return (
      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <iframe src={pdfUrl} title={title} style={{ flex: 1, border: 'none', minHeight: '75vh' }} />
      </Box>
    );
  }

  // DOCX / DOC
  if (content?.kind === 'docx') {
    return <DocxViewer blob={content.blob} />;
  }

  // CSV
  if (content?.kind === 'csv') {
    return <SpreadsheetViewer rows={content.rows} />;
  }

  // XLSX
  if (content?.kind === 'xlsx') {
    return <XlsxViewer sheets={content.sheets} />;
  }

  // JSON
  if (content?.kind === 'text' && mimeType === 'application/json') {
    return <JsonViewer content={content.text} />;
  }

  // Image
  if (mimeType.startsWith('image/')) {
    return (
      <Box sx={{ flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column' }}>
        <Box
          sx={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center', p: 2 }}
        >
          <Box
            component="img"
            src={url}
            alt={title}
            sx={{ maxWidth: '100%', maxHeight: '70vh', objectFit: 'contain' }}
          />
        </Box>
      </Box>
    );
  }

  // Plain text
  if (content?.kind === 'text') {
    return (
      <Box sx={{ flex: 1, overflow: 'auto', p: 2 }}>
        <Box
          component="pre"
          sx={{
            fontSize: '0.8rem',
            fontFamily: 'monospace',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
            color: 'text.primary',
            m: 0,
          }}
        >
          {content.text}
        </Box>
      </Box>
    );
  }

  // Fallback
  return (
    <Box sx={{ p: 3, display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Typography variant="body2" color="text.secondary">
        This file type cannot be previewed in the browser.
      </Typography>
      <Typography
        component="a"
        href={url}
        download={title}
        sx={{
          color: 'primary.main',
          textDecoration: 'none',
          '&:hover': { textDecoration: 'underline' },
        }}
      >
        Download {title}
      </Typography>
    </Box>
  );
}

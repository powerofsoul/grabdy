import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type { DbId } from '@grabdy/common';
import {
  Box,
  Chip,
  CircularProgress,
  Tab,
  Tabs,
  Typography,
} from '@mui/material';
import { DataGrid, type GridColDef } from '@mui/x-data-grid';
import { renderAsync } from 'docx-preview';
import Papa from 'papaparse';
import { read, utils } from 'xlsx';

import { JsonTreeView } from '@/components/ui/JsonTreeView';
import { useAuth } from '@/context/AuthContext';
import type { DrawerProps } from '@/context/DrawerContext';
import { api } from '@/lib/api';

const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const XLS_MIME = 'application/vnd.ms-excel';

/** Mime types that we can preview in-browser */
const PREVIEWABLE_MIMES = new Set([
  'application/pdf',
  DOCX_MIME,
  XLSX_MIME,
  XLS_MIME,
  'text/csv',
  'text/plain',
  'application/json',
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif',
]);

export function canPreview(mimeType: string): boolean {
  return PREVIEWABLE_MIMES.has(mimeType);
}

interface DocumentPreviewDrawerProps extends DrawerProps {
  dataSourceId: DbId<'DataSource'>;
  page?: number;
}

export function DocumentPreviewDrawer({ dataSourceId, page }: DocumentPreviewDrawerProps) {
  const { selectedOrgId } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<{ url: string; mimeType: string; filename: string; aiTags?: string[]; aiDescription?: string } | null>(null);
  const [textContent, setTextContent] = useState<string | null>(null);
  const [docxBlob, setDocxBlob] = useState<Blob | null>(null);
  const [csvData, setCsvData] = useState<string[][] | null>(null);
  const [xlsxSheets, setXlsxSheets] = useState<{ name: string; rows: string[][] }[] | null>(null);

  useEffect(() => {
    if (!selectedOrgId) return;
    const orgId = selectedOrgId;
    let cancelled = false;

    async function fetchPreview() {
      try {
        const res = await api.dataSources.previewUrl({
          params: { orgId, id: dataSourceId },
        });
        if (cancelled) return;
        if (res.status !== 200) {
          setError('Data source not found');
          return;
        }

        setData(res.body.data);
        const mime = res.body.data.mimeType;
        const url = res.body.data.url;

        // Text-based: TXT, JSON
        if (mime === 'text/plain' || mime === 'application/json') {
          try {
            const textRes = await fetch(url, { credentials: 'include' });
            if (!cancelled && textRes.ok) {
              const text = await textRes.text();
              if (!cancelled) setTextContent(text);
            }
          } catch { /* fall through */ }
        }

        // CSV
        if (mime === 'text/csv') {
          try {
            const textRes = await fetch(url, { credentials: 'include' });
            if (!cancelled && textRes.ok) {
              const text = await textRes.text();
              if (!cancelled) {
                const result = Papa.parse<string[]>(text, { header: false });
                setCsvData(result.data);
              }
            }
          } catch { /* fall through */ }
        }

        // DOCX
        if (mime === DOCX_MIME) {
          try {
            const blobRes = await fetch(url, { credentials: 'include' });
            if (!cancelled && blobRes.ok) {
              const blob = await blobRes.blob();
              if (!cancelled) setDocxBlob(blob);
            }
          } catch { /* fall through */ }
        }

        // XLSX
        if (mime === XLSX_MIME || mime === XLS_MIME) {
          try {
            const blobRes = await fetch(url, { credentials: 'include' });
            if (!cancelled && blobRes.ok) {
              const buffer = await blobRes.arrayBuffer();
              if (!cancelled) {
                const workbook = read(buffer, { type: 'array' });
                const sheets = workbook.SheetNames.map((name) => ({
                  name,
                  rows: utils.sheet_to_json<string[]>(workbook.Sheets[name], {
                    header: 1,
                    defval: '',
                  }),
                }));
                setXlsxSheets(sheets);
              }
            }
          } catch { /* fall through */ }
        }
      } catch {
        if (!cancelled) setError('Failed to load preview');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchPreview();
    return () => { cancelled = true; };
  }, [selectedOrgId, dataSourceId]);

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', flex: 1, p: 4 }}>
        <CircularProgress size={28} />
      </Box>
    );
  }

  if (error || !data) {
    return (
      <Box sx={{ p: 3 }}>
        <Typography color="error">{error ?? 'Unknown error'}</Typography>
      </Box>
    );
  }

  // PDF
  if (data.mimeType === 'application/pdf') {
    const pdfUrl = page ? `${data.url}#page=${page}` : data.url;
    return (
      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <iframe
          src={pdfUrl}
          title={data.filename}
          style={{ flex: 1, border: 'none', minHeight: '75vh' }}
        />
      </Box>
    );
  }

  // DOCX
  if (data.mimeType === DOCX_MIME && docxBlob) {
    return <DocxViewer blob={docxBlob} />;
  }

  // CSV
  if (data.mimeType === 'text/csv' && csvData) {
    return <SpreadsheetViewer rows={csvData} />;
  }

  // XLSX
  if ((data.mimeType === XLSX_MIME || data.mimeType === XLS_MIME) && xlsxSheets) {
    return <XlsxViewer sheets={xlsxSheets} />;
  }

  // JSON
  if (data.mimeType === 'application/json' && textContent !== null) {
    return <JsonViewer content={textContent} />;
  }

  // Image
  if (data.mimeType.startsWith('image/')) {
    return (
      <Box sx={{ flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column' }}>
        <Box sx={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center', p: 2 }}>
          <Box
            component="img"
            src={data.url}
            alt={data.filename}
            sx={{ maxWidth: '100%', maxHeight: '70vh', objectFit: 'contain' }}
          />
        </Box>
        {data.aiDescription && (
          <Box sx={{ px: 3, pb: 2 }}>
            <Typography variant="subtitle2" sx={{ mb: 0.5 }}>AI Description</Typography>
            <Typography variant="body2" color="text.secondary">{data.aiDescription}</Typography>
          </Box>
        )}
        {data.aiTags && data.aiTags.length > 0 && (
          <Box sx={{ px: 3, pb: 2 }}>
            <Typography variant="subtitle2" sx={{ mb: 0.5 }}>Tags</Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
              {data.aiTags.map((tag) => (
                <Chip key={tag} label={tag} size="small" variant="outlined" />
              ))}
            </Box>
          </Box>
        )}
        <Box sx={{ px: 3, pb: 2 }}>
          <Typography variant="caption" color="text.disabled">{data.filename}</Typography>
        </Box>
      </Box>
    );
  }

  // Plain text
  if (textContent !== null) {
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
          {textContent}
        </Box>
      </Box>
    );
  }

  // Fallback — download link
  return (
    <Box sx={{ p: 3, display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Typography variant="body2" color="text.secondary">
        This file type cannot be previewed in the browser.
      </Typography>
      <Typography
        component="a"
        href={data.url}
        download={data.filename}
        sx={{
          color: 'primary.main',
          textDecoration: 'none',
          '&:hover': { textDecoration: 'underline' },
        }}
      >
        Download {data.filename}
      </Typography>
    </Box>
  );
}

// ── DOCX Viewer ─────────────────────────────────────────────────────

function DocxViewer({ blob }: { blob: Blob }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [rendering, setRendering] = useState(true);

  const render = useCallback(async (container: HTMLDivElement, docBlob: Blob) => {
    try {
      await renderAsync(docBlob, container, undefined, {
        className: 'docx-preview',
        inWrapper: true,
        ignoreWidth: false,
        ignoreHeight: false,
        ignoreFonts: false,
        breakPages: true,
        renderHeaders: true,
        renderFooters: true,
        renderFootnotes: true,
      });
    } catch {
      // Render failed
    } finally {
      setRendering(false);
    }
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    render(el, blob);
  }, [blob, render]);

  return (
    <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {rendering && (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
          <CircularProgress size={24} />
        </Box>
      )}
      <Box
        ref={containerRef}
        sx={{
          flex: 1,
          overflow: 'auto',
          '& .docx-wrapper': {
            background: 'transparent',
            padding: '16px',
          },
          '& .docx-wrapper > section.docx': {
            boxShadow: '0 0 0 1px',
            borderColor: 'divider',
            marginBottom: '16px',
            mx: 'auto',
          },
        }}
      />
    </Box>
  );
}

// ── Spreadsheet Viewer (CSV / single sheet) ─────────────────────────

function SpreadsheetViewer({ rows }: { rows: string[][] }) {
  const { columns, gridRows } = useMemo(() => {
    if (rows.length === 0) return { columns: [] satisfies GridColDef[] as GridColDef[], gridRows: [] };

    const header = rows[0];
    const body = rows.slice(1);

    const cols: GridColDef[] = header.map((name, i) => ({
      field: `col_${i}`,
      headerName: name || `Column ${i + 1}`,
      flex: 1,
      minWidth: 100,
      sortable: true,
    }));

    const gRows = body.map((row, ri) => {
      const obj: Record<string, string | number> = { id: ri };
      row.forEach((cell, ci) => {
        obj[`col_${ci}`] = cell;
      });
      return obj;
    });

    return { columns: cols, gridRows: gRows };
  }, [rows]);

  if (rows.length === 0) {
    return (
      <Box sx={{ p: 3 }}>
        <Typography color="text.secondary">Empty file</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ flex: 1, minHeight: 0 }}>
      <DataGrid
        rows={gridRows}
        columns={columns}
        density="compact"
        disableRowSelectionOnClick
        sx={{
          border: 'none',
          fontSize: '0.8rem',
          '& .MuiDataGrid-columnHeader': {
            fontWeight: 600,
            fontSize: '0.75rem',
          },
        }}
      />
    </Box>
  );
}

// ── XLSX Viewer (multi-sheet with tabs) ─────────────────────────────

function XlsxViewer({ sheets }: { sheets: { name: string; rows: string[][] }[] }) {
  const [activeSheet, setActiveSheet] = useState(0);

  if (sheets.length === 0) {
    return (
      <Box sx={{ p: 3 }}>
        <Typography color="text.secondary">Empty workbook</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {sheets.length > 1 && (
        <Tabs
          value={activeSheet}
          onChange={(_, v: number) => setActiveSheet(v)}
          variant="scrollable"
          scrollButtons="auto"
          sx={{ borderBottom: 1, borderColor: 'divider', minHeight: 36 }}
        >
          {sheets.map((sheet, i) => (
            <Tab key={i} label={sheet.name} sx={{ textTransform: 'none', minHeight: 36, py: 0.5 }} />
          ))}
        </Tabs>
      )}
      <SpreadsheetViewer rows={sheets[activeSheet].rows} />
    </Box>
  );
}

// ── JSON Viewer ─────────────────────────────────────────────────────

function JsonViewer({ content }: { content: string }) {
  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    parsed = null;
  }

  if (parsed === null) {
    return (
      <Box sx={{ flex: 1, overflow: 'auto', p: 2 }}>
        <Box
          component="pre"
          sx={{
            fontSize: '0.78rem',
            fontFamily: 'monospace',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
            color: 'text.primary',
            m: 0,
          }}
        >
          {content}
        </Box>
      </Box>
    );
  }

  return (
    <Box sx={{ flex: 1, overflow: 'auto', p: 2 }}>
      <JsonTreeView value={parsed} />
    </Box>
  );
}

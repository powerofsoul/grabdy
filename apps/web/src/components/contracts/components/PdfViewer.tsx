import { useCallback, useEffect, useRef, useState } from 'react';

import { alpha, Box, IconButton, Tooltip, Typography, useTheme } from '@mui/material';
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  MagnifyingGlassMinusIcon,
  MagnifyingGlassPlusIcon,
} from '@phosphor-icons/react';
import { getDocument, type PDFDocumentProxy, TextLayer } from 'pdfjs-dist';

import '@/components/chat/components/pdf-page-viewer/constants';

const MIN_ZOOM = 0.5;
const MAX_ZOOM = 3.0;
const ZOOM_PRESETS = [0.5, 0.75, 1.0, 1.25, 1.5, 2.0, 2.5, 3.0] as const;

interface PdfViewerProps {
  url: string;
}

export function PdfViewer({ url }: PdfViewerProps) {
  const theme = useTheme();
  const measureRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const textLayerRef = useRef<HTMLDivElement>(null);
  const pdfDocRef = useRef<PDFDocumentProxy | null>(null);
  const renderTaskRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const baseScaleRef = useRef(1.0);

  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [zoom, setZoom] = useState(1.0);
  const [loading, setLoading] = useState(true);

  // Load PDF document
  useEffect(() => {
    let cancelled = false;

    async function loadDocument() {
      setLoading(true);
      try {
        pdfDocRef.current?.destroy();
        pdfDocRef.current = null;

        const doc = await getDocument({
          url,
          disableAutoFetch: true,
          disableStream: true,
          rangeChunkSize: 65536,
        }).promise;

        if (cancelled) {
          doc.destroy();
          return;
        }

        pdfDocRef.current = doc;
        setTotalPages(doc.numPages);
        setCurrentPage(1);
        setZoom(1.0);

        // Compute base scale from first page to fit container width
        const page = await doc.getPage(1);
        if (cancelled) return;
        const measureWidth = measureRef.current?.clientWidth ?? 600;
        const unscaledVp = page.getViewport({ scale: 1 });
        baseScaleRef.current = (measureWidth - 48) / unscaledVp.width;
      } catch (err) {
        if (!cancelled) console.error('PDF load failed:', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadDocument();

    return () => {
      cancelled = true;
    };
  }, [url]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      pdfDocRef.current?.destroy();
      pdfDocRef.current = null;
    };
  }, []);

  // Render current page
  useEffect(() => {
    if (!pdfDocRef.current || totalPages === 0) return;

    if (renderTaskRef.current) clearTimeout(renderTaskRef.current);

    let cancelled = false;
    renderTaskRef.current = setTimeout(async () => {
      const doc = pdfDocRef.current;
      if (!doc || cancelled) return;

      try {
        const page = await doc.getPage(currentPage);
        if (cancelled) return;

        const scale = baseScaleRef.current * zoom;
        const viewport = page.getViewport({ scale });

        const canvas = canvasRef.current;
        const textLayerDiv = textLayerRef.current;
        if (!canvas || !textLayerDiv) return;

        const dpr = window.devicePixelRatio || 1;
        canvas.width = viewport.width * dpr;
        canvas.height = viewport.height * dpr;
        canvas.style.width = `${viewport.width}px`;
        canvas.style.height = `${viewport.height}px`;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.scale(dpr, dpr);

        await page.render({ canvas, viewport }).promise;
        if (cancelled) return;

        textLayerDiv.innerHTML = '';
        textLayerDiv.style.width = `${viewport.width}px`;
        textLayerDiv.style.height = `${viewport.height}px`;

        const textContent = await page.getTextContent();
        if (cancelled) return;

        const textLayer = new TextLayer({
          textContentSource: textContent,
          container: textLayerDiv,
          viewport,
        });
        await textLayer.render();
      } catch (err) {
        if (!cancelled) console.error('PDF render failed:', err);
      }
    }, 30);

    return () => {
      cancelled = true;
      if (renderTaskRef.current) clearTimeout(renderTaskRef.current);
    };
  }, [currentPage, zoom, totalPages]);

  const goToPrevPage = useCallback(() => {
    setCurrentPage((p) => Math.max(1, p - 1));
  }, []);

  const goToNextPage = useCallback(() => {
    setCurrentPage((p) => Math.min(totalPages, p + 1));
  }, [totalPages]);

  const zoomIn = useCallback(() => {
    setZoom((z) => {
      const next = ZOOM_PRESETS.find((p) => p > z + 0.01);
      return next ?? Math.min(MAX_ZOOM, z + 0.15);
    });
  }, []);

  const zoomOut = useCallback(() => {
    setZoom((z) => {
      const prev = [...ZOOM_PRESETS].reverse().find((p) => p < z - 0.01);
      return prev ?? Math.max(MIN_ZOOM, z - 0.15);
    });
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        e.preventDefault();
        goToPrevPage();
      } else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        e.preventDefault();
        goToNextPage();
      } else if ((e.key === '=' || e.key === '+') && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        zoomIn();
      } else if (e.key === '-' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        zoomOut();
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [goToPrevPage, goToNextPage, zoomIn, zoomOut]);

  const zoomPercent = Math.round(zoom * 100);

  const toolbarBtnSx = {
    color: 'text.secondary',
    '&:hover': { bgcolor: alpha(theme.palette.text.primary, 0.06) },
    '&.Mui-disabled': { color: alpha(theme.palette.text.primary, 0.2) },
  };

  return (
    <Box
      sx={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        minHeight: 0,
        overflow: 'hidden',
        position: 'relative',
      }}
    >
      {/* Measure container (never scrolls, used to get stable width for base scale) */}
      <Box
        ref={measureRef}
        sx={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: 0,
          visibility: 'hidden',
          pointerEvents: 'none',
        }}
      />

      {/* Toolbar */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 0.5,
          py: 0.75,
          px: 2,
          borderBottom: '1px solid',
          borderColor: 'divider',
          bgcolor: alpha(theme.palette.text.primary, 0.02),
          flexShrink: 0,
        }}
      >
        {/* Page navigation */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <Tooltip title="Previous page">
            <span>
              <IconButton
                size="small"
                onClick={goToPrevPage}
                disabled={currentPage <= 1}
                sx={toolbarBtnSx}
              >
                <ArrowLeftIcon size={16} weight="light" />
              </IconButton>
            </span>
          </Tooltip>
          <Typography
            variant="body2"
            sx={{
              fontSize: '0.8rem',
              color: 'text.secondary',
              userSelect: 'none',
              minWidth: 60,
              textAlign: 'center',
            }}
          >
            {totalPages > 0 ? `${currentPage} / ${totalPages}` : '...'}
          </Typography>
          <Tooltip title="Next page">
            <span>
              <IconButton
                size="small"
                onClick={goToNextPage}
                disabled={currentPage >= totalPages}
                sx={toolbarBtnSx}
              >
                <ArrowRightIcon size={16} weight="light" />
              </IconButton>
            </span>
          </Tooltip>
        </Box>

        <Box sx={{ width: 1, height: 16, bgcolor: 'divider', mx: 1 }} />

        {/* Zoom controls */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <Tooltip title="Zoom out">
            <span>
              <IconButton
                size="small"
                onClick={zoomOut}
                disabled={zoom <= MIN_ZOOM}
                sx={toolbarBtnSx}
              >
                <MagnifyingGlassMinusIcon size={16} weight="light" />
              </IconButton>
            </span>
          </Tooltip>
          <Typography
            variant="body2"
            sx={{
              fontSize: '0.8rem',
              color: 'text.secondary',
              userSelect: 'none',
              minWidth: 40,
              textAlign: 'center',
            }}
          >
            {zoomPercent}%
          </Typography>
          <Tooltip title="Zoom in">
            <span>
              <IconButton
                size="small"
                onClick={zoomIn}
                disabled={zoom >= MAX_ZOOM}
                sx={toolbarBtnSx}
              >
                <MagnifyingGlassPlusIcon size={16} weight="light" />
              </IconButton>
            </span>
          </Tooltip>
        </Box>
      </Box>

      {/* Scrollable PDF canvas area */}
      <Box
        sx={{
          flex: 1,
          overflow: 'auto',
          minHeight: 0,
          bgcolor: alpha(theme.palette.text.primary, 0.04),
        }}
      >
        {loading ? (
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              height: '100%',
              p: 4,
            }}
          >
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              Loading document...
            </Typography>
          </Box>
        ) : (
          <Box sx={{ p: 3 }}>
            <Box
              sx={{
                position: 'relative',
                lineHeight: 0,
                width: 'fit-content',
                mx: 'auto',
                boxShadow: `0 1px 4px ${alpha(theme.palette.common.black, 0.12)}`,
              }}
            >
              <canvas ref={canvasRef} style={{ display: 'block' }} />
              <Box
                ref={textLayerRef}
                sx={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  opacity: 0.25,
                  lineHeight: 1,
                  '& span': {
                    position: 'absolute',
                    whiteSpace: 'pre',
                    transformOrigin: '0% 0%',
                    color: 'transparent',
                  },
                }}
              />
            </Box>
          </Box>
        )}
      </Box>
    </Box>
  );
}

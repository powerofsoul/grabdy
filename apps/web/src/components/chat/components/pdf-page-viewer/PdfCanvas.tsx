import { useEffect, useRef, useState } from 'react';

import { Box, CircularProgress } from '@mui/material';
import { getDocument, type PDFDocumentProxy, TextLayer } from 'pdfjs-dist';

import './constants';

interface PdfCanvasProps {
  url: string;
  pageNumber: number;
  onDocumentLoaded?: (numPages: number) => void;
}

export function PdfCanvas({ url, pageNumber, onDocumentLoaded }: PdfCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const textLayerRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const pdfDocRef = useRef<PDFDocumentProxy | null>(null);
  const currentUrlRef = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function renderPage() {
      setLoading(true);
      try {
        if (currentUrlRef.current !== url) {
          pdfDocRef.current?.destroy();
          pdfDocRef.current = null;
        }

        if (!pdfDocRef.current) {
          pdfDocRef.current = await getDocument(url).promise;
          currentUrlRef.current = url;
          onDocumentLoaded?.(pdfDocRef.current.numPages);
        }
        if (cancelled) return;

        const page = await pdfDocRef.current.getPage(pageNumber);
        if (cancelled) return;

        // Compute scale to fit container width
        const containerWidth = containerRef.current?.clientWidth ?? 800;
        const unscaledViewport = page.getViewport({ scale: 1 });
        const scale = Math.min(containerWidth / unscaledViewport.width, 2);
        const viewport = page.getViewport({ scale });

        const canvas = canvasRef.current;
        const textLayerDiv = textLayerRef.current;
        if (!canvas || !textLayerDiv) return;

        canvas.width = viewport.width;
        canvas.height = viewport.height;
        canvas.style.width = `${viewport.width}px`;
        canvas.style.height = `${viewport.height}px`;

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
        if (cancelled) return;
      } catch (err) {
        if (!cancelled) {
          console.error('PDF render failed:', err);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    renderPage();

    return () => {
      cancelled = true;
    };
  }, [url, pageNumber]);

  useEffect(() => {
    return () => {
      pdfDocRef.current?.destroy();
      pdfDocRef.current = null;
    };
  }, []);

  return (
    <Box
      ref={containerRef}
      sx={{ position: 'relative', display: 'flex', justifyContent: 'center', width: '100%' }}
    >
      {loading && (
        <Box
          sx={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 2,
          }}
        >
          <CircularProgress size={28} />
        </Box>
      )}
      <Box sx={{ position: 'relative' }}>
        <canvas ref={canvasRef} style={{ display: 'block', maxWidth: '100%' }} />
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
  );
}

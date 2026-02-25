import { useCallback, useState } from 'react';

import { Box, CircularProgress, IconButton, Tooltip, Typography } from '@mui/material';
import { CaretLeftIcon, CaretRightIcon } from '@phosphor-icons/react';
import { useQuery } from '@tanstack/react-query';
import { z } from 'zod';

import { DocumentPreview } from '@/components/chat/components/document-preview';
import { PdfCanvas } from '@/components/chat/components/pdf-page-viewer/PdfCanvas';
import { useEmbedAuth } from '@/components/embed-chat/hooks/useEmbedAuth';
import { baseUrl } from '@/lib/api';

const previewResponseSchema = z.object({
  data: z.object({
    url: z.string(),
    mimeType: z.string(),
    title: z.string(),
  }),
});

export function EmbedPreviewPage() {
  const { jwt } = useEmbedAuth();

  const params = new URLSearchParams(window.location.search);
  const dataSourceId = params.get('dataSourceId');
  const pageParam = params.get('page');
  const page = pageParam ? parseInt(pageParam, 10) : undefined;

  const { data, isLoading, error } = useQuery({
    queryKey: ['embedPreview', dataSourceId, jwt],
    queryFn: async () => {
      // SDK endpoints use Bearer JWT auth (not cookie-based ts-rest)
      const response = await fetch(
        `${baseUrl}/sdk/data-sources/${encodeURIComponent(dataSourceId ?? '')}/preview-url`,
        { headers: { Authorization: `Bearer ${jwt}` } }
      );

      if (!response.ok) {
        throw new Error(response.status === 404 ? 'Source not found' : 'Failed to load preview');
      }

      const json: unknown = await response.json();
      const parsed = previewResponseSchema.parse(json);
      return parsed.data;
    },
    enabled: !!jwt && !!dataSourceId,
  });

  if (!dataSourceId) {
    return (
      <Box
        sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100dvh' }}
      >
        <Typography color="error">Missing dataSourceId parameter</Typography>
      </Box>
    );
  }

  if (!jwt || isLoading) {
    return (
      <Box
        sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100dvh' }}
      >
        <CircularProgress size={28} />
      </Box>
    );
  }

  if (error || !data) {
    return (
      <Box
        sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100dvh' }}
      >
        <Typography color="text.secondary">
          {error instanceof Error ? error.message : 'Unknown error'}
        </Typography>
      </Box>
    );
  }

  if (data.mimeType === 'application/pdf' && page) {
    return <EmbedPdfPageViewer url={data.url} title={data.title} initialPage={page} />;
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100dvh' }}>
      <DocumentPreview url={data.url} mimeType={data.mimeType} title={data.title} page={page} />
    </Box>
  );
}

function EmbedPdfPageViewer({
  url,
  title,
  initialPage,
}: {
  url: string;
  title: string;
  initialPage: number;
}) {
  const [currentPage, setCurrentPage] = useState(initialPage);
  const [totalPages, setTotalPages] = useState<number | null>(null);

  const handleDocumentLoaded = useCallback((numPages: number) => {
    setTotalPages(numPages);
  }, []);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100dvh', overflow: 'hidden' }}>
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          px: 2,
          py: 1,
          borderBottom: 1,
          borderColor: 'divider',
        }}
      >
        <Typography variant="body2" noWrap sx={{ flex: 1, mr: 1 }} title={title}>
          {title}
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Tooltip title="Previous page">
            <span>
              <IconButton
                size="small"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage <= 1}
              >
                <CaretLeftIcon size={18} weight="light" />
              </IconButton>
            </span>
          </Tooltip>
          <Typography variant="body2" color="text.secondary">
            Page {currentPage}
            {totalPages ? ` of ${totalPages}` : ''}
          </Typography>
          <Tooltip title="Next page">
            <span>
              <IconButton
                size="small"
                onClick={() =>
                  setCurrentPage((p) => (totalPages ? Math.min(totalPages, p + 1) : p + 1))
                }
                disabled={totalPages !== null && currentPage >= totalPages}
              >
                <CaretRightIcon size={18} weight="light" />
              </IconButton>
            </span>
          </Tooltip>
        </Box>
      </Box>
      <Box sx={{ flex: 1, overflow: 'auto', p: 2 }}>
        <PdfCanvas url={url} pageNumber={currentPage} onDocumentLoaded={handleDocumentLoaded} />
      </Box>
    </Box>
  );
}

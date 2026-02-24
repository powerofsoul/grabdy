import { useCallback, useState } from 'react';

import type { DbId } from '@grabdy/common';
import { Box, CircularProgress, IconButton, Tooltip, Typography } from '@mui/material';
import { CaretLeftIcon, CaretRightIcon } from '@phosphor-icons/react';
import { useQuery } from '@tanstack/react-query';

import { PdfCanvas } from './PdfCanvas';

import { useAuth } from '@/context/AuthContext';
import type { DrawerProps } from '@/context/DrawerContext';
import { api } from '@/lib/api';

interface PdfPageViewerProps extends DrawerProps {
  dataSourceId: DbId<'DataSource'>;
  initialPage: number;
}

export function PdfPageViewer({ dataSourceId, initialPage }: PdfPageViewerProps) {
  const { selectedOrgId } = useAuth();
  const [currentPage, setCurrentPage] = useState(initialPage);
  const [totalPages, setTotalPages] = useState<number | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['pdf-preview-url', dataSourceId, selectedOrgId],
    queryFn: async () => {
      if (!selectedOrgId) return null;
      const res = await api.dataSources.previewUrl({
        params: { orgId: selectedOrgId, id: dataSourceId },
      });
      if (res.status === 200) {
        return res.body.data.url;
      }
      return null;
    },
    enabled: Boolean(selectedOrgId),
  });

  const handleDocumentLoaded = useCallback((numPages: number) => {
    setTotalPages(numPages);
  }, []);

  if (isLoading || !data) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', flex: 1, p: 4 }}>
        <CircularProgress size={28} />
      </Box>
    );
  }

  return (
    <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Navigation header */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 1,
          py: 1,
          borderBottom: 1,
          borderColor: 'divider',
        }}
      >
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

      {/* PDF content */}
      <Box sx={{ flex: 1, overflow: 'auto', p: 2 }}>
        <PdfCanvas url={data} pageNumber={currentPage} onDocumentLoaded={handleDocumentLoaded} />
      </Box>
    </Box>
  );
}

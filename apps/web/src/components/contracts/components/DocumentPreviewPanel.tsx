import type { DbId } from '@grabdy/common';
import { Box, CircularProgress, Typography } from '@mui/material';
import { useQuery } from '@tanstack/react-query';

import { PdfViewer } from './PdfViewer';

import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api';

interface DocumentPreviewPanelProps {
  dataSourceId: DbId<'DataSource'>;
}

export function DocumentPreviewPanel({ dataSourceId }: DocumentPreviewPanelProps) {
  const { selectedOrgId } = useAuth();

  const { data, isLoading } = useQuery({
    queryKey: ['dataSourcePreview', dataSourceId, selectedOrgId],
    queryFn: async () => {
      if (!selectedOrgId) return null;
      const res = await api.dataSources.previewUrl({
        params: { orgId: selectedOrgId, id: dataSourceId },
      });
      if (res.status !== 200) return null;
      return res.body.data;
    },
    enabled: !!selectedOrgId,
  });

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', flex: 1, p: 4 }}>
        <CircularProgress size={28} />
      </Box>
    );
  }

  if (!data) {
    return (
      <Box sx={{ p: 3 }}>
        <Typography color="text.secondary">Document preview unavailable.</Typography>
      </Box>
    );
  }

  if (data.mimeType === 'application/pdf') {
    return <PdfViewer url={data.url} />;
  }

  return (
    <Box sx={{ p: 3 }}>
      <Typography color="text.secondary">
        Document preview is only available for PDF files.
      </Typography>
    </Box>
  );
}

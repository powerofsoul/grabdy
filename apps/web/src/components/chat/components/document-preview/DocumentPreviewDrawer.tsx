import type { DbId } from '@grabdy/common';
import { Box, CircularProgress, Typography } from '@mui/material';
import { useQuery } from '@tanstack/react-query';

import { DocumentPreview } from './DocumentPreview';

import { useAuth } from '@/context/AuthContext';
import type { DrawerProps } from '@/context/DrawerContext';
import { api } from '@/lib/api';

interface DocumentPreviewDrawerProps extends DrawerProps {
  dataSourceId: DbId<'DataSource'>;
  page?: number;
}

export function DocumentPreviewDrawer({ dataSourceId, page }: DocumentPreviewDrawerProps) {
  const { selectedOrgId } = useAuth();

  const { data, isLoading, error } = useQuery({
    queryKey: ['dataSourcePreview', dataSourceId, selectedOrgId],
    queryFn: async () => {
      if (!selectedOrgId) return null;
      const res = await api.dataSources.previewUrl({
        params: { orgId: selectedOrgId, id: dataSourceId },
      });
      if (res.status !== 200) throw new Error('Data source not found');
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

  if (error || !data) {
    return (
      <Box sx={{ p: 3 }}>
        <Typography color="error">
          {error instanceof Error ? error.message : 'Unknown error'}
        </Typography>
      </Box>
    );
  }

  return <DocumentPreview url={data.url} mimeType={data.mimeType} title={data.title} page={page} />;
}

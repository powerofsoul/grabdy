import { Box, CircularProgress, Typography } from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { z } from 'zod';

import { DocumentPreview } from '@/components/chat/components/document-preview';
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

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100dvh' }}>
      <DocumentPreview url={data.url} mimeType={data.mimeType} title={data.title} page={page} />
    </Box>
  );
}

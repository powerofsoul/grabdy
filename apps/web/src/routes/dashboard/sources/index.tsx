import { useEffect, useState } from 'react';

import {
  Box,
  Card,
  CardContent,
  CircularProgress,
  Grid,
  IconButton,
  Tooltip,
  Typography,
} from '@mui/material';
import { createFileRoute } from '@tanstack/react-router';
import { Database, RefreshCw, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { EmptyState } from '@/components/ui/EmptyState';
import { FileUpload } from '@/components/ui/FileUpload';
import { PageHeader } from '@/components/ui/PageHeader';
import { StatusChip } from '@/components/ui/StatusChip';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api';

import type { DataSourceStatus } from '@fastdex/contracts';

interface DataSource {
  id: string;
  name: string;
  filename: string;
  type: string;
  status: DataSourceStatus;
  fileSize: number;
  createdAt: string;
}

export const Route = createFileRoute('/dashboard/sources/')({
  component: SourcesPage,
});

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function SourcesPage() {
  const { selectedOrgId } = useAuth();
  const [sources, setSources] = useState<DataSource[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<DataSource | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchSources = async () => {
    if (!selectedOrgId) return;
    setIsLoading(true);
    try {
      const res = await api.dataSources.list({ params: { orgId: selectedOrgId }, query: {} });
      if (res.status === 200) {
        setSources(res.body.data);
      }
    } catch {
      toast.error('Failed to load data sources');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchSources();
  }, [selectedOrgId]);

  const handleUpload = async (file: File) => {
    if (!selectedOrgId) return;
    setIsUploading(true);
    try {
      const res = await api.dataSources.upload({
        params: { orgId: selectedOrgId },
        body: { file },
      });
      if (res.status === 200) {
        toast.success('File uploaded');
        fetchSources();
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setIsUploading(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedOrgId || !deleteTarget) return;
    setIsDeleting(true);
    try {
      const res = await api.dataSources.delete({
        params: { orgId: selectedOrgId, id: deleteTarget.id as never },
        body: {},
      });
      if (res.status === 200) {
        toast.success('Data source deleted');
        fetchSources();
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Delete failed');
    } finally {
      setIsDeleting(false);
      setDeleteTarget(null);
    }
  };

  const handleReprocess = async (sourceId: string) => {
    if (!selectedOrgId) return;
    try {
      const res = await api.dataSources.reprocess({
        params: { orgId: selectedOrgId, id: sourceId as never },
        body: {},
      });
      if (res.status === 200) {
        toast.success('Reprocessing started');
        fetchSources();
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Reprocess failed');
    }
  };

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      <PageHeader title="Data Sources" />

      <Box sx={{ mb: 3 }}>
        <FileUpload onFileSelect={handleUpload} disabled={isUploading} />
      </Box>

      {sources.length === 0 ? (
        <EmptyState
          icon={<Database size={48} />}
          message="No data sources"
          description="Upload a file to index and make it searchable."
        />
      ) : (
        <Grid container spacing={2}>
          {sources.map((source) => (
            <Grid key={source.id} size={{ xs: 12, sm: 6, md: 4 }}>
              <Card>
                <CardContent sx={{ p: 2.5 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', mb: 1 }}>
                    <Typography variant="subtitle2" fontWeight={600} noWrap sx={{ flex: 1, mr: 1 }}>
                      {source.name}
                    </Typography>
                    <StatusChip status={source.status} />
                  </Box>
                  <Typography variant="caption" color="text.secondary" display="block">
                    {source.filename}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1 }}>
                    {formatFileSize(source.fileSize)} &middot; {source.type}
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 0.5 }}>
                    {source.status === 'FAILED' && (
                      <Tooltip title="Reprocess">
                        <IconButton size="small" onClick={() => handleReprocess(source.id)}>
                          <RefreshCw size={16} />
                        </IconButton>
                      </Tooltip>
                    )}
                    <Tooltip title="Delete">
                      <IconButton size="small" color="error" onClick={() => setDeleteTarget(source)}>
                        <Trash2 size={16} />
                      </IconButton>
                    </Tooltip>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete Data Source"
        message={`Are you sure you want to delete "${deleteTarget?.name}"? This will remove all indexed data.`}
        confirmLabel="Delete"
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
        isLoading={isDeleting}
      />
    </Box>
  );
}

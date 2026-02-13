import { useEffect, useState } from 'react';

import {
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Grid,
  Typography,
} from '@mui/material';
import { createFileRoute, notFound, useNavigate } from '@tanstack/react-router';
import { Database, Trash } from '@phosphor-icons/react';
import { toast } from 'sonner';

import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { DashboardPage } from '@/components/ui/DashboardPage';
import { EmptyState } from '@/components/ui/EmptyState';
import { FileUpload } from '@/components/ui/FileUpload';
import { StatusChip } from '@/components/ui/StatusChip';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api';

import type { DataSourceStatus } from '@grabdy/contracts';

interface DataSource {
  id: string;
  name: string;
  filename: string;
  type: string;
  status: DataSourceStatus;
  fileSize: number;
  createdAt: string;
}

interface Collection {
  id: string;
  name: string;
  description: string | null;
  sourceCount: number;
  chunkCount: number;
}

export const Route = createFileRoute('/dashboard/sources/$collectionId')({
  component: CollectionDetailPage,
});

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function CollectionDetailPage() {
  const { collectionId } = Route.useParams();
  const { selectedOrgId } = useAuth();
  const navigate = useNavigate();
  const [collection, setCollection] = useState<Collection | null>(null);
  const [dataSources, setDataSources] = useState<DataSource[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchData = async () => {
    if (!selectedOrgId) return;
    setIsLoading(true);
    try {
      const [collRes, sourcesRes] = await Promise.all([
        api.collections.get({
          params: { orgId: selectedOrgId, collectionId: collectionId as never },
        }),
        api.dataSources.list({
          params: { orgId: selectedOrgId },
          query: { collectionId },
        }),
      ]);

      if (collRes.status === 200) {
        setCollection(collRes.body.data);
      }
      if (sourcesRes.status === 200) {
        setDataSources(sourcesRes.body.data);
      }
    } catch {
      toast.error('Failed to load source');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [selectedOrgId, collectionId]);

  const handleUpload = async (file: File) => {
    if (!selectedOrgId) return;
    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('collectionId', collectionId);

      const res = await api.dataSources.upload({
        params: { orgId: selectedOrgId },
        body: { file: formData.get('file'), collectionId },
      });

      if (res.status === 200) {
        toast.success('File uploaded');
        fetchData();
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setIsUploading(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedOrgId) return;
    setIsDeleting(true);
    try {
      const res = await api.collections.delete({
        params: { orgId: selectedOrgId, collectionId: collectionId as never },
        body: {},
      });
      if (res.status === 200) {
        toast.success('Source deleted');
        navigate({ to: '/dashboard/sources' });
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Delete failed');
    } finally {
      setIsDeleting(false);
      setDeleteConfirm(false);
    }
  };

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (!collection) {
    throw notFound();
  }

  return (
    <DashboardPage
      showBack
      title={collection.name}
      actions={
        <Button
          variant="outlined"
          color="error"
          startIcon={<Trash size={16} weight="light" color="currentColor" />}
          onClick={() => setDeleteConfirm(true)}
        >
          Delete
        </Button>
      }
    >
      {collection.description && (
        <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
          {collection.description}
        </Typography>
      )}

      <Typography variant="h6" sx={{ mb: 2 }}>
        Data Sources
      </Typography>

      <Box sx={{ mb: 3 }}>
        <FileUpload onFileSelect={handleUpload} disabled={isUploading} />
      </Box>

      {dataSources.length === 0 ? (
        <EmptyState
          icon={<Database size={48} weight="light" color="currentColor" />}
          message="No data sources"
          description="Upload a file to get started."
        />
      ) : (
        <Grid container spacing={2}>
          {dataSources.map((source) => (
            <Grid key={source.id} size={{ xs: 12, sm: 6, md: 4 }}>
              <Card>
                <CardContent sx={{ p: 2.5 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', mb: 1 }}>
                    <Typography variant="subtitle2" noWrap sx={{ flex: 1 }}>
                      {source.name}
                    </Typography>
                    <StatusChip status={source.status} />
                  </Box>
                  <Typography variant="caption" color="text.secondary" display="block">
                    {source.filename}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {formatFileSize(source.fileSize)} &middot; {source.type}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}

      <ConfirmDialog
        open={deleteConfirm}
        title="Delete Source"
        message="Are you sure you want to delete this source? All data and indexed content will be permanently removed."
        confirmLabel="Delete"
        onConfirm={handleDelete}
        onCancel={() => setDeleteConfirm(false)}
        isLoading={isDeleting}
      />
    </DashboardPage>
  );
}

import { useState } from 'react';

import { dbIdSchema } from '@grabdy/common';
import { Box, Button, IconButton, Tooltip, Typography } from '@mui/material';
import {
  ArrowsClockwiseIcon,
  DatabaseIcon,
  DownloadSimpleIcon,
  EyeIcon,
  PencilSimpleIcon,
  TrashIcon,
} from '@phosphor-icons/react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createFileRoute, notFound, useNavigate } from '@tanstack/react-router';
import { toast } from 'sonner';

import { type RenameDataSource, RenameDrawer } from './RenameDrawer';

import { canPreview, DocumentPreviewDrawer } from '@/components/chat/components/document-preview';
import { getFileIcon } from '@/components/chat/components/source-chips/helpers';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { DashboardPage } from '@/components/ui/DashboardPage';
import { EmptyState } from '@/components/ui/EmptyState';
import { FileUpload } from '@/components/ui/FileUpload';
import { MainTable } from '@/components/ui/main-table';
import { PageLoader } from '@/components/ui/PageLoader';
import { StatusChip } from '@/components/ui/StatusChip';
import { useAuth } from '@/context/AuthContext';
import { useDrawer } from '@/context/DrawerContext';
import { api, uploadDataSource } from '@/lib/api';
import { relativeDate } from '@/lib/date';

type DataSource = RenameDataSource;

export const Route = createFileRoute('/dashboard/sources/$collectionId')({
  component: CollectionDetailPage,
});

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const headerNames = {
  name: 'Name',
  type: 'Type',
  status: 'Status',
  size: 'Size',
  uploaded: 'Uploaded',
  actions: '',
} as const;

// ── Main Page ──────────────────────────────────────────────────────

function CollectionDetailPage() {
  const { collectionId } = Route.useParams();
  const { selectedOrgId } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { pushDrawer } = useDrawer();
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [deleteCollectionConfirm, setDeleteCollectionConfirm] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<DataSource | null>(null);

  const { data: collection, isLoading: isCollectionLoading } = useQuery({
    queryKey: ['collections', collectionId, selectedOrgId],
    queryFn: async () => {
      if (!selectedOrgId) return null;
      const res = await api.collections.get({
        params: { orgId: selectedOrgId, collectionId },
      });
      if (res.status === 200) return res.body.data;
      return null;
    },
    enabled: !!selectedOrgId,
  });

  const { data: dataSources = [], isLoading: isSourcesLoading } = useQuery({
    queryKey: ['dataSources', collectionId, selectedOrgId],
    queryFn: async () => {
      if (!selectedOrgId) return [];
      const res = await api.dataSources.list({
        params: { orgId: selectedOrgId },
        query: { collectionId },
      });
      if (res.status === 200) return res.body.data;
      return [];
    },
    enabled: !!selectedOrgId,
    refetchInterval: (query) => {
      const data = query.state.data;
      if (data?.some((ds) => ds.status === 'DELETING' || ds.status === 'PROCESSING')) return 3000;
      return false;
    },
  });

  const invalidateSources = () => {
    queryClient.invalidateQueries({ queryKey: ['dataSources', collectionId] });
    queryClient.invalidateQueries({ queryKey: ['collections', collectionId] });
  };

  const deleteCollectionMutation = useMutation({
    mutationFn: async () => {
      if (!selectedOrgId) return;
      const res = await api.collections.delete({
        params: { orgId: selectedOrgId, collectionId },
        body: {},
      });
      if (res.status !== 200) throw new Error('Delete failed');
    },
    onSuccess: () => {
      toast.success('Source deleted');
      navigate({ to: '/dashboard/sources' });
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : 'Delete failed');
    },
    onSettled: () => setDeleteCollectionConfirm(false),
  });

  const deleteSourceMutation = useMutation({
    mutationFn: async (ds: DataSource) => {
      if (!selectedOrgId) return;
      const parsed = dbIdSchema('DataSource').safeParse(ds.id);
      if (!parsed.success) return;
      const res = await api.dataSources.delete({
        params: { orgId: selectedOrgId, id: parsed.data },
        body: {},
      });
      if (res.status !== 200) throw new Error('Delete failed');
    },
    onSuccess: () => {
      toast.success('File deleted');
      invalidateSources();
    },
    onError: () => toast.error('Failed to delete file'),
    onSettled: () => setDeleteTarget(null),
  });

  const reprocessMutation = useMutation({
    mutationFn: async (ds: DataSource) => {
      if (!selectedOrgId) return;
      const parsed = dbIdSchema('DataSource').safeParse(ds.id);
      if (!parsed.success) return;
      const res = await api.dataSources.reprocess({
        params: { orgId: selectedOrgId, id: parsed.data },
        body: {},
      });
      if (res.status !== 200) throw new Error('Reprocess failed');
    },
    onSuccess: () => {
      toast.success('Reprocessing started');
      invalidateSources();
    },
    onError: () => toast.error('Failed to reprocess'),
  });

  const handleUpload = async (file: File) => {
    if (!selectedOrgId) return;
    setUploadProgress(0);
    try {
      const res = await uploadDataSource(selectedOrgId, file, collectionId, setUploadProgress);

      if (res.status === 200) {
        toast.success('File uploaded');
        invalidateSources();
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploadProgress(null);
    }
  };

  const handlePreview = (ds: DataSource) => {
    const parsed = dbIdSchema('DataSource').safeParse(ds.id);
    if (!parsed.success) return;
    pushDrawer(
      (onClose) => <DocumentPreviewDrawer onClose={onClose} dataSourceId={parsed.data} />,
      { title: ds.title, mode: 'dialog', maxWidth: 'lg' }
    );
  };

  const handleDownload = async (ds: DataSource) => {
    if (!selectedOrgId) return;
    const parsed = dbIdSchema('DataSource').safeParse(ds.id);
    if (!parsed.success) return;
    try {
      const res = await api.dataSources.previewUrl({
        params: { orgId: selectedOrgId, id: parsed.data },
      });
      if (res.status === 200) {
        const link = document.createElement('a');
        link.href = res.body.data.url;
        link.download = res.body.data.title;
        link.click();
      }
    } catch {
      toast.error('Failed to download file');
    }
  };

  const handleRename = (ds: DataSource) => {
    pushDrawer(
      (onClose) => <RenameDrawer onClose={onClose} dataSource={ds} onRenamed={invalidateSources} />,
      { title: 'Rename File' }
    );
  };

  const isLoading = isCollectionLoading || isSourcesLoading;

  if (isLoading) {
    return <PageLoader />;
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
          startIcon={<TrashIcon size={16} weight="light" color="currentColor" />}
          onClick={() => setDeleteCollectionConfirm(true)}
        >
          Delete Collection
        </Button>
      }
    >
      {collection.description && (
        <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
          {collection.description}
        </Typography>
      )}

      <Box sx={{ mb: 3 }}>
        <FileUpload
          onFileSelect={handleUpload}
          disabled={uploadProgress !== null}
          uploadProgress={uploadProgress}
        />
      </Box>

      {dataSources.length === 0 ? (
        <EmptyState
          icon={<DatabaseIcon size={48} weight="light" color="currentColor" />}
          message="No files"
          description="Upload a file to get started."
        />
      ) : (
        <MainTable<DataSource, typeof headerNames>
          data={dataSources}
          headerNames={headerNames}
          columnWidths={{
            name: '1fr',
            type: 70,
            status: 100,
            size: 90,
            uploaded: 130,
            actions: 130,
          }}
          noWrap={['name', 'uploaded', 'size']}
          keyExtractor={(ds) => ds.id}
          rowTitle={(ds) => ds.title}
          sorting={{
            sortableColumns: ['name', 'uploaded', 'size'] as const,
            defaultSort: 'uploaded',
            defaultDirection: 'desc',
            getSortValue: (item, col) => {
              switch (col) {
                case 'name':
                  return item.title.toLowerCase();
                case 'uploaded':
                  return new Date(item.createdAt).getTime();
                case 'size':
                  return item.fileSize;
                default:
                  return '';
              }
            },
          }}
          renderItems={{
            name: (ds) => {
              const Icon = getFileIcon(ds.title);
              return (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0 }}>
                  <Icon size={18} weight="light" style={{ flexShrink: 0 }} />
                  <Box sx={{ minWidth: 0, maxWidth: 300 }}>
                    <Typography variant="body2" noWrap sx={{ fontWeight: 500 }}>
                      {ds.title}
                    </Typography>
                  </Box>
                </Box>
              );
            },
            type: (ds) => (
              <Typography variant="caption" color="text.secondary">
                {ds.type}
              </Typography>
            ),
            status: (ds) => (
              <StatusChip status={ds.status} progress={ds.processingProgress ?? undefined} />
            ),
            size: (ds) => formatFileSize(ds.fileSize),
            uploaded: (ds) => relativeDate(ds.createdAt),
            actions: (ds) => (
              <Box sx={{ display: 'flex', gap: 0.25, justifyContent: 'flex-end' }}>
                {canPreview(ds.mimeType) ? (
                  <Tooltip title="Preview">
                    <IconButton
                      size="small"
                      onClick={(e) => {
                        e.stopPropagation();
                        handlePreview(ds);
                      }}
                    >
                      <EyeIcon size={16} weight="light" />
                    </IconButton>
                  </Tooltip>
                ) : (
                  <Tooltip title="Download">
                    <IconButton
                      size="small"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDownload(ds);
                      }}
                    >
                      <DownloadSimpleIcon size={16} weight="light" />
                    </IconButton>
                  </Tooltip>
                )}
                <Tooltip title="Rename">
                  <IconButton
                    size="small"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRename(ds);
                    }}
                  >
                    <PencilSimpleIcon size={16} weight="light" />
                  </IconButton>
                </Tooltip>
                <Tooltip title="Reprocess">
                  <IconButton
                    size="small"
                    onClick={(e) => {
                      e.stopPropagation();
                      reprocessMutation.mutate(ds);
                    }}
                    disabled={ds.status !== 'FAILED'}
                  >
                    <ArrowsClockwiseIcon size={16} weight="light" />
                  </IconButton>
                </Tooltip>
                <Tooltip title="Delete">
                  <IconButton
                    size="small"
                    onClick={(e) => {
                      e.stopPropagation();
                      setDeleteTarget(ds);
                    }}
                    sx={{ color: 'error.main' }}
                    disabled={ds.status !== 'READY' && ds.status !== 'FAILED'}
                  >
                    <TrashIcon size={16} weight="light" />
                  </IconButton>
                </Tooltip>
              </Box>
            ),
          }}
        />
      )}

      <ConfirmDialog
        open={deleteCollectionConfirm}
        title="Delete Collection"
        message="Are you sure you want to delete this collection? All files and indexed content will be permanently removed."
        confirmLabel="Delete"
        onConfirm={() => deleteCollectionMutation.mutate()}
        onCancel={() => setDeleteCollectionConfirm(false)}
        isLoading={deleteCollectionMutation.isPending}
      />

      <ConfirmDialog
        open={deleteTarget !== null}
        title="Delete File"
        message={`Are you sure you want to delete "${deleteTarget?.title}"? This will remove the file and all its indexed content.`}
        confirmLabel="Delete"
        onConfirm={() => {
          if (deleteTarget) deleteSourceMutation.mutate(deleteTarget);
        }}
        onCancel={() => setDeleteTarget(null)}
        isLoading={deleteSourceMutation.isPending}
      />
    </DashboardPage>
  );
}

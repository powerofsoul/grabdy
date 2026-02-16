import type { ComponentType } from 'react';
import { useCallback, useEffect, useState } from 'react';

import { dbIdSchema } from '@grabdy/common';
import type { DataSourceStatus, UploadsExt } from '@grabdy/contracts';
import {
  Box,
  Button,
  CircularProgress,
  IconButton,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import type { IconProps } from '@phosphor-icons/react';
import {
  ArrowsClockwiseIcon,
  DatabaseIcon,
  DownloadSimpleIcon,
  EyeIcon,
  FileCsvIcon,
  FileDocIcon,
  FileImageIcon,
  FilePdfIcon,
  FileTextIcon,
  FileXlsIcon,
  PencilSimpleIcon,
  TrashIcon,
} from '@phosphor-icons/react';
import { createFileRoute, notFound, useNavigate } from '@tanstack/react-router';
import { formatDistanceToNow } from 'date-fns';
import { toast } from 'sonner';

import { canPreview, DocumentPreviewDrawer } from '@/components/chat/components/DocumentPreviewDrawer';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { DashboardPage } from '@/components/ui/DashboardPage';
import { EmptyState } from '@/components/ui/EmptyState';
import { FileUpload } from '@/components/ui/FileUpload';
import { MainTable } from '@/components/ui/main-table';
import { StatusChip } from '@/components/ui/StatusChip';
import { useAuth } from '@/context/AuthContext';
import { type DrawerProps, useDrawer } from '@/context/DrawerContext';
import { api } from '@/lib/api';

interface DataSource {
  id: string;
  title: string;
  type: string;
  mimeType: string;
  status: DataSourceStatus;
  fileSize: number;
  pageCount: number | null;
  summary: string | null;
  createdAt: string;
  updatedAt: string;
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

function relativeDate(iso: string): string {
  return formatDistanceToNow(new Date(iso), { addSuffix: true });
}

const ICON_BY_EXT: Record<UploadsExt, ComponentType<IconProps>> = {
  pdf: FilePdfIcon,
  csv: FileCsvIcon,
  docx: FileDocIcon,
  doc: FileDocIcon,
  xlsx: FileXlsIcon,
  xls: FileXlsIcon,
  txt: FileTextIcon,
  json: FileTextIcon,
  png: FileImageIcon,
  jpg: FileImageIcon,
  webp: FileImageIcon,
  gif: FileImageIcon,
};

function isFileExt(ext: string): ext is UploadsExt {
  return ext in ICON_BY_EXT;
}

function getFileIcon(filename: string): ComponentType<IconProps> {
  const ext = filename.split('.').pop()?.toLowerCase() ?? '';
  return isFileExt(ext) ? ICON_BY_EXT[ext] : FileTextIcon;
}

const headerNames = {
  name: 'Name',
  type: 'Type',
  status: 'Status',
  size: 'Size',
  uploaded: 'Uploaded',
  actions: '',
} as const;

// ── Rename Drawer ──────────────────────────────────────────────────

interface RenameDrawerProps extends DrawerProps {
  dataSource: DataSource;
  onRenamed: () => void;
}

function RenameDrawer({ onClose, dataSource, onRenamed }: RenameDrawerProps) {
  const { selectedOrgId } = useAuth();
  const [title, setTitle] = useState(dataSource.title);
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    if (!selectedOrgId || !title.trim()) return;
    setIsSaving(true);
    try {
      const parsed = dbIdSchema('DataSource').safeParse(dataSource.id);
      if (!parsed.success) return;
      const res = await api.dataSources.rename({
        params: { orgId: selectedOrgId, id: parsed.data },
        body: { title: title.trim() },
      });
      if (res.status === 200) {
        toast.success('File renamed');
        onRenamed();
        onClose();
      }
    } catch {
      toast.error('Failed to rename');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Box sx={{ p: 3, display: 'flex', flexDirection: 'column', gap: 2 }}>
      <TextField
        label="Title"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        fullWidth
        autoFocus
        size="small"
        onKeyDown={(e) => {
          if (e.key === 'Enter') handleSave();
        }}
      />
      <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
        <Button variant="outlined" onClick={onClose} disabled={isSaving}>
          Cancel
        </Button>
        <Button
          variant="contained"
          onClick={handleSave}
          disabled={isSaving || !title.trim() || title.trim() === dataSource.title}
        >
          {isSaving ? 'Saving...' : 'Save'}
        </Button>
      </Box>
    </Box>
  );
}

// ── Main Page ──────────────────────────────────────────────────────

function CollectionDetailPage() {
  const { collectionId } = Route.useParams();
  const { selectedOrgId } = useAuth();
  const navigate = useNavigate();
  const { pushDrawer } = useDrawer();
  const [collection, setCollection] = useState<Collection | null>(null);
  const [dataSources, setDataSources] = useState<DataSource[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [deleteCollectionConfirm, setDeleteCollectionConfirm] = useState(false);
  const [isDeletingCollection, setIsDeletingCollection] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<DataSource | null>(null);
  const [isDeletingSource, setIsDeletingSource] = useState(false);

  const fetchData = useCallback(async () => {
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
  }, [selectedOrgId, collectionId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

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

  const handleDeleteCollection = async () => {
    if (!selectedOrgId) return;
    setIsDeletingCollection(true);
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
      setIsDeletingCollection(false);
      setDeleteCollectionConfirm(false);
    }
  };

  const handleDeleteSource = async () => {
    if (!selectedOrgId || !deleteTarget) return;
    setIsDeletingSource(true);
    try {
      const parsed = dbIdSchema('DataSource').safeParse(deleteTarget.id);
      if (!parsed.success) return;
      const res = await api.dataSources.delete({
        params: { orgId: selectedOrgId, id: parsed.data },
        body: {},
      });
      if (res.status === 200) {
        toast.success('File deleted');
        fetchData();
      }
    } catch {
      toast.error('Failed to delete file');
    } finally {
      setIsDeletingSource(false);
      setDeleteTarget(null);
    }
  };

  const handleReprocess = async (ds: DataSource) => {
    if (!selectedOrgId) return;
    try {
      const parsed = dbIdSchema('DataSource').safeParse(ds.id);
      if (!parsed.success) return;
      const res = await api.dataSources.reprocess({
        params: { orgId: selectedOrgId, id: parsed.data },
        body: {},
      });
      if (res.status === 200) {
        toast.success('Reprocessing started');
        fetchData();
      }
    } catch {
      toast.error('Failed to reprocess');
    }
  };

  const handlePreview = (ds: DataSource) => {
    const parsed = dbIdSchema('DataSource').safeParse(ds.id);
    if (!parsed.success) return;
    pushDrawer(
      (onClose) => <DocumentPreviewDrawer onClose={onClose} dataSourceId={parsed.data} />,
      { title: ds.title, mode: 'dialog', maxWidth: 'lg' },
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
      (onClose) => <RenameDrawer onClose={onClose} dataSource={ds} onRenamed={fetchData} />,
      { title: 'Rename File' },
    );
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
        <FileUpload onFileSelect={handleUpload} disabled={isUploading} />
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
                case 'name': return item.title.toLowerCase();
                case 'uploaded': return new Date(item.createdAt).getTime();
                case 'size': return item.fileSize;
                default: return '';
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
            status: (ds) => <StatusChip status={ds.status} />,
            size: (ds) => formatFileSize(ds.fileSize),
            uploaded: (ds) => relativeDate(ds.createdAt),
            actions: (ds) => (
              <Box sx={{ display: 'flex', gap: 0.25, justifyContent: 'flex-end' }}>
                {canPreview(ds.mimeType) ? (
                  <Tooltip title="Preview">
                    <IconButton
                      size="small"
                      onClick={(e) => { e.stopPropagation(); handlePreview(ds); }}
                    >
                      <EyeIcon size={16} weight="light" />
                    </IconButton>
                  </Tooltip>
                ) : (
                  <Tooltip title="Download">
                    <IconButton
                      size="small"
                      onClick={(e) => { e.stopPropagation(); handleDownload(ds); }}
                    >
                      <DownloadSimpleIcon size={16} weight="light" />
                    </IconButton>
                  </Tooltip>
                )}
                <Tooltip title="Rename">
                  <IconButton
                    size="small"
                    onClick={(e) => { e.stopPropagation(); handleRename(ds); }}
                  >
                    <PencilSimpleIcon size={16} weight="light" />
                  </IconButton>
                </Tooltip>
                <Tooltip title="Reprocess">
                  <IconButton
                    size="small"
                    onClick={(e) => { e.stopPropagation(); handleReprocess(ds); }}
                    disabled={ds.status === 'PROCESSING'}
                  >
                    <ArrowsClockwiseIcon size={16} weight="light" />
                  </IconButton>
                </Tooltip>
                <Tooltip title="Delete">
                  <IconButton
                    size="small"
                    onClick={(e) => { e.stopPropagation(); setDeleteTarget(ds); }}
                    sx={{ color: 'error.main' }}
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
        onConfirm={handleDeleteCollection}
        onCancel={() => setDeleteCollectionConfirm(false)}
        isLoading={isDeletingCollection}
      />

      <ConfirmDialog
        open={deleteTarget !== null}
        title="Delete File"
        message={`Are you sure you want to delete "${deleteTarget?.title}"? This will remove the file and all its indexed content.`}
        confirmLabel="Delete"
        onConfirm={handleDeleteSource}
        onCancel={() => setDeleteTarget(null)}
        isLoading={isDeletingSource}
      />
    </DashboardPage>
  );
}

import { useState } from 'react';

import { dbIdSchema } from '@grabdy/common';
import type { DataSourceStatus } from '@grabdy/contracts';
import { Box, IconButton, Tooltip, Typography } from '@mui/material';
import {
  ArrowsOutSimpleIcon,
  DatabaseIcon,
  DownloadSimpleIcon,
  EyeIcon,
  FileTextIcon,
  PencilSimpleIcon,
  TrashIcon,
} from '@phosphor-icons/react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { toast } from 'sonner';

import { FolderCard } from '../FolderCard';
import { MoveToDrawer } from '../move-to-drawer';
import { RenameFolderDrawer } from '../RenameFolderDrawer';
import { UploadProgressList } from '../UploadProgressList';

import { headerNames } from './constants';
import { formatFileSize } from './helpers';

import { canPreview, DocumentPreviewDrawer } from '@/components/chat/components/document-preview';
import { getFileIcon } from '@/components/chat/components/source-chips/helpers';
import type { FileUploadEntry } from '@/components/sources/hooks';
import { RenameDrawer } from '@/components/sources/RenameDrawer';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { EmptyState } from '@/components/ui/EmptyState';
import { FileUpload } from '@/components/ui/FileUpload';
import { MainTable } from '@/components/ui/main-table';
import { StatusChip } from '@/components/ui/StatusChip';
import { useAuth } from '@/context/AuthContext';
import { useDrawer } from '@/context/DrawerContext';
import { api } from '@/lib/api';
import { relativeDate } from '@/lib/date';

interface DataSource {
  id: string;
  title: string;
  type: string;
  mimeType: string;
  status: DataSourceStatus;
  fileSize: number;
  pageCount: number | null;
  processingProgress: number | null;
  contractId: string | null;
  createdAt: string;
  updatedAt: string;
}

interface FolderItem {
  id: string;
  name: string;
  sourceCount: number;
  childCount: number;
}

interface FileListingPanelProps {
  collectionId: string | null;
  folders: FolderItem[];
  dataSources: DataSource[];
  uploads: FileUploadEntry[];
  startUpload: (files: File[]) => void;
  dismissUploads: () => void;
  isUploading: boolean;
}

export function FileListingPanel({
  collectionId,
  folders,
  dataSources,
  uploads,
  startUpload,
  dismissUploads,
  isUploading,
}: FileListingPanelProps) {
  const { selectedOrgId } = useAuth();
  const queryClient = useQueryClient();
  const { pushDrawer } = useDrawer();
  const navigate = useNavigate();
  const [deleteTarget, setDeleteTarget] = useState<DataSource | null>(null);

  const invalidateSources = () => {
    queryClient.invalidateQueries({ queryKey: ['dataSources'] });
    queryClient.invalidateQueries({ queryKey: ['collections'] });
  };

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

  const handleUpload = (file: File) => {
    startUpload([file]);
  };

  const handleFilesUpload = (files: File[]) => {
    startUpload(files);
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
    pushDrawer((onClose) => <RenameDrawer onClose={onClose} dataSource={ds} />, {
      title: 'Rename File',
    });
  };

  const handleMove = (ds: DataSource) => {
    const parsed = dbIdSchema('DataSource').safeParse(ds.id);
    if (!parsed.success) return;
    pushDrawer(
      (onClose) => (
        <MoveToDrawer
          onClose={onClose}
          dataSourceId={parsed.data}
          currentCollectionId={collectionId}
        />
      ),
      { title: 'Move File' }
    );
  };

  return (
    <>
      {folders.length > 0 && (
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
            gap: 1.5,
            mb: 3,
          }}
        >
          {folders.map((folder) => (
            <FolderCard
              key={folder.id}
              id={folder.id}
              name={folder.name}
              sourceCount={folder.sourceCount}
              childCount={folder.childCount}
              onRename={(folderId, folderName) => {
                pushDrawer(
                  (onClose) => (
                    <RenameFolderDrawer
                      onClose={onClose}
                      collectionId={folderId}
                      currentName={folderName}
                    />
                  ),
                  { title: 'Rename Folder' }
                );
              }}
            />
          ))}
        </Box>
      )}

      <Box sx={{ mb: 3 }}>
        <FileUpload
          onFileSelect={handleUpload}
          onFilesSelect={handleFilesUpload}
          multiple
          disabled={isUploading}
        />
      </Box>

      <UploadProgressList uploads={uploads} onDismiss={dismissUploads} />

      {dataSources.length === 0 && folders.length === 0 ? (
        <EmptyState
          icon={<DatabaseIcon size={48} weight="light" color="currentColor" />}
          message="No files"
          description="Upload a file or create a folder to get started."
        />
      ) : dataSources.length > 0 ? (
        <MainTable<DataSource, typeof headerNames>
          data={dataSources}
          headerNames={headerNames}
          columnWidths={{
            name: '1fr',
            type: 70,
            status: 100,
            size: 90,
            uploaded: 130,
            actions: 192,
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
                  <Typography variant="body2" noWrap sx={{ fontWeight: 500 }}>
                    {ds.title}
                  </Typography>
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
                {ds.contractId !== null && (
                  <Tooltip title="View contract">
                    <IconButton
                      size="small"
                      onClick={(e) => {
                        e.stopPropagation();
                        const cId = ds.contractId;
                        if (cId)
                          navigate({
                            to: '/dashboard/contracts/$contractId',
                            params: { contractId: cId },
                          });
                      }}
                    >
                      <FileTextIcon size={16} weight="light" />
                    </IconButton>
                  </Tooltip>
                )}
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
                <Tooltip title="Move to">
                  <IconButton
                    size="small"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleMove(ds);
                    }}
                  >
                    <ArrowsOutSimpleIcon size={16} weight="light" />
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
      ) : null}

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
    </>
  );
}

import { useMemo, useState } from 'react';

import { dbIdSchema } from '@grabdy/common';
import { Box, Button, Typography } from '@mui/material';
import { FolderPlusIcon, PencilSimpleIcon, TrashIcon } from '@phosphor-icons/react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createFileRoute, notFound, useNavigate } from '@tanstack/react-router';
import { toast } from 'sonner';

import {
  CreateFolderDrawer,
  FileListingPanel,
  FolderBreadcrumb,
  RenameFolderDrawer,
  SourcesTreePanel,
} from '@/components/sources/components';
import { useBulkUpload, useFolderContents } from '@/components/sources/hooks';
import { useCollection } from '@/components/sources/hooks/useCollections';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { DashboardPage } from '@/components/ui/DashboardPage';
import { PageLoader } from '@/components/ui/PageLoader';
import { useAuth } from '@/context/AuthContext';
import { useDrawer } from '@/context/DrawerContext';
import { api } from '@/lib/api';

export const Route = createFileRoute('/dashboard/sources/$collectionId')({
  component: CollectionDetailPage,
});

function CollectionDetailPage() {
  const { collectionId } = Route.useParams();
  const { selectedOrgId } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { pushDrawer } = useDrawer();
  const { uploads, startUpload, dismissUploads, isUploading } = useBulkUpload(
    selectedOrgId,
    collectionId
  );
  const [deleteCollectionConfirm, setDeleteCollectionConfirm] = useState(false);

  const { collection, isLoading: isCollectionLoading } = useCollection(collectionId);

  const parsedCollectionId = useMemo(() => {
    const result = dbIdSchema('Collection').safeParse(collectionId);
    return result.success ? result.data : null;
  }, [collectionId]);

  const {
    folders,
    sources: dataSources,
    isLoading: isContentsLoading,
  } = useFolderContents(parsedCollectionId);

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
      toast.success('Folder deleted');
      queryClient.invalidateQueries({ queryKey: ['dataSources'] });
      queryClient.invalidateQueries({ queryKey: ['collections'] });
      const parentId = collection?.parentId;
      if (parentId) {
        navigate({
          to: '/dashboard/sources/$collectionId',
          params: { collectionId: parentId },
        });
      } else {
        navigate({ to: '/dashboard/sources' });
      }
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : 'Delete failed');
    },
    onSettled: () => setDeleteCollectionConfirm(false),
  });

  const handleRenameFolder = () => {
    if (!collection) return;
    pushDrawer(
      (onClose) => (
        <RenameFolderDrawer
          onClose={onClose}
          collectionId={collectionId}
          currentName={collection.name}
        />
      ),
      { title: 'Rename Folder' }
    );
  };

  const handleCreateFolder = () => {
    pushDrawer((onClose) => <CreateFolderDrawer onClose={onClose} parentId={collectionId} />, {
      title: 'New Folder',
    });
  };

  const isLoading = isCollectionLoading || isContentsLoading;

  if (!isLoading && !collection) {
    throw notFound();
  }

  return (
    <DashboardPage
      showBack
      noPadding
      maxWidth={false}
      title={collection?.name ?? ''}
      subtitle={<FolderBreadcrumb collectionId={collectionId} />}
      actions={
        collection ? (
          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
            <Button
              variant="outlined"
              size="small"
              startIcon={<PencilSimpleIcon size={16} weight="light" color="currentColor" />}
              onClick={handleRenameFolder}
            >
              Rename
            </Button>
            <Button
              variant="outlined"
              size="small"
              startIcon={<FolderPlusIcon size={16} weight="light" color="currentColor" />}
              onClick={handleCreateFolder}
            >
              New Folder
            </Button>
            <Button
              variant="outlined"
              size="small"
              color="error"
              startIcon={<TrashIcon size={16} weight="light" color="currentColor" />}
              onClick={() => setDeleteCollectionConfirm(true)}
            >
              Delete
            </Button>
          </Box>
        ) : undefined
      }
    >
      <Box sx={{ display: 'flex', flex: 1, minHeight: 0 }}>
        <SourcesTreePanel />
        <Box
          sx={{
            flex: 1,
            overflow: 'auto',
            px: { xs: 2, md: 2.5 },
            pb: { xs: 2, md: 2.5 },
            pt: { xs: 1, md: 1.5 },
          }}
        >
          {isLoading ? (
            <PageLoader />
          ) : (
            <>
              {collection?.description && (
                <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
                  {collection.description}
                </Typography>
              )}

              <FileListingPanel
                collectionId={collectionId}
                folders={folders}
                dataSources={dataSources}
                uploads={uploads}
                startUpload={startUpload}
                dismissUploads={dismissUploads}
                isUploading={isUploading}
              />
            </>
          )}
        </Box>
      </Box>

      {collection && (
        <ConfirmDialog
          open={deleteCollectionConfirm}
          title="Delete Folder"
          message="This will permanently delete this folder, all subfolders, and all files inside them. This action cannot be undone."
          confirmLabel="Delete"
          confirmText={collection.name}
          onConfirm={() => deleteCollectionMutation.mutate()}
          onCancel={() => setDeleteCollectionConfirm(false)}
          isLoading={deleteCollectionMutation.isPending}
        />
      )}
    </DashboardPage>
  );
}

import { Box, Button } from '@mui/material';
import { FolderPlusIcon } from '@phosphor-icons/react';
import { createFileRoute } from '@tanstack/react-router';

import {
  CreateFolderDrawer,
  FileListingPanel,
  SourcesTreePanel,
} from '@/components/sources/components';
import { useBulkUpload, useFolderContents } from '@/components/sources/hooks';
import { DashboardPage } from '@/components/ui/DashboardPage';
import { PageLoader } from '@/components/ui/PageLoader';
import { useAuth } from '@/context/AuthContext';
import { useDrawer } from '@/context/DrawerContext';

export const Route = createFileRoute('/dashboard/sources/')({
  component: SourcesIndexPage,
});

function SourcesIndexPage() {
  const { pushDrawer } = useDrawer();
  const { selectedOrgId } = useAuth();
  const { folders, sources: dataSources, isLoading } = useFolderContents(null);
  const { uploads, startUpload, dismissUploads, isUploading } = useBulkUpload(selectedOrgId, '');

  const handleCreateFolder = () => {
    pushDrawer((onClose) => <CreateFolderDrawer onClose={onClose} />, { title: 'New Folder' });
  };

  return (
    <DashboardPage
      title="Sources"
      noPadding
      maxWidth={false}
      actions={
        <Button
          variant="outlined"
          size="small"
          startIcon={<FolderPlusIcon size={16} weight="light" color="currentColor" />}
          onClick={handleCreateFolder}
        >
          New Folder
        </Button>
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
            <FileListingPanel
              collectionId={null}
              folders={folders}
              dataSources={dataSources}
              uploads={uploads}
              startUpload={startUpload}
              dismissUploads={dismissUploads}
              isUploading={isUploading}
            />
          )}
        </Box>
      </Box>
    </DashboardPage>
  );
}

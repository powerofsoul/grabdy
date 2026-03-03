import { Box, Button } from '@mui/material';
import { FolderOpenIcon, PlusIcon } from '@phosphor-icons/react';
import { createFileRoute } from '@tanstack/react-router';

import { CreateFolderDrawer, FolderCard, RenameFolderDrawer, SourcesTreePanel } from './components';
import { useFolderContents } from './hooks';

import { DashboardPage } from '@/components/ui/DashboardPage';
import { EmptyState } from '@/components/ui/EmptyState';
import { PageLoader } from '@/components/ui/PageLoader';
import { useDrawer } from '@/context/DrawerContext';

export const Route = createFileRoute('/dashboard/sources/')({
  component: SourcesIndexPage,
});

function SourcesIndexPage() {
  const { pushDrawer } = useDrawer();
  const { folders, isLoading } = useFolderContents(null);

  const handleCreateFolder = () => {
    pushDrawer((onClose) => <CreateFolderDrawer onClose={onClose} />, { title: 'New Folder' });
  };

  if (isLoading) {
    return <PageLoader />;
  }

  return (
    <DashboardPage
      title="Files"
      noPadding
      maxWidth={false}
      actions={
        <Button
          variant="contained"
          startIcon={<PlusIcon size={18} weight="light" color="currentColor" />}
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
          {folders.length === 0 ? (
            <EmptyState
              icon={<FolderOpenIcon size={48} weight="light" color="currentColor" />}
              message="No folders yet"
              description="Create a folder to organize your files."
              actionLabel="Create Folder"
              onAction={handleCreateFolder}
            />
          ) : (
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
                gap: 1.5,
              }}
            >
              {folders.map((folder) => (
                <FolderCard
                  key={folder.id}
                  id={folder.id}
                  name={folder.name}
                  sourceCount={folder.sourceCount}
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
        </Box>
      </Box>
    </DashboardPage>
  );
}

import { useEffect, useState } from 'react';

import {
  alpha,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  TextField,
  Typography,
  useTheme,
} from '@mui/material';
import { FolderOpenIcon, PlusIcon } from '@phosphor-icons/react';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { toast } from 'sonner';

import { DashboardPage } from '@/components/ui/DashboardPage';
import { EmptyState } from '@/components/ui/EmptyState';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api';
import { FONT_MONO } from '@/theme';

interface Collection {
  id: string;
  name: string;
  description: string | null;
  sourceCount: number;
  chunkCount: number;
  createdAt: string;
}

export const Route = createFileRoute('/dashboard/sources/')({
  component: CollectionsPage,
});

function CollectionsPage() {
  const { selectedOrgId } = useAuth();
  const navigate = useNavigate();
  const theme = useTheme();
  const ct = theme.palette.text.primary;
  const [collections, setCollections] = useState<Collection[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  const fetchCollections = async () => {
    if (!selectedOrgId) return;
    setIsLoading(true);
    try {
      const res = await api.collections.list({ params: { orgId: selectedOrgId } });
      if (res.status === 200) {
        setCollections(res.body.data);
      }
    } catch {
      toast.error('Failed to load sources');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchCollections();
  }, [selectedOrgId]);

  const handleCreate = async () => {
    if (!selectedOrgId || !name.trim()) return;
    setIsCreating(true);
    try {
      const res = await api.collections.create({
        params: { orgId: selectedOrgId },
        body: { name: name.trim(), description: description.trim() || undefined },
      });
      if (res.status === 200) {
        toast.success('Source created');
        setDialogOpen(false);
        setName('');
        setDescription('');
        fetchCollections();
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create source');
    } finally {
      setIsCreating(false);
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
    <DashboardPage
      title="Sources"
      actions={
        <Button
          variant="contained"
          startIcon={<PlusIcon size={18} weight="light" color="currentColor" />}
          onClick={() => setDialogOpen(true)}
        >
          New Source
        </Button>
      }
    >

      {collections.length === 0 ? (
        <EmptyState
          icon={<FolderOpenIcon size={48} weight="light" color="currentColor" />}
          message="No sources yet"
          description="Create a source to organize your data."
          actionLabel="Create Source"
          onAction={() => setDialogOpen(true)}
        />
      ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column' }}>
          {collections.map((collection, index) => (
            <Box
              key={collection.id}
              onClick={() =>
                navigate({
                  to: '/dashboard/sources/$collectionId',
                  params: { collectionId: collection.id },
                })
              }
              sx={{
                display: 'flex',
                alignItems: 'baseline',
                gap: 2,
                py: 1.5,
                px: 1,
                borderBottom: '1px solid',
                borderColor: 'divider',
                cursor: 'pointer',
                transition: 'background-color 0.12s',
                '&:hover': { bgcolor: alpha(ct, 0.02) },
              }}
            >
              {/* Number */}
              <Typography
                sx={{
                  fontFamily: FONT_MONO,
                  fontSize: '0.85rem',
                  color: 'text.secondary',
                  minWidth: 28,
                  textAlign: 'right',
                }}
              >
                {String(index + 1).padStart(2, '0')}.
              </Typography>

              {/* Name */}
              <Typography
                sx={{
                  fontWeight: 500,
                  fontSize: '0.9rem',
                  flex: 1,
                }}
              >
                {collection.name}
              </Typography>

              {/* Dotted leader + counts */}
              <Box
                sx={{
                  flex: 1,
                  borderBottom: `1px dotted ${alpha(ct, 0.15)}`,
                  mb: '0.3em',
                  minWidth: 40,
                }}
              />
              <Typography
                sx={{
                  fontFamily: FONT_MONO,
                  fontSize: '0.8rem',
                  color: 'text.secondary',
                  whiteSpace: 'nowrap',
                }}
              >
                {collection.sourceCount} sources &middot; {collection.chunkCount} chunks
              </Typography>
            </Box>
          ))}
        </Box>
      )}

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Create Source</DialogTitle>
        <DialogContent>
          <TextField
            label="Name"
            fullWidth
            value={name}
            onChange={(e) => setName(e.target.value)}
            sx={{ mt: 1, mb: 2 }}
            required
          />
          <TextField
            label="Description"
            fullWidth
            multiline
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleCreate}
            disabled={isCreating || !name.trim()}
          >
            {isCreating ? 'Creating...' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>
    </DashboardPage>
  );
}

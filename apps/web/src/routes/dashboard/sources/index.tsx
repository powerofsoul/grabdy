import { useEffect, useState } from 'react';

import {
  Box,
  Button,
  Card,
  CardActionArea,
  CardContent,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Grid,
  TextField,
  Typography,
} from '@mui/material';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { FolderOpen, Plus } from 'lucide-react';
import { toast } from 'sonner';

import { DashboardPage } from '@/components/ui/DashboardPage';
import { EmptyState } from '@/components/ui/EmptyState';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api';

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
          startIcon={<Plus size={18} />}
          onClick={() => setDialogOpen(true)}
        >
          New Source
        </Button>
      }
    >

      {collections.length === 0 ? (
        <EmptyState
          icon={<FolderOpen size={48} />}
          message="No sources yet"
          description="Create a source to organize your data."
          actionLabel="Create Source"
          onAction={() => setDialogOpen(true)}
        />
      ) : (
        <Grid container spacing={2}>
          {collections.map((collection) => (
            <Grid key={collection.id} size={{ xs: 12, sm: 6, md: 4 }}>
              <Card>
                <CardActionArea
                  onClick={() =>
                    navigate({
                      to: '/dashboard/sources/$collectionId',
                      params: { collectionId: collection.id },
                    })
                  }
                >
                  <CardContent sx={{ p: 3 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                      <FolderOpen size={20} />
                      <Typography variant="h6" fontWeight={600}>
                        {collection.name}
                      </Typography>
                    </Box>
                    {collection.description && (
                      <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                        {collection.description}
                      </Typography>
                    )}
                    <Typography variant="caption" color="text.secondary">
                      {collection.sourceCount} sources &middot; {collection.chunkCount} chunks
                    </Typography>
                  </CardContent>
                </CardActionArea>
              </Card>
            </Grid>
          ))}
        </Grid>
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

import { useEffect, useState } from 'react';

import {
  Box,
  Button,
  TextField,
  Typography,
} from '@mui/material';
import { createFileRoute } from '@tanstack/react-router';
import { toast } from 'sonner';

import { DashboardPage } from '@/components/ui/DashboardPage';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api';

export const Route = createFileRoute('/dashboard/settings')({
  component: SettingsPage,
});

function SettingsPage() {
  const { selectedOrgId } = useAuth();
  const [orgName, setOrgName] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!selectedOrgId) return;

    const fetchData = async () => {
      setIsLoading(true);
      try {
        const orgRes = await api.orgs.get({ params: { orgId: selectedOrgId } });
        if (orgRes.status === 200) {
          setOrgName(orgRes.body.data.name);
        }
      } catch {
        toast.error('Failed to load settings');
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, [selectedOrgId]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOrgId || !orgName.trim()) return;

    setIsSaving(true);
    try {
      const res = await api.orgs.update({
        params: { orgId: selectedOrgId },
        body: { name: orgName.trim() },
      });
      if (res.status === 200) {
        toast.success('Organization updated');
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update organization');
    } finally {
      setIsSaving(false);
    }
  };

  if (!selectedOrgId || isLoading) return null;

  return (
    <DashboardPage title="Settings" maxWidth={700}>
      <Box
        component="form"
        onSubmit={handleSave}
        sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}
      >
        <Typography variant="subtitle1" fontWeight={600}>
          Organization
        </Typography>
        <TextField
          label="Organization Name"
          value={orgName}
          onChange={(e) => setOrgName(e.target.value)}
          required
          fullWidth
        />
        <Box>
          <Button type="submit" variant="contained" disabled={isSaving}>
            {isSaving ? 'Saving...' : 'Save Changes'}
          </Button>
        </Box>
      </Box>
    </DashboardPage>
  );
}

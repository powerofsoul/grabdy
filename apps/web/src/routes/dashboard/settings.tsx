import { useEffect, useState } from 'react';

import {
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  IconButton,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import { createFileRoute } from '@tanstack/react-router';
import { Trash2, UserPlus } from 'lucide-react';
import { toast } from 'sonner';

import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { PageHeader } from '@/components/ui/PageHeader';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api';

interface Member {
  id: string;
  userId: string;
  roles: string[];
  email?: string;
  name?: string;
  createdAt: string;
}

export const Route = createFileRoute('/dashboard/settings')({
  component: SettingsPage,
});

function SettingsPage() {
  const { selectedOrgId, user, logout } = useAuth();
  const [orgName, setOrgName] = useState('');
  const [members, setMembers] = useState<Member[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [removeMember, setRemoveMember] = useState<Member | null>(null);
  const [isRemoving, setIsRemoving] = useState(false);

  useEffect(() => {
    if (!selectedOrgId) return;

    const fetchData = async () => {
      setIsLoading(true);
      try {
        const [orgRes, membersRes] = await Promise.all([
          api.orgs.get({ params: { orgId: selectedOrgId } }),
          api.orgs.listMembers({ params: { orgId: selectedOrgId } }),
        ]);

        if (orgRes.status === 200) {
          setOrgName(orgRes.body.data.name);
        }
        if (membersRes.status === 200) {
          setMembers(membersRes.body.data);
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

  const handleRemoveMember = async () => {
    if (!selectedOrgId || !removeMember) return;
    setIsRemoving(true);
    try {
      const res = await api.orgs.removeMember({
        params: { orgId: selectedOrgId, memberId: removeMember.id as never },
        body: {},
      });
      if (res.status === 200) {
        toast.success('Member removed');
        setMembers((prev) => prev.filter((m) => m.id !== removeMember.id));
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to remove member');
    } finally {
      setIsRemoving(false);
      setRemoveMember(null);
    }
  };

  if (!selectedOrgId) return null;

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3, maxWidth: 700 }}>
      <PageHeader title="Settings" />

      <Box
        component="form"
        onSubmit={handleSave}
        sx={{ display: 'flex', flexDirection: 'column', gap: 3, mb: 6 }}
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

      <Box sx={{ mb: 6 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="subtitle1" fontWeight={600}>
            Members
          </Typography>
          <Button startIcon={<UserPlus size={16} />} size="small" variant="outlined">
            Invite
          </Button>
        </Box>

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          {members.map((member) => (
            <Card key={member.id}>
              <CardContent
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  p: 2,
                  '&:last-child': { pb: 2 },
                }}
              >
                <Box>
                  <Typography variant="subtitle2" fontWeight={600}>
                    {member.name || 'Unknown'}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {member.email || 'No email'} &middot; {member.roles.join(', ')}
                  </Typography>
                </Box>
                <Tooltip title="Remove member">
                  <IconButton size="small" color="error" onClick={() => setRemoveMember(member)}>
                    <Trash2 size={16} />
                  </IconButton>
                </Tooltip>
              </CardContent>
            </Card>
          ))}
        </Box>
      </Box>

      <Box>
        <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 2 }}>
          Account
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
          Signed in as {user?.email}
        </Typography>
        <Button variant="outlined" color="error" onClick={logout}>
          Sign Out
        </Button>
      </Box>

      <ConfirmDialog
        open={!!removeMember}
        title="Remove Member"
        message={`Are you sure you want to remove ${removeMember?.name || removeMember?.email}?`}
        confirmLabel="Remove"
        onConfirm={handleRemoveMember}
        onCancel={() => setRemoveMember(null)}
        isLoading={isRemoving}
      />
    </Box>
  );
}

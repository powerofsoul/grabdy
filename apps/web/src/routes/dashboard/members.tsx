import { useEffect, useState } from 'react';

import {
  Box,
  Button,
  Chip,
  CircularProgress,
  Typography,
} from '@mui/material';
import { createFileRoute } from '@tanstack/react-router';
import { Plus, Users } from 'lucide-react';
import { toast } from 'sonner';

import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { DashboardPage } from '@/components/ui/DashboardPage';
import { EmptyState } from '@/components/ui/EmptyState';
import { MainTable } from '@/components/ui/main-table';
import { useAuth } from '@/context/AuthContext';
import { useDrawer } from '@/context/DrawerContext';
import { api } from '@/lib/api';

import { InviteMemberDrawer } from '@/components/drawers/InviteMemberDrawer';

interface Member {
  id: string;
  userId: string;
  orgId: string;
  roles: string[];
  email?: string;
  name?: string;
  createdAt: string;
}

interface PendingInvitation {
  id: string;
  email: string;
  name: string;
  roles: string[];
  expiresAt: string | null;
  createdAt: string;
}

export const Route = createFileRoute('/dashboard/members')({
  component: MembersPage,
});

function MembersPage() {
  const { selectedOrgId, user } = useAuth();
  const { pushDrawer } = useDrawer();
  const [members, setMembers] = useState<Member[]>([]);
  const [invitations, setInvitations] = useState<PendingInvitation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [removeTarget, setRemoveTarget] = useState<Member | null>(null);
  const [isRemoving, setIsRemoving] = useState(false);
  const [revokeTarget, setRevokeTarget] = useState<PendingInvitation | null>(null);
  const [isRevoking, setIsRevoking] = useState(false);

  const fetchData = async () => {
    if (!selectedOrgId) return;
    setIsLoading(true);
    try {
      const [membersRes, invitationsRes] = await Promise.all([
        api.orgs.listMembers({ params: { orgId: selectedOrgId } }),
        api.orgs.listPendingInvitations({ params: { orgId: selectedOrgId } }),
      ]);
      if (membersRes.status === 200) {
        setMembers(membersRes.body.data);
      }
      if (invitationsRes.status === 200) {
        setInvitations(invitationsRes.body.data);
      }
    } catch {
      toast.error('Failed to load members');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [selectedOrgId]);

  const handleRemoveMember = async () => {
    if (!selectedOrgId || !removeTarget) return;
    setIsRemoving(true);
    try {
      const res = await api.orgs.removeMember({
        params: { orgId: selectedOrgId, memberId: removeTarget.id as never },
        body: {},
      });
      if (res.status === 200) {
        toast.success('Member removed');
        fetchData();
      } else if (res.status === 400) {
        toast.error(res.body.error);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to remove member');
    } finally {
      setIsRemoving(false);
      setRemoveTarget(null);
    }
  };

  const handleRevokeInvitation = async () => {
    if (!selectedOrgId || !revokeTarget) return;
    setIsRevoking(true);
    try {
      const res = await api.orgs.revokeInvitation({
        params: { orgId: selectedOrgId, invitationId: revokeTarget.id },
        body: {},
      });
      if (res.status === 200) {
        toast.success('Invitation revoked');
        fetchData();
      } else if (res.status === 400) {
        toast.error(res.body.error);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to revoke invitation');
    } finally {
      setIsRevoking(false);
      setRevokeTarget(null);
    }
  };

  const openInviteDrawer = () => {
    pushDrawer(InviteMemberDrawer, {
      title: 'Invite Member',
      onInvited: fetchData,
    });
  };

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  const isCurrentUser = (member: Member) => member.userId === user?.id;

  return (
    <DashboardPage
      title="Members"
      actions={
        <Button variant="contained" startIcon={<Plus size={18} />} onClick={openInviteDrawer}>
          Invite Member
        </Button>
      }
    >

      <MainTable
        data={members}
        headerNames={{
          name: 'Name',
          email: 'Email',
          role: 'Role',
          joined: 'Joined',
          actions: '',
        }}
        columnWidths={{ actions: 80 }}
        rowTitle={(m) => m.name ?? 'Unknown'}
        keyExtractor={(m) => m.id}
        renderItems={{
          name: (m) => (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography variant="body2" fontWeight={500}>
                {m.name ?? 'Unknown'}
              </Typography>
              {isCurrentUser(m) && (
                <Chip label="You" size="small" sx={{ height: 20, fontSize: '0.7rem' }} />
              )}
            </Box>
          ),
          email: (m) => (
            <Typography variant="body2" color="text.secondary">
              {m.email ?? '-'}
            </Typography>
          ),
          role: (m) => (
            <Box sx={{ display: 'flex', gap: 0.5 }}>
              {m.roles.map((role) => (
                <Chip
                  key={role}
                  label={role}
                  size="small"
                  color={role === 'OWNER' ? 'primary' : 'default'}
                  sx={{ height: 22, fontSize: '0.72rem' }}
                />
              ))}
            </Box>
          ),
          joined: (m) => (
            <Typography variant="body2" color="text.secondary">
              {new Date(m.createdAt).toLocaleDateString()}
            </Typography>
          ),
          actions: (m) =>
            !isCurrentUser(m) ? (
              <Typography
                component="span"
                onClick={(e) => {
                  e.stopPropagation();
                  setRemoveTarget(m);
                }}
                sx={{
                  fontSize: '0.82rem',
                  color: 'error.main',
                  cursor: 'pointer',
                  '&:hover': { textDecoration: 'underline' },
                }}
              >
                Remove
              </Typography>
            ) : null,
        }}
        emptyState={
          <EmptyState
            icon={<Users size={48} />}
            message="No members"
            description="Invite team members to collaborate."
            actionLabel="Invite Member"
            onAction={openInviteDrawer}
          />
        }
      />

      {invitations.length > 0 && (
        <Box sx={{ mt: 4 }}>
          <Typography variant="h6" sx={{ fontWeight: 600, mb: 2 }}>
            Pending Invitations
          </Typography>
          <MainTable
            data={invitations}
            headerNames={{
              name: 'Name',
              email: 'Email',
              role: 'Role',
              expires: 'Expires',
              actions: '',
            }}
            columnWidths={{ actions: 80 }}
            rowTitle={(inv) => inv.name}
            keyExtractor={(inv) => inv.id}
            renderItems={{
              name: (inv) => inv.name,
              email: (inv) => (
                <Typography variant="body2" color="text.secondary">
                  {inv.email}
                </Typography>
              ),
              role: (inv) => (
                <Box sx={{ display: 'flex', gap: 0.5 }}>
                  {inv.roles.map((role) => (
                    <Chip
                      key={role}
                      label={role}
                      size="small"
                      sx={{ height: 22, fontSize: '0.72rem' }}
                    />
                  ))}
                </Box>
              ),
              expires: (inv) => (
                <Typography variant="body2" color="text.secondary">
                  {inv.expiresAt ? new Date(inv.expiresAt).toLocaleDateString() : '-'}
                </Typography>
              ),
              actions: (inv) => (
                <Typography
                  component="span"
                  onClick={(e) => {
                    e.stopPropagation();
                    setRevokeTarget(inv);
                  }}
                  sx={{
                    fontSize: '0.82rem',
                    color: 'error.main',
                    cursor: 'pointer',
                    '&:hover': { textDecoration: 'underline' },
                  }}
                >
                  Revoke
                </Typography>
              ),
            }}
          />
        </Box>
      )}

      <ConfirmDialog
        open={!!removeTarget}
        title="Remove Member"
        message={`Are you sure you want to remove ${removeTarget?.name ?? removeTarget?.email ?? 'this member'} from the organization?`}
        confirmLabel="Remove"
        onConfirm={handleRemoveMember}
        onCancel={() => setRemoveTarget(null)}
        isLoading={isRemoving}
      />

      <ConfirmDialog
        open={!!revokeTarget}
        title="Revoke Invitation"
        message={`Are you sure you want to revoke the invitation for ${revokeTarget?.email ?? 'this person'}?`}
        confirmLabel="Revoke"
        onConfirm={handleRevokeInvitation}
        onCancel={() => setRevokeTarget(null)}
        isLoading={isRevoking}
      />
    </DashboardPage>
  );
}

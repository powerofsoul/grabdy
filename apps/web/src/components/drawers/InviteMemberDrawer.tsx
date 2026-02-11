import { useState } from 'react';

import {
  Box,
  Button,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  TextField,
} from '@mui/material';
import { toast } from 'sonner';

import { DrawerProps } from '@/context/DrawerContext';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api';

interface InviteMemberDrawerProps extends DrawerProps {
  onInvited: () => void;
}

export function InviteMemberDrawer({ onClose, onInvited }: InviteMemberDrawerProps) {
  const { selectedOrgId } = useAuth();
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState<'OWNER' | 'ADMIN' | 'MEMBER'>('MEMBER');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOrgId || !email.trim() || !name.trim()) return;

    setIsSubmitting(true);
    try {
      const res = await api.orgs.invite({
        params: { orgId: selectedOrgId },
        body: {
          email: email.trim(),
          name: name.trim(),
          roles: [role],
        },
      });

      if (res.status === 200) {
        toast.success('Invitation sent');
        onInvited();
        onClose();
      } else if (res.status === 400) {
        toast.error(res.body.error);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to send invitation');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Box component="form" onSubmit={handleSubmit} sx={{ p: 3, display: 'flex', flexDirection: 'column', gap: 2.5 }}>
      <TextField
        label="Name"
        fullWidth
        required
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="John Doe"
      />
      <TextField
        label="Email"
        type="email"
        fullWidth
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="john@example.com"
      />
      <FormControl fullWidth>
        <InputLabel>Role</InputLabel>
        <Select
          value={role}
          label="Role"
          onChange={(e) => setRole(e.target.value as 'OWNER' | 'ADMIN' | 'MEMBER')}
        >
          <MenuItem value="MEMBER">Member</MenuItem>
          <MenuItem value="ADMIN">Admin</MenuItem>
          <MenuItem value="OWNER">Owner</MenuItem>
        </Select>
      </FormControl>
      <Button
        type="submit"
        variant="contained"
        disabled={isSubmitting || !email.trim() || !name.trim()}
        sx={{ mt: 1 }}
      >
        {isSubmitting ? 'Sending...' : 'Send Invitation'}
      </Button>
    </Box>
  );
}

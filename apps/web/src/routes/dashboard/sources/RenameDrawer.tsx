import { useState } from 'react';

import { dbIdSchema } from '@grabdy/common';
import type { DataSourceStatus } from '@grabdy/contracts';
import { Box, Button, TextField } from '@mui/material';
import { toast } from 'sonner';

import { useAuth } from '@/context/AuthContext';
import type { DrawerProps } from '@/context/DrawerContext';
import { api } from '@/lib/api';

export interface RenameDataSource {
  id: string;
  title: string;
  type: string;
  mimeType: string;
  status: DataSourceStatus;
  fileSize: number;
  pageCount: number | null;
  processingProgress: number | null;
  createdAt: string;
  updatedAt: string;
}

interface RenameDrawerProps extends DrawerProps {
  dataSource: RenameDataSource;
  onRenamed: () => void;
}

export function RenameDrawer({ onClose, dataSource, onRenamed }: RenameDrawerProps) {
  const { selectedOrgId } = useAuth();
  const [title, setTitle] = useState(dataSource.title);
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    if (!selectedOrgId || !title.trim()) return;
    setIsSaving(true);
    try {
      const parsed = dbIdSchema('DataSource').safeParse(dataSource.id);
      if (!parsed.success) return;
      const res = await api.dataSources.rename({
        params: { orgId: selectedOrgId, id: parsed.data },
        body: { title: title.trim() },
      });
      if (res.status === 200) {
        toast.success('File renamed');
        onRenamed();
        onClose();
      }
    } catch {
      toast.error('Failed to rename');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Box sx={{ p: 3, display: 'flex', flexDirection: 'column', gap: 2 }}>
      <TextField
        label="Title"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        fullWidth
        autoFocus
        size="small"
        onKeyDown={(e) => {
          if (e.key === 'Enter') handleSave();
        }}
      />
      <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
        <Button variant="outlined" onClick={onClose} disabled={isSaving}>
          Cancel
        </Button>
        <Button
          variant="contained"
          onClick={handleSave}
          disabled={isSaving || !title.trim() || title.trim() === dataSource.title}
        >
          {isSaving ? 'Saving...' : 'Save'}
        </Button>
      </Box>
    </Box>
  );
}

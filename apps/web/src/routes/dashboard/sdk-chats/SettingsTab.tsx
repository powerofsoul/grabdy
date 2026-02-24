import { useState } from 'react';
import { useForm } from 'react-hook-form';

import type { SdkChatSourceConfig } from '@grabdy/contracts';
import { sdkChatsContract } from '@grabdy/contracts';
import { zodResolver } from '@hookform/resolvers/zod';
import { Box, Button, TextField, Typography } from '@mui/material';
import { toast } from 'sonner';
import { z } from 'zod';

import type { SdkChatDetail } from './types';

import { DataSourcePicker } from '@/components/data-source-picker';
import { CopyButton } from '@/components/ui/CopyButton';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api';
import { FONT_MONO } from '@/theme';

const settingsSchema = sdkChatsContract.update.body.required().pick({
  name: true,
  systemPrompt: true,
});

type SettingsForm = z.infer<typeof settingsSchema>;

export function SettingsTab({ chat, onUpdated }: { chat: SdkChatDetail; onUpdated: () => void }) {
  const { selectedOrgId } = useAuth();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setError,
  } = useForm<SettingsForm>({
    resolver: zodResolver(settingsSchema),
    mode: 'onBlur',
    defaultValues: {
      name: chat.name,
      systemPrompt: chat.systemPrompt ?? '',
    },
  });

  // dataSourceConfig is a complex array managed outside react-hook-form
  const [dataSourceConfig, setDataSourceConfig] = useState<SdkChatSourceConfig>(
    chat.dataSourceConfig
  );

  const onSubmit = async (data: SettingsForm) => {
    if (!selectedOrgId) return;
    try {
      const res = await api.sdkChats.update({
        params: { orgId: selectedOrgId, sdkChatId: chat.id },
        body: {
          name: data.name.trim(),
          systemPrompt: data.systemPrompt?.trim() || null,
          dataSourceConfig,
        },
      });
      if (res.status === 200) {
        toast.success('Settings saved');
        onUpdated();
      }
    } catch (err) {
      setError('root', { message: err instanceof Error ? err.message : 'Failed to save settings' });
    }
  };

  return (
    <Box
      component="form"
      onSubmit={handleSubmit(onSubmit)}
      sx={{ display: 'flex', flexDirection: 'column', gap: 3, maxWidth: 600 }}
    >
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          p: 1.5,
          bgcolor: 'action.hover',
          borderRadius: 1,
          border: '1px solid',
          borderColor: 'divider',
        }}
      >
        <Typography variant="body2" color="text.secondary">
          Chat ID:
        </Typography>
        <Typography variant="body2" sx={{ fontFamily: FONT_MONO, fontWeight: 500 }}>
          {chat.id}
        </Typography>
        <CopyButton text={chat.id} />
      </Box>

      <TextField
        label="Name"
        fullWidth
        {...register('name')}
        error={!!errors.name}
        helperText={errors.name?.message}
      />
      <TextField
        label="System Prompt"
        fullWidth
        multiline
        minRows={3}
        {...register('systemPrompt')}
        placeholder="Optional instructions for the AI assistant"
      />

      <Typography variant="subtitle2" sx={{ mt: 1 }}>
        Data Sources
      </Typography>
      <Typography variant="body2" color="text.secondary">
        Select which collections and data sources this chat can search.
      </Typography>
      {selectedOrgId && (
        <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
          <DataSourcePicker
            value={dataSourceConfig}
            onChange={setDataSourceConfig}
            orgId={selectedOrgId}
          />
        </Box>
      )}

      {errors.root && (
        <Typography color="error" variant="body2">
          {errors.root.message}
        </Typography>
      )}

      <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
        <Button type="submit" variant="contained" disabled={isSubmitting}>
          {isSubmitting ? 'Saving...' : 'Save'}
        </Button>
      </Box>
    </Box>
  );
}

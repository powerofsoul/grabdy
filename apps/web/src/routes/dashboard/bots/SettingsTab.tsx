import { useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';

import type { BotSourceConfig } from '@grabdy/contracts';
import { botsContract } from '@grabdy/contracts';
import { zodResolver } from '@hookform/resolvers/zod';
import { Avatar, Box, Button, IconButton, Stack, TextField, Typography } from '@mui/material';
import { TrashIcon, UploadSimpleIcon } from '@phosphor-icons/react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { z } from 'zod';

import { COLOR_PICKER_FALLBACK } from './constants';
import type { BotAppearance, BotDetail } from './types';

import { DataSourcePicker } from '@/components/data-source-picker';
import { CopyButton } from '@/components/ui/CopyButton';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api';
import { FONT_MONO } from '@/theme';

const settingsSchema = botsContract.update.body.required().pick({
  name: true,
  systemPrompt: true,
  title: true,
  subtitle: true,
  placeholder: true,
  accentColor: true,
  primaryColor: true,
});

type SettingsForm = z.infer<typeof settingsSchema>;

export function SettingsTab({
  bot,
  queryKey,
  onAppearanceChange,
}: {
  bot: BotDetail;
  queryKey: ReadonlyArray<unknown>;
  onAppearanceChange?: (appearance: BotAppearance) => void;
}) {
  const { selectedOrgId } = useAuth();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setError,
    watch,
    setValue,
  } = useForm<SettingsForm>({
    resolver: zodResolver(settingsSchema),
    mode: 'onBlur',
    defaultValues: {
      name: bot.name,
      systemPrompt: bot.systemPrompt ?? '',
      title: bot.title ?? '',
      subtitle: bot.subtitle ?? '',
      placeholder: bot.placeholder ?? '',
      accentColor: bot.accentColor ?? '',
      primaryColor: bot.primaryColor ?? '',
    },
  });

  // Live preview: notify parent of appearance changes
  const watchedTitle = watch('title');
  const watchedSubtitle = watch('subtitle');
  const watchedPlaceholder = watch('placeholder');
  const watchedPrimaryColor = watch('primaryColor');
  const watchedAccentColor = watch('accentColor');

  useEffect(() => {
    onAppearanceChange?.({
      title: watchedTitle?.trim() || undefined,
      subtitle: watchedSubtitle?.trim() || undefined,
      placeholder: watchedPlaceholder?.trim() || undefined,
      accentColor: watchedAccentColor?.trim() || undefined,
      primaryColor: watchedPrimaryColor?.trim() || undefined,
    });
  }, [
    watchedTitle,
    watchedSubtitle,
    watchedPlaceholder,
    watchedAccentColor,
    watchedPrimaryColor,
    onAppearanceChange,
  ]);

  const [dataSourceConfig, setDataSourceConfig] = useState<BotSourceConfig>(bot.dataSourceConfig);

  const uploadImageMutation = useMutation({
    mutationFn: async (file: File) => {
      if (!selectedOrgId) return;
      const formData = new FormData();
      formData.append('file', file);
      const res = await api.bots.uploadImage({
        params: { orgId: selectedOrgId, botId: bot.id },
        body: formData,
      });
      if (res.status === 200) {
        toast.success('Image uploaded');
        queryClient.invalidateQueries({ queryKey });
      }
    },
  });

  const deleteImageMutation = useMutation({
    mutationFn: async () => {
      if (!selectedOrgId) return;
      const res = await api.bots.deleteImage({
        params: { orgId: selectedOrgId, botId: bot.id },
        body: {},
      });
      if (res.status === 200) {
        toast.success('Image removed');
        queryClient.invalidateQueries({ queryKey });
      }
    },
  });

  const onSubmit = async (data: SettingsForm) => {
    if (!selectedOrgId) return;
    try {
      const res = await api.bots.update({
        params: { orgId: selectedOrgId, botId: bot.id },
        body: {
          name: data.name.trim(),
          systemPrompt: data.systemPrompt?.trim() || null,
          dataSourceConfig,
          title: data.title?.trim() || null,
          subtitle: data.subtitle?.trim() || null,
          placeholder: data.placeholder?.trim() || null,
          accentColor: data.accentColor?.trim() || null,
          primaryColor: data.primaryColor?.trim() || null,
        },
      });
      if (res.status === 200) {
        toast.success('Settings saved');
        queryClient.invalidateQueries({ queryKey });
        queryClient.invalidateQueries({ queryKey: ['bots', selectedOrgId] });
      }
    } catch (err) {
      setError('root', {
        message: err instanceof Error ? err.message : 'Failed to save settings',
      });
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
          Bot ID:
        </Typography>
        <Typography variant="body2" sx={{ fontFamily: FONT_MONO, fontWeight: 500 }}>
          {bot.id}
        </Typography>
        <CopyButton text={bot.id} />
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

      {/* Appearance */}
      <Typography variant="subtitle2" sx={{ mt: 2 }}>
        Appearance
      </Typography>
      <Typography variant="body2" color="text.secondary">
        Customize how this bot looks in the chat interface.
      </Typography>

      {/* Image upload */}
      <Stack direction="row" spacing={2} alignItems="center">
        <Avatar
          src={bot.imageUrl ?? undefined}
          sx={{ width: 56, height: 56, bgcolor: 'grey.200' }}
        />
        <Stack spacing={1}>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/svg+xml"
            hidden
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) uploadImageMutation.mutate(file);
              e.target.value = '';
            }}
          />
          <Stack direction="row" spacing={1}>
            <Button
              size="small"
              variant="outlined"
              startIcon={<UploadSimpleIcon size={16} weight="light" />}
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadImageMutation.isPending}
            >
              {uploadImageMutation.isPending ? 'Uploading...' : 'Upload image'}
            </Button>
            {bot.imageUrl && (
              <IconButton
                size="small"
                onClick={() => deleteImageMutation.mutate()}
                disabled={deleteImageMutation.isPending}
                sx={{ color: 'text.secondary' }}
              >
                <TrashIcon size={16} weight="light" />
              </IconButton>
            )}
          </Stack>
          <Typography variant="caption" color="text.secondary">
            PNG, JPG, WebP, or SVG. Max 5 MB.
          </Typography>
        </Stack>
      </Stack>

      <TextField label="Title" fullWidth {...register('title')} placeholder="e.g. Ask our docs" />
      <TextField
        label="Subtitle"
        fullWidth
        {...register('subtitle')}
        placeholder="e.g. Powered by AI"
      />
      <TextField
        label="Placeholder"
        fullWidth
        {...register('placeholder')}
        placeholder="e.g. Type your question..."
      />

      <Stack direction="row" spacing={2}>
        <Box sx={{ flex: 1 }}>
          <Typography variant="body2" sx={{ mb: 0.5 }}>
            Primary Color
          </Typography>
          <Stack direction="row" spacing={1} alignItems="center">
            <Box
              component="input"
              type="color"
              value={watchedPrimaryColor || COLOR_PICKER_FALLBACK}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setValue('primaryColor', e.target.value, { shouldDirty: true })
              }
              sx={{
                width: 36,
                height: 36,
                border: '1px solid',
                borderColor: 'divider',
                borderRadius: 1,
                cursor: 'pointer',
                p: 0.25,
              }}
            />
            <TextField size="small" {...register('primaryColor')} placeholder="#000000" fullWidth />
          </Stack>
        </Box>
        <Box sx={{ flex: 1 }}>
          <Typography variant="body2" sx={{ mb: 0.5 }}>
            Accent Color
          </Typography>
          <Stack direction="row" spacing={1} alignItems="center">
            <Box
              component="input"
              type="color"
              value={watchedAccentColor || COLOR_PICKER_FALLBACK}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setValue('accentColor', e.target.value, { shouldDirty: true })
              }
              sx={{
                width: 36,
                height: 36,
                border: '1px solid',
                borderColor: 'divider',
                borderRadius: 1,
                cursor: 'pointer',
                p: 0.25,
              }}
            />
            <TextField size="small" {...register('accentColor')} placeholder="#000000" fullWidth />
          </Stack>
        </Box>
      </Stack>

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

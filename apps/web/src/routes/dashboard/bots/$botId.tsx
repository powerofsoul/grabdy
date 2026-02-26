import { useCallback, useState } from 'react';

import { dbIdSchema } from '@grabdy/common';
import {
  alpha,
  Box,
  CircularProgress,
  IconButton,
  Tab,
  Tabs,
  Tooltip,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import { ArrowLeftIcon } from '@phosphor-icons/react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { createFileRoute, useRouter } from '@tanstack/react-router';

import { DeveloperDocs } from './DeveloperDocs';
import { SettingsTab } from './SettingsTab';
import { SigningKeysTab } from './SigningKeysTab';
import type { BotAppearance } from './types';

import { ChatPanel } from '@/components/chat';
import { DashboardPage } from '@/components/ui/DashboardPage';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api';

export const Route = createFileRoute('/dashboard/bots/$botId')({
  component: BotDetailPage,
});

function BotDetailPage() {
  const { selectedOrgId } = useAuth();
  const { botId: rawBotId } = Route.useParams();
  const queryClient = useQueryClient();
  const router = useRouter();
  const theme = useTheme();
  const ct = theme.palette.text.primary;
  const isDesktop = useMediaQuery('(min-width:960px)');
  const [tabIndex, setTabIndex] = useState(0);
  const [liveAppearance, setLiveAppearance] = useState<BotAppearance>({});

  const parsed = dbIdSchema('Bot').safeParse(rawBotId);
  const botId = parsed.success ? parsed.data : undefined;

  const queryKey = ['bot', selectedOrgId, botId];

  const { data: bot, isLoading } = useQuery({
    queryKey,
    queryFn: async () => {
      if (!selectedOrgId || !botId) return null;
      const res = await api.bots.get({
        params: { orgId: selectedOrgId, botId },
      });
      if (res.status === 200) return res.body.data;
      return null;
    },
    enabled: !!selectedOrgId && !!botId,
  });

  const invalidateBot = () => {
    queryClient.invalidateQueries({ queryKey });
  };

  const handleAppearanceChange = useCallback((appearance: BotAppearance) => {
    setLiveAppearance(appearance);
  }, []);

  if (!parsed.success) {
    return (
      <DashboardPage title="Bot" showBack>
        <Box sx={{ p: 4 }}>
          <Typography color="error">Invalid bot ID</Typography>
        </Box>
      </DashboardPage>
    );
  }

  if (isLoading || !bot) {
    return (
      <DashboardPage title="Bot" showBack>
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
          <CircularProgress />
        </Box>
      </DashboardPage>
    );
  }

  // Live values override saved values
  const previewTitle = liveAppearance.title ?? bot.title ?? undefined;
  const previewSubtitle = liveAppearance.subtitle ?? bot.subtitle ?? undefined;
  const previewPlaceholder = liveAppearance.placeholder ?? bot.placeholder ?? undefined;
  const previewImageUrl = liveAppearance.imageUrl ?? bot.imageUrl ?? undefined;
  const previewAccentColor = liveAppearance.accentColor ?? bot.accentColor ?? undefined;
  const previewPrimaryColor = liveAppearance.primaryColor ?? bot.primaryColor ?? undefined;

  const tabs = isDesktop
    ? (['Settings', 'Signing Keys', 'Integration'] as const)
    : (['Settings', 'Signing Keys', 'Integration', 'Test'] as const);

  const isMobileTestTab = !isDesktop && tabIndex === 3;

  const settingsContent = (
    <>
      {tabIndex === 0 && (
        <SettingsTab bot={bot} queryKey={queryKey} onAppearanceChange={handleAppearanceChange} />
      )}
      {tabIndex === 1 && <SigningKeysTab bot={bot} onUpdated={invalidateBot} />}
      {tabIndex === 2 && <DeveloperDocs botId={bot.id} />}
    </>
  );

  const chatPanel = (
    <ChatPanel
      botId={bot.id}
      botTitle={previewTitle}
      botSubtitle={previewSubtitle}
      botPlaceholder={previewPlaceholder}
      botImageUrl={previewImageUrl}
      botAccentColor={previewAccentColor}
      botPrimaryColor={previewPrimaryColor}
      showMobileSidebar={false}
    />
  );

  const header = (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1,
        px: 2,
        pt: 2,
        pb: 0,
        flexShrink: 0,
      }}
    >
      <Tooltip title="Go back">
        <IconButton
          onClick={() => router.history.back()}
          size="small"
          sx={{ color: alpha(ct, 0.35), '&:hover': { color: 'text.primary' } }}
        >
          <ArrowLeftIcon size={18} weight="light" color="currentColor" />
        </IconButton>
      </Tooltip>
      <Typography variant="h6" noWrap sx={{ fontSize: 16, fontWeight: 600 }}>
        {bot.name}
      </Typography>
    </Box>
  );

  if (isDesktop) {
    return (
      <DashboardPage noPadding>
        <Box sx={{ display: 'flex', height: '100%', overflow: 'hidden' }}>
          <Box
            sx={{
              flex: 1,
              minWidth: 0,
              display: 'flex',
              flexDirection: 'column',
              borderRight: '1px solid',
              borderColor: 'divider',
            }}
          >
            {header}
            <Box sx={{ borderBottom: 1, borderColor: 'divider', px: 2 }}>
              <Tabs value={tabIndex} onChange={(_, v: number) => setTabIndex(v)}>
                {tabs.map((label) => (
                  <Tab key={label} label={label} />
                ))}
              </Tabs>
            </Box>
            <Box sx={{ flex: 1, overflow: 'auto', p: 3 }}>{settingsContent}</Box>
          </Box>

          <Box
            sx={{
              width: '45%',
              maxWidth: 560,
              minWidth: 380,
              flexShrink: 0,
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            {chatPanel}
          </Box>
        </Box>
      </DashboardPage>
    );
  }

  return (
    <DashboardPage noPadding>
      <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
        {header}
        <Box sx={{ borderBottom: 1, borderColor: 'divider', px: 2 }}>
          <Tabs
            value={tabIndex}
            onChange={(_, v: number) => setTabIndex(v)}
            variant="scrollable"
            scrollButtons="auto"
          >
            {tabs.map((label) => (
              <Tab key={label} label={label} />
            ))}
          </Tabs>
        </Box>

        {isMobileTestTab ? (
          <Box sx={{ flex: 1, minHeight: 0 }}>{chatPanel}</Box>
        ) : (
          <Box sx={{ flex: 1, overflow: 'auto', p: 3 }}>{settingsContent}</Box>
        )}
      </Box>
    </DashboardPage>
  );
}

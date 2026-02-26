import type { DbId } from '@grabdy/common';
import { alpha, Box, Tab, Tabs, useTheme } from '@mui/material';
import { ChatCircleIcon, RobotIcon } from '@phosphor-icons/react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';

import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api';

interface ChatBotTabsProps {
  currentBotId?: DbId<'Bot'>;
  accentColor?: string;
}

export function ChatBotTabs({ currentBotId, accentColor }: ChatBotTabsProps) {
  const theme = useTheme();
  const ct = theme.palette.text.primary;
  const navigate = useNavigate();
  const { selectedOrgId } = useAuth();

  const { data: bots = [] } = useQuery({
    queryKey: ['bots', selectedOrgId],
    queryFn: async () => {
      if (!selectedOrgId) return [];
      const res = await api.bots.list({ params: { orgId: selectedOrgId } });
      if (res.status === 200) return res.body.data;
      return [];
    },
    enabled: !!selectedOrgId,
  });

  if (bots.length === 0) return null;

  const value = currentBotId ?? '__general__';

  return (
    <Box
      sx={{
        borderBottom: '1px solid',
        borderColor: alpha(ct, 0.08),
        flexShrink: 0,
      }}
    >
      <Tabs
        value={value}
        onChange={(_, val: string) => {
          if (val === '__general__') {
            navigate({ to: '/dashboard/chat' });
          } else {
            navigate({ to: '/dashboard/chat/bot/$botId', params: { botId: val } });
          }
        }}
        variant="scrollable"
        scrollButtons="auto"
        sx={{
          minHeight: 36,
          '& .MuiTab-root': {
            minHeight: 36,
            py: 0.5,
            px: 1.5,
            fontSize: 12,
            fontWeight: 500,
            textTransform: 'none',
            color: alpha(ct, 0.5),
            '&.Mui-selected': { color: accentColor ?? 'text.primary', fontWeight: 600 },
          },
          '& .MuiTabs-indicator': {
            height: 2,
            ...(accentColor ? { backgroundColor: accentColor } : {}),
          },
        }}
      >
        <Tab
          value="__general__"
          icon={<ChatCircleIcon size={13} weight="light" />}
          iconPosition="start"
          label="General"
          sx={{ gap: 0.5 }}
        />
        {bots.map((bot) => (
          <Tab
            key={bot.id}
            value={bot.id}
            icon={<RobotIcon size={13} weight="light" />}
            iconPosition="start"
            label={bot.name}
            sx={{ gap: 0.5 }}
          />
        ))}
      </Tabs>
    </Box>
  );
}

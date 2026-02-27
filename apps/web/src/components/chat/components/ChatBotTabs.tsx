import type { DbId } from '@grabdy/common';
import { alpha, Box, MenuItem, Select, Tab, Tabs, useMediaQuery, useTheme } from '@mui/material';
import { ChatCircleIcon, RobotIcon } from '@phosphor-icons/react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';

import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api';

interface ChatBotTabsProps {
  currentBotId?: DbId<'Bot'>;
  accentColor?: string;
  onBotChange?: (botId: string | undefined) => void;
}

export function ChatBotTabs({ currentBotId, accentColor, onBotChange }: ChatBotTabsProps) {
  const theme = useTheme();
  const ct = theme.palette.text.primary;
  const navigate = useNavigate();
  const { selectedOrgId } = useAuth();
  const isMobile = useMediaQuery('(max-width:767px)');

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

  const handleChange = (val: string) => {
    if (onBotChange) {
      onBotChange(val === '__general__' ? undefined : val);
    } else {
      if (val === '__general__') {
        navigate({ to: '/dashboard/chat' });
      } else {
        navigate({ to: '/dashboard/chat/bot/$botId', params: { botId: val } });
      }
    }
  };

  if (isMobile) {
    return (
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Select
          value={value}
          onChange={(e) => handleChange(e.target.value)}
          size="small"
          fullWidth
          sx={{
            fontSize: 13,
            fontWeight: 500,
            '& .MuiSelect-select': { py: 0.75, display: 'flex', alignItems: 'center', gap: 1 },
            '& .MuiOutlinedInput-notchedOutline': { borderColor: alpha(ct, 0.12) },
          }}
        >
          <MenuItem value="__general__" sx={{ fontSize: 13, display: 'flex', gap: 1 }}>
            <ChatCircleIcon size={13} weight="light" />
            General
          </MenuItem>
          {bots.map((bot) => (
            <MenuItem key={bot.id} value={bot.id} sx={{ fontSize: 13, display: 'flex', gap: 1 }}>
              <RobotIcon size={13} weight="light" />
              {bot.name}
            </MenuItem>
          ))}
        </Select>
      </Box>
    );
  }

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
        onChange={(_, val: string) => handleChange(val)}
        variant="scrollable"
        scrollButtons="auto"
        sx={{
          minHeight: 48,
          '& .MuiTab-root': {
            minHeight: 48,
            py: 1,
            px: 2,
            fontSize: 14,
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
          icon={<ChatCircleIcon size={17} weight="light" />}
          iconPosition="start"
          label="General"
          sx={{ gap: 0.75 }}
        />
        {bots.map((bot) => (
          <Tab
            key={bot.id}
            value={bot.id}
            icon={<RobotIcon size={17} weight="light" />}
            iconPosition="start"
            label={bot.name}
            sx={{ gap: 0.75 }}
          />
        ))}
      </Tabs>
    </Box>
  );
}

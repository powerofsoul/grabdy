import { useMemo } from 'react';

import type { DbId } from '@grabdy/common';
import type { BotSourceConfig } from '@grabdy/contracts';
import { useQuery } from '@tanstack/react-query';

import { formatSourceConfigSummary } from './formatSourceConfigSummary';

import { api } from '@/lib/api';

const EMPTY_CONFIG: BotSourceConfig = [];

export function useBotSourceConfig(orgId: DbId<'Org'> | undefined, botId: DbId<'Bot'> | undefined) {
  const { data: bot, isLoading } = useQuery({
    queryKey: ['bot', orgId, botId],
    queryFn: async () => {
      if (!orgId || !botId) return null;
      const res = await api.bots.get({
        params: { orgId, botId },
      });
      if (res.status === 200) return res.body.data;
      return null;
    },
    enabled: !!orgId && !!botId,
  });

  const config: BotSourceConfig = bot?.dataSourceConfig ?? EMPTY_CONFIG;
  const summary = useMemo(() => formatSourceConfigSummary(config), [config]);

  return { config, summary, isLoading };
}

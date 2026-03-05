import { dbIdSchema } from '@grabdy/common';
import { useQuery } from '@tanstack/react-query';
import { createFileRoute, useNavigate, useParams, useSearch } from '@tanstack/react-router';
import { z } from 'zod';

import { ChatPanel } from '@/components/chat';
import { ChatBotTabs } from '@/components/chat/components/ChatBotTabs';
import { DashboardPage } from '@/components/ui/DashboardPage';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api';

const botChatSearchSchema = z.object({
  thread: z.string().optional(),
});

export const Route = createFileRoute('/dashboard/chat/bot/$botId')({
  validateSearch: botChatSearchSchema,
  component: BotChatPage,
});

function BotChatPage() {
  const { botId: rawBotId } = useParams({ from: '/dashboard/chat/bot/$botId' });
  const { thread } = useSearch({ from: '/dashboard/chat/bot/$botId' });
  const { selectedOrgId } = useAuth();
  const navigate = useNavigate();

  const parsed = dbIdSchema('Bot').safeParse(rawBotId);
  const botId = parsed.success ? parsed.data : undefined;

  const { data: bot } = useQuery({
    queryKey: ['bot', selectedOrgId, botId],
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

  if (!parsed.success || !botId) {
    return (
      <DashboardPage noPadding>
        <div>Invalid bot ID</div>
      </DashboardPage>
    );
  }

  return (
    <DashboardPage noPadding>
      <ChatPanel
        botId={botId}
        initialThreadId={thread}
        tabsSlot={<ChatBotTabs currentBotId={botId} accentColor={bot?.accentColor ?? undefined} />}
        botTitle={bot?.title ?? undefined}
        botSubtitle={bot?.subtitle ?? undefined}
        botPlaceholder={bot?.placeholder ?? undefined}
        botImageUrl={bot?.imageUrl ?? undefined}
        botAccentColor={bot?.accentColor ?? undefined}
        botPrimaryColor={bot?.primaryColor ?? undefined}
        onThreadChange={(threadId) => {
          navigate({
            to: '/dashboard/chat/bot/$botId',
            params: { botId },
            search: threadId ? { thread: threadId } : {},
            replace: true,
          });
        }}
      />
    </DashboardPage>
  );
}

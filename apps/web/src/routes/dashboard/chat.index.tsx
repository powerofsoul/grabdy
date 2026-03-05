import { createFileRoute, useNavigate, useSearch } from '@tanstack/react-router';
import { z } from 'zod';

import { ChatPanel } from '@/components/chat';
import { ChatBotTabs } from '@/components/chat/components/ChatBotTabs';
import { DashboardPage } from '@/components/ui/DashboardPage';

const chatSearchSchema = z.object({
  thread: z.string().optional(),
});

export const Route = createFileRoute('/dashboard/chat/')({
  validateSearch: chatSearchSchema,
  component: ChatPage,
});

function ChatPage() {
  const { thread } = useSearch({ from: '/dashboard/chat/' });
  const navigate = useNavigate();

  return (
    <DashboardPage noPadding>
      <ChatPanel
        initialThreadId={thread}
        tabsSlot={<ChatBotTabs />}
        onThreadChange={(threadId) => {
          navigate({
            to: '/dashboard/chat',
            search: threadId ? { thread: threadId } : {},
            replace: true,
          });
        }}
      />
    </DashboardPage>
  );
}

import { createFileRoute, useNavigate, useSearch } from '@tanstack/react-router';
import { z } from 'zod';

import { ChatPanel } from '@/components/chat';
import { DashboardPage } from '@/components/ui/DashboardPage';

const chatSearchSchema = z.object({
  thread: z.string().optional(),
});

export const Route = createFileRoute('/dashboard/chat')({
  component: ChatPage,
  validateSearch: chatSearchSchema,
});

function ChatPage() {
  const { thread } = useSearch({ from: '/dashboard/chat' });
  const navigate = useNavigate();

  return (
    <DashboardPage noPadding>
      <ChatPanel
        initialThreadId={thread}
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

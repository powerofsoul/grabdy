import { createFileRoute } from '@tanstack/react-router';

import { EmbedChatPage } from '@/components/embed-chat';

export const Route = createFileRoute('/embed')({
  component: EmbedChatPage,
});

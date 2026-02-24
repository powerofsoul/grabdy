import { createFileRoute } from '@tanstack/react-router';

import { EmbedPreviewPage } from '@/components/embed-preview';

export const Route = createFileRoute('/embed-preview')({
  component: EmbedPreviewPage,
});

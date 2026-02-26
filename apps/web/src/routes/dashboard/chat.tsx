import { createFileRoute, Outlet } from '@tanstack/react-router';

export const Route = createFileRoute('/dashboard/chat')({
  component: ChatLayout,
});

function ChatLayout() {
  return <Outlet />;
}

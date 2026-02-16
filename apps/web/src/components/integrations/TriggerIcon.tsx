import { LightningIcon, PlugsIcon, UserIcon } from '@phosphor-icons/react';

export function TriggerIcon({ trigger }: { trigger: string }) {
  const size = 11;
  switch (trigger) {
    case 'MANUAL': return <UserIcon size={size} weight="light" color="currentColor" />;
    case 'WEBHOOK': return <PlugsIcon size={size} weight="light" color="currentColor" />;
    default: return <LightningIcon size={size} weight="light" color="currentColor" />;
  }
}

import type { DbId } from '@grabdy/common';
import type { SdkChatSourceConfig } from '@grabdy/contracts';

export interface SigningKey {
  id: DbId<'SdkSigningKey'>;
  name: string;
  fingerprint: string;
  revokedAt: string | null;
  createdAt: string;
}

export interface SdkChatDetail {
  id: DbId<'SdkChat'>;
  name: string;
  dataSourceConfig: SdkChatSourceConfig;
  systemPrompt: string | null;
  isActive: boolean;
  signingKeys: SigningKey[];
  createdAt: string;
  updatedAt: string;
}

import type { DbId } from '@grabdy/common';
import type { BotSourceConfig } from '@grabdy/contracts';

export interface BotAppearance {
  title?: string;
  subtitle?: string;
  placeholder?: string;
  imageUrl?: string;
  accentColor?: string;
  primaryColor?: string;
}

export interface SigningKey {
  id: DbId<'BotSigningKey'>;
  name: string;
  fingerprint: string;
  revokedAt: string | null;
  createdAt: string;
}

export interface BotDetail {
  id: DbId<'Bot'>;
  name: string;
  dataSourceConfig: BotSourceConfig;
  systemPrompt: string | null;
  title: string | null;
  subtitle: string | null;
  placeholder: string | null;
  imageUrl: string | null;
  accentColor: string | null;
  primaryColor: string | null;
  signingKeys: SigningKey[];
  createdAt: string;
  updatedAt: string;
}

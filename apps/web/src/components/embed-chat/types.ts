import type { SdkChatStyle } from '@grabdy/contracts';
import { sdkChatStyleSchema } from '@grabdy/contracts';
import { z } from 'zod';

export interface EmbedAuthState {
  jwt: string | null;
  chatId: string | null;
  style: SdkChatStyle | undefined;
}

const jwtMessageSchema = z.object({
  type: z.literal('JWT'),
  jwt: z.string(),
  chatId: z.string(),
  style: sdkChatStyleSchema.optional(),
});

const updateJwtMessageSchema = z.object({
  type: z.literal('UPDATE_JWT'),
  jwt: z.string(),
});

export const parentMessageSchema = z.discriminatedUnion('type', [
  jwtMessageSchema,
  updateJwtMessageSchema,
]);

export interface EmbedSource {
  type: string;
  dataSourceId: string;
  dataSourceName: string;
  sourceUrl: string | null;
  pages?: number[];
}

export type EmbedMessage =
  | { type: 'READY' }
  | { type: 'RESIZE'; height: number }
  | { type: 'CLOSE' }
  | { type: 'TOKEN_REFRESH' }
  | { type: 'OPEN_SOURCE'; source: EmbedSource };

// Uses '*' origin because the embed doesn't know the parent's origin upfront.
// Safe: messages contain only control signals (READY, RESIZE, CLOSE, TOKEN_REFRESH), no secrets.
export function postToParent(message: EmbedMessage): void {
  if (window.parent !== window) {
    window.parent.postMessage(message, '*');
  }
}

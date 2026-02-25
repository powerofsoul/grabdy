import { z } from 'zod';

export const MAX_CHAT_ATTACHMENTS = 4;

export const chatAttachmentSchema = z.object({
  fileName: z.string(),
  mimeType: z.string(),
  fileSize: z.number(),
  storageKey: z.string(),
});

export type ChatAttachment = z.infer<typeof chatAttachmentSchema>;

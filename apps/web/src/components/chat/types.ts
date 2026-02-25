import type { ChatAttachment, ChatSource } from '@grabdy/contracts';

export interface ChatMessage {
  id?: string;
  role: 'user' | 'assistant';
  content: string;
  sources?: ChatSource[];
  thinkingTexts?: string[];
  isStreaming?: boolean;
  durationMs?: number;
  attachments?: ChatAttachment[];
}

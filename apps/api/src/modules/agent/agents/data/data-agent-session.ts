import type { DbId } from '@grabdy/common';
import type { ChatAttachment } from '@grabdy/contracts';
import type { ToolLoopAgent } from 'ai';

import type { AgentMemoryService, CoreMessage } from '../../services/memory.service';

export type AttachmentContext = Array<
  { type: 'text'; text: string } | { type: 'image'; image: Buffer; mimeType: string }
>;

export interface StreamInput {
  threadId?: DbId<'ChatThread'>;
  message: string;
  attachments?: ChatAttachment[];
  attachmentContext?: AttachmentContext;
}

export function buildUserContent(
  message: string,
  attachmentContext?: AttachmentContext
):
  | string
  | Array<{ type: 'text'; text: string } | { type: 'image'; image: Buffer; mimeType?: string }> {
  if (!attachmentContext || attachmentContext.length === 0) {
    return message;
  }

  const textParts = attachmentContext.filter(
    (p): p is { type: 'text'; text: string } => p.type === 'text'
  );
  const imageParts = attachmentContext.filter(
    (p): p is { type: 'image'; image: Buffer; mimeType: string } => p.type === 'image'
  );

  const textPrefix = textParts.map((p) => p.text).join('\n\n');
  const fullMessage = textPrefix ? `${textPrefix}\n\n${message}` : message;

  if (imageParts.length === 0) {
    return fullMessage;
  }

  const parts: Array<
    { type: 'text'; text: string } | { type: 'image'; image: Buffer; mimeType?: string }
  > = [
    { type: 'text', text: fullMessage },
    ...imageParts.map((p) => ({ type: 'image' as const, image: p.image, mimeType: p.mimeType })),
  ];

  return parts;
}

export class DataAgentSession {
  constructor(
    private agent: ToolLoopAgent,
    private agentMemory: AgentMemoryService,
    private orgId: DbId<'Org'>
  ) {}

  async generate(input: StreamInput) {
    const history: CoreMessage[] = input.threadId
      ? await this.agentMemory.getMessagesForContext(input.threadId)
      : [];

    const userContent = buildUserContent(input.message, input.attachmentContext);

    const result = await this.agent.generate({
      messages: [...history, { role: 'user' as const, content: userContent }],
    });

    if (input.threadId) {
      await this.agentMemory.saveMessages(input.threadId, this.orgId, [
        { role: 'user', content: input.message, attachments: input.attachments },
        { role: 'assistant', content: result.text },
      ]);
    }

    return result;
  }

  async stream(input: StreamInput) {
    const history: CoreMessage[] = input.threadId
      ? await this.agentMemory.getMessagesForContext(input.threadId)
      : [];

    const userContent = buildUserContent(input.message, input.attachmentContext);

    const streamResult = await this.agent.stream({
      messages: [...history, { role: 'user' as const, content: userContent }],
    });

    // Save user message immediately
    if (input.threadId) {
      await this.agentMemory.saveMessages(input.threadId, this.orgId, [
        { role: 'user', content: input.message, attachments: input.attachments },
      ]);
    }

    const saveAssistant = async (text: string): Promise<void> => {
      if (input.threadId && text.trim()) {
        await this.agentMemory.saveMessages(input.threadId, this.orgId, [
          { role: 'assistant', content: text },
        ]);
      }
    };

    return { streamResult, saveAssistant };
  }
}

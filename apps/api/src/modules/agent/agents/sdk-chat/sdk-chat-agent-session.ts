import type { DbId } from '@grabdy/common';
import type { ToolLoopAgent } from 'ai';

import type { AgentMemoryService, CoreMessage } from '../../services/memory.service';
import type { StreamInput } from '../data/data-agent-session';
import { buildUserContent } from '../data/data-agent-session';

export class SdkChatAgentSession {
  constructor(
    private agent: ToolLoopAgent,
    private agentMemory: AgentMemoryService,
    private orgId: DbId<'Org'>
  ) {}

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

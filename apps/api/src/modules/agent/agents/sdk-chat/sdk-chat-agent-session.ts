import type { DbId } from '@grabdy/common';
import type { ToolLoopAgent } from 'ai';

import type { AgentMemoryService, CoreMessage } from '../../services/memory.service';

export class SdkChatAgentSession {
  constructor(
    private agent: ToolLoopAgent,
    private agentMemory: AgentMemoryService,
    private orgId: DbId<'Org'>
  ) {}

  async stream(input: { threadId?: DbId<'ChatThread'>; message: string }) {
    const history: CoreMessage[] = input.threadId
      ? await this.agentMemory.getMessagesForContext(input.threadId)
      : [];

    const streamResult = await this.agent.stream({
      messages: [...history, { role: 'user' as const, content: input.message }],
    });

    // Save user message immediately
    if (input.threadId) {
      await this.agentMemory.saveMessages(input.threadId, this.orgId, [
        { role: 'user', content: input.message },
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

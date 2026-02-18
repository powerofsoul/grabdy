import type { MastraDBMessage } from '@mastra/core/agent';
import type { MemoryConfig, SharedMemoryConfig } from '@mastra/core/memory';
import { Memory } from '@mastra/memory';

export class OrderedMemory extends Memory {
  private lastTimestamp = 0;

  constructor(config?: SharedMemoryConfig) {
    super(config);
  }

  override async saveMessages({
    messages,
    memoryConfig,
  }: {
    messages: MastraDBMessage[];
    memoryConfig?: MemoryConfig | undefined;
  }): Promise<{
    messages: MastraDBMessage[];
    usage?: { tokens: number };
  }> {
    const now = Date.now();
    const baseTime = Math.max(now, this.lastTimestamp + 1);

    const messagesWithOrderedTimestamps = messages.map((msg, index) => ({
      ...msg,
      createdAt: new Date(baseTime + index),
    }));

    this.lastTimestamp = baseTime + messages.length - 1;

    return super.saveMessages({
      messages: messagesWithOrderedTimestamps,
      memoryConfig,
    });
  }
}

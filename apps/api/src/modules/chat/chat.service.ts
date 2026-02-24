import { Injectable, Logger, NotFoundException } from '@nestjs/common';

import { type DbId, packId } from '@grabdy/common';
import { canvasStateSchema } from '@grabdy/contracts';
import { sql } from 'kysely';

import { THREAD_TITLE_MAX_LENGTH } from '../../config/constants';
import { DbService } from '../../db/db.module';
import { DataAgent } from '../agent/agents/data/data-agent';
import { AgentMemoryService } from '../agent/services/memory.service';
import { CanvasDelegateTool } from '../agent/tools/canvas-delegate.tool';
import { buildBlockInstructionsPrompt } from '../canvas/block-registry';
import { CanvasService } from '../canvas/canvas.service';

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);

  constructor(
    private db: DbService,
    private dataAgent: DataAgent,
    private agentMemory: AgentMemoryService,
    private canvasDelegateTool: CanvasDelegateTool,
    private canvasService: CanvasService
  ) {}

  private async ensureThread(
    orgId: DbId<'Org'>,
    membershipId: DbId<'OrgMembership'>,
    message: string,
    options: { threadId?: DbId<'ChatThread'>; collectionId?: DbId<'Collection'> }
  ): Promise<DbId<'ChatThread'>> {
    if (options.threadId) {
      await this.db.kysely
        .updateTable('data.chat_threads')
        .set({
          title: sql`COALESCE(title, ${message.slice(0, THREAD_TITLE_MAX_LENGTH)})`,
          updated_at: new Date(),
        })
        .where('id', '=', options.threadId)
        .where('org_id', '=', orgId)
        .execute();
      return options.threadId;
    }

    const thread = await this.db.kysely
      .insertInto('data.chat_threads')
      .values({
        id: packId('ChatThread', orgId),
        title: message.slice(0, THREAD_TITLE_MAX_LENGTH),
        collection_id: options.collectionId ?? null,
        org_id: orgId,
        membership_id: membershipId,
        updated_at: new Date(),
      })
      .returningAll()
      .executeTakeFirstOrThrow();

    return thread.id;
  }

  private buildChatInstructions(): string {
    const parts = [buildBlockInstructionsPrompt()];

    parts.push(`## Canvas -- MANDATORY
**You MUST call \`canvas_delegate\` on every response where you found an answer.** If you answered the user's question using knowledge base results, you MUST visualize it. No exceptions. Text-only answers are broken. The canvas is how users consume information.

**Only skip \`canvas_delegate\` when you literally cannot answer:** greetings, "I couldn't find anything", clarifying questions, or single-sentence acknowledgments like "Happy to help."

Execution order, non-negotiable:
1. Search the knowledge base
2. Write your complete chat answer (including the sources block)
3. Call \`canvas_delegate\` as your VERY LAST action, after all text is finished
- Pass ALL relevant search results as context so the canvas agent can visualize them.`);

    return parts.join('\n\n');
  }

  async chat(
    orgId: DbId<'Org'>,
    membershipId: DbId<'OrgMembership'>,
    userId: DbId<'User'>,
    message: string,
    options: {
      threadId?: DbId<'ChatThread'>;
      collectionId?: DbId<'Collection'>;
    }
  ): Promise<{
    answer: string;
    threadId: DbId<'ChatThread'>;
    sources: never[];
  }> {
    const threadId = await this.ensureThread(orgId, membershipId, message, options);
    const canvasState = await this.canvasService.getState(threadId, orgId);

    const session = this.dataAgent.create({
      orgId,
      userId,
      source: 'WEB',
      collectionIds: options.collectionId ? [options.collectionId] : undefined,
      instructions: this.buildChatInstructions(),
      tools: [
        this.canvasDelegateTool.create({
          orgId,
          userId,
          threadId,
          source: 'WEB',
          canvasState,
        }),
      ],
    });

    const result = await session.generate({ threadId, message });

    return {
      answer: result.text,
      threadId,
      sources: [],
    };
  }

  async streamChat(
    orgId: DbId<'Org'>,
    membershipId: DbId<'OrgMembership'>,
    userId: DbId<'User'>,
    message: string,
    options: {
      threadId?: DbId<'ChatThread'>;
      collectionId?: DbId<'Collection'>;
    }
  ) {
    const threadId = await this.ensureThread(orgId, membershipId, message, options);
    const canvasState = await this.canvasService.getState(threadId, orgId);

    const session = this.dataAgent.create({
      orgId,
      userId,
      source: 'WEB',
      collectionIds: options.collectionId ? [options.collectionId] : undefined,
      instructions: this.buildChatInstructions(),
      tools: [
        this.canvasDelegateTool.create({
          orgId,
          userId,
          threadId,
          source: 'WEB',
          canvasState,
        }),
      ],
    });

    const { streamResult, saveAssistant } = await session.stream({ threadId, message });

    return { threadId, streamResult, orgId, saveAssistant };
  }

  async createThread(
    orgId: DbId<'Org'>,
    membershipId: DbId<'OrgMembership'>,
    options: { title?: string; collectionId?: DbId<'Collection'> }
  ) {
    const thread = await this.db.kysely
      .insertInto('data.chat_threads')
      .values({
        id: packId('ChatThread', orgId),
        title: options.title ?? null,
        collection_id: options.collectionId ?? null,
        org_id: orgId,
        membership_id: membershipId,
        updated_at: new Date(),
      })
      .returningAll()
      .executeTakeFirstOrThrow();

    return {
      id: thread.id,
      title: thread.title,
      collectionId: thread.collection_id,
      createdAt: new Date(thread.created_at).toISOString(),
      updatedAt: new Date(thread.updated_at).toISOString(),
    };
  }

  async listThreads(orgId: DbId<'Org'>, membershipId: DbId<'OrgMembership'>) {
    const threads = await this.db.kysely
      .selectFrom('data.chat_threads')
      .select(['id', 'title', 'collection_id', 'created_at', 'updated_at'])
      .where('org_id', '=', orgId)
      .where('membership_id', '=', membershipId)
      .orderBy('updated_at', 'desc')
      .execute();

    return threads.map((t) => ({
      id: t.id,
      title: t.title,
      collectionId: t.collection_id,
      createdAt: new Date(t.created_at).toISOString(),
      updatedAt: new Date(t.updated_at).toISOString(),
    }));
  }

  async getThread(orgId: DbId<'Org'>, threadId: DbId<'ChatThread'>) {
    const thread = await this.db.kysely
      .selectFrom('data.chat_threads')
      .selectAll()
      .where('id', '=', threadId)
      .where('org_id', '=', orgId)
      .executeTakeFirst();

    if (!thread) {
      throw new NotFoundException('Thread not found');
    }

    const messages = await this.agentMemory.getHistory(threadId);

    return {
      id: thread.id,
      title: thread.title,
      collectionId: thread.collection_id,
      createdAt: new Date(thread.created_at).toISOString(),
      updatedAt: new Date(thread.updated_at).toISOString(),
      canvasState: thread.canvas_state ? canvasStateSchema.parse(thread.canvas_state) : null,
      messages: messages.map((m) => ({
        id: m.id,
        role: m.role,
        content: m.content,
        sources: null,
        createdAt: m.createdAt ? m.createdAt.toISOString() : new Date().toISOString(),
      })),
    };
  }

  async deleteThread(orgId: DbId<'Org'>, threadId: DbId<'ChatThread'>): Promise<void> {
    const result = await this.db.kysely
      .deleteFrom('data.chat_threads')
      .where('id', '=', threadId)
      .where('org_id', '=', orgId)
      .executeTakeFirst();

    if (result.numDeletedRows === 0n) {
      throw new NotFoundException('Thread not found');
    }
  }

  async renameThread(orgId: DbId<'Org'>, threadId: DbId<'ChatThread'>, title: string) {
    const thread = await this.db.kysely
      .updateTable('data.chat_threads')
      .set({ title, updated_at: new Date() })
      .where('id', '=', threadId)
      .where('org_id', '=', orgId)
      .returningAll()
      .executeTakeFirst();

    if (!thread) {
      throw new NotFoundException('Thread not found');
    }

    return {
      id: thread.id,
      title: thread.title,
      collectionId: thread.collection_id,
      createdAt: new Date(thread.created_at).toISOString(),
      updatedAt: new Date(thread.updated_at).toISOString(),
    };
  }
}

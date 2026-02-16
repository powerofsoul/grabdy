import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger, NotFoundException } from '@nestjs/common';

import { type DbId, type NonDbId, packId } from '@grabdy/common';
import { type CanvasEdge, type CanvasState, canvasStateSchema, type Card } from '@grabdy/contracts';
import { Queue } from 'bullmq';
import { sql } from 'kysely';

import { THREAD_TITLE_MAX_LENGTH } from '../../config/constants';
import { DbService } from '../../db/db.module';
import { AgentFactory } from '../agent/services/agent.factory';
import { AgentMemoryService } from '../agent/services/memory.service';
import { CanvasTools } from '../agent/tools/canvas-tools';
import { CANVAS_OPS_QUEUE } from '../queue/queue.constants';

import type { CanvasOp } from './processors/canvas-ops.types';
import { buildBlockInstructionsPrompt } from './block-registry';
import { CANVAS_INSTRUCTIONS, summarizeCanvas } from './canvas-prompt';

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);

  constructor(
    private db: DbService,
    private agentFactory: AgentFactory,
    private agentMemory: AgentMemoryService,
    private canvasTools: CanvasTools,
    @InjectQueue(CANVAS_OPS_QUEUE) private canvasQueue: Queue<CanvasOp>
  ) {}

  private async getCanvasState(threadId: DbId<'ChatThread'>): Promise<CanvasState | undefined> {
    const row = await this.db.kysely
      .selectFrom('data.chat_threads')
      .select('canvas_state')
      .where('id', '=', threadId)
      .executeTakeFirst();

    if (!row?.canvas_state) return undefined;
    return canvasStateSchema.parse(row.canvas_state);
  }

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

  private buildChatInstructions(canvasState?: CanvasState): string {
    const parts = [buildBlockInstructionsPrompt()];

    parts.push(CANVAS_INSTRUCTIONS);

    if (canvasState && canvasState.cards.length > 0) {
      parts.push(summarizeCanvas(canvasState));
    }

    return parts.join('\n\n');
  }

  async chat(
    orgId: DbId<'Org'>,
    membershipId: DbId<'OrgMembership'>,
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
    const canvasState = await this.getCanvasState(threadId);

    const chatAgent = this.agentFactory.createDataAgent({
      orgId,
      source: 'WEB',
      collectionIds: options.collectionId ? [options.collectionId] : undefined,
      instructions: this.buildChatInstructions(canvasState),
      memory: this.agentMemory.getMemory(),
      tools: [this.canvasTools.create(threadId, orgId)],
    });
    const result = await chatAgent.generate(message, threadId, membershipId);

    return {
      answer: result.text,
      threadId,
      sources: [],
    };
  }

  async streamChat(
    orgId: DbId<'Org'>,
    membershipId: DbId<'OrgMembership'>,
    message: string,
    options: {
      threadId?: DbId<'ChatThread'>;
      collectionId?: DbId<'Collection'>;
    }
  ) {
    const threadId = await this.ensureThread(orgId, membershipId, message, options);
    const canvasState = await this.getCanvasState(threadId);

    const agent = this.agentFactory.createDataAgent({
      orgId,
      source: 'WEB',
      collectionIds: options.collectionId ? [options.collectionId] : undefined,
      instructions: this.buildChatInstructions(canvasState),
      memory: this.agentMemory.getMemory(),
      tools: [this.canvasTools.create(threadId, orgId)],
    });

    const streamResult = await agent.stream(message, threadId, membershipId);

    return { threadId, streamResult };
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

  private enqueueCanvasOp(op: CanvasOp): void {
    this.canvasQueue.add(op.type, op, { attempts: 1 }).catch((err) => {
      this.logger.error(`Failed to enqueue canvas op ${op.type}: ${err}`);
    });
  }

  async moveCanvasCard(
    orgId: DbId<'Org'>,
    threadId: DbId<'ChatThread'>,
    cardId: NonDbId<'CanvasCard'>,
    update: {
      position?: { x: number; y: number };
      width?: number;
      height?: number;
      title?: string;
      zIndex?: number;
    }
  ): Promise<void> {
    this.enqueueCanvasOp({ type: 'move_card', threadId, orgId, cardId, ...update });
  }

  async updateCanvasEdges(
    orgId: DbId<'Org'>,
    threadId: DbId<'ChatThread'>,
    edges: CanvasEdge[]
  ): Promise<void> {
    this.enqueueCanvasOp({ type: 'update_edges', threadId, orgId, edges });
  }

  async addCanvasEdge(
    orgId: DbId<'Org'>,
    threadId: DbId<'ChatThread'>,
    edge: CanvasEdge
  ): Promise<void> {
    this.enqueueCanvasOp({ type: 'add_edge', threadId, orgId, edge });
  }

  async deleteCanvasEdge(
    orgId: DbId<'Org'>,
    threadId: DbId<'ChatThread'>,
    edgeId: NonDbId<'CanvasEdge'>
  ): Promise<void> {
    this.enqueueCanvasOp({ type: 'delete_edge', threadId, orgId, edgeId });
  }

  async deleteCanvasCard(
    orgId: DbId<'Org'>,
    threadId: DbId<'ChatThread'>,
    cardId: NonDbId<'CanvasCard'>
  ): Promise<void> {
    this.enqueueCanvasOp({ type: 'remove_card', threadId, orgId, cardId });
  }

  async updateCanvasComponent(
    orgId: DbId<'Org'>,
    threadId: DbId<'ChatThread'>,
    cardId: NonDbId<'CanvasCard'>,
    componentId: NonDbId<'CanvasComponent'>,
    data: Record<string, unknown>
  ): Promise<void> {
    this.enqueueCanvasOp({ type: 'update_component', threadId, orgId, cardId, componentId, data });
  }

  async addCanvasCard(orgId: DbId<'Org'>, threadId: DbId<'ChatThread'>, card: Card): Promise<void> {
    this.enqueueCanvasOp({ type: 'add_card', threadId, orgId, cards: [card] });
  }
}

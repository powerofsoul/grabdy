import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';

import type { DbId, NonDbId } from '@grabdy/common';
import type { CanvasEdge, CanvasState, Card } from '@grabdy/contracts';
import { canvasStateSchema } from '@grabdy/contracts';
import { Queue } from 'bullmq';

import { DbService } from '../../db/db.module';
import { CANVAS_OPS_QUEUE } from '../queue/queue.constants';

import type { CanvasOp } from './processors/canvas-ops.types';

@Injectable()
export class CanvasService {
  private readonly logger = new Logger(CanvasService.name);

  constructor(
    private db: DbService,
    @InjectQueue(CANVAS_OPS_QUEUE) private canvasQueue: Queue<CanvasOp>
  ) {}

  async getState(
    threadId: DbId<'ChatThread'>,
    orgId: DbId<'Org'>
  ): Promise<CanvasState | undefined> {
    const row = await this.db.kysely
      .selectFrom('data.chat_threads')
      .select('canvas_state')
      .where('id', '=', threadId)
      .where('org_id', '=', orgId)
      .executeTakeFirst();

    if (!row?.canvas_state) return undefined;
    return canvasStateSchema.parse(row.canvas_state);
  }

  private enqueueOp(op: CanvasOp): void {
    this.canvasQueue.add(op.type, op, { attempts: 1 }).catch((err) => {
      this.logger.error(`Failed to enqueue canvas op ${op.type}: ${err}`);
    });
  }

  moveCard(
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
  ): void {
    this.enqueueOp({ type: 'move_card', threadId, orgId, cardId, ...update });
  }

  updateEdges(orgId: DbId<'Org'>, threadId: DbId<'ChatThread'>, edges: CanvasEdge[]): void {
    this.enqueueOp({ type: 'update_edges', threadId, orgId, edges });
  }

  addEdge(orgId: DbId<'Org'>, threadId: DbId<'ChatThread'>, edge: CanvasEdge): void {
    this.enqueueOp({ type: 'add_edge', threadId, orgId, edge });
  }

  deleteEdge(
    orgId: DbId<'Org'>,
    threadId: DbId<'ChatThread'>,
    edgeId: NonDbId<'CanvasEdge'>
  ): void {
    this.enqueueOp({ type: 'delete_edge', threadId, orgId, edgeId });
  }

  deleteCard(
    orgId: DbId<'Org'>,
    threadId: DbId<'ChatThread'>,
    cardId: NonDbId<'CanvasCard'>
  ): void {
    this.enqueueOp({ type: 'remove_card', threadId, orgId, cardId });
  }

  updateComponent(
    orgId: DbId<'Org'>,
    threadId: DbId<'ChatThread'>,
    cardId: NonDbId<'CanvasCard'>,
    componentId: NonDbId<'CanvasComponent'>,
    data: Record<string, unknown>
  ): void {
    this.enqueueOp({ type: 'update_component', threadId, orgId, cardId, componentId, data });
  }

  addCard(orgId: DbId<'Org'>, threadId: DbId<'ChatThread'>, card: Card): void {
    this.enqueueOp({ type: 'add_card', threadId, orgId, cards: [card] });
  }
}

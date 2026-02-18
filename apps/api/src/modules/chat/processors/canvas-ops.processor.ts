import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';

import { type CanvasState, canvasStateSchema } from '@grabdy/contracts';
import { Job } from 'bullmq';
import { sql } from 'kysely';

import { DbService } from '../../../db/db.module';
import { CANVAS_OPS_QUEUE } from '../../queue/queue.constants';

import { mergeComponentData } from './canvas-ops.helpers';
import type { BatchInnerOp, CanvasOp } from './canvas-ops.types';

// BullMQ serializes processor errors as plain Error objects, losing the original
// class. We use this prefix so the service can reliably re-throw as NotFoundException.
export const NOT_FOUND_PREFIX = 'NOT_FOUND:';

function notFound(detail: string): Error {
  return new Error(`${NOT_FOUND_PREFIX}${detail}`);
}

function emptyCanvas(): CanvasState {
  return { version: 1, viewport: { x: 0, y: 0, zoom: 1 }, cards: [], edges: [] };
}

function applyInnerOp(state: CanvasState, innerOp: BatchInnerOp): void {
  switch (innerOp.op) {
    case 'add_card': {
      state.cards.push(...innerOp.cards);
      break;
    }
    case 'remove_card': {
      const idx = state.cards.findIndex((c) => c.id === innerOp.cardId);
      if (idx === -1) throw notFound('Card not found');
      state.cards.splice(idx, 1);
      state.edges = state.edges.filter(
        (e) => e.source !== innerOp.cardId && e.target !== innerOp.cardId
      );
      break;
    }
    case 'move_card': {
      const card = state.cards.find((c) => c.id === innerOp.cardId);
      if (!card) throw notFound('Card not found');
      if (innerOp.position) card.position = innerOp.position;
      if (innerOp.width !== undefined) card.width = innerOp.width;
      if (innerOp.height !== undefined) card.height = innerOp.height;
      break;
    }
    case 'update_component': {
      const card = state.cards.find((c) => c.id === innerOp.cardId);
      if (!card) throw notFound('Card not found');
      const found = mergeComponentData(card, innerOp.componentId, innerOp.data);
      if (!found) throw notFound('Component not found');
      break;
    }
    case 'add_edge': {
      const sourceExists = state.cards.some((c) => c.id === innerOp.edge.source);
      const targetExists = state.cards.some((c) => c.id === innerOp.edge.target);
      if (!sourceExists || !targetExists) {
        throw notFound('Edge source or target card not found');
      }
      const exists = state.edges.some(
        (e) =>
          (e.source === innerOp.edge.source && e.target === innerOp.edge.target) ||
          (e.source === innerOp.edge.target && e.target === innerOp.edge.source)
      );
      if (!exists) {
        state.edges.push(innerOp.edge);
      }
      break;
    }
    case 'remove_edge': {
      state.edges = state.edges.filter((e) => e.id !== innerOp.edgeId);
      break;
    }
  }
}

@Processor(CANVAS_OPS_QUEUE, { concurrency: 10 })
export class CanvasOpsProcessor extends WorkerHost {
  private readonly logger = new Logger(CanvasOpsProcessor.name);

  constructor(private db: DbService) {
    super();
  }

  async process(job: Job<CanvasOp>): Promise<CanvasState> {
    const op = job.data;
    this.logger.log(`Processing canvas op: ${op.type} for thread ${op.threadId}`);

    // Use a transaction with SELECT FOR UPDATE to serialize per-thread.
    // Different threads lock different rows so they run in parallel.
    // Same-thread jobs block until the previous one commits.
    return this.db.kysely.transaction().execute(async (trx) => {
      let query = trx
        .selectFrom('data.chat_threads')
        .select('canvas_state')
        .where('id', '=', op.threadId)
        .forUpdate();

      if (op.orgId) {
        query = query.where('org_id', '=', op.orgId);
      }

      const thread = await query.executeTakeFirst();
      if (!thread) {
        this.logger.error(`Thread not found: ${op.threadId}`);
        throw notFound('Thread not found');
      }

      const state = thread.canvas_state
        ? canvasStateSchema.parse(thread.canvas_state)
        : emptyCanvas();

      switch (op.type) {
        case 'add_card': {
          state.cards.push(...op.cards);
          break;
        }
        case 'remove_card': {
          const idx = state.cards.findIndex((c) => c.id === op.cardId);
          if (idx === -1) throw notFound('Card not found');
          state.cards.splice(idx, 1);
          state.edges = state.edges.filter((e) => e.source !== op.cardId && e.target !== op.cardId);
          break;
        }
        case 'move_card': {
          const card = state.cards.find((c) => c.id === op.cardId);
          if (!card) throw notFound('Card not found');
          if (op.position) card.position = op.position;
          if (op.width !== undefined) card.width = op.width;
          if (op.height !== undefined) card.height = op.height;
          if (op.title !== undefined) card.title = op.title || undefined;
          if (op.zIndex !== undefined) card.zIndex = op.zIndex;
          break;
        }
        case 'update_edges': {
          state.edges = op.edges;
          break;
        }
        case 'add_edge': {
          const sourceExists = state.cards.some((c) => c.id === op.edge.source);
          const targetExists = state.cards.some((c) => c.id === op.edge.target);
          if (!sourceExists || !targetExists) {
            throw notFound('Edge source or target card not found');
          }
          const exists = state.edges.some(
            (e) =>
              (e.source === op.edge.source && e.target === op.edge.target) ||
              (e.source === op.edge.target && e.target === op.edge.source)
          );
          if (!exists) {
            state.edges.push(op.edge);
          }
          break;
        }
        case 'delete_edge': {
          state.edges = state.edges.filter((e) => e.id !== op.edgeId);
          break;
        }
        case 'update_component': {
          const card = state.cards.find((c) => c.id === op.cardId);
          if (!card) throw notFound('Card not found');
          const found = mergeComponentData(card, op.componentId, op.data);
          if (!found) throw notFound('Component not found');
          break;
        }
        case 'batch': {
          for (const innerOp of op.operations) {
            applyInnerOp(state, innerOp);
          }
          break;
        }
      }

      const jsonStr = JSON.stringify(state);
      await trx
        .updateTable('data.chat_threads')
        .set({ canvas_state: sql`${jsonStr}::jsonb` })
        .where('id', '=', op.threadId)
        .execute();

      this.logger.log(`Canvas op ${op.type} completed: ${state.cards.length} cards`);

      return state;
    });
  }
}

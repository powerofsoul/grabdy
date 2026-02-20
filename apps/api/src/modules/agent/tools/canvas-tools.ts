import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';

import type { DbId } from '@grabdy/common';
import { nonDbIdSchema, packNonDbId } from '@grabdy/common';
import { canvasEdgeSchema, cardSchema, chunkMetaTypeEnum } from '@grabdy/contracts';
import { createTool } from '@mastra/core/tools';
import { Queue } from 'bullmq';
import { z } from 'zod';

import { type CanvasOp, batchInnerOpSchema } from '../../chat/processors/canvas-ops.types';
import { CANVAS_OPS_QUEUE } from '../../queue/queue.constants';

// ---------------------------------------------------------------------------
// AI-friendly input schemas
//
// The AI cannot generate packed UUIDs, so we accept z.string() for IDs that
// the server will replace. IDs of *existing* entities (remove, move, update)
// still come from prior server output but may also be placeholder IDs from
// earlier ops in the same batch — resolution happens at execution time.
// ---------------------------------------------------------------------------

const aiComponentSchema = z.object({
  id: z.string().describe('Placeholder component ID — the server will replace it'),
  type: z.string().describe('Component type (table, chart, kpi_row, summary, checklist, etc.)'),
  data: z.record(z.string(), z.unknown()).describe('Component data matching the type schema'),
  citations: z
    .array(
      z.object({
        label: z.string(),
        url: z.string().optional(),
        dataSourceId: z.string().optional(),
        chunkId: z.string().optional(),
      })
    )
    .optional(),
});

const aiCardSourceSchema = z.object({
  name: z.string(),
  score: z.number().optional(),
  chunkId: z.string().optional(),
  dataSourceId: z.string().optional(),
  collectionId: z.string().optional(),
  sourceUrl: z.string().nullable().optional(),
  type: chunkMetaTypeEnum.optional(),
});

const aiCardSchema = z.object({
  id: z.string().describe('Placeholder card ID — the server will replace it'),
  position: z.object({ x: z.number(), y: z.number() }),
  width: z.number(),
  height: z.number(),
  title: z.string().optional(),
  component: aiComponentSchema,
  sources: z.array(aiCardSourceSchema).default([]),
  style: z
    .object({
      backgroundColor: z.string().optional(),
      borderColor: z.string().optional(),
      borderWidth: z.number().optional(),
    })
    .optional(),
  metadata: z
    .object({
      createdBy: z
        .union([z.literal('ai'), z.object({ id: z.string(), name: z.string() })])
        .default('ai'),
      locked: z.boolean().default(false),
      tags: z.array(z.string()).default([]),
      aiNotes: z.string().optional(),
    })
    .default({ createdBy: 'ai', locked: false, tags: [] }),
  zIndex: z.number().optional(),
});

const aiEdgeSchema = z.object({
  id: z.string().describe('Placeholder edge ID — the server will replace it'),
  source: z.string().describe('Source card ID (placeholder from this batch or existing server ID)'),
  target: z.string().describe('Target card ID (placeholder from this batch or existing server ID)'),
  label: z.string().optional(),
  strokeWidth: z.number().default(2),
});

const canvasOpInputSchema = z.discriminatedUnion('op', [
  z.object({ op: z.literal('add_card'), card: aiCardSchema }),
  z.object({ op: z.literal('remove_card'), cardId: z.string() }),
  z.object({
    op: z.literal('move_card'),
    cardId: z.string(),
    position: z.object({ x: z.number(), y: z.number() }).optional(),
    width: z.number().optional(),
    height: z.number().optional(),
  }),
  z.object({
    op: z.literal('update_component'),
    cardId: z.string(),
    componentId: z.string(),
    data: z.record(z.string(), z.unknown()),
  }),
  z.object({ op: z.literal('add_edge'), edge: aiEdgeSchema }),
  z.object({ op: z.literal('remove_edge'), edgeId: z.string() }),
]);

type CanvasOpInput = z.infer<typeof canvasOpInputSchema>;

type ResolveResult = { ok: true; id: string } | { ok: false; error: string };

const cardIdValidator = nonDbIdSchema('CanvasCard');
const edgeIdValidator = nonDbIdSchema('CanvasEdge');
const componentIdValidator = nonDbIdSchema('CanvasComponent');

function resolveCardId(id: string, idMap: Map<string, string>): ResolveResult {
  const mapped = idMap.get(id);
  if (mapped) return { ok: true, id: mapped };
  if (cardIdValidator.safeParse(id).success) return { ok: true, id };
  return {
    ok: false,
    error: `Invalid card ID "${id}" — not a placeholder from this batch and not a valid server ID`,
  };
}

function resolveEdgeId(id: string, idMap: Map<string, string>): ResolveResult {
  const mapped = idMap.get(id);
  if (mapped) return { ok: true, id: mapped };
  if (edgeIdValidator.safeParse(id).success) return { ok: true, id };
  return {
    ok: false,
    error: `Invalid edge ID "${id}" — not a placeholder from this batch and not a valid server ID`,
  };
}

function resolveComponentId(id: string, idMap: Map<string, string>): ResolveResult {
  const mapped = idMap.get(id);
  if (mapped) return { ok: true, id: mapped };
  if (componentIdValidator.safeParse(id).success) return { ok: true, id };
  return {
    ok: false,
    error: `Invalid component ID "${id}" — not a placeholder from this batch and not a valid server ID`,
  };
}

@Injectable()
export class CanvasTools {
  private readonly logger = new Logger(CanvasTools.name);

  constructor(@InjectQueue(CANVAS_OPS_QUEUE) private canvasQueue: Queue<CanvasOp>) {}

  create(threadId: DbId<'ChatThread'>, orgId: DbId<'Org'>) {
    const queue = this.canvasQueue;
    const logger = this.logger;

    const canvasUpdate = createTool({
      id: 'canvas_update',
      description:
        'Apply one or more canvas operations in a single batch. Use placeholder IDs for new cards/edges — the server replaces them with real IDs. Later operations in the same batch can reference placeholder IDs from earlier operations.',
      inputSchema: z.object({
        operations: z
          .array(canvasOpInputSchema)
          .describe('Ordered array of canvas operations to apply'),
      }),
      execute: async (input) => {
        logger.log(
          `[canvas_update] Executing ${input.operations.length} ops: ${input.operations.map((o) => o.op).join(', ')}`
        );
        const idMap = new Map<string, string>();
        const results: Array<Record<string, unknown>> = [];

        for (const op of input.operations) {
          const result = processOp(op, orgId, idMap, logger);
          if ('error' in result) {
            logger.error(`[canvas_update] Op "${op.op}" failed: ${result.error}`);
            return { error: result.error, results };
          }
          results.push(result);
        }

        // Parse results through the schema to get properly branded types
        try {
          const batchOps = results.map((r) => batchInnerOpSchema.parse(r));

          await queue.add(
            'batch',
            {
              type: 'batch',
              threadId,
              orgId,
              operations: batchOps,
            },
            { attempts: 1 }
          );
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          logger.error(`[canvas_update] Failed to queue batch: ${msg}`);
          return { error: `Internal error processing canvas update: ${msg}` };
        }

        logger.log(`[canvas_update] Queued ${results.length} ops successfully`);
        return { results };
      },
    });

    return {
      canvas_update: canvasUpdate,
    };
  }
}

function processOp(
  op: CanvasOpInput,
  orgId: DbId<'Org'>,
  idMap: Map<string, string>,
  logger: Logger
): Record<string, unknown> {
  switch (op.op) {
    case 'add_card': {
      const cardId = packNonDbId('CanvasCard', orgId);
      const componentId = packNonDbId('CanvasComponent', orgId);
      idMap.set(op.card.id, cardId);
      idMap.set(op.card.component.id, componentId);

      const rawCard = {
        ...op.card,
        id: cardId,
        component: {
          ...op.card.component,
          id: componentId,
        },
      };

      const parsed = cardSchema.safeParse(rawCard);
      if (!parsed.success) {
        logger.warn(`[canvas_update:add_card] Validation failed: ${parsed.error.message}`);
        return {
          error: `Invalid card data: ${parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ')}`,
        };
      }

      return { op: 'add_card', cards: [parsed.data] };
    }
    case 'remove_card': {
      const resolved = resolveCardId(op.cardId, idMap);
      if (!resolved.ok) return { error: resolved.error };
      return { op: 'remove_card', cardId: resolved.id };
    }
    case 'move_card': {
      const resolved = resolveCardId(op.cardId, idMap);
      if (!resolved.ok) return { error: resolved.error };
      return {
        op: 'move_card',
        cardId: resolved.id,
        position: op.position,
        width: op.width,
        height: op.height,
      };
    }
    case 'update_component': {
      const resolvedCard = resolveCardId(op.cardId, idMap);
      if (!resolvedCard.ok) return { error: resolvedCard.error };
      const resolvedComp = resolveComponentId(op.componentId, idMap);
      if (!resolvedComp.ok) return { error: resolvedComp.error };
      return {
        op: 'update_component',
        cardId: resolvedCard.id,
        componentId: resolvedComp.id,
        data: op.data,
      };
    }
    case 'add_edge': {
      const edgeId = packNonDbId('CanvasEdge', orgId);
      idMap.set(op.edge.id, edgeId);

      const resolvedSource = resolveCardId(op.edge.source, idMap);
      if (!resolvedSource.ok) return { error: resolvedSource.error };
      const resolvedTarget = resolveCardId(op.edge.target, idMap);
      if (!resolvedTarget.ok) return { error: resolvedTarget.error };

      const rawEdge = {
        ...op.edge,
        id: edgeId,
        source: resolvedSource.id,
        target: resolvedTarget.id,
      };

      const parsed = canvasEdgeSchema.safeParse(rawEdge);
      if (!parsed.success) {
        logger.warn(`[canvas_update:add_edge] Validation failed: ${parsed.error.message}`);
        return {
          error: `Invalid edge data: ${parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ')}`,
        };
      }

      return { op: 'add_edge', edge: parsed.data };
    }
    case 'remove_edge': {
      const resolved = resolveEdgeId(op.edgeId, idMap);
      if (!resolved.ok) return { error: resolved.error };
      return { op: 'remove_edge', edgeId: resolved.id };
    }
  }
}

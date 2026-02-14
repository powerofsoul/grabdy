import { Injectable, Logger } from '@nestjs/common';

import type { DbId } from '@grabdy/common';
import {
  nonDbIdSchema,
  packNonDbId,
} from '@grabdy/common';
import { canvasEdgeSchema, cardSchema } from '@grabdy/contracts';
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import { CanvasOpsService } from '../../queue/canvas-ops.service';

// ---------------------------------------------------------------------------
// AI-friendly input schemas
//
// The AI cannot generate packed UUIDs, so we accept z.string() for IDs that
// the server will replace. IDs of *existing* entities (remove, move, update)
// still use nonDbIdSchema because those values come from prior server output.
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
      }),
    )
    .optional(),
});

const aiCardSourceSchema = z.object({
  name: z.string(),
  score: z.number().optional(),
  chunkId: z.string().optional(),
  dataSourceId: z.string().optional(),
  collectionId: z.string().optional(),
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
      createdBy: z.union([z.literal('ai'), z.object({ id: z.string(), name: z.string() })]).default('ai'),
      locked: z.boolean().default(false),
      tags: z.array(z.string()).default([]),
      aiNotes: z.string().optional(),
    })
    .default({ createdBy: 'ai', locked: false, tags: [] }),
  zIndex: z.number().optional(),
});

const aiEdgeSchema = z.object({
  id: z.string().describe('Placeholder edge ID — the server will replace it'),
  source: z.string().describe('Source card ID (use the server-returned ID from canvas_add_card)'),
  target: z.string().describe('Target card ID (use the server-returned ID from canvas_add_card)'),
  label: z.string().optional(),
  strokeWidth: z.number().default(2),
});

@Injectable()
export class CanvasTools {
  private readonly logger = new Logger(CanvasTools.name);

  constructor(private canvasOps: CanvasOpsService) {}

  create(threadId: DbId<'ChatThread'>, orgId: DbId<'Org'>) {
    const canvasOps = this.canvasOps;
    const logger = this.logger;

    const addCard = createTool({
      id: 'canvas_add_card',
      description:
        'Add one or more cards to the canvas. Returns the created cards with server-generated IDs — use those IDs (not your input IDs) when calling canvas_add_edge to connect cards.',
      inputSchema: z.object({
        cards: z.array(aiCardSchema).describe('Array of cards to add to the canvas'),
      }),
      execute: async (input) => {
        // Replace AI-provided IDs with proper packed UUIDs
        const rawCards = input.cards.map((c) => ({
          ...c,
          id: packNonDbId('CanvasCard', orgId),
          component: {
            ...c.component,
            id: packNonDbId('CanvasComponent', orgId),
          },
        }));

        // Validate through the real schema to ensure correct component data
        const parsed = z.array(cardSchema).safeParse(rawCards);
        if (!parsed.success) {
          logger.warn(`[canvas_add_card] Validation failed: ${parsed.error.message}`);
          return { error: `Invalid card data: ${parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ')}` };
        }

        await canvasOps.execute({ type: 'add_card', threadId, orgId, cards: parsed.data });
        return { cards: parsed.data };
      },
    });

    const removeCard = createTool({
      id: 'canvas_remove_card',
      description: 'Remove a card from the canvas by its ID.',
      inputSchema: z.object({
        cardId: nonDbIdSchema('CanvasCard').describe('The ID of the card to remove'),
      }),
      execute: async (input) => {
        await canvasOps.execute({ type: 'remove_card', threadId, orgId, cardId: input.cardId });
        return { removed: true };
      },
    });

    const moveCard = createTool({
      id: 'canvas_move_card',
      description: 'Move or resize a card on the canvas.',
      inputSchema: z.object({
        cardId: nonDbIdSchema('CanvasCard').describe('The ID of the card to move'),
        position: z.object({ x: z.number(), y: z.number() }).optional(),
        width: z.number().optional(),
        height: z.number().optional(),
      }),
      execute: async (input) => {
        const state = await canvasOps.execute({
          type: 'move_card',
          threadId,
          orgId,
          cardId: input.cardId,
          position: input.position,
          width: input.width,
          height: input.height,
        });
        const card = state.cards.find((c) => c.id === input.cardId);
        return { cardId: input.cardId, position: card?.position };
      },
    });

    const updateComponent = createTool({
      id: 'canvas_update_component',
      description:
        "Update a card's component data. Merges the new data into the card's single component.",
      inputSchema: z.object({
        cardId: nonDbIdSchema('CanvasCard').describe('The ID of the card to update'),
        componentId: nonDbIdSchema('CanvasComponent').describe(
          'The ID of the component to update'
        ),
        data: z.record(z.string(), z.unknown()).describe('Data fields to merge into the component'),
      }),
      execute: async (input) => {
        const state = await canvasOps.execute({
          type: 'update_component',
          threadId,
          orgId,
          cardId: input.cardId,
          componentId: input.componentId,
          data: input.data,
        });
        const card = state.cards.find((c) => c.id === input.cardId);
        return { cardId: input.cardId, componentId: input.componentId, position: card?.position };
      },
    });

    const addEdge = createTool({
      id: 'canvas_add_edge',
      description:
        'Connect two cards with a visible edge/arrow. Use to show relationships, flow, or dependencies between cards.',
      inputSchema: z.object({
        edge: aiEdgeSchema.describe(
          'Edge object with id, source (card ID), target (card ID), optional label and strokeWidth'
        ),
      }),
      execute: async (input) => {
        const rawEdge = {
          ...input.edge,
          id: packNonDbId('CanvasEdge', orgId),
        };

        const parsed = canvasEdgeSchema.safeParse(rawEdge);
        if (!parsed.success) {
          logger.warn(`[canvas_add_edge] Validation failed: ${parsed.error.message}`);
          return { error: `Invalid edge data: ${parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ')}` };
        }

        await canvasOps.execute({ type: 'add_edge', threadId, orgId, edge: parsed.data });
        return { edge: parsed.data };
      },
    });

    const removeEdge = createTool({
      id: 'canvas_remove_edge',
      description: 'Remove a connection/edge between two cards.',
      inputSchema: z.object({
        edgeId: nonDbIdSchema('CanvasEdge').describe('The ID of the edge to remove'),
      }),
      execute: async (input) => {
        await canvasOps.execute({ type: 'delete_edge', threadId, orgId, edgeId: input.edgeId });
        return { removed: true };
      },
    });

    return {
      canvas_add_card: addCard,
      canvas_remove_card: removeCard,
      canvas_move_card: moveCard,
      canvas_update_component: updateComponent,
      canvas_add_edge: addEdge,
      canvas_remove_edge: removeEdge,
    };
  }
}

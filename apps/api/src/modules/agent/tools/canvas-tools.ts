import { Injectable } from '@nestjs/common';

import type { DbId } from '@grabdy/common';
import {
  nonDbIdSchema,
  packNonDbId,
} from '@grabdy/common';
import { canvasEdgeSchema, cardSchema } from '@grabdy/contracts';
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import { CanvasOpsService } from '../../queue/canvas-ops.service';

@Injectable()
export class CanvasTools {
  constructor(private canvasOps: CanvasOpsService) {}

  create(threadId: DbId<'ChatThread'>, orgId: DbId<'Org'>) {
    const canvasOps = this.canvasOps;

    const addCard = createTool({
      id: 'canvas_add_card',
      description:
        'Add one or more cards to the canvas. Returns the created cards with server-generated IDs — use those IDs (not your input IDs) when calling canvas_add_edge to connect cards.',
      inputSchema: z.object({
        cards: z.array(cardSchema).describe('Array of cards to add to the canvas'),
      }),
      execute: async (input) => {
        // Replace AI-provided ids with proper packed UUIDs
        const cards = input.cards.map((c) => ({
          ...c,
          id: packNonDbId('CanvasCard', orgId),
        }));
        await canvasOps.execute({ type: 'add_card', threadId, orgId, cards });
        return { cards };
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
        edge: canvasEdgeSchema.describe(
          'Edge object with id, source (card ID), target (card ID), optional label and strokeWidth'
        ),
      }),
      execute: async (input) => {
        const edge = { ...input.edge, id: packNonDbId('CanvasEdge', orgId) };
        await canvasOps.execute({ type: 'add_edge', threadId, orgId, edge });
        return { edge };
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

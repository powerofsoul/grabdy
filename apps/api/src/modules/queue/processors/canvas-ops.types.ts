import { dbIdSchema, nonDbIdSchema } from '@grabdy/common';
import { canvasEdgeSchema, cardSchema } from '@grabdy/contracts';
import { z } from 'zod';

const sharedFields = {
  threadId: dbIdSchema('ChatThread'),
  orgId: dbIdSchema('Org').optional(),
};

export const canvasOpSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('add_card'), ...sharedFields, cards: z.array(cardSchema) }),
  z.object({
    type: z.literal('remove_card'),
    ...sharedFields,
    cardId: nonDbIdSchema('CanvasCard'),
  }),
  z.object({
    type: z.literal('move_card'),
    ...sharedFields,
    cardId: nonDbIdSchema('CanvasCard'),
    position: z.object({ x: z.number(), y: z.number() }).optional(),
    width: z.number().optional(),
    height: z.number().optional(),
    title: z.string().optional(),
    zIndex: z.number().optional(),
  }),
  z.object({ type: z.literal('update_edges'), ...sharedFields, edges: z.array(canvasEdgeSchema) }),
  z.object({ type: z.literal('add_edge'), ...sharedFields, edge: canvasEdgeSchema }),
  z.object({
    type: z.literal('delete_edge'),
    ...sharedFields,
    edgeId: nonDbIdSchema('CanvasEdge'),
  }),
  z.object({
    type: z.literal('update_component'),
    ...sharedFields,
    cardId: nonDbIdSchema('CanvasCard'),
    componentId: nonDbIdSchema('CanvasComponent'),
    data: z.record(z.string(), z.unknown()),
  }),
]);

export type CanvasOp = z.output<typeof canvasOpSchema>;

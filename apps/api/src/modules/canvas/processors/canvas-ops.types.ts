import { dbIdSchema, nonDbIdSchema } from '@grabdy/common';
import { canvasEdgeSchema, cardSchema } from '@grabdy/contracts';
import { z } from 'zod';

const sharedFields = {
  threadId: dbIdSchema('ChatThread'),
  orgId: dbIdSchema('Org'),
};

// Inner operations used within a batch (keyed on `op`, no threadId/orgId)
export const batchInnerOpSchema = z.discriminatedUnion('op', [
  z.object({ op: z.literal('add_card'), cards: z.array(cardSchema) }),
  z.object({ op: z.literal('remove_card'), cardId: nonDbIdSchema('CanvasCard') }),
  z.object({
    op: z.literal('move_card'),
    cardId: nonDbIdSchema('CanvasCard'),
    position: z.object({ x: z.number(), y: z.number() }).optional(),
    width: z.number().optional(),
    height: z.number().optional(),
  }),
  z.object({
    op: z.literal('update_component'),
    cardId: nonDbIdSchema('CanvasCard'),
    componentId: nonDbIdSchema('CanvasComponent'),
    data: z.record(z.string(), z.unknown()),
  }),
  z.object({ op: z.literal('add_edge'), edge: canvasEdgeSchema }),
  z.object({ op: z.literal('remove_edge'), edgeId: nonDbIdSchema('CanvasEdge') }),
]);

export type BatchInnerOp = z.output<typeof batchInnerOpSchema>;
export type CanvasOpName = BatchInnerOp['op'];

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
  z.object({
    type: z.literal('batch'),
    ...sharedFields,
    operations: z.array(batchInnerOpSchema),
  }),
]);

export type CanvasOp = z.output<typeof canvasOpSchema>;

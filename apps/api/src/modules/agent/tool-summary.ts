import { dbIdSchema } from '@grabdy/common';
import { z } from 'zod';

// ---------------------------------------------------------------------------
// Canvas tool names
// ---------------------------------------------------------------------------

export const CANVAS_TOOL_NAMES = [
  'canvas_add_card',
  'canvas_remove_card',
  'canvas_move_card',
  'canvas_update_component',
  'canvas_add_edge',
  'canvas_remove_edge',
] as const;

export type CanvasToolName = (typeof CANVAS_TOOL_NAMES)[number];

export const CANVAS_TOOL_NAME_SET = new Set<string>(CANVAS_TOOL_NAMES);

// ---------------------------------------------------------------------------
// Zod schemas for tool result parsing
// ---------------------------------------------------------------------------

export const ragResultItemSchema = z.object({
  dataSourceId: dbIdSchema('DataSource'),
  dataSourceName: z.string(),
  score: z.number(),
  metadata: z.object({ pages: z.array(z.number()).optional() }).passthrough().optional(),
});

export const ragResultsSchema = z.object({ results: z.array(z.unknown()) });
export const ragSearchArgsSchema = z.object({ query: z.string() });
export const canvasCardsSchema = z.object({ cards: z.array(z.unknown()) });

// ---------------------------------------------------------------------------
// Tool call summarization — describes what was done, not what was found
// ---------------------------------------------------------------------------

function isCanvasToolName(name: string): name is CanvasToolName {
  return CANVAS_TOOL_NAME_SET.has(name);
}

const TOOL_SUMMARIES: Record<CanvasToolName, string> = {
  canvas_add_card: 'Card created',
  canvas_remove_card: 'Card removed',
  canvas_move_card: 'Card repositioned',
  canvas_update_component: 'Card updated',
  canvas_add_edge: 'Connection added',
  canvas_remove_edge: 'Connection removed',
};

export function summarizeToolCall(toolName: string, args: unknown, result: unknown): string {
  if (toolName === 'rag-search') {
    const parsed = ragSearchArgsSchema.safeParse(args);
    return parsed.success ? `Searched "${parsed.data.query}"` : 'Searched knowledge base';
  }
  if (toolName === 'canvas_add_card') {
    const parsed = canvasCardsSchema.safeParse(result);
    if (!parsed.success) return 'Card created';
    return parsed.data.cards.length === 1 ? 'Card created' : `${parsed.data.cards.length} cards created`;
  }
  if (isCanvasToolName(toolName)) {
    return TOOL_SUMMARIES[toolName];
  }
  return 'Done';
}

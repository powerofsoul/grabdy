import type { CanvasEdge, CanvasState, Card, CardSource, ChatSource, DataSourceType } from '@grabdy/contracts';
import { chatSourceSchema } from '@grabdy/contracts';
import type { Edge, Node } from '@xyflow/react';

function assertNever(value: never): never {
  throw new Error(`Unhandled data source type: ${value}`);
}

/**
 * Build the type-specific extra fields for a ChatSource from a CardSource.
 * Uses an exhaustive switch so adding a new DataSourceType without handling it here causes a compile error.
 */
function chatSourceExtras(type: DataSourceType, s: CardSource): Record<string, unknown> {
  switch (type) {
    case 'PDF':
    case 'DOCX':
      return { pages: s.pages ?? [] };
    case 'XLSX':
      return { sheet: s.sheet ?? '', rows: s.rows ?? [], columns: s.columns ?? [] };
    case 'CSV':
      return { rows: s.rows ?? [], columns: s.columns ?? [] };
    case 'CODE_REPO':
      return { filePath: s.filePath, docPageId: s.docPageId, docPageTitle: s.docPageTitle };
    case 'TXT':
    case 'JSON':
    case 'IMAGE':
    case 'SLACK':
    case 'LINEAR':
    case 'GITHUB':
    case 'NOTION':
      return {};
    default:
      return assertNever(type);
  }
}

/** Convert CardSource[] to ChatSource[], validating each through chatSourceSchema. */
export function cardSourcesToChat(sources: CardSource[]): ChatSource[] {
  const result: ChatSource[] = [];
  for (const s of sources) {
    if (!s.dataSourceId || !s.type) continue;
    const base = {
      dataSourceId: s.dataSourceId,
      dataSourceName: s.name,
      score: s.score ?? 0,
      type: s.type,
      sourceUrl: s.sourceUrl,
    };
    const extras = chatSourceExtras(s.type, s);
    const parsed = chatSourceSchema.safeParse({ ...base, ...extras });
    if (parsed.success) result.push(parsed.data);
  }
  return result;
}

/** Merge partial data into a component while preserving its discriminated union type. */
export function mergeComponentData<T extends Card['component']>(
  component: T,
  data: Record<string, unknown>
): T {
  return { ...component, data: { ...component.data, ...data } };
}

export const EMPTY_CANVAS: CanvasState = {
  version: 1,
  viewport: { x: 0, y: 0, zoom: 1 },
  cards: [],
  edges: [],
};

export function cardToNode(card: Card): Node {
  return {
    id: card.id,
    type: 'card',
    position: card.position,
    data: card,
    style: { width: card.width },
    zIndex: card.zIndex,
  };
}

export function canvasEdgeToReactFlowEdge(edge: CanvasEdge): Edge {
  return {
    id: edge.id,
    type: 'custom',
    source: edge.source,
    target: edge.target,
    label: edge.label,
    data: {
      strokeWidth: edge.strokeWidth ?? 2,
    },
  };
}

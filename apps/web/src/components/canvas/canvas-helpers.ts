import type { CanvasEdge, CanvasState, Card } from '@grabdy/contracts';
import type { Edge, Node } from '@xyflow/react';

/** Merge partial data into a component while preserving its discriminated union type. */
export function mergeComponentData<T extends Card['component']>(component: T, data: Record<string, unknown>): T {
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

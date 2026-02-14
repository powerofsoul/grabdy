import type { NonDbId } from '@grabdy/common';
import type { Card } from '@grabdy/contracts';

export function findAndUpdateComponent(
  card: Card,
  componentKey: NonDbId<'CanvasComponent'>,
  data: Record<string, unknown>
): boolean {
  if (card.component.id === componentKey) {
    Object.assign(card.component.data, data);
    return true;
  }
  return false;
}

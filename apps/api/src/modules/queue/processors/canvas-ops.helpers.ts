import type { Card } from '@grabdy/contracts';

export function findAndUpdateComponent(
  card: Card,
  componentId: string,
  data: Record<string, unknown>
): boolean {
  if (card.component.id === componentId) {
    Object.assign(card.component.data, data);
    return true;
  }
  return false;
}

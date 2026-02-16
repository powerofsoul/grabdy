import { NODE_H, NODE_W } from './constants';
import type { HeroCardId } from './types';

export function edgePath(pos: Record<HeroCardId, { x: number; y: number }>, from: HeroCardId, to: HeroCardId, heights?: Partial<Record<HeroCardId, number>>): string {
  const f = pos[from];
  const t = pos[to];
  if (!f || !t) return '';

  const fw = NODE_W[from],
    fh = heights?.[from] ?? NODE_H[from];
  const tw = NODE_W[to],
    th = heights?.[to] ?? NODE_H[to];

  // Centers
  const fcx = f.x + fw / 2,
    fcy = f.y + fh / 2;
  const tcx = t.x + tw / 2,
    tcy = t.y + th / 2;
  const dx = tcx - fcx,
    dy = tcy - fcy;

  let x0: number, y0: number, x1: number, y1: number;
  let cx0: number, cy0: number, cx1: number, cy1: number;

  if (Math.abs(dy) > Math.abs(dx) * 0.6) {
    // Mostly vertical — exit bottom, enter top
    x0 = f.x + fw / 2;
    y0 = f.y + fh;
    x1 = t.x + tw / 2;
    y1 = t.y;
    const offset = Math.abs(y1 - y0) * 0.45;
    cx0 = x0;
    cy0 = y0 + offset;
    cx1 = x1;
    cy1 = y1 - offset;
  } else {
    // Mostly horizontal — exit right/left side, enter opposite side
    if (dx > 0) {
      // Target is to the right
      x0 = f.x + fw;
      y0 = fcy;
      x1 = t.x;
      y1 = tcy;
    } else {
      // Target is to the left
      x0 = f.x;
      y0 = fcy;
      x1 = t.x + tw;
      y1 = tcy;
    }
    const offset = Math.abs(x1 - x0) * 0.4;
    cx0 = dx > 0 ? x0 + offset : x0 - offset;
    cy0 = y0;
    cx1 = dx > 0 ? x1 - offset : x1 + offset;
    cy1 = y1;
  }

  return `M ${x0},${y0} C ${cx0},${cy0} ${cx1},${cy1} ${x1},${y1}`;
}

export function edgeEndpoints(
  pos: Record<HeroCardId, { x: number; y: number }>,
  from: HeroCardId,
  to: HeroCardId,
  heights?: Partial<Record<HeroCardId, number>>
): { x0: number; y0: number; x1: number; y1: number } | null {
  const f = pos[from];
  const t = pos[to];
  if (!f || !t) return null;

  const fw = NODE_W[from],
    fh = heights?.[from] ?? NODE_H[from];
  const tw = NODE_W[to],
    th = heights?.[to] ?? NODE_H[to];
  const fcx = f.x + fw / 2,
    fcy = f.y + fh / 2;
  const tcx = t.x + tw / 2,
    tcy = t.y + th / 2;
  const dx = tcx - fcx,
    dy = tcy - fcy;

  if (Math.abs(dy) > Math.abs(dx) * 0.6) {
    return { x0: f.x + fw / 2, y0: f.y + fh, x1: t.x + tw / 2, y1: t.y };
  }
  if (dx > 0) {
    return { x0: f.x + fw, y0: fcy, x1: t.x, y1: tcy };
  }
  return { x0: f.x, y0: fcy, x1: t.x + tw, y1: tcy };
}

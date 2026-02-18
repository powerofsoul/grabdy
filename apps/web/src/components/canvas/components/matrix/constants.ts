export const QUADRANT_KEYS = ['topLeft', 'topRight', 'bottomLeft', 'bottomRight'] as const;

interface QuadrantData {
  topLeft: string[];
  topRight: string[];
  bottomLeft: string[];
  bottomRight: string[];
}

export const QUADRANT_PALETTE_KEYS: Record<
  keyof QuadrantData,
  'info' | 'success' | 'warning' | 'error'
> = {
  topLeft: 'info',
  topRight: 'success',
  bottomLeft: 'warning',
  bottomRight: 'error',
};

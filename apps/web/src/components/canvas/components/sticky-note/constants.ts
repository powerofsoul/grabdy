export type StickyNoteColor = 'yellow' | 'pink' | 'blue' | 'green' | 'purple' | 'orange';

// Sticky note background palette — intentionally hardcoded (not UI chrome)
export const COLOR_MAP: Record<StickyNoteColor, string> = {
  yellow: '#ffecb3',
  pink: '#fce4ec',
  blue: '#e3f2fd',
  green: '#e8f5e9',
  purple: '#f3e5f5',
  orange: '#fff3e0',
};

export const COLOR_OPTIONS = [
  'yellow',
  'pink',
  'blue',
  'green',
  'purple',
  'orange',
] as const satisfies readonly StickyNoteColor[];

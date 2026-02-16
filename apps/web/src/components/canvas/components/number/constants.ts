export type SizeOption = 'sm' | 'md' | 'lg';

export const SIZE_FONT_MAP = { sm: 24, md: 36, lg: 48 } as const;
export const AFFIX_RATIO = 0.4;

export const SIZE_OPTIONS = [
  { value: 'sm', label: 'Small' },
  { value: 'md', label: 'Medium' },
  { value: 'lg', label: 'Large' },
] as const;

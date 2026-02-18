/**
 * Resolve a CSS color name to a hex value that MUI's `alpha()` can handle.
 * AI-generated data often contains CSS named colors like "blue" or "red",
 * which MUI's color utilities don't support — they require #hex, rgb(), etc.
 */

const CSS_COLOR_NAMES = [
  'red',
  'pink',
  'purple',
  'blue',
  'lightblue',
  'cyan',
  'teal',
  'green',
  'lightgreen',
  'lime',
  'yellow',
  'amber',
  'orange',
  'brown',
  'grey',
  'gray',
  'black',
  'white',
  'indigo',
] as const;

type CssColorName = (typeof CSS_COLOR_NAMES)[number];

const CSS_COLOR_TO_HEX: Record<CssColorName, string> = {
  red: '#f44336',
  pink: '#e91e63',
  purple: '#9c27b0',
  blue: '#2196f3',
  lightblue: '#03a9f4',
  cyan: '#00bcd4',
  teal: '#009688',
  green: '#4caf50',
  lightgreen: '#8bc34a',
  lime: '#cddc39',
  yellow: '#ffeb3b',
  amber: '#ffc107',
  orange: '#ff9800',
  brown: '#795548',
  grey: '#9e9e9e',
  gray: '#9e9e9e',
  black: '#000000',
  white: '#ffffff',
  indigo: '#3f51b5',
};

const HEX_RE = /^#([0-9a-f]{3,8})$/i;
const FUNC_RE = /^(rgb|rgba|hsl|hsla|color)\(/i;

export function resolveColor(color: string | undefined, fallback: string): string {
  if (!color) return fallback;
  // Already a valid MUI-compatible format
  if (HEX_RE.test(color) || FUNC_RE.test(color)) return color;
  // CSS named color — .find() narrows from string to CssColorName
  const lower = color.toLowerCase();
  const matched = CSS_COLOR_NAMES.find((n) => n === lower);
  return matched ? CSS_COLOR_TO_HEX[matched] : fallback;
}

import type { ReactNode } from 'react';

export const LANGUAGES = [
  '', 'bash', 'c', 'cpp', 'csharp', 'css', 'dart', 'diff', 'dockerfile',
  'elixir', 'erlang', 'go', 'graphql', 'haskell', 'html', 'java',
  'javascript', 'json', 'kotlin', 'lua', 'makefile', 'markdown', 'nginx',
  'perl', 'php', 'python', 'r', 'ruby', 'rust', 'scala', 'scss', 'shell',
  'sql', 'swift', 'terraform', 'toml', 'typescript', 'xml', 'yaml', 'zig',
] as const;

export interface HastNode {
  type: string;
  tagName?: string;
  properties?: Record<string, unknown>;
  children?: HastNode[];
  value?: string;
}

export function hastToReact(node: HastNode, key?: number): ReactNode {
  if (node.type === 'text') {
    return node.value ?? '';
  }
  if (node.type === 'element' && node.tagName) {
    const classNames = node.properties?.className;
    const className = Array.isArray(classNames)
      ? classNames.filter((c): c is string => typeof c === 'string').join(' ')
      : undefined;
    const children = node.children?.map((child, i) => hastToReact(child, i));
    return <span key={key} className={className}>{children}</span>;
  }
  if (node.type === 'root' && node.children) {
    return <>{node.children.map((child, i) => hastToReact(child, i))}</>;
  }
  return null;
}

export const CODE_FONT = '"Fira Code", "Cascadia Code", "JetBrains Mono", monospace';
export const CODE_FONT_SIZE = 12;
export const CODE_LINE_HEIGHT = 1.7;

export const HIGHLIGHT_SX_DARK = {
  '& .hljs-keyword': { color: '#c678dd' },
  '& .hljs-string': { color: '#98c379' },
  '& .hljs-number': { color: '#d19a66' },
  '& .hljs-comment': { color: '#5c6370', fontStyle: 'italic' },
  '& .hljs-function': { color: '#61afef' },
  '& .hljs-title': { color: '#61afef' },
  '& .hljs-params': { color: '#abb2bf' },
  '& .hljs-built_in': { color: '#e6c07b' },
  '& .hljs-literal': { color: '#56b6c2' },
  '& .hljs-type': { color: '#e6c07b' },
  '& .hljs-attr': { color: '#d19a66' },
  '& .hljs-selector-class': { color: '#d19a66' },
  '& .hljs-selector-tag': { color: '#e06c75' },
  '& .hljs-tag': { color: '#e06c75' },
  '& .hljs-name': { color: '#e06c75' },
  '& .hljs-variable': { color: '#e06c75' },
  '& .hljs-meta': { color: '#61afef' },
  '& .hljs-property': { color: '#e06c75' },
  '& .hljs-punctuation': { color: '#abb2bf' },
} as const;

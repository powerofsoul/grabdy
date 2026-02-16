import { createElement } from 'react';

import { getFileIcon } from './helpers';

export function FileIcon({ name, size }: { name: string; size: number }) {
  return createElement(getFileIcon(name), {
    size,
    weight: 'light',
    style: { flexShrink: 0, opacity: 0.5 },
  });
}

import { useCallback } from 'react';

import { dbIdSchema } from '@grabdy/common';
import type { ChatSource } from '@grabdy/contracts';

import { DocumentPreviewDrawer } from '../DocumentPreviewDrawer';

import { isExternalSource } from './helpers';

import { useDrawer } from '@/context/DrawerContext';

export function useOpenSource() {
  const { pushDrawer } = useDrawer();

  return useCallback(
    (source: ChatSource) => {
      // External sources (integrations) open their URL in a new tab
      if (isExternalSource(source.type) && source.sourceUrl) {
        window.open(source.sourceUrl, '_blank', 'noopener,noreferrer');
        return;
      }
      // Uploaded files open the preview drawer
      const parsed = dbIdSchema('DataSource').safeParse(source.dataSourceId);
      if (!parsed.success) return;
      pushDrawer(
        (onClose) => <DocumentPreviewDrawer onClose={onClose} dataSourceId={parsed.data} />,
        { title: source.dataSourceName, mode: 'dialog', maxWidth: 'lg' }
      );
    },
    [pushDrawer]
  );
}

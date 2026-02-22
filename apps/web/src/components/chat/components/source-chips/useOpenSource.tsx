import { useCallback } from 'react';

import { dbIdSchema } from '@grabdy/common';
import type { ChatSource } from '@grabdy/contracts';

import { DocPagePreviewDrawer } from '../DocPagePreviewDrawer';
import { DocumentPreviewDrawer } from '../DocumentPreviewDrawer';

import { isExternalSource } from './helpers';

import { useDrawer } from '@/context/DrawerContext';

export function useOpenSource() {
  const { pushDrawer } = useDrawer();

  return useCallback(
    (source: ChatSource) => {
      // CODE_REPO doc pages open in a preview drawer
      if (source.type === 'CODE_REPO' && source.docPageId) {
        const parsedDs = dbIdSchema('DataSource').safeParse(source.dataSourceId);
        const parsedPage = dbIdSchema('DocPage').safeParse(source.docPageId);
        if (!parsedDs.success || !parsedPage.success) return;
        pushDrawer(
          (onClose) => (
            <DocPagePreviewDrawer
              onClose={onClose}
              dataSourceId={parsedDs.data}
              docPageId={parsedPage.data}
            />
          ),
          {
            title: source.docPageTitle ?? source.dataSourceName,
            mode: 'dialog',
            maxWidth: 'lg',
          }
        );
        return;
      }
      // CODE_REPO code files open on GitHub
      if (source.type === 'CODE_REPO' && source.filePath) {
        if (source.sourceUrl) {
          window.open(source.sourceUrl, '_blank', 'noopener,noreferrer');
        }
        return;
      }
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

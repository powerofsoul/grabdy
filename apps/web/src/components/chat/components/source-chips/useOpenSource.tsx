import { useCallback } from 'react';

import { dbIdSchema } from '@grabdy/common';
import type { ChatSource } from '@grabdy/contracts';

import { DocumentPreviewDrawer } from '../document-preview';
import { PdfPageViewer } from '../pdf-page-viewer';

import { useDrawer } from '@/context/DrawerContext';

export function useOpenSource() {
  const { pushDrawer } = useDrawer();

  return useCallback(
    (source: ChatSource) => {
      // PDF sources with page info open the page-level viewer
      if (source.type === 'PDF' && source.pages.length > 0) {
        const parsed = dbIdSchema('DataSource').safeParse(source.dataSourceId);
        if (!parsed.success) return;
        pushDrawer(
          (onClose) => (
            <PdfPageViewer
              onClose={onClose}
              dataSourceId={parsed.data}
              initialPage={source.pages[0]}
            />
          ),
          { title: source.dataSourceName, mode: 'dialog', maxWidth: 'md' }
        );
        return;
      }

      // File sources open the preview drawer
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

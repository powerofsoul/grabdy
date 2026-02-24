import { useCallback } from 'react';

import { dbIdSchema } from '@grabdy/common';
import type { ChatSource } from '@grabdy/contracts';

import { DocumentPreviewDrawer } from '../document-preview';
import { PdfPageViewer } from '../pdf-page-viewer';

import { isExternalSource } from './helpers';

import { useIsEmbed } from '@/components/embed-chat/context';
import type { EmbedSource } from '@/components/embed-chat/types';
import { postToParent } from '@/components/embed-chat/types';
import { useDrawer } from '@/context/DrawerContext';

function toEmbedSource(source: ChatSource): EmbedSource {
  return {
    type: source.type,
    dataSourceId: source.dataSourceId,
    dataSourceName: source.dataSourceName,
    sourceUrl: source.sourceUrl ?? null,
    ...('pages' in source ? { pages: source.pages } : {}),
  };
}

export function useOpenSource() {
  const { pushDrawer } = useDrawer();
  const isEmbed = useIsEmbed();

  return useCallback(
    (source: ChatSource) => {
      // In embed mode, post to parent so the host page can show a preview
      if (isEmbed) {
        postToParent({ type: 'OPEN_SOURCE', source: toEmbedSource(source) });
        return;
      }

      // External sources (integrations) open their URL in a new tab
      if (isExternalSource(source.type) && source.sourceUrl) {
        window.open(source.sourceUrl, '_blank', 'noopener,noreferrer');
        return;
      }

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

      // Uploaded files open the preview drawer
      const parsed = dbIdSchema('DataSource').safeParse(source.dataSourceId);
      if (!parsed.success) return;
      pushDrawer(
        (onClose) => <DocumentPreviewDrawer onClose={onClose} dataSourceId={parsed.data} />,
        { title: source.dataSourceName, mode: 'dialog', maxWidth: 'lg' }
      );
    },
    [pushDrawer, isEmbed]
  );
}

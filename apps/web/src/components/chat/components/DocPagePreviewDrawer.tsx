import Markdown from 'react-markdown';

import type { DbId } from '@grabdy/common';
import { Box, CircularProgress, Typography } from '@mui/material';
import rehypeHighlight from 'rehype-highlight';
import remarkGfm from 'remark-gfm';

import { useDocPage } from '@/components/code-repos/doc-pages/hooks/useDocPage';
import { docPageMarkdownStyles } from '@/components/code-repos/doc-pages/styles';
import { useAuth } from '@/context/AuthContext';
import type { DrawerProps } from '@/context/DrawerContext';

interface DocPagePreviewDrawerProps extends DrawerProps {
  dataSourceId: DbId<'DataSource'>;
  docPageId: DbId<'DocPage'>;
}

export function DocPagePreviewDrawer({ dataSourceId, docPageId }: DocPagePreviewDrawerProps) {
  const { selectedOrgId } = useAuth();
  const { page, loading } = useDocPage(selectedOrgId, dataSourceId, docPageId);

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', flex: 1, p: 4 }}>
        <CircularProgress size={28} />
      </Box>
    );
  }

  if (!page) {
    return (
      <Box sx={{ p: 3 }}>
        <Typography color="error">Doc page not found</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ flex: 1, overflow: 'auto', p: 3, ...docPageMarkdownStyles }}>
      <Markdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeHighlight]}>
        {page.content}
      </Markdown>
    </Box>
  );
}

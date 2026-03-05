import type { DbId } from '@grabdy/common';

import type { TreeNode } from '@/components/ui/Sidebar/helpers';

export interface DataSourceItem {
  id: DbId<'DataSource'>;
  title: string;
}

export type CollectionOption = TreeNode<{
  id: DbId<'Collection'>;
  name: string;
  parentId: DbId<'Collection'> | null;
  sourceCount: number;
}>;

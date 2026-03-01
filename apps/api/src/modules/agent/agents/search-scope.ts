import type { DbId } from '@grabdy/common';

type SearchScope =
  | { type: 'all' }
  | {
      type: 'scoped';
      collectionIds: DbId<'Collection'>[];
      dataSourceIds: DbId<'DataSource'>[];
      connectionIds: DbId<'Connection'>[];
    }
  | { type: 'none' };

export type { SearchScope };

import type { DbId } from '@grabdy/common';

type ConnectionResource = { connectionId: DbId<'Connection'>; githubRepo: string };

type SearchScope =
  | { type: 'all' }
  | {
      type: 'scoped';
      collectionIds: DbId<'Collection'>[];
      dataSourceIds: DbId<'DataSource'>[];
      connectionIds: DbId<'Connection'>[];
      connectionResources: ConnectionResource[];
    }
  | { type: 'none' };

export type { ConnectionResource, SearchScope };

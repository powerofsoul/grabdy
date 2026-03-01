import type { DbId } from '@grabdy/common';
import type { IntegrationProvider } from '@grabdy/contracts';

export interface DataSourceItem {
  id: DbId<'DataSource'>;
  title: string;
}

export interface CollectionOption {
  id: DbId<'Collection'>;
  name: string;
  dataSources: DataSourceItem[];
}

export interface IntegrationSection {
  connectionId: DbId<'Connection'>;
  provider: IntegrationProvider;
  dataSources: DataSourceItem[];
}

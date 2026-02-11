import { Box, useMediaQuery, useTheme } from '@mui/material';

import { DesktopTable } from './DesktopTable';
import { MobileLayout } from './MobileLayout';
import type {
  ClientSortingConfig,
  ExpandableConfig,
  ExtractEndpointItem,
  SortDirection,
} from './types';
import { useMainTableState } from './useMainTableState';

interface ItemProps<T, K extends Record<string, string>> {
  headerNames: K;
  headerIcons?: Partial<Record<keyof K, React.ReactNode>>;
  noWrap?: (keyof K & string)[];
  columnWidths?: Partial<Record<keyof K & string, number | string>>;
  rowTitle: (item: T) => string | React.ReactNode;
  renderItems: { [P in keyof K]: (item: T) => string | React.ReactNode };
  keyExtractor: (item: T) => string;
  onRowClick?: (item: T) => void;
  expandable?: ExpandableConfig<T>;
  /** Custom empty state to show when there's no data */
  emptyState?: React.ReactNode;
}

interface DataModeProps<T, K extends Record<string, string>> extends ItemProps<T, K> {
  data: T[];
  sorting?: ClientSortingConfig<T, keyof K & string>;
  endpoint?: undefined;
}

interface EndpointModeProps<T, K extends Record<string, string>, TEndpoint> extends ItemProps<
  T,
  K
> {
  endpoint: TEndpoint;
  endpointParams: Record<string, unknown>;
  queryKey: readonly unknown[];
  queryParams?: Record<string, unknown>;
  sortableColumns?: readonly (keyof K & string)[];
  defaultSortBy?: keyof K & string;
  defaultSortOrder?: SortDirection;
  defaultLimit?: number;
  enabled?: boolean;
  data?: undefined;
}

type MainTableProps<K extends Record<string, string>> =
  | DataModeProps<unknown, K>
  | EndpointModeProps<unknown, K, unknown>;

export function MainTable<
  TEndpoint extends (arg: never) => Promise<unknown>,
  K extends Record<string, string>,
>(props: EndpointModeProps<ExtractEndpointItem<TEndpoint>, K, TEndpoint>): React.ReactElement;

export function MainTable<T, K extends Record<string, string>>(
  props: DataModeProps<T, K>
): React.ReactElement;

export function MainTable<K extends Record<string, string>>(
  props: MainTableProps<K>
): React.ReactElement {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  const state = useMainTableState(props, isMobile);

  const header = {
    names: props.headerNames,
    icons: props.headerIcons,
  };

  const columns = {
    widths: props.columnWidths,
    noWrap: props.noWrap,
  };

  const render = {
    items: props.renderItems,
    rowTitle: props.rowTitle,
    keyExtractor: props.keyExtractor,
  };

  const interaction = {
    onRowClick: props.onRowClick,
    expandable: props.expandable,
  };

  // Show empty state when no data and not loading
  if (state.items.length === 0 && !state.isLoading && props.emptyState) {
    return <>{props.emptyState}</>;
  }

  // Mobile uses natural page scrolling, desktop uses flex container
  return (
    <Box
      sx={
        isMobile
          ? undefined
          : { flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }
      }
    >
      {isMobile ? (
        <MobileLayout
          data={state.items}
          header={header}
          columns={columns}
          render={render}
          interaction={interaction}
          pagination={state.pagination}
          expansion={state.expansion}
          isLoading={state.isLoading}
        />
      ) : (
        <DesktopTable
          data={state.items}
          header={header}
          columns={columns}
          render={render}
          interaction={interaction}
          sorting={state.sorting}
          pagination={state.pagination}
          expansion={state.expansion}
        />
      )}
    </Box>
  );
}

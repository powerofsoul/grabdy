export type SortDirection = 'asc' | 'desc';

export interface ExpandableConfig<T> {
  renderExpanded: (item: T) => React.ReactNode;
}

/** Grouped pagination state for internal components */
export interface PaginationState {
  page: number;
  rowsPerPage: number;
  totalCount: number;
  hasPagination: boolean;
  onPageChange: (event: React.MouseEvent<HTMLButtonElement> | null, newPage: number) => void;
  onRowsPerPageChange: (newRowsPerPage: number) => void;
}

/** Grouped sorting state for internal components */
export interface SortingState {
  column: string | null;
  direction: SortDirection;
  sortableColumns: readonly string[];
  onSort: (column: string) => void;
}

/** Grouped expansion state for internal components */
export interface ExpansionState {
  expandedRows: Set<string>;
  toggleExpanded: (key: string) => void;
}

/** Header configuration for internal components */
export interface HeaderConfig {
  names: Record<string, string>;
  icons?: Record<string, React.ReactNode>;
}

/** Column configuration for internal components */
export interface ColumnConfig {
  widths?: Partial<Record<string, number | string>>;
  noWrap?: string[];
}

/** Render configuration for internal components */
export interface RenderConfig<T> {
  items: Record<string, (item: T) => string | React.ReactNode>;
  rowTitle: (item: T) => string | React.ReactNode;
  keyExtractor: (item: T) => string;
}

/** Interaction configuration for internal components */
export interface InteractionConfig<T> {
  onRowClick?: (item: T) => void;
  expandable?: ExpandableConfig<T>;
}

// =============================================================================
// Type helpers for ts-rest endpoint extraction
// =============================================================================

/** Standard paginated response shape that all list endpoints must return */
export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
}

/**
 * Extract the item type from a ts-rest endpoint's return type.
 * Uses Extract to filter to only the response that contains items.
 */
export type ExtractEndpointItem<TEndpoint> = TEndpoint extends (
  arg: infer _TArg
) => Promise<infer TResponses>
  ? Extract<TResponses, { body: { data: { items: unknown[] } } }> extends {
      body: { data: { items: (infer TItem)[] } };
    }
    ? TItem
    : never
  : never;

// =============================================================================
// Client-side sorting configuration
// =============================================================================

export interface ClientSortingConfig<T, K extends string> {
  sortableColumns: readonly K[];
  defaultSort?: K;
  defaultDirection?: SortDirection;
  getSortValue: (item: T, column: K) => string | number | Date | null;
}

// =============================================================================
// Internal props type for useMainTableState hook
// =============================================================================

/** Base props that both modes share */
interface InternalBaseProps<T, K extends Record<string, string>> {
  headerNames: K;
  headerIcons?: Partial<Record<keyof K, React.ReactNode>>;
  noWrap?: (keyof K & string)[];
  columnWidths?: Partial<Record<keyof K & string, number | string>>;
  rowTitle: (item: T) => string | React.ReactNode;
  renderItems: { [P in keyof K]: (item: T) => string | React.ReactNode };
  keyExtractor: (item: T) => string;
  onRowClick?: (item: T) => void;
  expandable?: ExpandableConfig<T>;
}

/** Data mode props for internal use */
export interface InternalDataProps<T, K extends Record<string, string>> extends InternalBaseProps<
  T,
  K
> {
  data: T[];
  sorting?: ClientSortingConfig<T, keyof K & string>;
  endpoint?: never;
}

/** Endpoint mode props for internal use */
export interface InternalEndpointProps<
  T,
  K extends Record<string, string>,
> extends InternalBaseProps<T, K> {
  endpoint: unknown;
  endpointParams: Record<string, unknown>;
  queryKey: readonly unknown[];
  queryParams?: Record<string, unknown>;
  sortableColumns?: readonly (keyof K & string)[];
  defaultSortBy?: keyof K & string;
  defaultSortOrder?: SortDirection;
  defaultLimit?: number;
  enabled?: boolean;
  data?: never;
}

/** Combined props type for internal use */
export type InternalProps<T, K extends Record<string, string>> =
  | InternalDataProps<T, K>
  | InternalEndpointProps<T, K>;

/** Type guard to check if props are data mode */
export function isDataMode<T, K extends Record<string, string>>(
  props: InternalProps<T, K>
): props is InternalDataProps<T, K> {
  return 'data' in props && props.data !== undefined;
}

/** Type guard to check if props are endpoint mode */
export function isEndpointMode<T, K extends Record<string, string>>(
  props: InternalProps<T, K>
): props is InternalEndpointProps<T, K> {
  return 'endpoint' in props && props.endpoint !== undefined;
}

// =============================================================================
// Endpoint call helper
// =============================================================================

interface EndpointArgs {
  params: Record<string, unknown>;
  query?: Record<string, unknown>;
}

interface EndpointResult {
  status: number;
  body: unknown;
}

export async function callEndpoint(endpoint: unknown, args: EndpointArgs): Promise<EndpointResult> {
  if (typeof endpoint !== 'function') {
    throw new Error('endpoint must be a function');
  }
  const result = endpoint(args);
  if (!(result instanceof Promise)) {
    throw new Error('endpoint must return a Promise');
  }
  return result;
}

// =============================================================================
// Hook state
// =============================================================================

export interface MainTableState<T> {
  items: T[];
  pagination: PaginationState;
  sorting: SortingState;
  expansion: ExpansionState;
  isLoading: boolean;
}

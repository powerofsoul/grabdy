import { useEffect, useMemo, useRef, useState } from 'react';

import { keepPreviousData, useQuery } from '@tanstack/react-query';

import type { InternalProps, MainTableState, PaginatedResponse, SortDirection } from './types';
import { callEndpoint, isDataMode, isEndpointMode } from './types';

/** Type for the query function return value */
interface QueryResult<T> {
  items: T[];
  total: number;
}

/** Create an empty query result */
function emptyResult<T>(): QueryResult<T> {
  return { items: [], total: 0 };
}

/** Type guard to check if a column is in the sortable columns list */
function isValidSortColumn<C extends string>(
  column: string,
  validColumns: readonly C[]
): column is C {
  return validColumns.some((c) => c === column);
}

/** Type guard to check if response body is a success response with paginated data */
function isSuccessBody<T>(body: unknown): body is { success: true; data: PaginatedResponse<T> } {
  if (typeof body !== 'object' || body === null) return false;
  if (!('success' in body) || body.success !== true) return false;
  if (!('data' in body)) return false;

  const { data } = body;
  if (typeof data !== 'object' || data === null) return false;
  if (!('items' in data) || !Array.isArray(data.items)) return false;
  if (!('total' in data)) return false;

  return true;
}

export function useMainTableState<TItem, K extends Record<string, string>>(
  props: InternalProps<TItem, K>,
  isMobile = false
): MainTableState<TItem> {
  // Determine mode using type guards
  const dataMode = isDataMode(props);
  const endpointModeActive = isEndpointMode(props);

  // Get sortable columns based on mode
  const sortableColumns: readonly string[] = useMemo(() => {
    if (dataMode) {
      return props.sorting?.sortableColumns ?? [];
    }
    if (endpointModeActive) {
      return props.sortableColumns ?? [];
    }
    return [];
  }, [dataMode, endpointModeActive, props]);

  // Get default sort column based on mode
  const getDefaultSortColumn = (): string | null => {
    if (dataMode && props.sorting?.defaultSort) {
      return props.sorting.defaultSort;
    }
    if (endpointModeActive && props.defaultSortBy) {
      return props.defaultSortBy;
    }
    return null;
  };

  // Get default sort direction based on mode
  const getDefaultSortDirection = (): SortDirection => {
    if (dataMode && props.sorting?.defaultDirection) {
      return props.sorting.defaultDirection;
    }
    if (endpointModeActive && props.defaultSortOrder) {
      return props.defaultSortOrder;
    }
    return 'asc';
  };

  // Internal pagination state
  const defaultLimit = endpointModeActive ? (props.defaultLimit ?? 10) : 10;
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(defaultLimit);

  // Internal sorting state
  const [sortColumn, setSortColumn] = useState<string | null>(getDefaultSortColumn);
  const [sortDirection, setSortDirection] = useState<SortDirection>(getDefaultSortDirection);

  // Expansion state
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  // Accumulated items for mobile infinite scroll
  const [accumulatedItems, setAccumulatedItems] = useState<TItem[]>([]);
  const prevQueryParamsRef = useRef<string>('');

  // Reset page and accumulated items when queryParams change (endpoint mode only)
  const queryParamsKey = endpointModeActive ? JSON.stringify(props.queryParams) : '';
  useEffect(() => {
    if (endpointModeActive && queryParamsKey !== prevQueryParamsRef.current) {
      setPage(0);
      setAccumulatedItems([]);
      prevQueryParamsRef.current = queryParamsKey;
    }
  }, [queryParamsKey, endpointModeActive]);

  // Build query params for endpoint mode
  const fullQuery = useMemo(() => {
    if (!endpointModeActive) return undefined;
    return {
      ...props.queryParams,
      page: page + 1, // API uses 1-indexed
      limit: rowsPerPage,
      ...(sortColumn ? { sortBy: sortColumn, sortOrder: sortDirection } : {}),
    };
  }, [endpointModeActive, props, page, rowsPerPage, sortColumn, sortDirection]);

  // Extract endpoint-specific props (only available in endpoint mode)
  const endpointQueryKey = endpointModeActive ? props.queryKey : null;
  const endpoint = endpointModeActive ? props.endpoint : null;
  const endpointParams = endpointModeActive ? props.endpointParams : null;

  // Server-side data fetching (endpoint mode)
  const queryKey = useMemo(
    () =>
      endpointModeActive && endpointQueryKey
        ? [...endpointQueryKey, endpoint, endpointParams, fullQuery]
        : ['__disabled__'],
    [endpointModeActive, endpointQueryKey, endpoint, endpointParams, fullQuery]
  );

  const serverQuery = useQuery({
    queryKey,
    queryFn: async (): Promise<QueryResult<TItem>> => {
      if (!endpoint || !endpointParams) {
        return emptyResult<TItem>();
      }

      const result = await callEndpoint(endpoint, {
        params: endpointParams,
        query: fullQuery,
      });

      if (result.status !== 200 || !isSuccessBody<TItem>(result.body)) {
        throw new Error('Failed to fetch data');
      }

      return {
        items: result.body.data.items,
        total: result.body.data.total,
      };
    },
    enabled: endpointModeActive && props.enabled !== false,
    placeholderData: keepPreviousData,
  });

  // Accumulate items for mobile infinite scroll
  useEffect(() => {
    if (isMobile && endpointModeActive && serverQuery.data?.items) {
      if (page === 0) {
        // First page - replace
        setAccumulatedItems(serverQuery.data.items);
      } else {
        // Subsequent pages - append
        setAccumulatedItems((prev) => [...prev, ...serverQuery.data.items]);
      }
    }
  }, [isMobile, endpointModeActive, serverQuery.data?.items, page]);

  // Get raw data from either mode
  const rawData: TItem[] = useMemo(() => {
    if (dataMode) {
      return props.data;
    }
    if (endpointModeActive) {
      // Mobile uses accumulated items for infinite scroll
      if (isMobile) {
        return accumulatedItems;
      }
      return serverQuery.data?.items ?? [];
    }
    return [];
  }, [dataMode, endpointModeActive, props, serverQuery.data?.items, isMobile, accumulatedItems]);

  // Client-side sorting for data mode
  const sortedData = useMemo(() => {
    // In endpoint mode, sorting is done server-side
    if (endpointModeActive) {
      return rawData;
    }

    // In data mode without sorting config, return unsorted
    if (!dataMode || !props.sorting || !sortColumn) {
      return rawData;
    }

    const { getSortValue, sortableColumns: validColumns } = props.sorting;

    // Type guard narrows sortColumn to the valid column type
    if (!isValidSortColumn(sortColumn, validColumns)) {
      return rawData;
    }

    return [...rawData].sort((a, b) => {
      const aVal = getSortValue(a, sortColumn);
      const bVal = getSortValue(b, sortColumn);

      // Handle nulls - push to end
      if (aVal === null && bVal === null) return 0;
      if (aVal === null) return 1;
      if (bVal === null) return -1;

      // Convert Date to timestamp for comparison
      const aCompare = aVal instanceof Date ? aVal.getTime() : aVal;
      const bCompare = bVal instanceof Date ? bVal.getTime() : bVal;

      // Compare values
      let comparison: number;
      if (typeof aCompare === 'string' && typeof bCompare === 'string') {
        comparison = aCompare.localeCompare(bCompare);
      } else {
        comparison = aCompare < bCompare ? -1 : aCompare > bCompare ? 1 : 0;
      }

      return sortDirection === 'asc' ? comparison : -comparison;
    });
  }, [rawData, endpointModeActive, dataMode, props, sortColumn, sortDirection]);

  const totalCount = endpointModeActive ? (serverQuery.data?.total ?? 0) : sortedData.length;

  // Sort handler
  const handleSort = (column: string) => {
    if (!sortableColumns.includes(column)) return;

    const newDirection = sortColumn === column ? (sortDirection === 'asc' ? 'desc' : 'asc') : 'asc';

    setSortColumn(column);
    setSortDirection(newDirection);
    if (endpointModeActive) {
      setPage(0);
      if (isMobile) {
        setAccumulatedItems([]);
      }
    }
  };

  // Pagination handlers
  const handlePageChange = (
    _event: React.MouseEvent<HTMLButtonElement> | null,
    newPage: number
  ) => {
    setPage(newPage);
  };

  const handleRowsPerPageChange = (newRowsPerPage: number) => {
    setRowsPerPage(newRowsPerPage);
    setPage(0);
    if (isMobile) {
      setAccumulatedItems([]);
    }
  };

  // Expansion toggle
  const toggleRowExpanded = (key: string) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  return {
    items: sortedData,
    pagination: {
      page,
      rowsPerPage,
      totalCount,
      hasPagination: endpointModeActive,
      onPageChange: handlePageChange,
      onRowsPerPageChange: handleRowsPerPageChange,
    },
    sorting: {
      column: sortColumn,
      direction: sortDirection,
      sortableColumns,
      onSort: handleSort,
    },
    expansion: {
      expandedRows,
      toggleExpanded: toggleRowExpanded,
    },
    isLoading: serverQuery.isLoading || serverQuery.isFetching,
  };
}

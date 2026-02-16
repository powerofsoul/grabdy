import type { PaginatedResponse } from './types';

/** Type for the query function return value */
export interface QueryResult<T> {
  items: T[];
  total: number;
}

/** Create an empty query result */
export function emptyResult<T>(): QueryResult<T> {
  return { items: [], total: 0 };
}

/** Type guard to check if a column is in the sortable columns list */
export function isValidSortColumn<C extends string>(
  column: string,
  validColumns: readonly C[]
): column is C {
  return validColumns.some((c) => c === column);
}

/** Type guard to check if response body is a success response with paginated data */
export function isSuccessBody<T>(body: unknown): body is { success: true; data: PaginatedResponse<T> } {
  if (typeof body !== 'object' || body === null) return false;
  if (!('success' in body) || body.success !== true) return false;
  if (!('data' in body)) return false;

  const { data } = body;
  if (typeof data !== 'object' || data === null) return false;
  if (!('items' in data) || !Array.isArray(data.items)) return false;
  if (!('total' in data)) return false;

  return true;
}

/** How far back to look on initial sync (no existing cursor). 1 year. */
const INITIAL_SYNC_LOOKBACK_MS = 365 * 24 * 60 * 60 * 1000;

/** Returns an ISO string N ms in the past, for use as initial sync cursor. */
export function getInitialSyncSince(): string {
  return new Date(Date.now() - INITIAL_SYNC_LOOKBACK_MS).toISOString();
}

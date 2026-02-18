/** How far back to look on initial sync (no existing cursor). 30 days. */
export const INITIAL_SYNC_LOOKBACK_MS = 30 * 24 * 60 * 60 * 1000;

/** Returns an ISO string N ms in the past, for use as initial sync cursor. */
export function getInitialSyncSince(): string {
  return new Date(Date.now() - INITIAL_SYNC_LOOKBACK_MS).toISOString();
}

/** Returns a Slack-style epoch timestamp (seconds.microseconds) for the initial sync lookback. */
export function getInitialSyncSlackTs(): string {
  const epochSeconds = (Date.now() - INITIAL_SYNC_LOOKBACK_MS) / 1000;
  return `${Math.floor(epochSeconds)}.000000`;
}

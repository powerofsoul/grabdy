export interface SyncLogEntry {
  id: string;
  status: string;
  trigger: string;
  itemsSynced: number;
  itemsFailed: number;
  errorMessage: string | null;
  details: { items: string[] } | null;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
}

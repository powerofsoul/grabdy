import { useCallback, useRef, useState } from 'react';

import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { uploadDataSource } from '@/lib/api';

type UploadStatus = 'uploading' | 'done' | 'error';

export interface FileUploadEntry {
  id: number;
  fileName: string;
  progress: number;
  status: UploadStatus;
}

const MAX_CONCURRENT = 3;

export function useBulkUpload(orgId: string | undefined, collectionId: string) {
  const [uploads, setUploads] = useState<FileUploadEntry[]>([]);
  const nextId = useRef(0);
  const queryClient = useQueryClient();
  const statusRef = useRef(new Map<number, UploadStatus>());

  const updateEntry = (id: number, patch: Partial<FileUploadEntry>) => {
    if (patch.status) {
      statusRef.current.set(id, patch.status);
    }
    setUploads((prev) => prev.map((e) => (e.id === id ? { ...e, ...patch } : e)));
  };

  const processFile = useCallback(
    async (file: File, entryId: number) => {
      if (!orgId) return;
      try {
        const res = await uploadDataSource(orgId, file, collectionId, (pct) => {
          updateEntry(entryId, { progress: pct });
        });
        if (res.status === 200) {
          updateEntry(entryId, { status: 'done', progress: 100 });
        } else {
          updateEntry(entryId, { status: 'error' });
        }
      } catch {
        updateEntry(entryId, { status: 'error' });
      }
    },
    [orgId, collectionId]
  );

  const startUpload = useCallback(
    async (files: File[]) => {
      const entries: FileUploadEntry[] = files.map((f) => ({
        id: nextId.current++,
        fileName: f.name,
        progress: 0,
        status: 'uploading',
      }));
      for (const entry of entries) {
        statusRef.current.set(entry.id, 'uploading');
      }
      setUploads((prev) => [...prev, ...entries]);

      // Process files with concurrency limit
      const queue = files.map((file, i) => ({ file, entryId: entries[i].id }));
      let cursor = 0;

      const runNext = async (): Promise<void> => {
        if (cursor >= queue.length) return;
        const idx = cursor++;
        const item = queue[idx];
        await processFile(item.file, item.entryId);
        await runNext();
      };

      const workers = Array.from({ length: Math.min(MAX_CONCURRENT, queue.length) }, () =>
        runNext()
      );
      await Promise.all(workers);

      // Count results from the ref (always up to date, no React batching concerns)
      let done = 0;
      let failed = 0;
      for (const entry of entries) {
        const status = statusRef.current.get(entry.id) ?? 'error';
        if (status === 'done') done++;
        if (status === 'error') failed++;
      }
      if (failed > 0) {
        toast.error(`${failed} file${failed > 1 ? 's' : ''} failed to upload`);
      }
      if (done > 0) {
        toast.success(`${done} file${done > 1 ? 's' : ''} uploaded`);
      }

      queryClient.invalidateQueries({ queryKey: ['dataSources'] });
      queryClient.invalidateQueries({ queryKey: ['collections'] });
      queryClient.invalidateQueries({ queryKey: ['deadlines'] });
    },
    [processFile, queryClient]
  );

  const dismissUploads = useCallback(() => {
    setUploads((prev) => prev.filter((e) => e.status === 'uploading'));
  }, []);

  const isUploading = uploads.some((e) => e.status === 'uploading');

  return { uploads, startUpload, dismissUploads, isUploading };
}

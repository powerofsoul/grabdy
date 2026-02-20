export interface TempFileHandle {
  path: string;
  /** Remove the temp file (no-op for local storage where the file is the original). */
  cleanup(): Promise<void>;
}

export interface FileStorage {
  put(key: string, body: Buffer, contentType: string): Promise<void>;
  get(key: string): Promise<Buffer>;
  /** Get the file as a temp path on disk (avoids loading into memory). */
  getTempPath(key: string): Promise<TempFileHandle>;
  delete(key: string): Promise<void>;
  getUrl(key: string): Promise<string>;
}

export const FILE_STORAGE = Symbol('FILE_STORAGE');

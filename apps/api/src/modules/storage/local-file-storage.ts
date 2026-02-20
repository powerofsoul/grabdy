import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

import type { FileStorage, TempFileHandle } from './file-storage.interface';

export class LocalFileStorage implements FileStorage {
  constructor(
    private readonly basePath: string,
    private readonly baseUrl: string
  ) {}

  async put(key: string, body: Buffer, _contentType: string): Promise<void> {
    const filePath = join(this.basePath, key);
    await mkdir(dirname(filePath), { recursive: true });
    await writeFile(filePath, body);
  }

  async get(key: string): Promise<Buffer> {
    const filePath = join(this.basePath, key);
    return readFile(filePath);
  }

  async getTempPath(key: string): Promise<TempFileHandle> {
    const filePath = join(this.basePath, key);
    return { path: filePath, cleanup: async () => {} };
  }

  async delete(key: string): Promise<void> {
    const filePath = join(this.basePath, key);
    await unlink(filePath);
  }

  async getUrl(key: string): Promise<string> {
    return `${this.baseUrl}/files/${key}`;
  }
}

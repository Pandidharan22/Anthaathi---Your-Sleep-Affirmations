import { getDatabase } from '@/lib/db';
import { createLocalFolder, listLocalFolders } from '@/lib/folders.local';
import { processQueue } from '@/lib/syncQueue';

/**
 * __DEV__-only console helpers for exercising the local-first data layer
 * before any UI consumes it (folder CRUD screens land in step 1.6).
 * Usage from the browser/device console: `__anthaathiDebug.createFolder('Test')`.
 */
export function installDebugTools(userId: string | null) {
  (globalThis as Record<string, unknown>).__anthaathiDebug = userId
    ? {
        userId,
        createFolder: (name: string) => createLocalFolder(userId, name),
        listFolders: () => listLocalFolders(userId),
        processQueue,
        db: getDatabase,
      }
    : undefined;
}

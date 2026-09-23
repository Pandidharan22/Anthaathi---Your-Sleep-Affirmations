import { deleteAccount } from '@/lib/account';
import {
  createLocalAffirmation,
  deleteLocalAffirmation,
  listLocalAffirmations,
  updateLocalAffirmationFolder,
} from '@/lib/affirmations.local';
import { getDatabase } from '@/lib/db';
import { createLocalFolder, deleteLocalFolder, listLocalFolders, renameLocalFolder } from '@/lib/folders.local';
import { uploadPendingGoalImages } from '@/lib/goalImages';
import {
  createLocalGoal,
  deleteLocalGoal,
  listLocalGoals,
  updateLocalGoalImage,
  updateLocalGoalStatus,
  updateLocalGoalText,
} from '@/lib/goals.local';
import { listLocalPlaybackSessions, logLocalPlaybackSession } from '@/lib/playbackSessions.local';
import { computeStreak } from '@/lib/streak';
import { processQueue } from '@/lib/syncQueue';

/**
 * __DEV__-only console helpers for exercising the local-first data layer
 * directly, bypassing UI gates that don't work in this dev environment
 * (mic capture, native Alert confirm dialogs on web).
 * Usage from the browser/device console: `__anthaathiDebug.createFolder('Test')`.
 */
export function installDebugTools(userId: string | null) {
  (globalThis as Record<string, unknown>).__anthaathiDebug = userId
    ? {
        userId,
        createFolder: (name: string) => createLocalFolder(userId, name),
        renameFolder: renameLocalFolder,
        deleteFolder: deleteLocalFolder,
        listFolders: () => listLocalFolders(userId),
        createAffirmation: (title: string, localUri = 'file:///debug/fake.m4a', durationMs = 1000) =>
          createLocalAffirmation({ userId, title, localUri, durationMs, source: 'recorded' }),
        updateAffirmationFolder: updateLocalAffirmationFolder,
        deleteAffirmation: deleteLocalAffirmation,
        listAffirmations: () => listLocalAffirmations(userId),
        createGoal: (title: string, description = '') =>
          createLocalGoal({ userId, title, description }),
        updateGoalText: updateLocalGoalText,
        updateGoalImage: updateLocalGoalImage,
        updateGoalStatus: updateLocalGoalStatus,
        deleteGoal: deleteLocalGoal,
        listGoals: () => listLocalGoals(userId),
        logPlaybackSession: (playedAt: string, durationMs: number) =>
          logLocalPlaybackSession(userId, playedAt, durationMs),
        listPlaybackSessions: () => listLocalPlaybackSessions(userId),
        getStreak: async () =>
          computeStreak((await listLocalPlaybackSessions(userId)).map((s) => s.played_at)),
        deleteAccount: () => deleteAccount(userId),
        processQueue,
        uploadPendingGoalImages,
        db: getDatabase,
      }
    : undefined;
}

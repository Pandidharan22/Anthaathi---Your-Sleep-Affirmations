import type { LocalAffirmation } from '@/lib/affirmations.local';
import { formatLength, getEffectiveDurationMs } from '@/lib/format';

/**
 * Route id for recordings with no folder: the Library's "Unfiled" card (shown only when
 * some exist) opens `/folder/unfiled`. Real folder ids are UUIDs, so it can't collide.
 */
export const UNFILED_FOLDER_ID = 'unfiled';

export type FolderStats = { count: number; totalMs: number };

/**
 * Recording count and total playable length per folder, keyed by folder id; unfiled
 * recordings are under `null`. Trimmed recordings count their trimmed length, matching
 * what actually plays.
 */
export function summarizeByFolder(
  affirmations: LocalAffirmation[],
): Map<string | null, FolderStats> {
  const stats = new Map<string | null, FolderStats>();
  for (const affirmation of affirmations) {
    const key = affirmation.folder_id ?? null;
    const current = stats.get(key) ?? { count: 0, totalMs: 0 };
    current.count += 1;
    current.totalMs += getEffectiveDurationMs(affirmation);
    stats.set(key, current);
  }
  return stats;
}

/** "12 recordings · 6m 24s", "1 recording · 32s", or "No recordings yet". */
export function describeFolderStats(stats: FolderStats | undefined): string {
  if (!stats || stats.count === 0) return 'No recordings yet';
  const noun = stats.count === 1 ? 'recording' : 'recordings';
  return `${stats.count} ${noun} · ${formatLength(stats.totalMs)}`;
}

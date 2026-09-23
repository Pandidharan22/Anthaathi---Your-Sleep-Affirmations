import * as Crypto from 'expo-crypto';

import { getDatabase } from '@/lib/db';
import { enqueue } from '@/lib/syncQueue';

export type LocalJournalEntry = {
  id: string;
  user_id: string;
  prompt: string | null;
  body: string;
  created_at: string;
  synced_at: string | null;
};

export type CreateLocalJournalEntryInput = {
  userId: string;
  prompt: string | null;
  body: string;
};

/**
 * Writes a journal entry locally (always succeeds offline — journaling
 * happens at night same as everything else here) and queues the Postgres
 * upsert. No update path: entries are immutable once created (see the
 * migration for why), so there's no updateLocalJournalEntry to go with this.
 */
export async function createLocalJournalEntry(
  input: CreateLocalJournalEntryInput,
): Promise<LocalJournalEntry> {
  const database = await getDatabase();
  const now = new Date().toISOString();
  const entry: LocalJournalEntry = {
    id: Crypto.randomUUID(),
    user_id: input.userId,
    prompt: input.prompt,
    body: input.body,
    created_at: now,
    synced_at: null,
  };

  await database.runAsync(
    `INSERT INTO journal_entries (id, user_id, prompt, body, created_at, synced_at) VALUES (?, ?, ?, ?, ?, ?)`,
    [entry.id, entry.user_id, entry.prompt, entry.body, entry.created_at, entry.synced_at],
  );

  await enqueue('journal_entries', 'upsert', entry.id, {
    id: entry.id,
    user_id: entry.user_id,
    prompt: entry.prompt,
    body: entry.body,
    created_at: entry.created_at,
  });

  return entry;
}

export async function listLocalJournalEntries(userId: string): Promise<LocalJournalEntry[]> {
  const database = await getDatabase();
  return database.getAllAsync<LocalJournalEntry>(
    `SELECT * FROM journal_entries WHERE user_id = ? ORDER BY created_at DESC`,
    [userId],
  );
}

export async function getLocalJournalEntry(id: string): Promise<LocalJournalEntry | null> {
  const database = await getDatabase();
  const rows = await database.getAllAsync<LocalJournalEntry>(
    `SELECT * FROM journal_entries WHERE id = ? LIMIT 1`,
    [id],
  );
  return rows[0] ?? null;
}

export async function deleteLocalJournalEntry(id: string): Promise<void> {
  const database = await getDatabase();
  const entry = await getLocalJournalEntry(id);

  await database.runAsync(`DELETE FROM journal_entries WHERE id = ?`, [id]);
  // user_id carried in the payload so account deletion can still attribute
  // this queue entry to its user even after the local row itself is gone.
  await enqueue('journal_entries', 'delete', id, entry ? { user_id: entry.user_id } : undefined);
}

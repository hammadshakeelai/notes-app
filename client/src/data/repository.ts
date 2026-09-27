import * as SQLite from 'expo-sqlite';
import { randomUUID } from 'expo-crypto';
import { shouldReplace } from './merge';
import type { Item, Repository } from './types';

let database: Promise<SQLite.SQLiteDatabase> | undefined;
async function openDatabase() {
  if (!database) database = (async () => {
    const db = await SQLite.openDatabaseAsync('lecture-notes.db');
    await db.execAsync('PRAGMA journal_mode = WAL; CREATE TABLE IF NOT EXISTS items (id TEXT PRIMARY KEY NOT NULL, kind TEXT NOT NULL, payload TEXT NOT NULL); CREATE INDEX IF NOT EXISTS items_kind ON items(kind); CREATE TABLE IF NOT EXISTS metadata (key TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL);');
    return db;
  })().catch(error => { database = undefined; throw error; });
  return database;
}

export const repository: Repository = {
  async list<T>(kind: string): Promise<Item<T>[]> {
    const db = await openDatabase();
    const rows = await db.getAllAsync<{ payload: string }>('SELECT payload FROM items WHERE kind = ?', kind);
    return rows.map(row => JSON.parse(row.payload) as Item<T>);
  },
  async get<T>(id: string): Promise<Item<T> | null> {
    const db = await openDatabase();
    const row = await db.getFirstAsync<{ payload: string }>('SELECT payload FROM items WHERE id = ?', id);
    return row ? JSON.parse(row.payload) as Item<T> : null;
  },
  async put(item: Item): Promise<void> {
    const db = await openDatabase();
    await db.withExclusiveTransactionAsync(async transaction => {
      const row = await transaction.getFirstAsync<{ payload: string }>('SELECT payload FROM items WHERE id = ?', item.id);
      if (shouldReplace(row ? JSON.parse(row.payload) as Item : null, item)) {
        await transaction.runAsync('INSERT INTO items (id, kind, payload) VALUES (?, ?, ?) ON CONFLICT(id) DO UPDATE SET kind = excluded.kind, payload = excluded.payload', item.id, item.kind, JSON.stringify(item));
      }
    });
  },
};

export async function getDeviceId(): Promise<string> {
  const db = await openDatabase();
  await db.runAsync('INSERT OR IGNORE INTO metadata (key, value) VALUES (?, ?)', 'deviceId', randomUUID());
  const row = await db.getFirstAsync<{ value: string }>('SELECT value FROM metadata WHERE key = ?', 'deviceId');
  if (!row) throw new Error('Unable to persist device identity.');
  return row.value;
}

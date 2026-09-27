import { openDatabase, readRecord } from './idb';
import { shouldReplace } from './merge';
import type { Item, Repository } from './types';

export const repository: Repository = {
  async list<T>(kind: string): Promise<Item<T>[]> {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const request = db.transaction('items').objectStore('items').index('kind').getAll(kind);
      request.onsuccess = () => resolve(request.result as Item<T>[]);
      request.onerror = () => reject(request.error);
    });
  },
  async get<T>(id: string) { return (await readRecord<Item<T>>('items', id)) ?? null; },
  async put(item: Item): Promise<void> {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction('items', 'readwrite');
      const store = transaction.objectStore('items');
      const request = store.get(item.id);
      request.onsuccess = () => { if (shouldReplace(request.result ?? null, item)) store.put(item); };
      transaction.oncomplete = () => resolve();
      transaction.onabort = () => reject(transaction.error ?? new Error('Item write was aborted.'));
      transaction.onerror = () => reject(transaction.error);
    });
  },
};

export async function getDeviceId(): Promise<string> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('metadata', 'readwrite');
    const store = transaction.objectStore('metadata');
    let id: string;
    const request = store.get('deviceId');
    request.onsuccess = () => {
      id = request.result ?? crypto.randomUUID();
      if (!request.result) store.put(id, 'deviceId');
    };
    transaction.oncomplete = () => resolve(id);
    transaction.onabort = () => reject(transaction.error ?? new Error('Unable to persist device identity.'));
    transaction.onerror = () => reject(transaction.error);
  });
}

let database: Promise<IDBDatabase> | undefined;

export function openDatabase(): Promise<IDBDatabase> {
  if (!database) {
    database = new Promise<IDBDatabase>((resolve, reject) => {
      if (typeof indexedDB === 'undefined') {
        reject(new Error('Persistent browser storage is unavailable. Enable IndexedDB to use this app.'));
        return;
      }
      const request = indexedDB.open('lecture-notes', 1);
      request.onupgradeneeded = () => {
        const db = request.result;
        const items = db.createObjectStore('items', { keyPath: 'id' });
        items.createIndex('kind', 'kind');
        db.createObjectStore('assets');
        db.createObjectStore('metadata');
      };
      request.onsuccess = () => {
        request.result.onversionchange = () => { request.result.close(); database = undefined; };
        resolve(request.result);
      };
      request.onerror = () => reject(request.error ?? new Error('Unable to open persistent storage.'));
      request.onblocked = () => reject(new Error('Close other app tabs to upgrade local storage.'));
    }).catch(error => { database = undefined; throw error; });
  }
  return database;
}

export async function readRecord<T>(storeName: string, key: string): Promise<T | undefined> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const request = db.transaction(storeName).objectStore(storeName).get(key);
    request.onsuccess = () => resolve(request.result as T | undefined);
    request.onerror = () => reject(request.error);
  });
}

export async function writeRecord(storeName: string, key: string, value: unknown): Promise<void> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readwrite');
    transaction.objectStore(storeName).put(value, key);
    transaction.oncomplete = () => resolve();
    transaction.onabort = () => reject(transaction.error ?? new Error('Storage write was aborted.'));
    transaction.onerror = () => reject(transaction.error);
  });
}

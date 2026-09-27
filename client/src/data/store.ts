import { useEffect, useState } from 'react';
import { getDeviceId, repository as persistentRepository } from './repository';
import type { Item, Repository } from './types';

const listeners = new Set<() => void>();
export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}
export const repository: Repository = {
  list: persistentRepository.list,
  get: persistentRepository.get,
  async put(item) {
    await persistentRepository.put(item);
    listeners.forEach(listener => listener());
  },
};
let identity: Promise<string> | undefined;
export async function initializeStore(): Promise<void> {
  await deviceId();
}
function deviceId() {
  if (!identity) identity = getDeviceId().catch(error => { identity = undefined; throw error; });
  return identity;
}
let lastTime = 0;
async function writeItem<T>(kind: string, id: string, value: T, deleted: boolean) {
  const updatedBy = await deviceId();
  const previous = await repository.get(id);
  lastTime = Math.max(Date.now(), lastTime + 1, previous ? Date.parse(previous.updatedAt) + 1 : 0);
  await repository.put({ id, kind, value, deleted, updatedBy, updatedAt: new Date(lastTime).toISOString() });
}
export async function saveItem<T>(kind: string, id: string, value: T): Promise<void> {
  await writeItem(kind, id, value, false);
}
export async function deleteItem(kind: string, id: string): Promise<void> {
  const previous = await repository.get(id);
  await writeItem(kind, id, previous?.value ?? null, true);
}
export function useItems<T>(kind: string): { items: Item<T>[]; error: string | null; loading: boolean } {
  const [state, setState] = useState<{ items: Item<T>[]; error: string | null; loading: boolean }>({ items: [], error: null, loading: true });
  useEffect(() => {
    let active = true;
    let revision = 0;
    setState({ items: [], error: null, loading: true });
    const refresh = async () => {
      const request = ++revision;
      try {
        const items = (await repository.list<T>(kind)).filter(item => !item.deleted).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
        if (active && request === revision) setState({ items, error: null, loading: false });
      } catch (error) {
        if (active && request === revision) setState(current => ({ ...current, error: error instanceof Error ? error.message : 'Unable to load saved items.', loading: false }));
      }
    };
    const unsubscribe = subscribe(() => { void refresh(); });
    void refresh();
    return () => { active = false; unsubscribe(); };
  }, [kind]);
  return state;
}

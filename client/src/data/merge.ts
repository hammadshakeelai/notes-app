import type { Item } from './types';
import { mergeSyncItems } from '@/features/study/core';

/** Deterministic last-write-wins ordering, including deletion markers. */
export function shouldReplace(current: Item | null, incoming: Item): boolean {
  return mergeSyncItems(current ? [current] : [], [incoming])[0] === incoming;
}

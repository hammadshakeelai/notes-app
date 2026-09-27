import { seedTimetable } from '@/domain/timetable';
import type { Timetable } from '@/domain/timetable';
import { useItems } from '@/data/store';

const seed = seedTimetable();
export function useTimetable() {
  const result = useItems<Timetable>('timetable');
  return { ...result, timetable: result.items.find(item => item.id === 'timetable')?.value ?? seed };
}

export function localDay(now = new Date()): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

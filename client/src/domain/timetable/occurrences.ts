import { addDays, minutesOf, weekdayOf } from '../calendar';
import type { IsoDate } from '../calendar';
import type { Occurrence, Slot, Timetable } from './types';

export function occurrenceKey(slotId: string, date: IsoDate): string {
  return `${slotId}@${date}`;
}

/**
 * Every scheduled class from `from` to `to` (both inclusive), in time order.
 * Includes holidays and cancelled classes: use `isExcepted` to leave them out (R-NUM-4 lists them all).
 */
export function occurrencesBetween(slots: Slot[], from: IsoDate, to: IsoDate): Occurrence[] {
  // Validate both ends before using ISO strings for chronological comparison.
  weekdayOf(from);
  weekdayOf(to);
  const result: Occurrence[] = [];
  let date = from;
  while (date <= to) {
    const weekday = weekdayOf(date);
    const today = slots
      .filter((s) => s.weekday === weekday)
      .sort((a, b) => minutesOf(a.start) - minutesOf(b.start));
    for (const slot of today) result.push({ slot, date });
    if (date === to) break;
    date = addDays(date, 1);
  }
  return result;
}

/** True if the class did not take place: its day is a holiday or the class was cancelled. */
export function isExcepted(tt: Pick<Timetable, 'exceptions'>, occ: Occurrence): boolean {
  return tt.exceptions.some((e) =>
    e.kind === 'holiday' ? e.date === occ.date : e.slotId === occ.slot.id && e.date === occ.date,
  );
}

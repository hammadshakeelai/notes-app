import { minutesOf, weekdayOf } from '../calendar';
import type { HhMm, IsoDate } from '../calendar';
import { isExcepted, occurrenceKey, occurrencesBetween } from './occurrences';
import type { Occurrence, Timetable } from './types';

export const PROMPT_DELAY_MIN = 15;

/**
 * R-NUM-3: today's classes whose end was at least 15 minutes ago, excluding holidays,
 * cancellations and handled classes. Handled keys represent recorded or answered occurrences.
 */
export function classesNeedingPrompt(
  tt: Timetable,
  date: IsoDate,
  time: HhMm,
  handled: ReadonlySet<string>,
): Occurrence[] {
  weekdayOf(date);
  weekdayOf(tt.semesterStart);
  const now = minutesOf(time);
  if (date < tt.semesterStart) return [];
  return occurrencesBetween(tt.slots, date, date).filter(
    (occurrence) =>
      minutesOf(occurrence.slot.end) + PROMPT_DELAY_MIN <= now &&
      !isExcepted(tt, occurrence) &&
      !handled.has(occurrenceKey(occurrence.slot.id, occurrence.date)),
  );
}

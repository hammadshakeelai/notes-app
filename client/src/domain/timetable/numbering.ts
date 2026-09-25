import { minutesOf, weekdayOf } from '../calendar';
import type { HhMm, IsoDate } from '../calendar';
import { isExcepted, occurrencesBetween } from './occurrences';
import type { Stream, Timetable } from './types';

/** A class that took place: a scheduled slot or a make-up session. */
export interface SessionRef {
  subjectId: string;
  stream: Stream;
  date: IsoDate;
  start: HhMm;
}

function sortKey(date: IsoDate, start: HhMm): string {
  weekdayOf(date); // validates the date
  minutesOf(start); // validates the time
  return `${date} ${start}`;
}

/**
 * R-NUM-1: the lecture or lab number of a class. It counts that subject's classes of the same stream
 * from the semester start up to and including this one: scheduled classes that took place (missed ones
 * still count), minus holidays and cancellations, plus make-up sessions. Pure, so editing holidays or
 * cancellations and calling it again renumbers everything (R-NUM-2).
 */
export function sessionNumber(tt: Timetable, ref: SessionRef): number {
  weekdayOf(tt.semesterStart);
  const refKey = sortKey(ref.date, ref.start);
  if (ref.date < tt.semesterStart) {
    throw new Error(`${ref.date} is before the semester start (${tt.semesterStart})`);
  }
  const streamSlots = tt.slots.filter((s) => s.subjectId === ref.subjectId && s.stream === ref.stream);
  const scheduled = occurrencesBetween(streamSlots, tt.semesterStart, ref.date).filter((o) => !isExcepted(tt, o));
  const sessionKeys = new Set(scheduled.map((occ) => sortKey(occ.date, occ.slot.start)));
  for (const extra of tt.extras) {
    if (extra.subjectId !== ref.subjectId || extra.stream !== ref.stream) continue;
    const key = sortKey(extra.date, extra.start);
    if (extra.date >= tt.semesterStart) sessionKeys.add(key);
  }

  // The reference identifies a session by stream, date and start. Duplicate records
  // for that same session must not consume additional lecture or lab numbers.
  if (!sessionKeys.has(refKey)) {
    throw new Error(
      `No ${ref.stream} of ${ref.subjectId} at ${ref.date} ${ref.start}: add it as a make-up session first`,
    );
  }

  return [...sessionKeys].filter((key) => key <= refKey).length;
}

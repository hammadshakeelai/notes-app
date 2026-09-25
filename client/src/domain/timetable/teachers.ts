import { weekdayOf } from '../calendar';
import type { IsoDate } from '../calendar';
import type { Stream, TeacherAssignment } from './types';

/**
 * R-TT-5: the latest assignment starting on or before the date wins.
 * Earlier classes retain their teacher. Equal dates resolve to the last assignment.
 */
export function teacherOn(
  assignments: TeacherAssignment[],
  subjectId: string,
  stream: Stream,
  date: IsoDate,
): string | undefined {
  weekdayOf(date);
  let best: TeacherAssignment | undefined;
  for (const assignment of assignments) {
    if (assignment.subjectId !== subjectId || assignment.stream !== stream) continue;
    weekdayOf(assignment.from);
    if (assignment.from > date) continue;
    if (!best || assignment.from >= best.from) best = assignment;
  }
  return best?.teacher;
}

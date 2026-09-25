import type { HhMm, IsoDate, Weekday } from '../calendar';

export type Stream = 'lecture' | 'lab';

export interface Subject {
  id: string;
  name: string;
}

/** A weekly class in the timetable. */
export interface Slot {
  id: string;
  subjectId: string;
  stream: Stream;
  weekday: Weekday;
  start: HhMm;
  end: HhMm;
  room?: string;
}

/** Who teaches a subject's lecture or lab stream, from a date onwards (R-TT-5). */
export interface TeacherAssignment {
  subjectId: string;
  stream: Stream;
  teacher: string;
  from: IsoDate;
}

/** A day with no classes, or one class that did not happen (R-NUM-2). */
export type CalendarException =
  | { kind: 'holiday'; date: IsoDate }
  | { kind: 'cancelled'; slotId: string; date: IsoDate };

/** A make-up class outside the weekly timetable; it counts towards numbering (R-NUM-1). */
export interface ExtraSession {
  subjectId: string;
  stream: Stream;
  date: IsoDate;
  start: HhMm;
}

export interface Timetable {
  semesterStart: IsoDate;
  subjects: Subject[];
  slots: Slot[];
  teachers: TeacherAssignment[];
  exceptions: CalendarException[];
  extras: ExtraSession[];
}

/** One weekly slot on one date. */
export interface Occurrence {
  slot: Slot;
  date: IsoDate;
}

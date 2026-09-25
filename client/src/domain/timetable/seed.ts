import type { Slot, Subject, Timetable } from './types';

/**
 * Semester V, Group B, from 2026-09-07 (design, Appendix A).
 * Teachers and rooms are not here: they come from the private timetable file at setup.
 */
export const SEMESTER_START = '2026-09-07';

export const SEED_SUBJECTS: Subject[] = [
  { id: 'computer-networks', name: 'Computer Networks' },
  { id: 'fundamentals-of-accounting', name: 'Fundamentals of Accounting' },
  { id: 'technical-business-writing', name: 'Technical & Business Writing' },
  { id: 'parallel-and-distributed-computing', name: 'Parallel and Distributed Computing' },
  { id: 'machine-learning', name: 'Machine Learning' },
  { id: 'programming-for-ai', name: 'Programming for AI' },
];

function slot(
  day: string,
  weekday: Slot['weekday'],
  start: string,
  end: string,
  subjectId: string,
  stream: Slot['stream'],
): Slot {
  return { id: `${day}-${start.replace(':', '')}`, subjectId, stream, weekday, start, end };
}

export const SEED_SLOTS: Slot[] = [
  slot('mon', 1, '08:30', '10:00', 'computer-networks', 'lab'),
  slot('mon', 1, '10:15', '11:45', 'fundamentals-of-accounting', 'lecture'),
  slot('mon', 1, '12:00', '13:30', 'technical-business-writing', 'lecture'),
  slot('mon', 1, '14:00', '16:00', 'parallel-and-distributed-computing', 'lecture'),
  slot('tue', 2, '08:30', '10:00', 'computer-networks', 'lab'),
  slot('tue', 2, '10:15', '11:45', 'fundamentals-of-accounting', 'lecture'),
  slot('tue', 2, '12:00', '13:30', 'machine-learning', 'lab'),
  slot('tue', 2, '14:00', '16:00', 'computer-networks', 'lecture'),
  slot('wed', 3, '08:30', '10:00', 'programming-for-ai', 'lab'),
  slot('wed', 3, '10:15', '11:45', 'parallel-and-distributed-computing', 'lab'),
  slot('wed', 3, '12:00', '13:30', 'machine-learning', 'lab'),
  slot('wed', 3, '14:00', '15:30', 'technical-business-writing', 'lecture'),
  slot('thu', 4, '08:30', '10:00', 'parallel-and-distributed-computing', 'lab'),
  slot('thu', 4, '10:01', '11:59', 'programming-for-ai', 'lecture'),
  slot('thu', 4, '12:00', '13:30', 'programming-for-ai', 'lab'),
  slot('thu', 4, '14:00', '16:00', 'machine-learning', 'lecture'),
];

export function seedTimetable(): Timetable {
  return {
    semesterStart: SEMESTER_START,
    subjects: SEED_SUBJECTS.map((subject) => ({ ...subject })),
    slots: SEED_SLOTS.map((weeklySlot) => ({ ...weeklySlot })),
    teachers: [],
    exceptions: [],
    extras: [],
  };
}

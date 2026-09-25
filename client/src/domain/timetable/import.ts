import { minutesOf, weekdayOf } from '../calendar';
import type { IsoDate, Weekday } from '../calendar';
import type { Slot, Stream, Subject, TeacherAssignment, Timetable } from './types';

const WEEKDAYS = new Map<string, Weekday>([
  ['mon', 1],
  ['tue', 2],
  ['wed', 3],
  ['thu', 4],
  ['fri', 5],
  ['sat', 6],
  ['sun', 7],
]);

const HEADER = 'day|time|subject|stream|teacher|room';

/** 'Technical & Business Writing' → 'technical-business-writing'. */
export function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/&/g, ' ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function parseStream(cell: string, where: string): Stream {
  const stream = cell.toLowerCase();
  if (stream === 'lecture' || stream === 'lab') return stream;
  throw new Error(`${where}: stream must be Lecture or Lab`);
}

function parseTimeRange(cell: string, where: string): [string, string] {
  const times = cell.split(/[-–—]/).map((time) => time.trim());
  if (times.length !== 2) {
    throw new Error(`${where}: time must look like 08:30–10:00`);
  }
  const [start, end] = times;
  let startMinutes: number;
  let endMinutes: number;
  try {
    startMinutes = minutesOf(start);
    endMinutes = minutesOf(end);
  } catch {
    throw new Error(`${where}: time must look like 08:30–10:00 with valid HH:MM times`);
  }
  if (startMinutes >= endMinutes) {
    throw new Error(`${where}: the class must end after it starts`);
  }
  return [start, end];
}

/**
 * R-TT-1: imports a Markdown table with columns Day | Time | Subject | Stream | Teacher | Room.
 * Prose, headers and separators are ignored; malformed timetable rows fail with their source line.
 * This is an initial snapshot: trailing parenthetical teacher notes are removed, and assignments
 * start at semesterStart. Historical teacher changes need explicit effective-date assignments.
 */
export function importTimetable(markdown: string, semesterStart: IsoDate): Timetable {
  weekdayOf(semesterStart);
  const subjects = new Map<string, Subject>();
  const slots: Slot[] = [];
  const teachers = new Map<string, TeacherAssignment>();
  let inTimetable = false;

  markdown.split(/\r?\n/).forEach((line, index) => {
    const trimmed = line.trim();
    if (!trimmed.startsWith('|')) {
      inTimetable = false;
      return;
    }
    const cells = trimmed.replace(/^\||\|$/g, '').split('|').map((cell) => cell.trim());
    if (cells.map((cell) => cell.toLowerCase()).join('|') === HEADER) {
      inTimetable = true;
      return;
    }
    if (cells.every((cell) => /^:?-+:?$/.test(cell))) return;

    const weekday = WEEKDAYS.get(cells[0].toLowerCase());
    // Headerless timetable rows are supported too; a misspelled day must not silently drop one.
    const looksLikeTime = /^\d{1,2}:\d{2}/.test(cells[1] ?? '');
    if (!weekday && !inTimetable && !looksLikeTime) return;

    const where = `line ${index + 1}`;
    if (cells.length !== 6) throw new Error(`${where}: expected 6 columns`);
    if (!weekday) throw new Error(`${where}: day must be Mon through Sun`);
    const [day, time, subjectName, streamCell, teacherCell, room] = cells;
    const [start, end] = parseTimeRange(time, where);
    const stream = parseStream(streamCell, where);
    const subjectId = slugify(subjectName);
    if (!subjectId) throw new Error(`${where}: the subject is empty`);
    const existingSubject = subjects.get(subjectId);
    if (existingSubject && existingSubject.name.toLowerCase() !== subjectName.toLowerCase()) {
      throw new Error(`${where}: conflicting subject names produce the same id`);
    }

    const id = `${day.toLowerCase()}-${start.replace(':', '')}`;
    if (slots.some((slot) => slot.id === id)) throw new Error(`${where}: duplicate slot`);
    if (slots.some((slot) => slot.weekday === weekday && start < slot.end && slot.start < end)) {
      throw new Error(`${where}: overlapping classes on the same day`);
    }

    const teacher = teacherCell.replace(/\s*\(.*\)\s*$/, '').trim();
    const teacherKey = `${subjectId}:${stream}`;
    const existingTeacher = teachers.get(teacherKey);
    if (teacher && existingTeacher && existingTeacher.teacher !== teacher) {
      throw new Error(`${where}: conflicting teachers for the same subject and stream`);
    }

    if (!existingSubject) subjects.set(subjectId, { id: subjectId, name: subjectName });
    slots.push({ id, subjectId, stream, weekday, start, end, ...(room ? { room } : {}) });
    if (teacher && !existingTeacher) {
      teachers.set(teacherKey, { subjectId, stream, teacher, from: semesterStart });
    }
  });

  if (slots.length === 0) throw new Error('No timetable rows found');
  return {
    semesterStart,
    subjects: [...subjects.values()],
    slots,
    teachers: [...teachers.values()],
    exceptions: [],
    extras: [],
  };
}

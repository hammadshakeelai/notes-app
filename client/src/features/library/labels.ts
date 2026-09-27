import type { Lecture } from '@/data/types';
import { displayName, sessionNumber } from '@/domain/timetable';
import type { Timetable } from '@/domain/timetable';

export function lectureTitle(lecture: Lecture, timetable: Timetable): string {
  const subject = timetable.subjects.find(item => item.id === lecture.subjectId);
  if (!subject || lecture.stream === 'other') return lecture.title;
  try {
    const number = sessionNumber(timetable, { subjectId: subject.id, stream: lecture.stream, date: lecture.date, start: lecture.start });
    return displayName(lecture.date, { kind: 'class', subjectName: subject.name, stream: lecture.stream, number });
  } catch { return lecture.title; }
}

export function durationLabel(ms: number) {
  const seconds = Math.floor(ms / 1000);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

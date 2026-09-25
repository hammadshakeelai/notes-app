import { importTimetable, slugify } from '../import';
import { SEED_SLOTS, SEED_SUBJECTS, SEMESTER_START } from '../seed';

const SAMPLE = [
  '# Full timetable (synthetic)',
  '',
  '| Day | Time | Subject | Stream | Teacher | Room |',
  '| --- | --- | --- | --- | --- | --- |',
  '| Mon | 08:30–10:00 | Computer Networks | Lab | Teacher A | Lab 1 |',
  '| Tue | 14:00-16:00 | Computer Networks | Lecture | Teacher B (replaced Teacher Z, Sept 2026) | Room 7 |',
  '| Wed | 10:15–11:45 | Technical & Business Writing | Lecture | Teacher C | Room 6 |',
].join('\n');

describe('slugify', () => {
  it('makes stable ids from subject names', () => {
    expect(slugify('Technical & Business Writing')).toBe('technical-business-writing');
    expect(slugify('Programming for AI')).toBe('programming-for-ai');
  });
});

describe('importTimetable (R-TT-1)', () => {
  it('reads slots, subjects, rooms and teachers from the Markdown table', () => {
    const timetable = importTimetable(SAMPLE, SEMESTER_START);
    expect(timetable.slots.map((slot) => slot.id)).toEqual(['mon-0830', 'tue-1400', 'wed-1015']);
    expect(timetable.subjects.map((subject) => subject.id)).toEqual(['computer-networks', 'technical-business-writing']);
    expect(timetable.slots[1]).toEqual({
      id: 'tue-1400',
      subjectId: 'computer-networks',
      stream: 'lecture',
      weekday: 2,
      start: '14:00',
      end: '16:00',
      room: 'Room 7',
    });
    expect(timetable.teachers).toEqual([
      { subjectId: 'computer-networks', stream: 'lab', teacher: 'Teacher A', from: SEMESTER_START },
      { subjectId: 'computer-networks', stream: 'lecture', teacher: 'Teacher B', from: SEMESTER_START },
      { subjectId: 'technical-business-writing', stream: 'lecture', teacher: 'Teacher C', from: SEMESTER_START },
    ]);
    expect(timetable.exceptions).toEqual([]);
    expect(timetable.extras).toEqual([]);
  });

  it('produces the same ids as the built-in timetable', () => {
    const dayName = ['', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const subjectName = new Map(SEED_SUBJECTS.map((subject) => [subject.id, subject.name]));
    const markdown = SEED_SLOTS.map(
      (slot) =>
        `| ${dayName[slot.weekday]} | ${slot.start}–${slot.end} | ${subjectName.get(slot.subjectId)} | ` +
        `${slot.stream === 'lab' ? 'Lab' : 'Lecture'} | Teacher | Room |`,
    ).join('\n');
    const timetable = importTimetable(markdown, SEMESTER_START);
    expect(timetable.slots.map((slot) => slot.id)).toEqual(SEED_SLOTS.map((slot) => slot.id));
    expect(timetable.subjects.map((subject) => subject.id).sort()).toEqual(SEED_SUBJECTS.map((subject) => subject.id).sort());
  });

  it('reports the line of a bad row', () => {
    const badStream = SAMPLE.replace('| Lab | Teacher A', '| Seminar | Teacher A');
    expect(() => importTimetable(badStream, SEMESTER_START)).toThrow('line 5: stream must be Lecture or Lab');
    const badTime = SAMPLE.replace('08:30–10:00', '10:00–08:30');
    expect(() => importTimetable(badTime, SEMESTER_START)).toThrow('line 5: the class must end after it starts');
  });

  it('reports line numbers for malformed clock times and ranges', () => {
    for (const time of ['24:00–25:00', '8:30–10:00', '08:30', '08:30–08:30']) {
      expect(() => importTimetable(SAMPLE.replace('08:30–10:00', time), SEMESTER_START)).toThrow('line 5:');
    }
  });

  it('accepts CRLF, case-insensitive days and streams, and em dashes', () => {
    const markdown = SAMPLE.replace(/\n/g, '\r\n').replace('| Mon |', '| MON |').replace('| Lab |', '| LAB |').replace('08:30–10:00', '08:30 — 10:00');
    expect(importTimetable(markdown, SEMESTER_START).slots[0].id).toBe('mon-0830');
  });

  it('allows blank teacher and room cells', () => {
    const timetable = importTimetable('| Mon | 08:30–10:00 | Subject | Lecture | | |', SEMESTER_START);
    expect(timetable.teachers).toEqual([]);
    expect(timetable.slots[0].room).toBeUndefined();
  });

  it('deduplicates repeated teacher assignments for the same subject and stream', () => {
    const markdown = SAMPLE + '\n| Thu | 08:30–10:00 | Computer Networks | Lab | Teacher A | Lab 1 |';
    expect(importTimetable(markdown, SEMESTER_START).teachers).toHaveLength(3);
  });

  it('rejects inconsistent teacher assignments instead of silently discarding one', () => {
    const markdown = SAMPLE + '\n| Thu | 08:30–10:00 | Computer Networks | Lab | Teacher D | Lab 1 |';
    expect(() => importTimetable(markdown, SEMESTER_START)).toThrow('line 8: conflicting teachers');
  });

  it('rejects duplicate slot ids instead of counting a class twice', () => {
    const markdown = SAMPLE + '\n| Mon | 08:30–10:00 | Subject | Lecture | Teacher D | Room 2 |';
    expect(() => importTimetable(markdown, SEMESTER_START)).toThrow('line 8: duplicate slot');
  });

  it('rejects overlapping classes while allowing adjacent classes', () => {
    const overlap = SAMPLE + '\n| Mon | 09:30–10:30 | Subject | Lecture | Teacher D | Room 2 |';
    expect(() => importTimetable(overlap, SEMESTER_START)).toThrow('line 8: overlapping classes');
    const adjacent = SAMPLE + '\n| Mon | 10:00–11:00 | Subject | Lecture | Teacher D | Room 2 |';
    expect(importTimetable(adjacent, SEMESTER_START).slots).toHaveLength(4);
  });

  it('rejects subject names that collide after slugging', () => {
    const markdown = SAMPLE + '\n| Thu | 08:30–10:00 | Technical Business Writing | Lecture | Teacher C | Room 6 |';
    expect(() => importTimetable(markdown, SEMESTER_START)).toThrow('line 8: conflicting subject names');
  });

  it('rejects empty subjects', () => {
    expect(() => importTimetable(SAMPLE.replace('Computer Networks', '  '), SEMESTER_START)).toThrow('line 5: the subject is empty');
  });

  it('rejects rows with missing or extra columns rather than importing a partial timetable', () => {
    const missing = SAMPLE.replace('| Teacher A | Lab 1 |', '| Teacher A |');
    const extra = SAMPLE.replace('| Teacher A | Lab 1 |', '| Teacher A | Lab 1 | Extra |');
    expect(() => importTimetable(missing, SEMESTER_START)).toThrow('line 5: expected 6 columns');
    expect(() => importTimetable(extra, SEMESTER_START)).toThrow('line 5: expected 6 columns');
  });

  it('rejects unknown weekdays inside the timetable', () => {
    expect(() => importTimetable(SAMPLE.replace('| Mon |', '| Mno |'), SEMESTER_START)).toThrow('line 5: day must be Mon through Sun');
  });

  it('ignores prose and unrelated tables', () => {
    const markdown = '| Item | Description |\n| --- | --- |\n| Note | Synthetic data |\n\n' + SAMPLE;
    expect(importTimetable(markdown, SEMESTER_START).slots).toHaveLength(3);
  });

  it('rejects an invalid semester start', () => {
    expect(() => importTimetable(SAMPLE, '2026-02-30')).toThrow('Invalid date');
  });

  it('refuses a file with no timetable rows', () => {
    expect(() => importTimetable('# Nothing here', SEMESTER_START)).toThrow('No timetable rows found');
  });
});

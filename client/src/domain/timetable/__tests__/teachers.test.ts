import { teacherOn } from '../teachers';
import type { TeacherAssignment } from '../types';

const ASSIGNMENTS: TeacherAssignment[] = [
  { subjectId: 'machine-learning', stream: 'lab', teacher: 'Teacher A', from: '2026-09-07' },
  { subjectId: 'machine-learning', stream: 'lab', teacher: 'Teacher B', from: '2026-09-21' },
  { subjectId: 'machine-learning', stream: 'lecture', teacher: 'Teacher C', from: '2026-09-07' },
];

describe('teacherOn (R-TT-5)', () => {
  it('keeps the earlier teacher for classes before the change', () => {
    expect(teacherOn(ASSIGNMENTS, 'machine-learning', 'lab', '2026-09-16')).toBe('Teacher A');
  });

  it('uses the new teacher from the change date onwards', () => {
    expect(teacherOn(ASSIGNMENTS, 'machine-learning', 'lab', '2026-09-21')).toBe('Teacher B');
    expect(teacherOn(ASSIGNMENTS, 'machine-learning', 'lab', '2026-10-05')).toBe('Teacher B');
  });

  it('keeps streams separate', () => {
    expect(teacherOn(ASSIGNMENTS, 'machine-learning', 'lecture', '2026-10-05')).toBe('Teacher C');
  });

  it('returns undefined before any assignment or for an unknown subject', () => {
    expect(teacherOn(ASSIGNMENTS, 'machine-learning', 'lab', '2026-09-01')).toBeUndefined();
    expect(teacherOn(ASSIGNMENTS, 'computer-networks', 'lab', '2026-09-16')).toBeUndefined();
  });

  it('finds the latest assignment regardless of input order without mutating it', () => {
    const assignments = [ASSIGNMENTS[1], ASSIGNMENTS[0], ASSIGNMENTS[2]];
    const before = assignments.map((assignment) => ({ ...assignment }));
    expect(teacherOn(assignments, 'machine-learning', 'lab', '2026-10-05')).toBe('Teacher B');
    expect(assignments).toEqual(before);
  });

  it('lets the last assignment win when its effective date is equal', () => {
    const assignments: TeacherAssignment[] = [
      ...ASSIGNMENTS,
      { subjectId: 'machine-learning', stream: 'lab', teacher: 'Teacher D', from: '2026-09-21' },
    ];
    expect(teacherOn(assignments, 'machine-learning', 'lab', '2026-09-21')).toBe('Teacher D');
  });

  it('rejects malformed dates instead of comparing them as strings', () => {
    expect(() => teacherOn(ASSIGNMENTS, 'machine-learning', 'lab', '2026-02-30')).toThrow('Invalid date');
    expect(() => teacherOn([{ ...ASSIGNMENTS[0], from: '2026-02-30' }], 'machine-learning', 'lab', '2026-09-21')).toThrow('Invalid date');
  });
});

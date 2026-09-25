import { displayName, fileName } from '../naming';

describe('displayName (R-NAME-1, R-TT-4)', () => {
  it('names a lecture', () => {
    const label = { kind: 'class', subjectName: 'Fundamentals of Accounting', stream: 'lecture', number: 5 } as const;
    expect(displayName('2026-09-21', label)).toBe('Mon 21 Sep 2026 – Fundamentals of Accounting – Lecture 5');
  });

  it('names a lab', () => {
    const label = { kind: 'class', subjectName: 'Machine Learning', stream: 'lab', number: 4 } as const;
    expect(displayName('2026-09-16', label)).toBe('Wed 16 Sep 2026 – Machine Learning – Lab 4');
  });

  it('names an Other recording with its title and no number', () => {
    expect(displayName('2026-09-11', { kind: 'other', title: '  Cyber Workshop ' })).toBe('Fri 11 Sep 2026 – Cyber Workshop');
  });

  it('refuses an Other recording without a title', () => {
    expect(() => displayName('2026-09-11', { kind: 'other', title: '   ' })).toThrow('needs a title');
  });

  it('refuses a class with an empty subject or invalid number', () => {
    expect(() => displayName('2026-09-11', { kind: 'class', subjectName: ' ', stream: 'lecture', number: 1 })).toThrow('subject');
    for (const number of [0, -1, 1.5, NaN, Infinity]) {
      expect(() => displayName('2026-09-11', { kind: 'class', subjectName: 'Subject', stream: 'lecture', number })).toThrow('positive integer');
    }
  });
});

describe('fileName (R-NAME-2)', () => {
  it('starts with the ISO date so files sort by date', () => {
    const label = { kind: 'class', subjectName: 'Technical & Business Writing', stream: 'lecture', number: 3 } as const;
    expect(fileName('2026-09-16', label)).toBe('2026-09-16 Technical & Business Writing – Lecture 3');
  });

  it('removes characters that are not allowed in file names', () => {
    expect(fileName('2026-09-11', { kind: 'other', title: 'Q/A: Guest Talk?' })).toBe('2026-09-11 Q A Guest Talk');
  });

  it('removes control characters and trailing dots for portable file names', () => {
    expect(fileName('2026-09-11', { kind: 'other', title: 'Guest\u0000 Talk... ' })).toBe('2026-09-11 Guest Talk');
  });

  it('rejects a title with nothing left after filename sanitization', () => {
    expect(() => fileName('2026-09-11', { kind: 'other', title: '/:*?..' })).toThrow('title');
  });

  it('rejects an invalid date', () => {
    expect(() => fileName('2026-13-01', { kind: 'other', title: 'Talk' })).toThrow('Invalid date');
    expect(() => displayName('2026-02-30', { kind: 'other', title: 'Talk' })).toThrow('Invalid date');
  });
});

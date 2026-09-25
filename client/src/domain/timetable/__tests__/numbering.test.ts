import { sessionNumber } from '../numbering';
import type { SessionRef } from '../numbering';
import { seedTimetable } from '../seed';

function accounting(date: string, start = '10:15'): SessionRef {
  return { subjectId: 'fundamentals-of-accounting', stream: 'lecture', date, start };
}

describe('sessionNumber (R-NUM-1, R-NUM-2)', () => {
  it('worked example: Accounting on Mon 21 Sep 2026 is Lecture 5', () => {
    expect(sessionNumber(seedTimetable(), accounting('2026-09-21'))).toBe(5);
  });

  it('numbers the first class of the semester 1', () => {
    const ref: SessionRef = { subjectId: 'computer-networks', stream: 'lab', date: '2026-09-07', start: '08:30' };
    expect(sessionNumber(seedTimetable(), ref)).toBe(1);
  });

  it('counts lectures and labs of the same subject separately', () => {
    const tt = seedTimetable();
    expect(sessionNumber(tt, { subjectId: 'computer-networks', stream: 'lecture', date: '2026-09-15', start: '14:00' })).toBe(2);
    expect(sessionNumber(tt, { subjectId: 'computer-networks', stream: 'lab', date: '2026-09-15', start: '08:30' })).toBe(4);
  });

  it('counts a stream that meets on two weekdays', () => {
    const ref: SessionRef = { subjectId: 'machine-learning', stream: 'lab', date: '2026-09-16', start: '12:00' };
    expect(sessionNumber(seedTimetable(), ref)).toBe(4);
  });

  it('skips holidays and cancelled classes, and renumbers when they are removed', () => {
    const tt = seedTimetable();
    tt.exceptions.push({ kind: 'holiday', date: '2026-09-08' });
    expect(sessionNumber(tt, accounting('2026-09-21'))).toBe(4);
    tt.exceptions.push({ kind: 'cancelled', slotId: 'mon-1015', date: '2026-09-14' });
    expect(sessionNumber(tt, accounting('2026-09-21'))).toBe(3);
    tt.exceptions = [];
    expect(sessionNumber(tt, accounting('2026-09-21'))).toBe(5);
  });

  it('counts make-up sessions in time order', () => {
    const tt = seedTimetable();
    tt.extras.push({ subjectId: 'fundamentals-of-accounting', stream: 'lecture', date: '2026-09-18', start: '10:00' });
    expect(sessionNumber(tt, accounting('2026-09-18', '10:00'))).toBe(5);
    expect(sessionNumber(tt, accounting('2026-09-21'))).toBe(6);
  });

  it('rejects classes that did not take place', () => {
    const tt = seedTimetable();
    expect(() => sessionNumber(tt, accounting('2026-09-16'))).toThrow('add it as a make-up session first');
    tt.exceptions.push({ kind: 'cancelled', slotId: 'mon-1015', date: '2026-09-21' });
    expect(() => sessionNumber(tt, accounting('2026-09-21'))).toThrow('add it as a make-up session first');
  });

  it('rejects dates before the semester', () => {
    expect(() => sessionNumber(seedTimetable(), accounting('2026-08-31'))).toThrow('before the semester start');
  });

  it('orders make-up sessions on the same day and excludes future sessions', () => {
    const tt = seedTimetable();
    tt.extras.push(
      accounting('2026-09-21', '08:00'),
      accounting('2026-09-21', '17:00'),
      accounting('2026-09-22', '08:00'),
      accounting('2026-09-01', '08:00'),
    );
    expect(sessionNumber(tt, accounting('2026-09-21', '08:00'))).toBe(5);
    expect(sessionNumber(tt, accounting('2026-09-21'))).toBe(6);
    expect(sessionNumber(tt, accounting('2026-09-21', '17:00'))).toBe(7);
  });

  it('counts an explicit make-up on a holiday or cancelled date', () => {
    const tt = seedTimetable();
    tt.exceptions.push({ kind: 'holiday', date: '2026-09-21' });
    tt.extras.push(accounting('2026-09-21'));
    expect(sessionNumber(tt, accounting('2026-09-21'))).toBe(5);
  });

  it('validates dates and times before comparing session positions', () => {
    expect(() => sessionNumber(seedTimetable(), accounting('2026-09-31'))).toThrow('Invalid date');
    expect(() => sessionNumber(seedTimetable(), accounting('2026-09-21', '9:00'))).toThrow('Invalid time');
    const tt = seedTimetable();
    tt.semesterStart = '2026-09-99';
    expect(() => sessionNumber(tt, accounting('2026-09-21'))).toThrow('Invalid date');
  });

  it('counts a session once when extras duplicate each other or an active weekly slot', () => {
    const tt = seedTimetable();
    tt.extras.push(
      accounting('2026-09-21'),
      accounting('2026-09-21'),
      accounting('2026-09-18', '10:00'),
      accounting('2026-09-18', '10:00'),
    );
    expect(sessionNumber(tt, accounting('2026-09-18', '10:00'))).toBe(5);
    expect(sessionNumber(tt, accounting('2026-09-21'))).toBe(6);
  });
});

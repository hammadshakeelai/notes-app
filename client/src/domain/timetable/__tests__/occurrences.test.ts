import { isExcepted, occurrenceKey, occurrencesBetween } from '../occurrences';
import { SEED_SLOTS, SEED_SUBJECTS, seedTimetable } from '../seed';
import { minutesOf } from '../../calendar';

describe('seed timetable', () => {
  it('creates independent editable timetable objects', () => {
    const first = seedTimetable();
    const second = seedTimetable();
    first.subjects[0].name = 'Edited subject';
    first.slots[0].start = '09:00';
    first.exceptions.push({ kind: 'holiday', date: '2026-09-07' });
    expect(second.subjects[0].name).toBe('Computer Networks');
    expect(second.slots[0].start).toBe('08:30');
    expect(second.exceptions).toEqual([]);
    expect(SEED_SUBJECTS[0].name).toBe('Computer Networks');
    expect(SEED_SLOTS[0].start).toBe('08:30');
  });

  it('has 16 weekly classes across 6 subjects, Monday to Thursday', () => {
    expect(SEED_SLOTS).toHaveLength(16);
    expect(SEED_SUBJECTS).toHaveLength(6);
    expect(SEED_SLOTS.every((s) => s.weekday >= 1 && s.weekday <= 4)).toBe(true);
  });

  it('only uses known subjects and never overlaps on the same day', () => {
    const ids = new Set(SEED_SUBJECTS.map((s) => s.id));
    expect(SEED_SLOTS.every((s) => ids.has(s.subjectId))).toBe(true);
    for (const a of SEED_SLOTS) {
      expect(minutesOf(a.start) < minutesOf(a.end)).toBe(true);
      for (const b of SEED_SLOTS) {
        if (a === b || a.weekday !== b.weekday) continue;
        const overlap = minutesOf(a.start) < minutesOf(b.end) && minutesOf(b.start) < minutesOf(a.end);
        expect(overlap).toBe(false);
      }
    }
  });
});

describe('occurrencesBetween', () => {
  it('sorts same-day classes without mutating the supplied slots', () => {
    const slots = [...SEED_SLOTS].reverse();
    const originalIds = slots.map((slot) => slot.id);
    const day = occurrencesBetween(slots, '2026-09-07', '2026-09-07');
    expect(day.map((occ) => occ.slot.id)).toEqual(['mon-0830', 'mon-1015', 'mon-1200', 'mon-1400']);
    expect(slots.map((slot) => slot.id)).toEqual(originalIds);
  });

  it('validates both range endpoints even for empty inputs', () => {
    expect(() => occurrencesBetween([], 'bad', '2026-09-07')).toThrow('Invalid date');
    expect(() => occurrencesBetween([], '2026-09-07', '2026-09-99')).toThrow('Invalid date');
  });

  it('can list the final supported date without overflowing the date range', () => {
    expect(occurrencesBetween([], '9999-12-31', '9999-12-31')).toEqual([]);
  });

  it('lists the first week of the semester in time order', () => {
    const week = occurrencesBetween(SEED_SLOTS, '2026-09-07', '2026-09-13');
    expect(week).toHaveLength(16);
    expect(occurrenceKey(week[0].slot.id, week[0].date)).toBe('mon-0830@2026-09-07');
    expect(occurrenceKey(week[1].slot.id, week[1].date)).toBe('mon-1015@2026-09-07');
    expect(occurrenceKey(week[15].slot.id, week[15].date)).toBe('thu-1400@2026-09-10');
  });

  it('returns nothing for a weekend or an empty range', () => {
    expect(occurrencesBetween(SEED_SLOTS, '2026-09-11', '2026-09-13')).toHaveLength(0);
    expect(occurrencesBetween(SEED_SLOTS, '2026-09-10', '2026-09-09')).toHaveLength(0);
  });
});

describe('isExcepted', () => {
  it('knows holidays and cancelled classes', () => {
    const tt = seedTimetable();
    tt.exceptions.push({ kind: 'holiday', date: '2026-09-08' });
    tt.exceptions.push({ kind: 'cancelled', slotId: 'mon-1015', date: '2026-09-14' });
    const [monCn, monAcc] = occurrencesBetween(tt.slots, '2026-09-14', '2026-09-14');
    const [tueCn] = occurrencesBetween(tt.slots, '2026-09-08', '2026-09-08');
    expect(isExcepted(tt, monCn)).toBe(false);
    expect(isExcepted(tt, monAcc)).toBe(true);
    expect(isExcepted(tt, tueCn)).toBe(true);
  });
});

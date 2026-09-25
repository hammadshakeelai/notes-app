import { occurrenceKey } from '../occurrences';
import { classesNeedingPrompt } from '../prompts';
import { seedTimetable } from '../seed';

const MON = '2026-09-21';
const NONE: ReadonlySet<string> = new Set();

function ids(date: string, time: string, handled = NONE, tt = seedTimetable()): string[] {
  return classesNeedingPrompt(tt, date, time, handled).map((occurrence) => occurrence.slot.id);
}

describe('classesNeedingPrompt (R-NUM-3)', () => {
  it('asks about classes that ended at least 15 minutes ago', () => {
    expect(ids(MON, '11:59')).toEqual(['mon-0830']);
    expect(ids(MON, '12:05')).toEqual(['mon-0830', 'mon-1015']);
  });

  it('includes the exact 15-minute boundary and excludes the minute before', () => {
    expect(ids(MON, '10:14')).toEqual([]);
    expect(ids(MON, '10:15')).toEqual(['mon-0830']);
  });

  it('skips classes that were recorded or already answered', () => {
    expect(ids(MON, '12:05', new Set([occurrenceKey('mon-1015', MON)]))).toEqual(['mon-0830']);
  });

  it('does not suppress a prompt because the same slot was handled on another day', () => {
    expect(ids(MON, '10:15', new Set([occurrenceKey('mon-0830', '2026-09-14')]))).toEqual(['mon-0830']);
  });

  it('skips holidays and cancelled classes', () => {
    const holiday = seedTimetable();
    holiday.exceptions.push({ kind: 'holiday', date: MON });
    expect(ids(MON, '17:00', NONE, holiday)).toEqual([]);

    const cancelled = seedTimetable();
    cancelled.exceptions.push({ kind: 'cancelled', slotId: 'mon-0830', date: MON });
    expect(ids(MON, '12:05', NONE, cancelled)).toEqual(['mon-1015']);
  });

  it('never asks on days without classes or before the semester', () => {
    expect(ids('2026-09-18', '17:00')).toEqual([]);
    expect(ids('2026-09-01', '17:00')).toEqual([]);
  });

  it('rejects malformed dates and times even before the semester starts', () => {
    expect(() => ids('2026-02-30', '17:00')).toThrow('Invalid date');
    expect(() => ids('2026-09-01', '24:00')).toThrow('Invalid time');
  });
});

import { addDays, formatDisplayDate, minutesOf, weekdayOf } from '../calendar';

describe('weekdayOf', () => {
  it('knows the semester starts on a Monday', () => {
    expect(weekdayOf('2026-09-07')).toBe(1);
  });

  it('returns 5 for Friday and 7 for Sunday', () => {
    expect(weekdayOf('2026-09-11')).toBe(5);
    expect(weekdayOf('2026-09-13')).toBe(7);
  });

  it('rejects impossible or badly formatted dates', () => {
    expect(() => weekdayOf('2026-02-30')).toThrow('Invalid date');
    expect(() => weekdayOf('21-09-2026')).toThrow('Invalid date');
  });
});

describe('addDays', () => {
  it('crosses month and year ends in both directions', () => {
    expect(addDays('2026-09-30', 1)).toBe('2026-10-01');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2026-09-07', -7)).toBe('2026-08-31');
  });
});

describe('minutesOf', () => {
  it('converts HH:MM to minutes after midnight', () => {
    expect(minutesOf('00:00')).toBe(0);
    expect(minutesOf('10:01')).toBe(601);
    expect(minutesOf('23:59')).toBe(1439);
  });

  it('rejects malformed times', () => {
    expect(() => minutesOf('24:00')).toThrow('Invalid time');
    expect(() => minutesOf('9:30')).toThrow('Invalid time');
  });
});

describe('formatDisplayDate', () => {
  it('formats dates the way recording names show them', () => {
    expect(formatDisplayDate('2026-09-21')).toBe('Mon 21 Sep 2026');
    expect(formatDisplayDate('2026-09-11')).toBe('Fri 11 Sep 2026');
  });
});

describe('calendar boundaries', () => {
  it('handles leap years without accepting rolled-over dates', () => {
    expect(addDays('2024-02-28', 1)).toBe('2024-02-29');
    expect(addDays('2024-02-29', 1)).toBe('2024-03-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
    expect(() => weekdayOf('2026-02-29')).toThrow('Invalid date');
    expect(() => weekdayOf('2026-13-01')).toThrow('Invalid date');
    expect(() => addDays('2026-00-01', 1)).toThrow('Invalid date');
  });

  it('preserves four-digit years, including years below 100', () => {
    expect(addDays('0099-12-31', 1)).toBe('0100-01-01');
    expect(addDays('0000-01-01', 0)).toBe('0000-01-01');
    expect(() => addDays('9999-12-31', 1)).toThrow('Invalid date');
    expect(() => addDays('0000-01-01', -1)).toThrow('Invalid date');
  });

  it('rejects fractional and non-finite day offsets', () => {
    for (const days of [0.5, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(() => addDays('2026-09-07', days)).toThrow('Invalid day offset');
    }
  });

  it('rejects malformed inputs in every calendar helper', () => {
    expect(() => formatDisplayDate('2026-9-07')).toThrow('Invalid date');
    expect(() => weekdayOf('2026-09-07\n')).toThrow('Invalid date');
    expect(() => minutesOf('12:60')).toThrow('Invalid time');
    expect(() => minutesOf('12:00\n')).toThrow('Invalid time');
    expect(() => minutesOf('12:00:00')).toThrow('Invalid time');
  });
});

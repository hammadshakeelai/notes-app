import { detectClass } from '../detect';
import { SEED_SLOTS } from '../seed';

const MON = '2026-09-21';
const THU = '2026-09-17';
const FRI = '2026-09-18';

/** 'now:mon-1015', 'upcoming:…', 'just-ended:…' or 'ask'. */
function detected(date: string, time: string): string {
  const d = detectClass(SEED_SLOTS, date, time);
  return d.kind === 'ask' ? 'ask' : `${d.kind}:${d.slot.id}`;
}

describe('detectClass (R-TT-3)', () => {
  it('picks the class in progress', () => {
    expect(detected(MON, '10:30')).toBe('now:mon-1015');
    expect(detected(THU, '11:30')).toBe('now:thu-1001');
  });

  it('prefers a class starting within 15 minutes over one that just ended', () => {
    expect(detected(MON, '10:05')).toBe('upcoming:mon-1015');
    expect(detected(MON, '08:15')).toBe('upcoming:mon-0830');
    expect(detected(THU, '11:59')).toBe('upcoming:thu-1200');
  });

  it('falls back to a class that ended within 10 minutes', () => {
    expect(detected(MON, '16:05')).toBe('just-ended:mon-1400');
    expect(detected(MON, '16:10')).toBe('just-ended:mon-1400');
  });

  it('asks when nothing is close enough', () => {
    expect(detected(MON, '08:14')).toBe('ask');
    expect(detected(MON, '16:11')).toBe('ask');
    expect(detected(FRI, '10:00')).toBe('ask');
  });

  it('switches at the exact start of the next class', () => {
    expect(detected(THU, '12:00')).toBe('now:thu-1200');
  });

  it('uses inclusive starts and exclusive ends', () => {
    expect(detected(MON, '08:30')).toBe('now:mon-0830');
    expect(detected(MON, '10:00')).toBe('upcoming:mon-1015');
    expect(detected(MON, '16:00')).toBe('just-ended:mon-1400');
  });

  it('does not depend on input order or mutate slots', () => {
    const slots = [...SEED_SLOTS].reverse();
    const ids = slots.map((slot) => slot.id);
    expect(detectClass(slots, MON, '10:05')).toEqual({ kind: 'upcoming', slot: SEED_SLOTS[1] });
    expect(slots.map((slot) => slot.id)).toEqual(ids);
  });

  it('validates the supplied date and time even when there are no slots', () => {
    expect(() => detectClass([], '2026-02-30', '10:00')).toThrow('Invalid date');
    expect(() => detectClass([], MON, '24:00')).toThrow('Invalid time');
  });
});

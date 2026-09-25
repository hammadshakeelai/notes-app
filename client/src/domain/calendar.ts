/**
 * Calendar helpers for the timetable.
 * Dates are local 'YYYY-MM-DD' strings and times are local 'HH:MM' strings,
 * so the domain code never converts between time zones.
 */
export type IsoDate = string;
export type HhMm = string;
/** ISO 8601 weekday: Monday = 1 … Sunday = 7. */
export type Weekday = 1 | 2 | 3 | 4 | 5 | 6 | 7;

const DAY_MS = 86_400_000;
const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;
const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function toUtcMs(date: IsoDate): number {
  const m = DATE_RE.exec(date);
  if (!m || m[0] !== date) throw new Error(`Invalid date: ${date}`);
  // Parsing an explicit UTC date avoids Date.UTC's special handling of years 00–99.
  const ms = Date.parse(`${date}T00:00:00.000Z`);
  if (!Number.isFinite(ms) || fromUtcMs(ms) !== date) throw new Error(`Invalid date: ${date}`);
  return ms;
}

function fromUtcMs(ms: number): IsoDate {
  if (!Number.isFinite(ms) || Math.abs(ms) > 8_640_000_000_000_000) {
    throw new Error('Invalid date: outside the supported calendar range');
  }
  const date = new Date(ms).toISOString().slice(0, 10);
  if (!DATE_RE.test(date)) throw new Error('Invalid date: outside the YYYY-MM-DD range');
  return date;
}

export function weekdayOf(date: IsoDate): Weekday {
  const day = new Date(toUtcMs(date)).getUTCDay(); // 0 = Sunday
  return (day === 0 ? 7 : day) as Weekday;
}

export function addDays(date: IsoDate, days: number): IsoDate {
  if (!Number.isSafeInteger(days)) throw new Error(`Invalid day offset: ${days}`);
  return fromUtcMs(toUtcMs(date) + days * DAY_MS);
}

export function minutesOf(time: HhMm): number {
  const m = TIME_RE.exec(time);
  if (!m || m[0] !== time) throw new Error(`Invalid time: ${time}`);
  return Number(m[1]) * 60 + Number(m[2]);
}

/** 'YYYY-MM-DD' → 'Mon 21 Sep 2026'. */
export function formatDisplayDate(date: IsoDate): string {
  const weekday = weekdayOf(date); // also validates the date
  const [year, month, day] = date.split('-');
  return `${DAY_NAMES[weekday - 1]} ${Number(day)} ${MONTH_NAMES[Number(month) - 1]} ${year}`;
}

import { minutesOf, weekdayOf } from '../calendar';
import type { HhMm, IsoDate } from '../calendar';
import type { Slot } from './types';

export const UPCOMING_WINDOW_MIN = 15;
export const JUST_ENDED_WINDOW_MIN = 10;

export type Detection =
  | { kind: 'now'; slot: Slot } // (1) the class in progress
  | { kind: 'upcoming'; slot: Slot } // (2) starts within the next 15 minutes
  | { kind: 'just-ended'; slot: Slot } // (3) ended within the last 10 minutes
  | { kind: 'ask' }; // (4) ask for the subject and stream, or "Other"

/** R-TT-3: which class is the user probably recording right now? Rules are tried in order. */
export function detectClass(slots: Slot[], date: IsoDate, time: HhMm): Detection {
  const now = minutesOf(time);
  const weekday = weekdayOf(date);
  const today = slots.filter((s) => s.weekday === weekday);

  const current = today.find((s) => minutesOf(s.start) <= now && now < minutesOf(s.end));
  if (current) return { kind: 'now', slot: current };

  const upcoming = today
    .filter((s) => minutesOf(s.start) > now && minutesOf(s.start) - now <= UPCOMING_WINDOW_MIN)
    .sort((a, b) => minutesOf(a.start) - minutesOf(b.start))[0];
  if (upcoming) return { kind: 'upcoming', slot: upcoming };

  const ended = today
    .filter((s) => minutesOf(s.end) <= now && now - minutesOf(s.end) <= JUST_ENDED_WINDOW_MIN)
    .sort((a, b) => minutesOf(b.end) - minutesOf(a.end))[0];
  if (ended) return { kind: 'just-ended', slot: ended };

  return { kind: 'ask' };
}

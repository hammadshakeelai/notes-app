# M1: Domain Core Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create the Expo project with CI, and implement all timetable logic (class detection, numbering, naming, teacher changes, prompts, timetable import) as pure, fully tested TypeScript.

**Architecture:** An Expo (React Native + TypeScript) project in `client/`, created now so CI and tooling exist from the first commit. All logic in this milestone lives in `client/src/domain/`: plain TypeScript functions with no React, no storage, no network and no clock. Screens (M3) and the recorder (M2) call these functions, passing in today's date and time. Dates are `'YYYY-MM-DD'` strings and times are `'HH:MM'` strings in local time, so no time-zone logic exists in the domain.

**Tech Stack:** Expo (latest SDK via `create-expo-app@latest`, default template), TypeScript (strict), Jest with the `jest-expo` preset, GitHub Actions.

**Spec:** [docs/specs/2026-09-18-notes-app-design.md](../../specs/2026-09-18-notes-app-design.md). Requirements: R-TT-1 (import logic), R-TT-2, R-TT-3, R-TT-4, R-TT-5, R-NAME-1, R-NAME-2, R-NUM-1, R-NUM-2, R-NUM-3 (selection logic), R-NUM-4 (listing logic). Roadmap: [M1](../../roadmap.md). Decisions: [ADR-0002](../../adr/0002-expo-single-codebase.md), [ADR-0009](../../adr/0009-numbering-follows-timetable.md), [ADR-0014](../../adr/0014-private-data-out-of-repo.md).

## Global Constraints

- Node 24 locally and in CI; npm 11.
- TypeScript `strict` (the Expo template's `tsconfig.json` enables it). Use `import type` for type-only imports.
- `client/src/domain/**` is pure: no React, no Expo modules, no I/O, no `Date.now()` or `new Date()` without an argument. Callers pass `date` and `time` in.
- Dates are `'YYYY-MM-DD'`, times are `'HH:MM'` (24-hour), both local. Weekdays are ISO: Monday = 1 … Sunday = 7.
- The semester starts on `2026-09-07` (a Monday).
- Recording names use an en dash with spaces (` – `, U+2013) between parts, e.g. `Mon 21 Sep 2026 – Fundamentals of Accounting – Lecture 5`. File names start with the ISO date: `2026-09-21 Fundamentals of Accounting – Lecture 5`.
- Stream labels are exactly `Lecture` and `Lab`.
- Detection windows: a class starting within **15** minutes, or one that ended within **10** minutes. The "Missed or Cancelled?" prompt comes **15** minutes after a class ends.
- **No personal data in committed code or tests** (ADR-0014): no real teacher names, rooms or lecture content. Tests use placeholders such as `Teacher A` and `Room 7`.
- Tests live in `client/src/**/__tests__/*.test.ts`. Commits follow Conventional Commits and end with the `Co-Authored-By` trailer when an agent writes them.

## File Structure

| File | Responsibility |
| --- | --- |
| `client/` | Expo project from `create-expo-app` (default template) |
| `client/package.json` | Adds `test` and `typecheck` scripts and the Jest config |
| `.github/workflows/ci.yml` | Type check, lint and tests on every push and pull request |
| `client/src/domain/calendar.ts` | Date/time helpers: weekday, add days, minutes, display date |
| `client/src/domain/timetable/types.ts` | Domain types: Subject, Slot, TeacherAssignment, CalendarException, ExtraSession, Timetable, Occurrence |
| `client/src/domain/timetable/seed.ts` | This semester's timetable (Appendix A: subjects and times only) |
| `client/src/domain/timetable/occurrences.ts` | Expanding weekly slots into dated classes; holiday and cancellation checks |
| `client/src/domain/timetable/detect.ts` | R-TT-3 class detection |
| `client/src/domain/timetable/numbering.ts` | R-NUM-1/2 lecture and lab numbers |
| `client/src/domain/timetable/naming.ts` | R-NAME-1/2 and R-TT-4 display and file names |
| `client/src/domain/timetable/teachers.ts` | R-TT-5 teacher on a date |
| `client/src/domain/timetable/prompts.ts` | R-NUM-3 which classes need a "Missed or Cancelled?" prompt |
| `client/src/domain/timetable/import.ts` | R-TT-1 reading the private timetable Markdown file |
| `client/src/domain/timetable/index.ts` | Public entry point for M2/M3 |

---

### Task 1: Project skeleton, CI and calendar helpers

**Files:**
- Create: `client/` (generated), `.github/workflows/ci.yml`, `client/src/domain/calendar.ts`
- Modify: `client/package.json`
- Test: `client/src/domain/__tests__/calendar.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `type IsoDate = string`, `type HhMm = string`, `type Weekday = 1 | 2 | 3 | 4 | 5 | 6 | 7`
  - `weekdayOf(date: IsoDate): Weekday`
  - `addDays(date: IsoDate, days: number): IsoDate`
  - `minutesOf(time: HhMm): number`
  - `formatDisplayDate(date: IsoDate): string`

  Invalid input throws `Error('Invalid date: …')` or `Error('Invalid time: …')`.

- [ ] **Step 1: Create a branch**

```bash
git checkout -b feat/m1-domain-core
```

- [ ] **Step 2: Generate the Expo project**

Run from the repo root:

```bash
npx create-expo-app@latest client --template default
```

Expected: a `client/` folder with `app/`, `package.json` and `tsconfig.json` (containing `"strict": true`), and dependencies installed.

- [ ] **Step 3: Add Jest**

```bash
cd client
npx expo install jest-expo jest @types/jest -- --save-dev
```

Then edit `client/package.json`: add two scripts, and a top-level `jest` key that only runs tests under `src/`:

```json
{
  "scripts": {
    "test": "jest",
    "typecheck": "tsc --noEmit"
  },
  "jest": {
    "preset": "jest-expo",
    "testMatch": ["<rootDir>/src/**/__tests__/**/*.test.ts?(x)"]
  }
}
```

Keep the template's existing scripts (`start`, `android`, `web`, `lint`, …) and merge these in.

- [ ] **Step 4: Write the failing test**

Create `client/src/domain/__tests__/calendar.test.ts`:

```ts
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
```

- [ ] **Step 5: Run it and watch it fail**

Run: `npx jest src/domain/__tests__/calendar.test.ts`
Expected: FAIL with `Cannot find module '../calendar'`.

- [ ] **Step 6: Implement**

Create `client/src/domain/calendar.ts`:

```ts
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
  if (!m) throw new Error(`Invalid date: ${date}`);
  const ms = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  if (fromUtcMs(ms) !== date) throw new Error(`Invalid date: ${date}`);
  return ms;
}

function fromUtcMs(ms: number): IsoDate {
  return new Date(ms).toISOString().slice(0, 10);
}

export function weekdayOf(date: IsoDate): Weekday {
  const day = new Date(toUtcMs(date)).getUTCDay(); // 0 = Sunday
  return (day === 0 ? 7 : day) as Weekday;
}

export function addDays(date: IsoDate, days: number): IsoDate {
  return fromUtcMs(toUtcMs(date) + days * DAY_MS);
}

export function minutesOf(time: HhMm): number {
  const m = TIME_RE.exec(time);
  if (!m) throw new Error(`Invalid time: ${time}`);
  return Number(m[1]) * 60 + Number(m[2]);
}

/** 'YYYY-MM-DD' → 'Mon 21 Sep 2026'. */
export function formatDisplayDate(date: IsoDate): string {
  const weekday = weekdayOf(date); // also validates the date
  const [year, month, day] = date.split('-').map(Number);
  return `${DAY_NAMES[weekday - 1]} ${day} ${MONTH_NAMES[month - 1]} ${year}`;
}
```

- [ ] **Step 7: Run the tests, type check and lint**

Run: `npx jest src/domain/__tests__/calendar.test.ts` → Expected: PASS, 7 tests.
Run: `npm run typecheck` → Expected: no output, exit code 0.
Run: `npx expo lint`. If the template has no ESLint config yet, the first run offers to install `eslint` and `eslint-config-expo` and create `eslint.config.js`: answer yes and commit what it creates. Expected: no errors.

- [ ] **Step 8: Add CI**

Create `.github/workflows/ci.yml` in the repo root:

```yaml
name: CI

on:
  push:
  pull_request:

jobs:
  client:
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: client
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 24
          cache: npm
          cache-dependency-path: client/package-lock.json
      - run: npm ci
      - run: npm run typecheck
      - run: npm run lint
      - run: npx jest --ci
```

- [ ] **Step 9: Commit**

```bash
cd ..
git add client .github/workflows/ci.yml
git commit -m "feat(client): scaffold Expo app, CI and calendar helpers"
```

---

### Task 2: Timetable types, this semester's timetable, and dated classes (R-NUM-4 listing)

**Files:**
- Create: `client/src/domain/timetable/types.ts`, `client/src/domain/timetable/seed.ts`, `client/src/domain/timetable/occurrences.ts`
- Test: `client/src/domain/timetable/__tests__/occurrences.test.ts`

**Interfaces:**
- Consumes: `IsoDate`, `HhMm`, `Weekday`, `addDays`, `minutesOf`, `weekdayOf` from `../calendar`.
- Produces:
  - types `Stream`, `Subject`, `Slot`, `TeacherAssignment`, `CalendarException`, `ExtraSession`, `Timetable`, `Occurrence`
  - `SEMESTER_START: string`, `SEED_SUBJECTS: Subject[]`, `SEED_SLOTS: Slot[]`, `seedTimetable(): Timetable`
  - `occurrenceKey(slotId: string, date: IsoDate): string` (e.g. `'mon-0830@2026-09-07'`)
  - `occurrencesBetween(slots: Slot[], from: IsoDate, to: IsoDate): Occurrence[]`
  - `isExcepted(tt: Pick<Timetable, 'exceptions'>, occ: Occurrence): boolean`

  Slot ids are `<mon|tue|…>-<HHMM>`; subject ids are slugs (`'computer-networks'`).

- [ ] **Step 1: Write the types** (no behaviour, so no test of its own; the tests below use them)

Create `client/src/domain/timetable/types.ts`:

```ts
import type { HhMm, IsoDate, Weekday } from '../calendar';

export type Stream = 'lecture' | 'lab';

export interface Subject {
  id: string;
  name: string;
}

/** A weekly class in the timetable. */
export interface Slot {
  id: string;
  subjectId: string;
  stream: Stream;
  weekday: Weekday;
  start: HhMm;
  end: HhMm;
  room?: string;
}

/** Who teaches a subject's lecture or lab stream, from a date onwards (R-TT-5). */
export interface TeacherAssignment {
  subjectId: string;
  stream: Stream;
  teacher: string;
  from: IsoDate;
}

/** A day with no classes, or one class that did not happen (R-NUM-2). */
export type CalendarException =
  | { kind: 'holiday'; date: IsoDate }
  | { kind: 'cancelled'; slotId: string; date: IsoDate };

/** A make-up class outside the weekly timetable; it counts towards numbering (R-NUM-1). */
export interface ExtraSession {
  subjectId: string;
  stream: Stream;
  date: IsoDate;
  start: HhMm;
}

export interface Timetable {
  semesterStart: IsoDate;
  subjects: Subject[];
  slots: Slot[];
  teachers: TeacherAssignment[];
  exceptions: CalendarException[];
  extras: ExtraSession[];
}

/** One weekly slot on one date. */
export interface Occurrence {
  slot: Slot;
  date: IsoDate;
}
```

- [ ] **Step 2: Write the failing test**

Create `client/src/domain/timetable/__tests__/occurrences.test.ts`:

```ts
import { isExcepted, occurrenceKey, occurrencesBetween } from '../occurrences';
import { SEED_SLOTS, SEED_SUBJECTS, seedTimetable } from '../seed';
import { minutesOf } from '../../calendar';

describe('seed timetable', () => {
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
```

- [ ] **Step 3: Run it and watch it fail**

Run: `npx jest src/domain/timetable/__tests__/occurrences.test.ts`
Expected: FAIL with `Cannot find module '../occurrences'`.

- [ ] **Step 4: Implement the seed timetable**

Create `client/src/domain/timetable/seed.ts`:

```ts
import type { Slot, Subject, Timetable } from './types';

/**
 * Semester V, Group B, from 2026-09-07 (design, Appendix A).
 * Teachers and rooms are not here: they come from the private timetable file at setup.
 */
export const SEMESTER_START = '2026-09-07';

export const SEED_SUBJECTS: Subject[] = [
  { id: 'computer-networks', name: 'Computer Networks' },
  { id: 'fundamentals-of-accounting', name: 'Fundamentals of Accounting' },
  { id: 'technical-business-writing', name: 'Technical & Business Writing' },
  { id: 'parallel-and-distributed-computing', name: 'Parallel and Distributed Computing' },
  { id: 'machine-learning', name: 'Machine Learning' },
  { id: 'programming-for-ai', name: 'Programming for AI' },
];

function slot(
  day: string,
  weekday: Slot['weekday'],
  start: string,
  end: string,
  subjectId: string,
  stream: Slot['stream'],
): Slot {
  return { id: `${day}-${start.replace(':', '')}`, subjectId, stream, weekday, start, end };
}

export const SEED_SLOTS: Slot[] = [
  slot('mon', 1, '08:30', '10:00', 'computer-networks', 'lab'),
  slot('mon', 1, '10:15', '11:45', 'fundamentals-of-accounting', 'lecture'),
  slot('mon', 1, '12:00', '13:30', 'technical-business-writing', 'lecture'),
  slot('mon', 1, '14:00', '16:00', 'parallel-and-distributed-computing', 'lecture'),
  slot('tue', 2, '08:30', '10:00', 'computer-networks', 'lab'),
  slot('tue', 2, '10:15', '11:45', 'fundamentals-of-accounting', 'lecture'),
  slot('tue', 2, '12:00', '13:30', 'machine-learning', 'lab'),
  slot('tue', 2, '14:00', '16:00', 'computer-networks', 'lecture'),
  slot('wed', 3, '08:30', '10:00', 'programming-for-ai', 'lab'),
  slot('wed', 3, '10:15', '11:45', 'parallel-and-distributed-computing', 'lab'),
  slot('wed', 3, '12:00', '13:30', 'machine-learning', 'lab'),
  slot('wed', 3, '14:00', '15:30', 'technical-business-writing', 'lecture'),
  slot('thu', 4, '08:30', '10:00', 'parallel-and-distributed-computing', 'lab'),
  slot('thu', 4, '10:01', '11:59', 'programming-for-ai', 'lecture'),
  slot('thu', 4, '12:00', '13:30', 'programming-for-ai', 'lab'),
  slot('thu', 4, '14:00', '16:00', 'machine-learning', 'lecture'),
];

export function seedTimetable(): Timetable {
  return {
    semesterStart: SEMESTER_START,
    subjects: [...SEED_SUBJECTS],
    slots: [...SEED_SLOTS],
    teachers: [],
    exceptions: [],
    extras: [],
  };
}
```

- [ ] **Step 5: Implement occurrences**

Create `client/src/domain/timetable/occurrences.ts`:

```ts
import { addDays, minutesOf, weekdayOf } from '../calendar';
import type { IsoDate } from '../calendar';
import type { Occurrence, Slot, Timetable } from './types';

export function occurrenceKey(slotId: string, date: IsoDate): string {
  return `${slotId}@${date}`;
}

/**
 * Every scheduled class from `from` to `to` (both inclusive), in time order.
 * Includes holidays and cancelled classes: use `isExcepted` to leave them out (R-NUM-4 lists them all).
 */
export function occurrencesBetween(slots: Slot[], from: IsoDate, to: IsoDate): Occurrence[] {
  const result: Occurrence[] = [];
  for (let date = from; date <= to; date = addDays(date, 1)) {
    const weekday = weekdayOf(date);
    const today = slots
      .filter((s) => s.weekday === weekday)
      .sort((a, b) => minutesOf(a.start) - minutesOf(b.start));
    for (const slot of today) result.push({ slot, date });
  }
  return result;
}

/** True if the class did not take place: its day is a holiday or the class was cancelled. */
export function isExcepted(tt: Pick<Timetable, 'exceptions'>, occ: Occurrence): boolean {
  return tt.exceptions.some((e) =>
    e.kind === 'holiday' ? e.date === occ.date : e.slotId === occ.slot.id && e.date === occ.date,
  );
}
```

- [ ] **Step 6: Run the tests**

Run: `npx jest src/domain/timetable/__tests__/occurrences.test.ts` → Expected: PASS, 5 tests.
Run: `npm run typecheck` → Expected: exit code 0.

- [ ] **Step 7: Commit**

```bash
git add client/src/domain/timetable
git commit -m "feat(domain): timetable types, semester seed and dated classes"
```

---

### Task 3: Class detection (R-TT-3)

**Files:**
- Create: `client/src/domain/timetable/detect.ts`
- Test: `client/src/domain/timetable/__tests__/detect.test.ts`

**Interfaces:**
- Consumes: `minutesOf`, `weekdayOf` (calendar); `Slot` (types); `SEED_SLOTS` (seed, in tests).
- Produces:
  - `type Detection = { kind: 'now' | 'upcoming' | 'just-ended'; slot: Slot } | { kind: 'ask' }` (declared as a union of four object types)
  - `detectClass(slots: Slot[], date: IsoDate, time: HhMm): Detection`
  - `UPCOMING_WINDOW_MIN = 15`, `JUST_ENDED_WINDOW_MIN = 10`

  Rules are tried in order: in progress, then starting within 15 minutes, then ended within 10 minutes, then ask.

- [ ] **Step 1: Write the failing test**

Create `client/src/domain/timetable/__tests__/detect.test.ts`:

```ts
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
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx jest src/domain/timetable/__tests__/detect.test.ts`
Expected: FAIL with `Cannot find module '../detect'`.

- [ ] **Step 3: Implement**

Create `client/src/domain/timetable/detect.ts`:

```ts
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
  const today = slots.filter((s) => s.weekday === weekdayOf(date));

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
```

- [ ] **Step 4: Run the tests**

Run: `npx jest src/domain/timetable/__tests__/detect.test.ts` → Expected: PASS, 5 tests.

- [ ] **Step 5: Commit**

```bash
git add client/src/domain/timetable/detect.ts client/src/domain/timetable/__tests__/detect.test.ts
git commit -m "feat(domain): detect the class being recorded (R-TT-3)"
```

---

### Task 4: Lecture and lab numbering (R-NUM-1, R-NUM-2)

**Files:**
- Create: `client/src/domain/timetable/numbering.ts`
- Test: `client/src/domain/timetable/__tests__/numbering.test.ts`

**Interfaces:**
- Consumes: `minutesOf` (calendar); `occurrencesBetween`, `isExcepted` (occurrences); `Stream`, `Timetable` (types); `seedTimetable` (seed, in tests).
- Produces:
  - `interface SessionRef { subjectId: string; stream: Stream; date: IsoDate; start: HhMm }`
  - `sessionNumber(tt: Timetable, ref: SessionRef): number`

  It throws `'… is before the semester start …'` for early dates, and `'… add it as a make-up session first'` when the class did not take place. The caller must add an `ExtraSession` for a make-up class before numbering it.

- [ ] **Step 1: Write the failing test**

Create `client/src/domain/timetable/__tests__/numbering.test.ts`:

```ts
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
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx jest src/domain/timetable/__tests__/numbering.test.ts`
Expected: FAIL with `Cannot find module '../numbering'`.

- [ ] **Step 3: Implement**

Create `client/src/domain/timetable/numbering.ts`:

```ts
import { minutesOf } from '../calendar';
import type { HhMm, IsoDate } from '../calendar';
import { isExcepted, occurrencesBetween } from './occurrences';
import type { Stream, Timetable } from './types';

/** A class that took place: a scheduled slot or a make-up session. */
export interface SessionRef {
  subjectId: string;
  stream: Stream;
  date: IsoDate;
  start: HhMm;
}

function sortKey(date: IsoDate, start: HhMm): string {
  minutesOf(start); // validates the time
  return `${date} ${start}`;
}

/**
 * R-NUM-1: the lecture or lab number of a class. It counts that subject's classes of the same stream
 * from the semester start up to and including this one: scheduled classes that took place (missed ones
 * still count), minus holidays and cancellations, plus make-up sessions. Pure, so editing holidays or
 * cancellations and calling it again renumbers everything (R-NUM-2).
 */
export function sessionNumber(tt: Timetable, ref: SessionRef): number {
  if (ref.date < tt.semesterStart) {
    throw new Error(`${ref.date} is before the semester start (${tt.semesterStart})`);
  }
  const refKey = sortKey(ref.date, ref.start);
  const streamSlots = tt.slots.filter((s) => s.subjectId === ref.subjectId && s.stream === ref.stream);
  const scheduled = occurrencesBetween(streamSlots, tt.semesterStart, ref.date).filter((o) => !isExcepted(tt, o));
  const extras = tt.extras.filter(
    (x) => x.subjectId === ref.subjectId && x.stream === ref.stream && x.date >= tt.semesterStart,
  );

  const takesPlace =
    scheduled.some((o) => o.date === ref.date && o.slot.start === ref.start) ||
    extras.some((x) => x.date === ref.date && x.start === ref.start);
  if (!takesPlace) {
    throw new Error(
      `No ${ref.stream} of ${ref.subjectId} at ${ref.date} ${ref.start}: add it as a make-up session first`,
    );
  }

  return (
    scheduled.filter((o) => sortKey(o.date, o.slot.start) <= refKey).length +
    extras.filter((x) => sortKey(x.date, x.start) <= refKey).length
  );
}
```

- [ ] **Step 4: Run the tests**

Run: `npx jest src/domain/timetable/__tests__/numbering.test.ts` → Expected: PASS, 8 tests, including the worked example (Accounting, Mon 21 Sep 2026 = Lecture 5).

- [ ] **Step 5: Commit**

```bash
git add client/src/domain/timetable/numbering.ts client/src/domain/timetable/__tests__/numbering.test.ts
git commit -m "feat(domain): number lectures and labs from the timetable (R-NUM-1, R-NUM-2)"
```

---

### Task 5: Recording names (R-NAME-1, R-NAME-2, R-TT-4)

**Files:**
- Create: `client/src/domain/timetable/naming.ts`
- Test: `client/src/domain/timetable/__tests__/naming.test.ts`

**Interfaces:**
- Consumes: `formatDisplayDate` (calendar); `Stream` (types).
- Produces:
  - `type RecordingLabel = { kind: 'class'; subjectName: string; stream: Stream; number: number } | { kind: 'other'; title: string }`
  - `displayName(date: IsoDate, label: RecordingLabel): string`
  - `fileName(date: IsoDate, label: RecordingLabel): string`

  An empty "Other" title throws `'An "Other" recording needs a title'`.

- [ ] **Step 1: Write the failing test**

Create `client/src/domain/timetable/__tests__/naming.test.ts`:

```ts
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

  it('names an "Other" recording with its title and no number', () => {
    expect(displayName('2026-09-11', { kind: 'other', title: '  Cyber Workshop ' })).toBe('Fri 11 Sep 2026 – Cyber Workshop');
  });

  it('refuses an "Other" recording without a title', () => {
    expect(() => displayName('2026-09-11', { kind: 'other', title: '   ' })).toThrow('needs a title');
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

  it('rejects an invalid date', () => {
    expect(() => fileName('2026-13-01', { kind: 'other', title: 'Talk' })).toThrow('Invalid date');
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx jest src/domain/timetable/__tests__/naming.test.ts`
Expected: FAIL with `Cannot find module '../naming'`.

- [ ] **Step 3: Implement**

Create `client/src/domain/timetable/naming.ts`:

```ts
import { formatDisplayDate } from '../calendar';
import type { IsoDate } from '../calendar';
import type { Stream } from './types';

export type RecordingLabel =
  | { kind: 'class'; subjectName: string; stream: Stream; number: number }
  | { kind: 'other'; title: string };

const STREAM_LABEL: Record<Stream, string> = { lecture: 'Lecture', lab: 'Lab' };

function titleOf(label: RecordingLabel): string {
  if (label.kind === 'other') {
    const title = label.title.trim();
    if (!title) throw new Error('An "Other" recording needs a title');
    return title;
  }
  return `${label.subjectName} – ${STREAM_LABEL[label.stream]} ${label.number}`;
}

/** R-NAME-1 / R-TT-4: 'Mon 21 Sep 2026 – Fundamentals of Accounting – Lecture 5' or 'Fri 11 Sep 2026 – Cyber Workshop'. */
export function displayName(date: IsoDate, label: RecordingLabel): string {
  return `${formatDisplayDate(date)} – ${titleOf(label)}`;
}

/** R-NAME-2: '2026-09-21 Fundamentals of Accounting – Lecture 5'. Sorts by date; safe on Android, Windows and Drive. */
export function fileName(date: IsoDate, label: RecordingLabel): string {
  formatDisplayDate(date); // validates the date
  const safe = titleOf(label)
    .replace(/[\\/:*?"<>|]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return `${date} ${safe}`;
}
```

- [ ] **Step 4: Run the tests**

Run: `npx jest src/domain/timetable/__tests__/naming.test.ts` → Expected: PASS, 7 tests.

- [ ] **Step 5: Commit**

```bash
git add client/src/domain/timetable/naming.ts client/src/domain/timetable/__tests__/naming.test.ts
git commit -m "feat(domain): recording display and file names (R-NAME-1, R-NAME-2, R-TT-4)"
```

---

### Task 6: Teacher on a date (R-TT-5)

**Files:**
- Create: `client/src/domain/timetable/teachers.ts`
- Test: `client/src/domain/timetable/__tests__/teachers.test.ts`

**Interfaces:**
- Consumes: `Stream`, `TeacherAssignment` (types).
- Produces: `teacherOn(assignments: TeacherAssignment[], subjectId: string, stream: Stream, date: IsoDate): string | undefined`.

- [ ] **Step 1: Write the failing test**

Create `client/src/domain/timetable/__tests__/teachers.test.ts`:

```ts
import { teacherOn } from '../teachers';
import type { TeacherAssignment } from '../types';

const ASSIGNMENTS: TeacherAssignment[] = [
  { subjectId: 'machine-learning', stream: 'lab', teacher: 'Teacher A', from: '2026-09-07' },
  { subjectId: 'machine-learning', stream: 'lab', teacher: 'Teacher B', from: '2026-09-21' },
  { subjectId: 'machine-learning', stream: 'lecture', teacher: 'Teacher C', from: '2026-09-07' },
];

describe('teacherOn (R-TT-5)', () => {
  it('keeps the earlier teacher for lectures before the change', () => {
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
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx jest src/domain/timetable/__tests__/teachers.test.ts`
Expected: FAIL with `Cannot find module '../teachers'`.

- [ ] **Step 3: Implement**

Create `client/src/domain/timetable/teachers.ts`:

```ts
import type { IsoDate } from '../calendar';
import type { Stream, TeacherAssignment } from './types';

/**
 * R-TT-5: who taught a subject's lecture or lab stream on a date. The latest assignment starting on or
 * before the date wins, so a mid-semester change never renames earlier lectures.
 */
export function teacherOn(
  assignments: TeacherAssignment[],
  subjectId: string,
  stream: Stream,
  date: IsoDate,
): string | undefined {
  let best: TeacherAssignment | undefined;
  for (const a of assignments) {
    if (a.subjectId !== subjectId || a.stream !== stream || a.from > date) continue;
    if (!best || a.from >= best.from) best = a;
  }
  return best?.teacher;
}
```

- [ ] **Step 4: Run the tests**

Run: `npx jest src/domain/timetable/__tests__/teachers.test.ts` → Expected: PASS, 4 tests.

- [ ] **Step 5: Commit**

```bash
git add client/src/domain/timetable/teachers.ts client/src/domain/timetable/__tests__/teachers.test.ts
git commit -m "feat(domain): teacher changes take effect from a date (R-TT-5)"
```

---

### Task 7: "Missed or Cancelled?" prompts (R-NUM-3)

**Files:**
- Create: `client/src/domain/timetable/prompts.ts`
- Test: `client/src/domain/timetable/__tests__/prompts.test.ts`

**Interfaces:**
- Consumes: `minutesOf` (calendar); `occurrencesBetween`, `isExcepted`, `occurrenceKey` (occurrences); `Occurrence`, `Timetable` (types).
- Produces:
  - `classesNeedingPrompt(tt: Timetable, date: IsoDate, time: HhMm, handled: ReadonlySet<string>): Occurrence[]`
  - `PROMPT_DELAY_MIN = 15`

  `handled` contains `occurrenceKey` values for classes that have a recording or were already answered. M3 builds this set from storage.

- [ ] **Step 1: Write the failing test**

Create `client/src/domain/timetable/__tests__/prompts.test.ts`:

```ts
import { occurrenceKey } from '../occurrences';
import { classesNeedingPrompt } from '../prompts';
import { seedTimetable } from '../seed';

const MON = '2026-09-21';
const NONE: ReadonlySet<string> = new Set();

function ids(date: string, time: string, handled = NONE, tt = seedTimetable()): string[] {
  return classesNeedingPrompt(tt, date, time, handled).map((o) => o.slot.id);
}

describe('classesNeedingPrompt (R-NUM-3)', () => {
  it('asks about classes that ended at least 15 minutes ago', () => {
    expect(ids(MON, '11:59')).toEqual(['mon-0830']);
    expect(ids(MON, '12:05')).toEqual(['mon-0830', 'mon-1015']);
  });

  it('skips classes that were recorded or already answered', () => {
    expect(ids(MON, '12:05', new Set([occurrenceKey('mon-1015', MON)]))).toEqual(['mon-0830']);
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
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx jest src/domain/timetable/__tests__/prompts.test.ts`
Expected: FAIL with `Cannot find module '../prompts'`.

- [ ] **Step 3: Implement**

Create `client/src/domain/timetable/prompts.ts`:

```ts
import { minutesOf } from '../calendar';
import type { HhMm, IsoDate } from '../calendar';
import { isExcepted, occurrenceKey, occurrencesBetween } from './occurrences';
import type { Occurrence, Timetable } from './types';

export const PROMPT_DELAY_MIN = 15;

/**
 * R-NUM-3: today's classes that should get a "Missed or Cancelled?" notification. A class qualifies
 * once it ended at least 15 minutes ago, if it was not a holiday or cancelled, and if it is not in
 * `handled` (occurrence keys of classes that have a recording or were already answered).
 */
export function classesNeedingPrompt(
  tt: Timetable,
  date: IsoDate,
  time: HhMm,
  handled: ReadonlySet<string>,
): Occurrence[] {
  if (date < tt.semesterStart) return [];
  const now = minutesOf(time);
  return occurrencesBetween(tt.slots, date, date).filter(
    (o) =>
      minutesOf(o.slot.end) + PROMPT_DELAY_MIN <= now &&
      !isExcepted(tt, o) &&
      !handled.has(occurrenceKey(o.slot.id, o.date)),
  );
}
```

- [ ] **Step 4: Run the tests**

Run: `npx jest src/domain/timetable/__tests__/prompts.test.ts` → Expected: PASS, 4 tests.

- [ ] **Step 5: Commit**

```bash
git add client/src/domain/timetable/prompts.ts client/src/domain/timetable/__tests__/prompts.test.ts
git commit -m "feat(domain): choose classes for the missed-or-cancelled prompt (R-NUM-3)"
```

---

### Task 8: Timetable import and the public entry point (R-TT-1)

**Files:**
- Create: `client/src/domain/timetable/import.ts`, `client/src/domain/timetable/index.ts`
- Test: `client/src/domain/timetable/__tests__/import.test.ts`

**Interfaces:**
- Consumes: `minutesOf`, `IsoDate`, `Weekday` (calendar); `Slot`, `Stream`, `Subject`, `TeacherAssignment`, `Timetable` (types); `SEED_SLOTS`, `SEED_SUBJECTS`, `SEMESTER_START` (seed, in tests).
- Produces:
  - `slugify(name: string): string`
  - `importTimetable(markdown: string, semesterStart: IsoDate): Timetable`
  - `index.ts` re-exporting every timetable module (M2 and M3 import from `src/domain/timetable`)

  The input format matches `private/timetable.md`: `| Day | Time | Subject | Stream | Teacher | Room |`.

- [ ] **Step 1: Write the failing test** (placeholder names only, never the real timetable: ADR-0014)

Create `client/src/domain/timetable/__tests__/import.test.ts`:

```ts
import { importTimetable, slugify } from '../import';
import { SEED_SLOTS, SEED_SUBJECTS, SEMESTER_START } from '../seed';

const SAMPLE = [
  '# Full timetable (private)',
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
    const tt = importTimetable(SAMPLE, SEMESTER_START);
    expect(tt.slots.map((s) => s.id)).toEqual(['mon-0830', 'tue-1400', 'wed-1015']);
    expect(tt.subjects.map((s) => s.id)).toEqual(['computer-networks', 'technical-business-writing']);
    expect(tt.slots[1]).toEqual({
      id: 'tue-1400',
      subjectId: 'computer-networks',
      stream: 'lecture',
      weekday: 2,
      start: '14:00',
      end: '16:00',
      room: 'Room 7',
    });
    expect(tt.teachers).toEqual([
      { subjectId: 'computer-networks', stream: 'lab', teacher: 'Teacher A', from: SEMESTER_START },
      { subjectId: 'computer-networks', stream: 'lecture', teacher: 'Teacher B', from: SEMESTER_START },
      { subjectId: 'technical-business-writing', stream: 'lecture', teacher: 'Teacher C', from: SEMESTER_START },
    ]);
    expect(tt.exceptions).toEqual([]);
    expect(tt.extras).toEqual([]);
  });

  it('produces the same ids as the built-in timetable', () => {
    const dayName = ['', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const subjectName = new Map(SEED_SUBJECTS.map((s) => [s.id, s.name]));
    const markdown = SEED_SLOTS.map(
      (s) =>
        `| ${dayName[s.weekday]} | ${s.start}–${s.end} | ${subjectName.get(s.subjectId)} | ` +
        `${s.stream === 'lab' ? 'Lab' : 'Lecture'} | Teacher | Room |`,
    ).join('\n');
    const tt = importTimetable(markdown, SEMESTER_START);
    expect(tt.slots.map((s) => s.id)).toEqual(SEED_SLOTS.map((s) => s.id));
    expect(tt.subjects.map((s) => s.id).sort()).toEqual(SEED_SUBJECTS.map((s) => s.id).sort());
  });

  it('reports the line of a bad row', () => {
    const badStream = SAMPLE.replace('| Lab | Teacher A', '| Seminar | Teacher A');
    expect(() => importTimetable(badStream, SEMESTER_START)).toThrow('line 5: stream must be Lecture or Lab');
    const badTime = SAMPLE.replace('08:30–10:00', '10:00–08:30');
    expect(() => importTimetable(badTime, SEMESTER_START)).toThrow('line 5: the class must end after it starts');
  });

  it('refuses a file with no timetable rows', () => {
    expect(() => importTimetable('# Nothing here', SEMESTER_START)).toThrow('No timetable rows found');
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx jest src/domain/timetable/__tests__/import.test.ts`
Expected: FAIL with `Cannot find module '../import'`.

- [ ] **Step 3: Implement**

Create `client/src/domain/timetable/import.ts`:

```ts
import { minutesOf } from '../calendar';
import type { IsoDate, Weekday } from '../calendar';
import type { Slot, Stream, Subject, TeacherAssignment, Timetable } from './types';

const WEEKDAYS = new Map<string, Weekday>([
  ['mon', 1],
  ['tue', 2],
  ['wed', 3],
  ['thu', 4],
  ['fri', 5],
  ['sat', 6],
  ['sun', 7],
]);

/** 'Technical & Business Writing' → 'technical-business-writing'. */
export function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/&/g, ' ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function parseStream(cell: string, where: string): Stream {
  const stream = cell.toLowerCase();
  if (stream === 'lecture' || stream === 'lab') return stream;
  throw new Error(`${where}: stream must be Lecture or Lab, got "${cell}"`);
}

/**
 * R-TT-1: reads the private timetable file (private/timetable.md), a Markdown table with the columns
 * Day | Time | Subject | Stream | Teacher | Room. Any other lines are ignored. A note in brackets after a
 * teacher's name, such as "(replaced …)", is dropped.
 */
export function importTimetable(markdown: string, semesterStart: IsoDate): Timetable {
  const subjects = new Map<string, Subject>();
  const slots: Slot[] = [];
  const teachers: TeacherAssignment[] = [];

  markdown.split(/\r?\n/).forEach((line, index) => {
    const trimmed = line.trim();
    if (!trimmed.startsWith('|')) return;
    const cells = trimmed.replace(/^\||\|$/g, '').split('|').map((c) => c.trim());
    const weekday = WEEKDAYS.get(cells[0].toLowerCase());
    if (!weekday || cells.length < 6) return; // header, separator or unrelated row

    const where = `line ${index + 1}`;
    const [day, time, subjectName, streamCell, teacherCell, room] = cells;
    const times = time.split(/[-–—]/).map((t) => t.trim());
    if (times.length !== 2) throw new Error(`${where}: time must look like 08:30–10:00, got "${time}"`);
    const [start, end] = times;
    if (minutesOf(start) >= minutesOf(end)) throw new Error(`${where}: the class must end after it starts`);
    const stream = parseStream(streamCell, where);
    const subjectId = slugify(subjectName);
    if (!subjectId) throw new Error(`${where}: the subject is empty`);

    subjects.set(subjectId, { id: subjectId, name: subjectName });
    slots.push({
      id: `${day.toLowerCase()}-${start.replace(':', '')}`,
      subjectId,
      stream,
      weekday,
      start,
      end,
      ...(room ? { room } : {}),
    });
    const teacher = teacherCell.replace(/\s*\(.*\)\s*$/, '').trim();
    if (teacher && !teachers.some((t) => t.subjectId === subjectId && t.stream === stream)) {
      teachers.push({ subjectId, stream, teacher, from: semesterStart });
    }
  });

  if (slots.length === 0) throw new Error('No timetable rows found');
  return { semesterStart, subjects: [...subjects.values()], slots, teachers, exceptions: [], extras: [] };
}
```

- [ ] **Step 4: Add the public entry point**

Create `client/src/domain/timetable/index.ts`:

```ts
export * from './types';
export * from './seed';
export * from './occurrences';
export * from './detect';
export * from './numbering';
export * from './naming';
export * from './teachers';
export * from './prompts';
export * from './import';
```

- [ ] **Step 5: Run everything**

Run: `npx jest` → Expected: PASS, 45 tests in 8 files.
Run: `npm run typecheck` → Expected: exit code 0.
Run: `npm run lint` → Expected: no errors.

- [ ] **Step 6: Check the real private file imports cleanly** (local only; `client/scripts/local/` is git-ignored)

Create `client/scripts/local/private-timetable.test.ts`:

```ts
import fs from 'node:fs';
import path from 'node:path';
import { importTimetable, SEED_SLOTS, SEMESTER_START } from '../../src/domain/timetable';

it('imports private/timetable.md', () => {
  const markdown = fs.readFileSync(path.join(__dirname, '../../../private/timetable.md'), 'utf8');
  const tt = importTimetable(markdown, SEMESTER_START);
  expect(tt.slots).toHaveLength(16);
  expect(tt.subjects).toHaveLength(6);
  expect(tt.teachers).toHaveLength(10); // one per subject and stream
  expect(tt.slots.map((s) => s.id)).toEqual(SEED_SLOTS.map((s) => s.id));
});
```

Run: `npx jest --testMatch "<rootDir>/scripts/local/*.test.ts"` → Expected: PASS, 1 test.
Run: `git status --short client/scripts` → Expected: no output (the folder is ignored).

This check was already run against the real file while writing the plan: 16 slots, 6 subjects, 10 teachers, and ids matching the seed.

- [ ] **Step 7: Commit**

```bash
git add client/src/domain/timetable/import.ts client/src/domain/timetable/index.ts client/src/domain/timetable/__tests__/import.test.ts
git commit -m "feat(domain): import the private timetable file (R-TT-1)"
```

---

### Task 9: Close the milestone

**Files:**
- Modify: `docs/roadmap.md` (M1 status → ✅ Done), `docs/project-log.md` (new dated entry), `README.md` (Status line: M1 done; how to run the tests)

**Interfaces:** none.

- [ ] **Step 1: Run the privacy scan** (from `docs/engineering.md`)

```bash
git grep -n -E "gsk_[A-Za-z0-9]{10}|AIza[0-9A-Za-z_-]{20}|tvly-[A-Za-z0-9]{10}" $(git rev-list --all)
```

Expected: no output. Then run the private-terms scan from `docs/engineering.md` (Security and privacy). Expected: no output.

- [ ] **Step 2: Update the docs**

In `docs/roadmap.md`, set M1's status to `✅ Done <date>` and link the pull request. In `docs/project-log.md`, add a dated entry: what was built, test count (45), anything that differed from this plan. In `README.md`, change the status line to "M1 done: timetable logic tested" and add:

```markdown
## Development

    cd client
    npm install
    npm test          # unit tests
    npm run typecheck
```

- [ ] **Step 3: Commit, open the pull request, merge after CI is green**

```bash
git add docs README.md
git commit -m "docs: close milestone M1"
git push -u origin feat/m1-domain-core
gh pr create --title "M1: domain core (timetable, numbering, naming)" --body "Implements R-TT-1..5, R-NAME-1/2, R-NUM-1..4 (logic). 45 unit tests. Plan: docs/superpowers/plans/2026-09-18-m1-domain-core.md"
```

Merge once CI is green, then:

```bash
git checkout main && git pull
git tag -a v0.1.0 -m "M1: domain core"
git push origin v0.1.0
```

- [ ] **Step 4: Plan M2**

Write `docs/superpowers/plans/<date>-m2-recorder-module.md` using the writing-plans skill, starting from the M2 section of `docs/roadmap.md`.

---

## Self-review (done while writing this plan)

- **Spec coverage:**
  - R-TT-1 → Task 8
  - R-TT-2 → Tasks 2 and 4 (separate stream numbering)
  - R-TT-3 → Task 3
  - R-TT-4 → Task 5 (Other names); detection's `ask` result covers "or Other"
  - R-TT-5 → Task 6
  - R-NAME-1/2 → Task 5
  - R-NUM-1/2 → Task 4
  - R-NUM-3 → Task 7
  - R-NUM-4 → Task 2 (`occurrencesBetween` lists every class; the setup screen is M3)
- **Verified:** every code block in Tasks 1–8 was run before this plan was written. All 45 tests passed under Node 24, and deliberately breaking two boundary conditions made the right tests fail. Strict type checking happens for the first time in Task 1 Step 7 and each later task.
- **Placeholders:** none. The Task 8 Step 6 manual check is local by design, because the real file must not be committed.
- **Type consistency:** `Occurrence`, `SessionRef`, `RecordingLabel`, `Detection` and the slot and subject id formats are used identically across tasks.

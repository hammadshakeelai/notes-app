# ADR-0009: Lecture numbers follow the timetable

- **Status:** Accepted
- **Date:** 2026-09-18

## Context

Recordings are named automatically, e.g. `Mon 21 Sep 2026 – Fundamentals of Accounting – Lecture 5`. The student chose timetable-based numbering over counting recordings.

## Decision

Number = scheduled slots of that stream from the semester start (2026-09-07) up to and including this one, minus slots marked cancelled or holiday, plus make-up sessions recorded before it. Lectures and labs are numbered separately within a subject. A notification asks "Missed or Cancelled?" 15 minutes after a class with no recording. Holidays and cancellations can be edited at any time and all numbers update. Recordings outside the timetable ("Other", e.g. a workshop) have no number. Teacher changes take effect from a date.

## Consequences

Missed classes still use up a number. Cancelled classes must be marked, which the prompt makes quick.

## Alternatives considered

Counting recordings: rejected by the student.

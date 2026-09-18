# ADR-0014: Personal data stays out of the public repo

- **Status:** Accepted
- **Date:** 2026-09-18

## Context

The repo is public and tied to the student's GitHub identity. The timetable with teacher names and rooms would reveal where the student is every weekday. Lecture recordings and transcripts are third-party content.

## Decision

`private/` is git-ignored and holds: the full timetable (teachers, rooms), recordings, transcripts and throwaway test scripts. `.env` is git-ignored. Public docs contain no lecture content and no teacher names. Before every push, history is scanned for key patterns and personal names.

## Consequences

The app loads teachers and rooms from the local file during setup. Findings are written up as summaries without content.

## Alternatives considered

Making the repo private: possible at any time, but the student chose public.

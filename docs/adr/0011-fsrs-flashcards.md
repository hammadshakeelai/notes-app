# ADR-0011: Flashcards scheduled with FSRS

- **Status:** Accepted
- **Date:** 2026-09-18

## Context

Research ([spec section 9](../specs/2026-09-18-notes-app-design.md)): testing yourself and spacing out study are the most effective techniques. FSRS predicts recall better than SM-2 for about 99.5% of users and needs 20-30% fewer reviews.

## Decision

Use `ts-fsrs` with desired retention 0.90 and two buttons (Forgot / Remembered). About 8 cards per lecture, one fact per card, including "why/how" and fill-in-the-blank. At most 20 new cards a day. Each card links to its source moment. Also exam mode and revision sheets.

## Consequences

Review load is roughly 15-20 minutes a day once running.

## Alternatives considered

SM-2 (older), or no spacing: rejected.

# ADR-0008: Caution loop: find doubtful parts, re-listen to short clips, learn from corrections

- **Status:** Accepted
- **Date:** 2026-09-18

## Context

The student wants transcripts that are correct. Phase 0 findings ([findings](../phase0-findings.md)):
- Flash-Lite checking whole transcripts found 0 problems, even in known-bad ones.
- Flash as a checker fixed untranslated segments from 23 to 1, but its own fixes sometimes contained Roman Urdu.
- Round 2 gave no measurable gain.
- The biggest disagreement between two independent drafts was exactly the misheard word ("paths" heard as *paanch*).
- Re-listening to a 50-second clip with context fixed it.

## Decision

Every lecture goes through the loop (R-QA-1 to R-QA-11):
1. Free automatic checks.
2. An independent Flash-Lite second draft, lined up with the main draft by text, to find doubtful parts.
3. Short-clip re-listening with context on Flash-Lite, escalating to Flash where the drafts still disagree.
4. The checker's own fixes must pass the automatic checks before they are used.
5. At most 2 rounds.
6. A sense check for anything that doesn't fit the subject.
7. A short "needs your check" list showing both versions.
8. Every correction is remembered in the subject's glossary.
9. A quality badge on each lecture.

## Consequences

Roughly 10-30 Flash-Lite calls per lecture. The app needs a review screen. Perfect transcripts are not promised; nothing uncertain is presented as certain.

## Alternatives considered

Flash-Lite as a whole-transcript judge: rejected (couldn't spot known-bad transcripts). Unlimited check rounds: rejected (no gain, uses up quota).

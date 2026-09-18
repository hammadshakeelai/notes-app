# ADR-0006: Website-style transcripts: Roman Urdu original, English, speaker turns, context

- **Status:** Accepted
- **Date:** 2026-09-18

## Context

The student found the Gemini website's transcript of a call the best they had seen. It uses Roman Urdu with English kept as spoken, and one line per speaker turn. The student reads English and Roman Urdu, not Urdu script. Evidence: [findings](../phase0-findings.md), "Getting close to the Gemini website".

## Decision

The original transcript is Roman Urdu (never Urdu script) with English words as spoken, and an English translation sits alongside. There is one segment per speaker turn, labelled Teacher/Student or by name. Every drafting and checking request carries context: subject, stream, teacher, date, a per-subject glossary, terms read from board and slide photos, and the course outline if added.

## Consequences

Gemini 3.5 Flash with context matched 85% of the website's words, got 3 of 3 names right and made no everyday-word slips. The glossary has to be maintained (partly automatically, ADR-0008). Roman Urdu is valid in the original field but a fault in the English field.

## Alternatives considered

Urdu-script original: rejected (the student can't read it well). English only: rejected (the student wants the original too).

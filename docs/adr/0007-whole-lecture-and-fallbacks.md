# ADR-0007: Whole-lecture drafts on Gemini 3.5 Flash, with a model fallback chain

- **Status:** Accepted
- **Date:** 2026-09-18

## Context

Real free limits (AI Studio, 2026-09-18) are per model: Flash models 20 a day each, Flash-Lite 500 a day, 250K tokens a minute. A 52-minute lecture went through in one request (79K input / 40K output tokens, 196 s). Newer Flash models were often overloaded (HTTP 503). Evidence: [findings](../phase0-findings.md).

## Decision

Draft each lecture in one request on Gemini 3.5 Flash. Fallbacks, in order: Gemini 3 Flash, 2.5 Flash, 30-minute pieces, 3.5 Flash-Lite, Groq Whisper. The queue sends at most one lecture per minute per model, retries with growing pauses, and runs work in priority order when limits are near (R-PROC-9). The app uses its own dedicated Google Cloud project. It never uses several projects or accounts to stretch limits.

## Consequences

Thursday uses up to 16 of Flash's 20 a day. Lectures may finish hours later during overloads. Gemini 3.5 Transcribe Live (no daily cap shown) may replace Flash for transcription if spike S1 passes.

## Alternatives considered

Several projects or accounts: rejected (reportedly against Google's terms, and it puts the Drive account at risk). 10-minute pieces: rejected (too many requests).

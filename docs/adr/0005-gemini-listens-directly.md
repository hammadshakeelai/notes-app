# ADR-0005: Transcribe with Gemini listening to the audio, not Whisper

- **Status:** Accepted
- **Date:** 2026-09-18

## Context

Lectures mix English, Urdu and Pashto in noisy rooms. Phase 0 ([findings](../phase0-findings.md)) compared five methods on three real clips.

## Decision

Gemini listens to the audio and returns the transcript and English translation in one pass. Groq Whisper is a last resort only.

## Consequences

Whisper turbo made up repeated sentences and large-v3 garbled Urdu script. Gemini's English was followable, and the student rated both Gemini models "very good". The app therefore depends on Gemini's free limits.

## Alternatives considered

Whisper followed by translation: rejected (errors carried through). Paid transcription services: rejected (budget).

# ADR-0015: Model roles after the API tests

- **Status:** Accepted. Supersedes the fallback chain in ADR-0007.
- **Date:** 2026-09-18

## Context

ADR-0007 set Gemini 3.5 Flash as the drafting model, with a fallback chain of Gemini 3 Flash → 2.5 Flash → 30-minute pieces → 3.5 Flash-Lite → Groq Whisper, and listed Gemini 3.5 Transcribe Live as a candidate. Spikes S1 and S2 and the feature checks ([findings](../phase0-findings.md), "API tests to decide the app's models") tested each option on the student's real audio:
- Transcribe Live dropped half the speech and mixed three scripts.
- 2.5 Flash gave up on transcription.
- 3 Flash matched 3.5 Flash.
- 3.1 Flash-Lite was the best Flash-Lite model but looped on one lecture.
- 3.5 Flash-Lite with a strict schema made good notes and cards in 5 s.

## Decision

| Job | Model | Fallbacks |
| --- | --- | --- |
| Transcription + English (whole lecture, website style, with context) | Gemini 3.5 Flash | Gemini 3 Flash → 30-minute pieces → Gemini 3.1 Flash-Lite → Gemini 3.5 Flash-Lite → Groq Whisper |
| Second, independent draft for finding doubtful parts (R-QA-3) | Gemini 3.1 Flash-Lite | Gemini 3.5 Flash-Lite |
| Re-listening to short doubtful clips (R-QA-3b) | Gemini 3.1 Flash-Lite | Gemini 3.5 Flash for parts that still disagree |
| Notes, summary, flashcards, practice questions, revision sheet | Gemini 3.5 Flash-Lite, strict JSON schema | Gemma 4 31B, strict JSON schema (slower) |
| Grading "explain it" answers, sense check | Gemini 3.5 Flash-Lite, strict JSON schema | Gemma 4 31B, strict JSON schema |
| Study chat answers | Gemini 3.5 Flash-Lite | Gemma 4 31B |
| Web search in the chat | Google Search grounding (Gemini 2.5 Flash) | Tavily, then Wikipedia (no key) |

Rules for every model call:
1. **Always use a strict response schema.** Gemma without one returns rambling text.
2. **Cap output by audio length:** about 1,600 output tokens per minute of audio, so a repetition loop fails fast and the next model takes over. Also add the repetition check (R-QA-1).
3. Retry an overloaded model (503) with growing pauses before falling back.

Removed: Gemini 3.5 Transcribe Live, and Gemini 2.5 Flash for transcription.

## Consequences

- Gemini Flash is now only used for drafts and escalations: about 1–2 requests per lecture, 4–8 on Thursday, well inside 20 a day. Notes and cards no longer compete with transcription.
- Flash-Lite does most of the work (500 a day each for 3.1 and 3.5).
- Gemini 3 Flash is a preview model and was overloaded once, so the chain continues to Flash-Lite.
- The looping behaviour of 3.1 Flash-Lite on some audio is handled by the output cap, the repetition check and the fallback, not by trusting the model.

## Alternatives considered

- Making Gemini 3.1 Flash-Lite the main drafting model (500 a day): rejected, because it loops on some lectures.
- Gemini 3.5 Transcribe Live for uncapped transcription: rejected (gaps, mixed scripts).
- Gemma 4 for notes as the primary model: rejected as primary (42 s against 5 s), kept as fallback.

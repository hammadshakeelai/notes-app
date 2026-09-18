# Spike tools

Throwaway scripts used to test free AI services on real lectures before building the app. The results and decisions are in [docs/phase0-findings.md](../../docs/phase0-findings.md) and [ADR-0005](../../docs/adr/0005-gemini-listens-directly.md) to [ADR-0008](../../docs/adr/0008-caution-loop.md) and [ADR-0015](../../docs/adr/0015-model-roles-after-api-tests.md).

They are kept for two reasons: to repeat a test when a model changes, and as a reference for the prompts, schemas and checks that the app will turn into proper, tested code in M4.

**Privacy (ADR-0014):** the scripts contain no keys, recordings, transcripts or personal names. They read audio from, and write results to, the git-ignored `private/phase0/` folder. Keys come from your own `.env` (see `.env.example`). Nothing they produce should be committed.

**Requirements:** Python 3.12+ (standard library only), Node 22.6+ (24 used), and `ffmpeg` for preparing audio. Nothing needs installing from npm or pip.

## Scripts

| Script | What it does | Example |
| --- | --- | --- |
| `phase0.py` | Phase 0 comparison: Groq Whisper (large-v3, turbo, translate) against Gemini listening directly; the automatic caution-loop checks (coverage, gaps, repetition loops, Urdu script and Roman Urdu in English); the checker pass; a side-by-side report | `py -3 tools/spikes/phase0.py check` |
| `webcompare.py` | Website-style transcription (Roman Urdu + English, speaker turns, optional `CONTEXT`), a checker pass, and scoring against a reference transcript | `py -3 tools/spikes/webcompare.py run gemini-3.5-flash label low` |
| `live_test.mjs` | Streams 16 kHz PCM audio to a Gemini Live model over WebSocket and records what it writes (spike S1) | `node tools/spikes/live_test.mjs gemini-3.5-transcribe-live in.pcm 2 out.json` |
| `study_test.py` | Notes, summary and flashcards from a transcript with Flash-Lite and Gemma 4 (with and without a schema), plus answer grading | `py -3 tools/spikes/study_test.py` |
| `run-jest-shim.mjs` | Runs Jest-style `*.test.ts` files under Node's built-in TypeScript stripping, with a small `describe`/`it`/`expect` shim | `node tools/spikes/run-jest-shim.mjs <src> <out>` |
| `verify_plan.py` | Extracts every code block from an implementation plan and runs its tests with the shim, so a plan can be checked before it is executed | `py -3 tools/spikes/verify_plan.py docs/superpowers/plans/2026-09-18-m1-domain-core.md` |

## Preparing audio

```bash
# 10-minute excerpt as 16 kHz mono MP3 (what the generateContent tests use)
ffmpeg -ss 600 -t 600 -i lecture.m4a -ac 1 -ar 16000 -b:a 64k private/phase0/excerpts/lecture_10-20min.mp3

# Raw PCM for the Live API test
ffmpeg -i clip.mp3 -f s16le -ac 1 -ar 16000 clip.pcm
```

## Lessons baked into these scripts

- Always send a strict `responseSchema`. Without one, Gemma returned rambling text.
- Cap `maxOutputTokens` by audio length (about 1,600 tokens per minute) so repetition loops fail fast.
- Inline audio requests must stay under 20 MB after base64 encoding. A 52-minute lecture at 32 kbps (16.8 MB request) worked; at 48 kbps it would not have.
- Gemini 2.5 models take `thinkingBudget`; Gemini 3.x models take `thinkingLevel`. The Transcribe model accepts neither.
- Retry HTTP 503 ("high demand") with pauses. It happened often on newer Flash models.
- With `git grep`, options such as `--cached` must come before the pattern, or the scan silently fails.

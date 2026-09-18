# Phase 0 findings: free transcription test

- **Date:** 2026-09-18
- **Question:** Can free services turn our lectures (English, Urdu and Pashto mixed, noisy rooms) into English we can study from?
- **Answer:** Yes: Gemini listening directly, followed by an independent check.

Recordings, transcripts and the test script are kept in the git-ignored `private/` folder. This note contains no lecture content.

## Test material

Three clips recorded on a Samsung S23 Ultra with the built-in Voice Recorder (AAC, 48 kHz mono, 128 kbps, about 58 MB per hour), converted to 16 kHz mono MP3 at 64 kbps for the test:

| Clip | Length |
| --- | --- |
| Programming for AI lecture, minutes 10–20 | 10:00 |
| Machine Learning lecture, minutes 10–20 | 10:00 |
| Cyber security workshop (outside the timetable) | 9:17 |

The rooms were never quiet (no stretch below −45 dB lasting 8 s or more).

## Transcription methods compared

| Method | Result | Time per 10 min |
| --- | --- | --- |
| Groq Whisper large-v3-turbo | ❌ Invented repeated sentences (the same phrase up to 10 times) | 3–5 s |
| Groq Whisper large-v3 (original language) | ❌ Urdu-script output garbled in places, repetition loops | 5–9 s |
| Groq Whisper large-v3 (its own English translation) | 🟡 About half the meaning survives | 3–4 s |
| Whisper text → Gemini Flash-Lite translation | ❌ Carries Whisper's errors through | 10–13 s |
| **Gemini 3.5 Flash, listening to the audio** | ✅ Clear, followable English | 25–45 s |
| **Gemini 3.5 Flash-Lite, listening to the audio** | ✅ Nearly as clear, same amount of content (~1,100–1,600 English words per clip) | 16–23 s |
| Gemini 3.5 Transcribe | ❌ Returned an empty reply | — |
| Gemini 3.8 Flash | ⚠️ Unavailable (HTTP 503, "high demand") | — |

The student read all three clips and judged both Gemini methods "very good". Flash was better on specific words: at one point Flash-Lite heard "paths" as *paanch* (Urdu for "five").

## Faults found

- **Untranslated English:** Flash-Lite left 23 of 63 English segments in Roman Urdu on one clip. Flash did not.
- **Malformed output:** Gemini once returned broken JSON. A strict response schema fixed it.
- **Truncated output:** Gemini's internal reasoning used up the output limit. Low thinking effort and a higher output limit fixed it.
- **Overload:** Gemini 3.8 Flash was unavailable during the test.

## The caution loop works, if the checker is a different, stronger model

| Checker | On Flash-Lite drafts | On Whisper turbo (known bad) |
| --- | --- | --- |
| Gemini 3.5 Flash-Lite (same model family) | 0–1 problems | **0 problems**, so it can't be trusted |
| Gemini 3.5 Flash | 4, 24 and 5 problems, including the "paths" / *paanch* mistake | — |

One full loop on the worst clip (automatic checks → Flash check → apply fixes → re-check):

| Round | Checker found | Applied | Rejected | Untranslated segments left |
| --- | --- | --- | --- | --- |
| Start | — | — | — | 23 / 63 |
| 1 | 56 | 56 | 0 | 1 / 63 |
| 2 | 44 | 43 | 1 (the fix itself was Roman Urdu) | 1 / 63 |

Takeaways, now requirements R-QA-1 to R-QA-9 in the design document:
- Automatic checks catch loops, gaps, empty segments, Urdu script and Roman Urdu in English.
- The checker must be a different, stronger model.
- The checker's own corrections must pass the automatic checks before they are applied.
- Round 1 did the real work. Round 2's 43 applied corrections changed no automatic check (untranslated segments stayed at 1/63), so it is either rewording or improvement the checks can't see. Round 2 now runs only when the automatic checks still fail.
- A segment still failing after the rounds gets a targeted repair. Anything left is shown to the student instead of being guessed.

## Getting close to the Gemini website

The student supplied a transcript made on the Gemini website (consumer app) of a 78-minute video call, and called it the best they had seen. Its style: **Roman Urdu** (Latin letters) with English kept as spoken, one line per speaker turn, names and terms spelled correctly. We asked the free API for the same style ("website-style prompt") on the first 10 minutes. Only that excerpt was sent, because the call was confidential.

| Setup | Words matching the website | Names right (of 3) | Everyday-word slips |
| --- | --- | --- | --- |
| Flash-Lite, website-style prompt | 82% | 0 | Several (e.g. "Saudi" for "Sorry") |
| Flash-Lite + names as context | 80% | 2 | Several |
| Flash-Lite + context, then a Flash check without context | 83% | 1 (the check undid one) | Several |
| Flash, website-style prompt | 85% | 0 | None |
| **Flash + names as context** | **85%** | **3** | **None** |
| Gemini 3.1 Pro | Not free: "limit: 0" on the free tier | — | — |

The remaining ~15% is mostly spelling variation of Roman Urdu ("hai/he", "kese/kaise"), which counts as a mismatch even when both are right. Flash with context also adds **timestamps and speaker names**, which the website version doesn't have. Its one visible fault was merging two short speaker turns.

**Whole lecture in one request:** the full 52-minute Programming for AI lecture was sent to Gemini 3.5 Flash in one request (16.8 MB, audio at 32 kbps).
- It returned 623 segments in 196 s: about 79,000 input tokens and 40,000 output tokens, finishing normally.
- Every minute had text (about 100–180 words a minute).
- The automatic checks found one out-of-place timestamp, 8 of 623 English segments in Roman Urdu, and one repeated phrase (possibly genuine).

**Overload:** during the evening test, Gemini 3.6, 3.7 and 3.8 Flash all returned HTTP 503 ("high demand"), and 3.5 Flash did so twice before succeeding on retry.

**Takeaways:**
- The original transcript is written in Roman Urdu, website-style.
- Gemini 3.5 Flash drafts the whole lecture, with context (subject, teacher, glossary).
- Context must go to the checker too.
- Retries with growing pauses are required.
- Extra API keys don't add free quota: limits are per project.

## Making transcripts correct: two cheap tests

**Finding doubtful parts for free.** The Flash and Flash-Lite transcripts of one clip were compared in 30-second windows by the words they share, with no API calls. The window where they agreed least (15%) was exactly where Flash-Lite had heard "paths" as *paanch*, the error a person had spotted by eye. Some other low-agreement windows were only timestamp offsets (the two models' clocks differed by about 30 s), so the real comparison lines drafts up by text, not time.

**Re-listening to a short clip.** The 50 seconds around that spot were sent again to Flash-Lite:

| | "paths" | ".bashrc" | "ls -a" |
| --- | --- | --- | --- |
| Flash-Lite, 10-minute clip | ❌ *paanch* | ❌ | ❌ |
| Flash-Lite, 50-second clip | ✅ | ❌ ("HRC") | ❌ ("LS - a") |
| Flash-Lite, 50-second clip + topic context | ✅ | ✅ | ✅ |

One phrase ("Paths in Linux") was still misheard. Items like that go to the student's short "needs your check" list, and the correction is remembered for future lectures.

Result: the checker question is settled. An independent Flash-Lite draft finds the doubtful parts, and Flash-Lite re-listens to short clips with context. Flash is only used for parts that still disagree (R-QA-3, R-QA-3b).

## Free-tier observations

- **Groq:** 2,000 requests a day reported in the response headers. Audio-second limits are not in the headers.
- **Gemini:** no rate-limit headers, but AI Studio (https://ai.dev/rate-limit) shows the real free limits per model:
  - Flash models: 20/day each
  - Flash-Lite models: 500/day each
  - 250K tokens a minute
  - Gemma 4: 14,400/day
  - Search grounding: 1,500/day on Gemini 2.5
  - Live API models (including 3.5 Transcribe Live): no daily cap shown, 20K tokens/min

  Peak use during the test: 3.5 Flash 17/20 per day and 78.7K tokens a minute (the whole-lecture request), and Flash-Lite 16/500.
- **Why Gemini 3.5 Transcribe returned nothing:** it is listed under the Live (streaming) API, with 10K tokens a minute. Calling it like a normal model was the wrong way to use it. Gemini 3.5 Transcribe *Live* is the candidate to test.
- **Size:** 10 minutes of audio is about 15,000 Gemini input tokens. A draft is about 3,500–7,700 output tokens.

## Decisions

1. Gemini 3.5 Flash drafts the whole lecture in one pass (Roman Urdu original + English, speaker turns, with context). Fallbacks: 30-minute pieces, then Flash-Lite, then Whisper. Doubtful parts are found by comparing with a Flash-Lite draft and re-heard as short clips.
2. The caution loop (R-QA-1 to R-QA-9) is part of processing.
3. Recordings outside the timetable are filed as **Other** (R-TT-4).
4. Before Phase 2: confirm the real Gemini free limits, test 30-minute pieces, and check that Drive access is shared between the web and Android clients.

# Roadmap

Milestones in build order. Each one ends with something usable, a release tag, and exit criteria that are checked before the next one starts. Detailed, test-first implementation plans are written for one milestone at a time, just before it starts, in `docs/superpowers/plans/`.

Requirement IDs refer to the [design](specs/2026-09-18-notes-app-design.md). Decisions are in the [ADRs](adr/README.md).

## Overview

```
M0 Inception + Phase 0 ✅
 └─ M1 Domain core ──► M2 Recorder module ──► M3 Android app v1 (usable, no AI)
                                                  │
                        Spikes S1–S5 ─────────────┤
                                                  ▼
                                   M4 Processing + caution loop
                                                  ▼
                                   M5 Drive sync + web app + Class share
                                                  ▼
                          M6 Flashcards + practice ──► M7 Study chat
```

| Milestone | Goal | Size | Tag | Plan | Status |
| --- | --- | --- | --- | --- | --- |
| M0 | Requirements, design, transcription test | — | — | — | ✅ Done 2026-09-18 |
| M1 | Timetable, naming and numbering logic, tested, with CI | S | `v0.1.0` | [plan](superpowers/plans/2026-09-18-m1-domain-core.md) | Ready |
| M2 | Android recorder that can't lose a lecture | L | `v0.2.0` | Written when M1 is done | Not started |
| M3 | Android app you can use in class every day (no AI yet) | M | `v0.3.0` | Written when M2 is done | Not started |
| S1–S5 | Spikes that settle the unknowns before M4 | S | — | Below | Not started |
| M4 | Every lecture becomes a checked transcript and notes | L | `v0.4.0` | Written after the spikes | Not started |
| M5 | Everything on the desktop; classmates' shared folder | L | `v0.5.0` | — | Not started |
| M6 | Flashcards, practice questions, exam mode, revision sheets | M | `v0.6.0` | — | Not started |
| M7 | Study chat per subject with web search | M | `v0.7.0` | — | Not started |

Sizes: S = a few focused sessions, M = one to two weeks part-time, L = two to four weeks part-time.

## Milestones

### M1: Domain core (`v0.1.0`)

- **Scope:** the Expo project skeleton, CI, and all timetable logic as pure TypeScript with unit tests:
  - class detection
  - lecture/lab numbering with holidays, cancellations and make-up sessions
  - display names and file names, including "Other" recordings
  - teacher changes by date
  - which classes need a "missed or cancelled?" prompt
  - importing the private timetable file
- **Requirements:** R-TT-1 (import logic), R-TT-2, R-TT-3, R-TT-4, R-TT-5, R-NAME-1, R-NAME-2, R-NUM-1, R-NUM-2, R-NUM-3 (selection logic), R-NUM-4 (listing logic).
- **Exit criteria:**
  - All plan tasks done.
  - CI green on `main`.
  - The worked example passes: Fundamentals of Accounting on Mon 21 Sep 2026 is Lecture 5.
  - Tag `v0.1.0`.

### M2: Recorder module (`v0.2.0`)

- **Scope:** a custom Kotlin Expo module:
  - foreground service of type `microphone` in its own process
  - 30-second chunk writer, and joining chunks after Stop
  - crash and reboot recovery
  - pause and resume on calls
  - notification with Bookmark / Pause / Stop
  - sound-level meter
  - battery and storage warnings

  Includes toolchain setup: JDK 17, `ANDROID_HOME`, `adb`, Expo development build.
- **Requirements:** R-REC-2, R-REC-3, R-REC-4, R-REC-5, R-REC-6, R-REC-7, R-REC-8, R-REC-10, R-REC-11, R-REC-13.
- **Exit criteria:** the device checklist passes on the S23 Ultra:
  - 10 minutes with the screen off
  - swipe-away
  - UI process killed
  - phone call mid-recording
  - reboot mid-recording, then recovered
  - battery use per hour measured

  Tag `v0.2.0`.

### M3: Android app v1 (`v0.3.0`)

- **Scope:**
  - SQLite storage
  - first-run setup: permissions, Samsung battery steps, timetable import and review, marking past holidays
  - home screen with the detected class and Record button
  - recordings list
  - timetable and holiday editor
  - "missed or cancelled?" notifications
  - photos and bookmarks during recording
  - "Other" recordings
  - importing audio from another recorder
- **Requirements:** R-REC-1, R-REC-9, R-REC-12, R-TT-1 (setup screen), R-NUM-2/3/4 (screens and notifications), R-SET-1 (all steps except Google sign-in and keys), R-SET-2.
- **Exit criteria:**
  - Used for **one full week of real classes**: every class recorded, named and numbered correctly, and nothing lost.
  - Tag `v0.3.0`.

### Spikes before M4

Throwaway investigations. Results go into `docs/phase0-findings.md` (or a new findings file), and decisions into ADRs.

| Spike | Question | Method | Pass means |
| --- | --- | --- | --- |
| S1 | Is Gemini 3.5 Transcribe Live (or Live Translate) good enough on our lectures, with no daily cap? | Stream 2 real lectures through the Live API; compare with Flash + context | The student rates it as good as Flash, and a 90-minute lecture finishes in under 15 minutes |
| S2 | How good are the fallback models (Gemini 3 Flash, 2.5 Flash) at website-style Roman Urdu? | Same 10-minute clips and scoring as Phase 0 | Close to 3.5 Flash with context; if not, drop them from the chain |
| S3 | Do 30-minute pieces stitch cleanly when a whole-lecture request fails? | Split a 90-minute lecture with 10 s overlap; check the joins | No duplicated or missing speech at the joins |
| S4 | Can the Android and web OAuth clients share `drive.file` access? Can the OAuth app be published to avoid sign-ins expiring every 7 days? | Two clients in the new project, one test file | Each client reads the other's file; published status reached |
| S5 | Which Android audio source and bitrate give the best transcripts? | Record the same class with 2 settings on 2 phones, or back-to-back | A clear winner, or no difference (then use the smaller files) |

S5 can run during M2, since it needs the recorder.

### M4: Processing and caution loop (`v0.4.0`)

- **Scope:**
  - persistent processing queue and AI router: model fallback chain, rate pacing, retries, priority order
  - whole-lecture drafts with context and glossary
  - caution loop: automatic checks, second draft, finding doubtful parts, short-clip re-listening, sense check, "needs your check" list, learning from corrections, quality badge
  - notes as Markdown
  - API key settings with a Test button
  - usage screen
- **Requirements:** R-PROC-1 to R-PROC-10, R-QA-1 to R-QA-11, R-NOTE-1 to R-NOTE-3, R-SET-3, R-SET-4.
- **Exit criteria:**
  - One week of lectures processed with no taps.
  - Every lecture has a quality badge.
  - The "needs your check" list works end to end, and a correction reappears as a glossary entry.
  - Tag `v0.4.0`.

### M5: Sync, web app and Class share (`v0.5.0`)

- **Scope:**
  - Google sign-in
  - Drive sync (one JSON file per item, latest edit wins, delete markers, Drive Changes API)
  - web app build hosted on GitHub Pages
  - IndexedDB store
  - audio upload and processing in the browser
  - Class share folder with Google Docs and Flashcards.csv
- **Requirements:** R-SYNC-1 to R-SYNC-3, R-WEB-1, R-WEB-2, R-SHARE-1 to R-SHARE-5, R-SET-1 (Google sign-in step).
- **Exit criteria:**
  - An edit on the desktop appears on the phone and the other way round.
  - A classmate can open the shared folder without an account prompt beyond Google's own.
  - Tag `v0.5.0`.

### M6: Flashcards and practice (`v0.6.0`)

- **Requirements:** R-FC-1 to R-FC-8.
- **Exit criteria:**
  - Cards are generated for every lecture and scheduled by FSRS.
  - Exam mode and revision sheet work for one subject end to end.
  - Tag `v0.6.0`.

### M7: Study chat (`v0.7.0`)

- **Requirements:** R-CHAT-1 to R-CHAT-5.
- **Exit criteria:**
  - Answers cite lecture timestamps and web links, labelled correctly.
  - Works within the free limits during a normal week.
  - Tag `v0.7.0`.

## Requirement traceability

Every requirement in the design, and the milestone that delivers it. Split requirements appear in more than one milestone.

| Requirement | Milestone | | Requirement | Milestone |
| --- | --- | --- | --- | --- |
| R-REC-1 | M3 | | R-QA-1 … R-QA-11 (incl. R-QA-3b) | M4 |
| R-REC-2 … R-REC-8 | M2 | | R-NOTE-1 … R-NOTE-3 | M4 (web editing in M5) |
| R-REC-9 | M3 | | R-FC-1 … R-FC-8 | M6 |
| R-REC-10, R-REC-11, R-REC-13 | M2 | | R-CHAT-1 … R-CHAT-5 | M7 |
| R-REC-12 | M3 (web upload in M5) | | R-SYNC-1 … R-SYNC-3 | M5 |
| R-TT-1 | M1 (import logic), M3 (setup screen) | | R-WEB-1, R-WEB-2 | M5 |
| R-TT-2 … R-TT-5 | M1 | | R-SHARE-1 … R-SHARE-5 | M5 |
| R-NAME-1, R-NAME-2 | M1 | | R-SET-1 | M3 (most steps), M4 (keys), M5 (Google sign-in) |
| R-NUM-1 | M1 | | R-SET-2 | M3 |
| R-NUM-2 … R-NUM-4 | M1 (logic), M3 (screens, notifications) | | R-SET-3, R-SET-4 | M4 |
| R-PROC-1 … R-PROC-10 | M4 | | | |

## Risk register

| ID | Risk | Likelihood | Impact | Mitigation | Status |
| --- | --- | --- | --- | --- | --- |
| K1 | Google cuts free limits | Medium | High | Model fallback chain; Groq Whisper; priority queue; spike S1 (Live) may remove the daily cap | Open |
| K2 | Gemini overload (503) delays processing | High | Low | Retries with growing pauses; fallbacks; lectures may finish hours later | Open |
| K3 | Pashto-heavy lectures transcribe badly | Low | Medium | Context and glossary; caution loop; "needs your check" | Open |
| K4 | Samsung kills the recorder | Medium | High | Foreground service in its own process; battery setup steps and reminders; M2 device checklist | Open |
| K5 | Android and web clients can't share `drive.file` files | Low | High | Spike S4 before M5; fallback: broader scope with Google review | Open |
| K6 | Sign-ins expire every 7 days (OAuth "testing" mode) | Medium | Medium | Publish the OAuth app (`drive.file` needs no review); spike S4 | Open |
| K7 | Lecturers or the university object to recording or sharing | Medium | High | Ask first; per-subject sharing switch; recordings stay personal | Open |
| K8 | Windows Android toolchain problems (JDK 19 installed; Expo expects 17) | Medium | Low | Toolchain setup is M2's first task | Open |
| K9 | Scope creep for a solo developer | High | Medium | Milestone exit criteria; nothing starts before the previous tag | Open |

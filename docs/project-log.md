# Project log

A dated record of what was done and why. Decisions are recorded in full in [ADRs](adr/README.md). Requirements are in the [design](specs/2026-09-18-notes-app-design.md). Times are Pakistan Standard Time.

## 2026-09-18: inception, requirements, Phase 0

### Timeline

| Time | What happened | Outcome |
| --- | --- | --- |
| 19:40 | Asked for a repo and README for a notes app for university: class recording and AI | Stack chosen: Expo, cloud transcription. Public GitHub repo `hammadshakeelai/notes-app` created (`b757f14`) |
| 19:49 | Requirement: record even if the app is closed or the phone is off | Explained what's possible: screen-off, pocket and swipe-away work on Android; a switched-off phone cannot record → ADR-0010 |
| 19:49–20:39 | Requirements gathering, one question at a time | See "Requirements captured" below |
| 20:15 | Asked for desktop access | Web app reading and writing Google Drive → ADR-0003 |
| 20:28 | Asked for a chatbot with free web search | Combined per-subject study chat → ADR-0012 |
| 20:39 | Answered open defaults: Samsung S23 Ultra, next semester dropped, holidays editable, notes as `.md`, English UI; asked for flashcard research | FSRS → ADR-0011 |
| 20:47 | First design spec written, README updated | Teacher names and rooms moved to git-ignored `private/` before the first push → ADR-0014 (`576e93f`) |
| 20:50 | Sent 3 recordings for Phase 0 | Transcription test started |
| 21:22 | "Everyone adds their own API keys locally" | `.env.example` and bring-your-own-keys → ADR-0004 (`45d9f51`) |
| 21:26 | Classmates need notes and study material, not audio, on desktop only | Class share Drive folder → ADR-0013 (`a231d7e`, `2845eda`) |
| 21:33 | Free Groq, Gemini and Tavily keys added to local `.env` | Phase 0 run: Gemini beats Whisper → ADR-0005 |
| 21:53 | Asked for a "caution loop" so faults are removed. Said lectures have little Pashto. The Friday clip was a cyber workshop | Caution loop designed and tested. "Other" recordings added (R-TT-4) (`9a94fa1`) |
| 21:54 | Judged Gemini Flash (B) and Flash-Lite (C) both "very good"; spotted *paanch* vs "paths" | Confirmed the Flash checker catches that kind of error |
| 22:01 | Budget review of the loop | Round 2 made conditional (`9db691a`) |
| 22:03 | Sent a Gemini-website transcript as the quality bar | Website-style Roman Urdu + context → ADR-0006. Whole-lecture requests work → ADR-0007 (`e2753c1`) |
| 22:17 | Asked about using several API keys or accounts | Limits are per project; several projects/accounts rejected → ADR-0007, spec Non-goals |
| 22:30 | ML Lab teacher changed (details only in the private timetable); **design approved**; asked how transcripts become correct | Private timetable updated; R-TT-5; correction layers tested → ADR-0008. Pushed (`4475383`) |
| 22:49 | Asked whether everything was in the repo, and whether API limits would run out | Gaps filled; quota priorities and noon PKT reset (R-PROC-9/10) (`62a1933`) |
| 23:14 | Shared the real limits from AI Studio | Per-model limits recorded; Flash fallback chain; Gemma 4; search grounding; Live Transcribe candidate (`493bff2`) |
| 23:19 | Will use a separate Google Cloud project for the app; asked to log everything and plan the next stages | This log, the ADRs, engineering conventions, roadmap and the Milestone 1 implementation plan |
| 23:37 | Asked to test the API to decide what goes into the app | Spikes S1 and S2 run, plus search, notes, flashcards and grading checks. Transcribe Live rejected; Gemini 3 Flash is a real fallback; 3.1 Flash-Lite strong but loops on some audio; notes and cards move to Flash-Lite → ADR-0015 |

### Requirements captured

| Topic | Answer |
| --- | --- |
| Users | Just me. Classmates only receive study material |
| Phone | Android: Samsung Galaxy S23 Ultra |
| Recording start/stop | Fully manual |
| In class | Photos of the board/slides and bookmarks; no typing |
| Naming | Date + class + lecture number from the timetable |
| Numbering | Follows the timetable; lectures and labs counted separately |
| Languages | English, Urdu and some Pashto, noisy rooms. Output in English plus the original |
| Processing | Every class, automatically |
| AI features | Summary and notes, flashcards and practice, "ask your lectures", revision sheet |
| Backup and desktop | Google Drive; full two-way web app |
| Budget | $0, free services only |
| Keys | Everyone brings their own |

### Evidence gathered

- Phase 0 transcription test on 3 real clips: [phase0-findings.md](phase0-findings.md)
- Gemini website comparison on a 10-minute excerpt of a call: same file
- Full 52-minute lecture in one request: same file
- Real free-tier limits from AI Studio: [spec §6.2](specs/2026-09-18-notes-app-design.md)

### Open items at end of session

- License: not chosen yet (all rights reserved by default)
- Spikes before Milestone 4 (processing): S1 and S2 done; S3–S5 open in the [roadmap](roadmap.md)
- A new Google Cloud project dedicated to the Notes App (being done by the student)

## 2026-09-19

| Time | What happened | Outcome |
| --- | --- | --- |
| 00:03 | Asked to write everything into the repo | Test scripts moved from `private/` to `tools/spikes/` (data stays private); `verify_plan.py` added. The M1 plan was re-verified from its committed text: 19 files, 45 tests pass |

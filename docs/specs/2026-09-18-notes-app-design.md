# Notes App: Requirements and Design

- **Date:** 2026-09-18
- **Status:** Approved 2026-09-18
- **Owner:** @hammadshakeelai (sole user)

## 1. Summary

A personal study app for one university student. The Android phone records every class, names and files each recording automatically from the timetable, and turns it into English study material: transcript, notes, flashcards and practice questions. It also offers a study chat that can search both the lectures and the web. Everything syncs through the student's Google Drive, and a web app gives full access from any desktop. The whole system runs on free services.

## 2. Context and constraints

| Item | Decision |
| --- | --- |
| Users | One person. No accounts, no app store, no other users. Classmates get the study material (never audio) through a shared Drive folder (4.8) |
| Phone | Samsung Galaxy S23 Ultra (Android). No iOS |
| Desktop | Any browser, via a web app |
| Lectures | English, Urdu and Pashto mixed within sentences, noisy rooms |
| Reading language | English only. All generated content is in English |
| Class load | About 16 classes and 26 hours a week, Mon–Thu (see Appendix A) |
| Budget | **$0.** Free tiers only. No paid APIs, no paid hosting |
| Semester | BS Artificial Intelligence, Semester V, Group B, starting 2026-09-07 |

The student's consumer subscriptions (Google AI Pro, Claude Pro, ChatGPT Plus) do not include API access and are not used by the app. Because all data is stored in Google Drive as ordinary files, the student can point the Gemini website or NotebookLM at their notes by hand. The app does nothing special for this.

## 3. Goals and non-goals

**Goals**
- Recording that is hard to lose: survives screen-off, the phone in a pocket, app swipe-away, UI crashes and phone calls. A dead battery loses at most about 30 seconds. A phone that is switched off or out of battery cannot record at all (no app can), so for that case audio from another recorder can be imported (R-REC-12).
- Zero typing to file a recording: subject, lecture/lab number and date come from the timetable.
- Every class becomes English notes, flashcards and practice questions with no manual steps.
- Everything is reachable and editable from a desktop browser.
- $0 running cost.

**Non-goals (for now)**
- iOS, other users, publishing to an app store
- Importing future timetables (next semester is handled later)
- Live transcription during class
- Typing notes during class (photos and bookmarks only)
- Automatic recording start (Android does not allow apps to start the microphone from the background; starting is always a manual tap)
- Paid services of any kind
- Several API keys, projects or Google accounts to stretch the free limits. Limits are per project, so extra keys don't help, and extra projects or accounts to get around limits are reported to be against Google's terms. A suspension would also hit the Google account that holds the Drive data

## 4. Requirements

### 4.1 Recording (phone)
- **R-REC-1** One tap starts recording. The home screen shows the detected class (subject, type, teacher, room, number) and you can change it before or during recording.
- **R-REC-2** Recording runs in an Android foreground service (type `microphone`) with a persistent notification showing the title, elapsed time and **Bookmark / Pause / Stop** buttons.
- **R-REC-3** Recording continues with the screen off, while other apps are in use, and after the app is swiped away from recent apps.
- **R-REC-4** The recorder runs in its own process, separate from the UI, so a UI crash does not stop it.
- **R-REC-5** Audio is written in 30-second chunks. After Stop, the chunks are joined into one file per recording and deleted once the join is verified.
- **R-REC-6** If the app or phone dies mid-recording, the next launch recovers the chunks into a normal recording and tells you ("Recovered: ML Lab 4 (1h 12m)").
- **R-REC-7** Phone calls or other apps taking the microphone pause the recording. It resumes afterwards and the gap is marked on the timeline.
- **R-REC-8** Starting a recording warns if the battery is below 20% or free storage is under 1 GB, and shows the estimated recording time left.
- **R-REC-9** A Photo button opens the camera. Each photo is saved and pinned to the current timestamp.
- **R-REC-10** Bookmarks can be added from the app or the notification without unlocking the phone. Each bookmark is a timestamp with an optional label.
- **R-REC-11** Audio format: mono, speech-quality AAC (about 14 MB per hour). The exact sample rate, bitrate and microphone source are chosen in Phase 0/1 by comparing transcription quality.
- **R-REC-13** A live sound-level meter on the recording screen and in the notification warns when the lecturer is too quiet ("move closer or face the phone towards the teacher"). Better audio is the cheapest way to a correct transcript.
- **R-REC-12** Audio from another recorder can be imported (phone file picker, or upload in the web app). You pick the subject and date, and it is numbered and processed like any other recording.

### 4.2 Timetable, naming and numbering
- **R-TT-1** This semester's timetable (Appendix A, plus teachers and rooms from the local `private/timetable.md`) is loaded during setup and can be edited on the phone or on the web.
- **R-TT-2** Subjects group a **Lecture** stream (theory) and an optional **Lab** stream. Each stream has its own numbering.
- **R-TT-3** Class detection when Record is tapped: (1) the slot whose time contains *now*; else (2) a slot starting within the next 15 minutes; else (3) a slot that ended within the last 10 minutes; else (4) ask for the subject and stream, or **Other**.
- **R-TT-4** Recordings outside the timetable (a workshop, seminar or talk) are filed as **Other** with a title you type, e.g. `Fri 11 Sep 2026 – Cyber Workshop`. They have no lecture number, are processed the same way, and are not added to the Class share folder unless you switch it on for them.
- **R-TT-5** Teachers can change mid-semester (this happened for the Machine Learning lab). A change takes effect from a date; earlier lectures keep the teacher they had, both in their names and in the context sent to the AI.
- **R-NAME-1** Display name: `Mon 21 Sep 2026 – Fundamentals of Accounting – Lecture 5` or `… – Machine Learning – Lab 4`.
- **R-NAME-2** File names use an ISO date prefix so they sort: `2026-09-21 Fundamentals of Accounting – Lecture 5`.
- **R-NUM-1** Numbers follow the timetable: *number = scheduled slots of that stream from 2026-09-07 up to and including this one, minus slots marked cancelled or holiday, plus extra (make-up) sessions recorded before it.* Missed classes still use up a number.
- **R-NUM-2** Holidays (whole day) and cancellations (one slot) can be added or removed at any time on phone or web. All numbers and names update automatically.
- **R-NUM-3** When a scheduled slot ends and 15 minutes pass with no recording, a notification asks **Missed** or **Cancelled**. Dismissing it counts as Missed.
- **R-NUM-4** First-time setup lists every slot from 2026-09-07 to today so you can mark holidays and cancellations in one pass. This can be changed later.

### 4.3 Processing
- **R-PROC-1** Every recording is processed automatically. No tap needed.
- **R-PROC-2** Transcription and translation happen in one pass. Gemini 3.5 Flash listens to the **whole recording in one request** (uploaded with the Gemini Files API) and returns timestamped segments, each with a speaker, the original and an English translation. The original is written like the Gemini website does it:
  - **Roman Urdu** (Latin letters) for Urdu and Pashto, never Urdu script, with English words kept as spoken
  - one segment per speaker turn, keeping short replies ("Jee jee", "Achha")
  - speakers labelled **Teacher** / **Student**, or by name when known
  Fallbacks, in order: the same model on 30-minute pieces, then Gemini Flash-Lite, then Groq Whisper.
- **R-PROC-8 Context.** Every drafting and checking request includes:
  - subject, stream, teacher's name and date
  - a per-subject **glossary**: names and technical terms from earlier lectures' notes, terms you add, and your past corrections (R-QA-11)
  - terms read from **this lecture's board and slide photos**
  - optionally, the course outline or slides (PDF) you add to a subject
  In testing, context took names the model got right from 0 of 3 to 3 of 3, and fixed technical terms (".bashrc", "ls -a").
- **R-PROC-3** Nothing is marked done until it has passed the caution loop (4.3.1).
- **R-PROC-4** From the English transcript, photos and bookmarks, the AI produces: a summary, key concepts, and study notes as Markdown (`.md`).
- **R-PROC-5** Flashcards and practice questions are then generated (see 4.5).
- **R-PROC-6** Processing is a persistent queue: it survives app restarts, waits for internet, and waits for free-tier limits to reset. Each recording shows its stage (e.g. "Transcribing 4/9", "Waiting for tomorrow's free limit").
- **R-PROC-7** The device that has the audio processes it. The phone processes its own recordings. The web app processes files uploaded on the desktop while its tab is open, and resumes next time if the tab closes.

#### 4.3.1 Caution loop
Every transcript, and everything generated from it, is checked and repaired before it is marked done. Perfect output is not possible from noisy, mixed-language audio. The loop removes every fault it can detect and shows you the rest, instead of guessing.

- **R-QA-1 Automatic checks** (free, on the device), run on every draft and after every repair:
  - the output is in the expected format
  - it covers the whole piece: starts within 20 s, ends within 45 s of the end, and has no gap over 60 s where there is speech
  - timestamps are in order and inside the audio
  - no repetition loops (the same 6-word phrase 3 or more times)
  - every segment has English
  - no Urdu script anywhere, and no Roman Urdu in the English (Roman Urdu is expected in the original)
  - a single out-of-place timestamp (seen once in a 52-minute test) is repaired by placing it between its neighbours
  - no empty segments
- **R-QA-2** A draft that fails the automatic checks is redrafted: once more with the same model, then with a stronger one.
- **R-QA-3 Find the doubtful parts.** A second, independent draft is made by a different model (Gemini Flash-Lite). The two drafts are lined up by their text and compared. Where they disagree, at least one is probably wrong. In testing, the biggest disagreement in a clip was exactly the word a person had spotted as wrong ("paths" heard as *paanch*).
- **R-QA-3b Re-listen to the doubtful parts.** Each disagreement, and anything failing R-QA-1, is cut from the audio as a short clip (about 20–60 seconds, with a few seconds either side) and transcribed again with full context. Short clips are heard much more accurately than long audio: in testing even Flash-Lite fixed "paanch" to "paths" and heard ".bashrc" and "ls -a" correctly. Re-listening runs on Flash-Lite (large free limit), escalating to Flash only for parts that still disagree. Flash-Lite is never used to judge a whole transcript: that failed in Phase 0.
- **R-QA-4 Check the checker.** A correction is applied only if it passes the automatic checks itself (Phase 0 saw the checker write Roman Urdu into the English).
- **R-QA-5** One check round per piece. A second round runs only if the automatic checks still fail after round 1 and after targeted repair (R-QA-6), for example when a stretch of speech is still missing. Never more than 2. In Phase 0, round 2 applied 43 more corrections that changed no automatic check, so it is not worth the free-tier cost by default.
- **R-QA-6 Targeted repair.** Any segment still failing after the rounds is re-translated on its own.
- **R-QA-7 Needs your check.** Anything still unresolved is marked `[unclear]` and listed on the lecture. Each item plays just those seconds of audio and shows the competing versions ("Flash heard X, Flash-Lite heard Y"): pick one or type the fix, on phone or desktop. Nothing unsure is silently presented as certain.
- **R-QA-8 Generated content is checked too** (text only, no audio, so it runs on Flash-Lite; whether Flash-Lite is strict enough for this is tested in Phase 2, with Flash as the fallback). The checker compares notes, flashcards and practice questions with the final transcript. Every claim must come from the lecture, and every flashcard's answer must match the moment it cites. Unsupported items are fixed or removed.
- **R-QA-9 Quality badge** on every lecture, e.g. *"✓ Checked: 3 pieces, 2 rounds, 57 fixes, nothing needs your check"* or *"⚠ 2 parts need your check"*.
- **R-QA-10 Sense check.** After the transcript passes, the checker reads the English and flags anything that makes no sense for the subject (Phase 0 example: "change the block chain" in a lecture about derivatives, really "change in function"). Flagged parts go back to R-QA-3b.
- **R-QA-11 Learning from your corrections.** Every correction you make is saved to that subject's glossary as a known mishearing (e.g. *paanch* → "paths" in Programming for AI). It is used as context for future lectures, and the app suggests the same fix wherever the same mistake appears in other transcripts.

### 4.4 Notes
- **R-NOTE-1** Notes are Markdown files, editable on the phone and on the web with a preview.
- **R-NOTE-2** If you have edited a note, regenerating it asks before overwriting your edits.
- **R-NOTE-3** Transcript view: English by default, with the original one tap away. Tapping a line plays audio from that moment. Bookmarks and photos appear on the timeline.

### 4.5 Flashcards and practice
Based on the research summary in Section 9.
- **R-FC-1** About 8 cards per lecture, one fact per card. A mix of Q&A ("why/how" as well as "what") and fill-in-the-blank (cloze) for definitions and formulas. Bookmarked moments get priority.
- **R-FC-2** Every card links to its source lecture and timestamp.
- **R-FC-3** Scheduling uses the FSRS algorithm (`ts-fsrs`) with desired retention 0.90 and two buttons, **Forgot** and **Remembered**.
- **R-FC-4** At most 20 new cards per day across all subjects (adjustable). Reviews that are due are always shown.
- **R-FC-5** Cards can be edited or deleted in one tap, from the phone or the web.
- **R-FC-6** Practice questions per subject:
  - mixed across lectures
  - exam-style multiple choice and numerical questions
  - "explain in your own words" questions that the AI grades against the lecture content
- **R-FC-7** **Exam mode** per subject combines the weakest cards (lowest predicted recall) with mixed practice questions.
- **R-FC-8** **Revision sheet**: one Markdown page per subject summarising all lectures so far, regenerated on request.

### 4.6 Study chat
- **R-CHAT-1** One chat per subject.
- **R-CHAT-2** It answers from your lectures first, by searching that subject's English transcripts and notes, and cites lecture + timestamp (tap to play).
- **R-CHAT-3** It can search the web (Tavily) and Wikipedia to explain further, and cites the links.
- **R-CHAT-4** Every answer labels its sources as **From your lectures** or **From the web**.
- **R-CHAT-5** Chat history is saved and synced.

### 4.7 Sync, backup and web app
- **R-SYNC-1** Google Drive (the student's own account) is the shared copy of all data: metadata, notes, transcripts, flashcards, chat, audio, photos.
- **R-SYNC-2** The phone works fully offline and syncs on Wi-Fi: when the app is open, and every ~15 minutes in the background.
- **R-SYNC-3** Clashes are resolved per item: the latest edit wins. Deletes sync as markers ("tombstones").
- **R-WEB-1** The web app is hosted free on GitHub Pages, signs in with Google, and reads and writes the same Drive data.
- **R-WEB-2** The web app can do everything except record: browse, play, read, search, edit notes and the timetable, mark holidays and cancellations, study flashcards, practise, chat, upload audio.

### 4.8 Sharing with classmates
Classmates don't use the app. They get the study material, never the audio, through a Google Drive folder they open in a desktop browser.
- **R-SHARE-1** The app keeps a **Class share** folder in Drive, updated automatically when a lecture finishes processing and whenever notes are edited.
- **R-SHARE-2** Contents, per subject:
  - per lecture: **Notes** (Google Doc: summary, key concepts, notes, board/slide photos) and **Transcript** (Google Doc: English, with the original under each part)
  - per subject: **Revision sheet** and **Practice questions** (Google Docs), and **Flashcards.csv** (imports into Anki or Quizlet)
- **R-SHARE-3** Never shared: audio, chat history, bookmarks, flashcard progress, API keys.
- **R-SHARE-4** Sharing can be switched on or off per subject (for example if a lecturer does not allow it). Switching off stops updates and removes that subject from the folder.
- **R-SHARE-5** You share the folder yourself, once, with Drive's own **Share** button (by email or link). The app has an **Open Class share in Drive** button and never changes who has access.

### 4.9 Setup and settings
- **R-SET-1** First run, in order:
  1. Google sign-in (Drive)
  2. Enter the free API keys (Groq, Gemini, Tavily), with links showing how to get each
  3. Grant permissions (microphone, notifications, camera)
  4. Samsung battery steps
  5. Review the timetable
  6. Mark past holidays and cancellations
- **R-SET-2** Samsung steps: set the app's battery usage to **Unrestricted** and add it to **Never sleeping apps**. The app checks these where Android allows and reminds you if they are off.
- **R-SET-3** API keys are stored only on the device: Android Keystore via `expo-secure-store` on the phone, browser storage on the web. They are never written to Drive, and never to the repo, which is public.
- **R-SET-4** Bring your own keys: the app and repo ship with **no** API keys. Everyone who uses the code creates their own free keys (Groq, Gemini, Tavily) and adds them locally: in the app's Settings on each device, or in a git-ignored `.env` for development scripts (template: `.env.example`). Keys are only ever sent to their own provider. Settings has a **Test key** button and links to each provider's key page.

## 5. Non-functional requirements

- **Cost:** $0 a month.
- **Reliability:** at most 30 seconds of audio lost on a sudden power loss. Nothing lost on a UI crash, swipe-away or call.
- **Offline:** recording, browsing, notes and flashcards all work without internet. Only processing, chat and sync need it.
- **Privacy:** audio goes to Groq and text or photos go to Google Gemini for processing. Free-tier terms may let the provider use this content. Recording needs the lecturer's permission, and the university policy should be checked.
- **Storage:** about 6 GB of audio a semester. Drive's free 15 GB lasts about two semesters.
- **Battery:** recording with the screen off should use little battery. This is measured in Phase 1.

## 6. Architecture

```
                 Google Drive (student's account)  ← the shared copy
                 ├─ NotesApp/data/     one JSON file per item
                 ├─ NotesApp/notes/    Markdown notes
                 ├─ NotesApp/audio/    one audio file per recording
                 └─ NotesApp/photos/
                    ▲ sync (Wi-Fi)                      ▲ sync
                    │                                   │
 Android app (Expo dev build)                   Web app (same Expo code, built for web)
 ├─ Recorder service (Kotlin, own process)      ├─ Google sign-in
 ├─ Local store: SQLite                         ├─ Local cache: IndexedDB
 ├─ Processing queue ─┐                         ├─ Processing queue (uploads only)
 ├─ Sync engine       │                         └─ Sync engine
 └─ UI                │
                      ▼
                 AI router ──► Groq Whisper · Gemini · Tavily · Wikipedia
```

### 6.1 Components

| Unit | Responsibility | Platform |
| --- | --- | --- |
| **Recorder** | Foreground service, 30 s chunks, pause/resume on interruptions, bookmarks, crash recovery, joining chunks | Android only, custom Kotlin module |
| **Timetable** | Slots, holidays/cancellations, class detection, numbering, naming. Pure logic, no I/O | Shared |
| **Store** | Typed read/write of all entities. SQLite on Android, IndexedDB on web, same interface | Shared interface, two backends |
| **Sync engine** | Pushes local changes to Drive and pulls remote ones (Drive Changes API); per-item latest-edit-wins; tombstones | Shared |
| **Processing queue** | Persistent jobs through the stages in 6.3; retries; waits for limits | Shared |
| **AI router** | One interface per task; picks a provider, falls back when a limit is hit, tracks daily usage | Shared |
| **Search index** | Full-text search over English transcripts and notes (a JS library such as MiniSearch, so both platforms use the same code) | Shared |
| **Flashcards** | Card storage, FSRS scheduling (`ts-fsrs`), daily caps, exam mode | Shared |
| **UI** | Screens with Expo Router; responsive layout for desktop | Shared, with the record screen Android-only |

Notes on platform choices:
- `expo-sqlite` on the web needs special HTTP headers (COOP/COEP) that GitHub Pages cannot send, so the web app uses IndexedDB behind the same Store interface.
- Audio stays in Drive. The web app streams it when needed instead of caching it all.

### 6.2 AI router: task to provider

| Task | Primary | Fallback |
| --- | --- | --- |
| Transcription + English, listening to the audio | Gemini 3.5 Flash, whole lecture, with context | Same model on 30-minute pieces → Gemini 3.5 Flash-Lite → Groq `whisper-large-v3` (translate) |
| Second draft + re-listening to short doubtful clips | Gemini 3.5 Flash-Lite | Gemini 3.5 Flash for parts that still disagree |
| Targeted re-translation of one segment | Gemini Flash | Gemini Flash-Lite |
| Summary + notes (reads photos) | Gemini Flash | Gemini Flash-Lite |
| Flashcards + practice questions | Gemini Flash | Gemini Flash-Lite |
| Grading "explain it" answers | Gemini Flash-Lite | Groq free text model |
| Study chat | Gemini Flash-Lite | Groq free text model |
| Web search | Tavily | Wikipedia API |

Chosen from the Phase 0 test ([findings](../phase0-findings.md)). Model names are configuration, not code.

**Free-tier budget.** These figures come from third-party reports in September 2026 and are verified in Phase 0:

| Service | Reported free limit | Expected use |
| --- | --- | --- |
| Groq Whisper | 8 h audio/day, 2 h/hour, 25 MB/file, 2,000 requests/day | Last-resort fallback only |
| Gemini Flash | ~20 requests/day per model version (reported) | About 3–4 per lecture (draft, notes, cards, escalated re-listens): ~50–64 a week, at most 16 on Thursday |
| Gemini Flash-Lite | ~500 requests/day | Second drafts, re-listening to short clips (roughly 10–30 per lecture), chat, grading |
| Tavily | 1,000 searches/month | ~33/day |
| Wikipedia | No key, fair use | Fallback |
| Google Drive | 15 GB | ~6 GB/semester |

**Overload matters more than the daily limit.** Whole-lecture requests keep Flash use inside the free limit (16 a day at most). But during testing Gemini 3.6, 3.7 and 3.8 Flash were all overloaded (HTTP 503), and 3.5 Flash was for a while too. The queue retries with growing pauses, so a lecture may finish hours later on a busy day. Real limits: https://ai.dev/rate-limit.

- **R-PROC-9 Running short.** Google resets Gemini's daily limits at midnight Pacific time, which is noon in Pakistan. When a limit is close, work runs in this order: (1) drafting new lectures, (2) re-listening to doubtful parts, (3) notes, (4) flashcards and practice questions, (5) study chat. Nothing is dropped: lower-priority work waits for the next reset.
- **R-PROC-10 Usage screen.** Settings shows each service's use today against its limit, and when it resets.

The router records usage per provider per day. When a limit is hit, it moves to the fallback. When the fallbacks are also used up, the job waits until the next day's reset.

### 6.3 Processing stages

`recorded → joined → drafting → second draft → comparing → re-listening (n/m doubtful parts) → sense check → notes → flashcards → checking content → done`, with anything left over listed under **needs your check**

Any stage can go to `waiting (reason, retry at)` or `failed (reason)`. A job's state is stored with the recording and syncs, so both devices show progress. A failed job can be retried by hand.

### 6.4 Drive layout

```
NotesApp/
├─ data/
│  ├─ subjects/<id>.json         name, streams (lecture/lab), teachers
│  ├─ slots/<id>.json            day, start, end, subject, stream, room, teacher
│  ├─ exceptions/<id>.json       holiday (date) or cancelled (slot + date)
│  ├─ recordings/<id>.json       subject, stream, start, duration, processing state
│  ├─ bookmarks/<id>.json        recording, time, label
│  ├─ photos/<id>.json           recording, time, file
│  ├─ transcripts/<recId>.json   segments: start, end, original, english
│  ├─ flashcards/<id>.json       content, source, FSRS state
│  ├─ practice/<id>.json         questions per recording/subject
│  └─ chats/<subjectId>/<id>.json  messages with sources
├─ notes/<Subject>/<date title>.md    notes and revision sheets
├─ audio/<recId>.m4a
├─ photos/<recId>/<photoId>.jpg
└─ Class share/<Subject>/          shared with classmates: Google Docs + Flashcards.csv, no audio
```

Every JSON item has `id`, `updatedAt`, `updatedBy` (device) and `deleted`. Using the ISO date in file names keeps Drive browsable by hand.

Both apps sign in to one Google Cloud project using the `drive.file` scope, so they can only see files this app created. Access for the web app and the phone app must be shared within that project. This is checked in Phase 0.

## 7. Error handling

| Failure | Behaviour |
| --- | --- |
| Microphone permission revoked | Record button explains and links to settings |
| Recorder killed by the system | Chunks recovered on next launch (R-REC-6). Setup and reminders keep battery settings correct |
| Storage full while recording | Stop cleanly, keep what was recorded, notify |
| No internet | Queue and sync wait. Everything local keeps working |
| Free limit reached (HTTP 429) | Respect the retry-after time, then fall back, then wait for the daily reset. Status shown on the recording |
| Model overloaded (HTTP 503, seen in Phase 0) | Retry with back-off, then use the fallback model |
| Checker's correction fails the checks | Correction rejected, original kept, counted in the badge |
| Bad AI output (invalid JSON) | Retry once with the same input, then mark failed with a Retry button |
| Invalid API key | Processing pauses and settings shows which key is wrong |
| Google sign-in expired | Sync pauses and a banner asks you to sign in again. Local work continues |
| Sync clash | Latest edit wins, per item |
| Transcription gibberish (e.g. only noise) | Notes step says "transcript unclear", and the audio is still kept |

## 8. Testing

- **Unit tests (pure logic):** caution-loop checks (repetition, Roman Urdu, coverage, gaps), using the kinds of faults seen in Phase 0 as fixtures, class detection, numbering with holidays, cancellations and make-ups, naming, overlap stitching of transcripts, sync merge rules, AI router fallback and usage counting, FSRS scheduling wrapper.
- **Integration tests:** processing queue with fake providers (success, 429, bad JSON, timeout); sync engine against a fake Drive.
- **On-device checklist (S23 Ultra):**
  - record 10 minutes with the screen off
  - swipe the app away
  - force-stop the UI process
  - take a phone call mid-recording
  - reboot mid-recording and check recovery
  - measure battery used per hour
- **Phase 0 measurements:** transcription quality on real lectures, and real free-tier limits.

## 9. Flashcard research summary

- Practice testing (retrieval) and distributed practice (spacing) are the most effective study techniques in large reviews of the evidence. Flashcards used for self-testing beat re-reading on delayed tests.
- FSRS, Anki's modern scheduler, predicts recall more accurately than SM-2 for about 99.5% of users in the open benchmark (about 350 million reviews). It needs about 20–30% fewer reviews for the same retention.
- Card design: one fact per card, "why/how" questions for understanding, cloze for definitions and formulas, a link back to the source.
- Mixing topics during practice (interleaving) helps with telling problem types apart.

Sources: [SRS benchmark](https://expertium.github.io/Benchmark.html), [ts-fsrs](https://github.com/open-spaced-repetition/ts-fsrs), [Evidence Based Education: retrieval and spaced practice](https://evidencebased.education/resource/retrieval-and-spaced-practice-study-strategies-that-must-be-combined/), [Retrieval practice in health professions (review)](https://pmc.ncbi.nlm.nih.gov/articles/PMC12292765/).

## 10. Build phases

Each phase ends with something usable.

0. **Test the free services.** ✅ Done 2026-09-18 ([findings](../phase0-findings.md)). Gemini listening directly beats Whisper by a wide margin. Gemini 3.5 Flash drafts whole lectures with context. Flash-Lite makes an independent second draft to find doubtful parts and re-listens to them as short clips. Whisper is a last resort only. Still to confirm before Phase 2: the real free limits (AI Studio), 30-minute pieces, and Drive access being shared between the web and Android clients.
1. **Recorder, timetable and naming.** Android app that records reliably and files every class correctly. Usable from day one, before any AI.
2. **Processing.** Transcripts (original + English), summaries and Markdown notes, with the queue and the AI router.
3. **Drive sync and web app.** Everything on the desktop, editable both ways.
4. **Flashcards and practice.** FSRS reviews, practice questions, exam mode, revision sheets.
5. **Study chat.** Per-subject chat over lectures, with web search and Wikipedia.

## 11. Risks and open questions

- **Transcription quality.** Tested on three real clips: after the caution loop, the English is good enough to study from. There was little Pashto in them, so Pashto-heavy lectures are still untested.
- **Gemini Flash free limit.** The caution loop depends on it. See the mitigations in 6.2.
- **The checker keeps finding small things.** Round 2 found 44 more corrections on a clip that already passed, so the loop is capped at 2 rounds.
- **Free tiers change without notice.** This is why the AI router and its fallbacks exist. The limits in 6.2 are reported, not guaranteed.
- **Content privacy on free tiers.** Lecture content may be used by providers to improve their products.
- **Google OAuth in "testing" mode** can expire sign-ins every 7 days. The OAuth app may need to be published (the `drive.file` scope does not need Google's review) to avoid weekly sign-ins. This is checked in Phase 0 or 3.
- **Recording consent.** Ask lecturers and check university policy.

## Appendix A: Timetable, Semester V, Group B (from 2026-09-07)

| Day | Time | Subject | Stream |
| --- | --- | --- | --- |
| Mon | 08:30–10:00 | Computer Networks | Lab |
| Mon | 10:15–11:45 | Fundamentals of Accounting | Lecture |
| Mon | 12:00–13:30 | Technical & Business Writing | Lecture |
| Mon | 14:00–16:00 | Parallel and Distributed Computing | Lecture |
| Tue | 08:30–10:00 | Computer Networks | Lab |
| Tue | 10:15–11:45 | Fundamentals of Accounting | Lecture |
| Tue | 12:00–13:30 | Machine Learning | Lab |
| Tue | 14:00–16:00 | Computer Networks | Lecture |
| Wed | 08:30–10:00 | Programming for AI | Lab |
| Wed | 10:15–11:45 | Parallel and Distributed Computing | Lab |
| Wed | 12:00–13:30 | Machine Learning | Lab |
| Wed | 14:00–15:30 | Technical & Business Writing | Lecture |
| Thu | 08:30–10:00 | Parallel and Distributed Computing | Lab |
| Thu | 10:01–11:59 | Programming for AI | Lecture |
| Thu | 12:00–13:30 | Programming for AI | Lab |
| Thu | 14:00–16:00 | Machine Learning | Lecture |

Teacher names and rooms are kept out of this public repo. They live in `private/timetable.md` (git-ignored) and are entered into the app during setup.

No classes Friday to Sunday. Worked example: Fundamentals of Accounting meets Mon and Tue, so with no holidays, Mon 21 Sep 2026 is Lecture 5 (after 7, 8, 14 and 15 Sep).

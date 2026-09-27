# Delivery status — September 27, 2026

The app is in active development. Do not describe it as completely final or tag a release yet.
The owner authorized committing and pushing incremental work to `codex/m1-foundation`.

## Implemented

- Tested timetable detection, numbering, names, teacher history and Markdown import.
- Separate-process Android recorder with durable chunk journals, recovery, notification
  controls, pause/resume, levels, bookmarks and storage/battery safeguards.
- SQLite on Android and IndexedDB on web; private permanent media imports; local secrets.
- Timetable review/editing, holidays and cancellations, class recording labels and photos.
- Lecture library, audio playback and timestamp links, editable notes and simple safe previews.
- Opt-in persistent Gemini whole-audio draft/independent draft/notes/check-notes queue,
  model pacing, daily counters, backoff, visible unresolved checks and correction glossary.
- FSRS reviews with 90% retention, 20-new-card cap, source links and card editing/removal.
- Subject chat with retrieved lecture excerpts and optional Tavily/Wikipedia sources;
  returned citations are checked against supplied evidence before answers are saved.
- Configurable Google IDs, native Google sign-in and web Google Identity Services.
- Manual personal Drive sync, media upload and LWW item revisions including tombstones.
- Manual Class share publishing of study documents and CSV; no audio, chat, keys,
  bookmarks or review progress. Access permissions are never changed by the app.

## Verification

- Native module compiles; 33 Kotlin/JVM tests pass.
- Timetable/recorder/study unit suites passed; new queue and FSRS tests also pass.
- Strict TypeScript checks pass. Lint and final build checks are rerun after changes.
- Static web export produces 11 routes.
- Headless Chrome smoke passed on a 390px viewport: real IndexedDB persistence,
  synthetic audio playback, notes navigation/persistence, flashcard creation and review,
  settings save, no page errors or horizontal overflow.
- Public-file privacy scan passed. Private timetable, lecture files, keys, build logs,
  generated Android project and local conversation notes remain ignored.

## Remaining implementation and release gates

- Targeted short-clip re-listening, full semantic caution loop, long-audio split/stitch
  fallback and Groq fallback are unfinished. Jobs intentionally finish at **Needs your
  check**, never claim a fully checked transcript. Notes are not certified factual.
- Automatic generated cards/practice, numerical/MCQ practice, grading, complete exam
  mode and checked revision sheets remain unfinished. Existing cards are created manually.
- Background Wi-Fi sync, Drive Changes API incremental pulls, automatic Class share
  updates and shared photos remain unfinished. Sync/publish currently run explicitly.
- Missed/cancelled notifications, complete first-run walkthrough and in-recording class
  reassignment still need implementation.
- Google OAuth IDs will be supplied later by the owner. Live Drive interop, Google Docs
  conversion and provider calls have not been verified with the owner's accounts.
- The Android APK build encountered Windows path limits, then exhausted C: space.
  Native staging and generated output are being relocated to F: before retrying.
- S23 Ultra screen-off/call/swipe-away/process-death/reboot/battery tests, real-lecture
  audio-quality comparison, week-long daily use and deployment remain pending.

## Sync implementation decision

Drive stores immutable per-item revisions under `NotesApp/data`, rather than overwriting
one mutable file per item. This prevents a concurrent phone/browser write from silently
losing the other device's edit without a server-side transaction. LWW ordering merges
revisions deterministically and retains tombstones. Revision compaction and Changes API
pagination remain future work; current sync scans all app data revisions.

API documentation consulted: [Gemini Files](https://ai.google.dev/api/files),
[Drive uploads](https://developers.google.com/workspace/drive/api/guides/manage-uploads),
[Google sign-in setup](https://react-native-google-signin.github.io/docs/original).

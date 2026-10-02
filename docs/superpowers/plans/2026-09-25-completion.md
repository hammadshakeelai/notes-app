# Completion implementation ledger

Authority: the approved September 18 design. The September 25 request authorizes
implementation of all remaining milestones without pausing at milestone tags.
Existing branch and working tree are retained to preserve the ongoing app.

## Work in order

1. Finish native recorder compilation, durability tests and Android packaging.
2. Add SQLite / IndexedDB persistence, durable assets and local secret storage.
3. Integrate the library, playback, notes, timetable editing and setup.
4. Implement checked processing, provider settings and a persistent retry queue.
5. Add study reviews, practice and grounded chat.
6. Add Drive authorization/sync and study-only sharing.
7. Run type/lint/unit/build/browser checks, audit privacy and document release gates.

## Interface review

| Producers / consumers | Contract / ruling |
| --- | --- |
| Storage / every feature | Generic versioned item repository; writes complete before UI acknowledgement |
| Native recorder / library | Native journal remains audio authority; library imports ready sessions by UUID |
| Processing / study | Checked transcript segments with timestamps in seconds; unresolved findings stay visible |
| Sync / local files | Local file paths and secrets never exported; media uses separate Drive identities |
| Study / sharing | Explicit allowlist excludes audio, chat, bookmarks, keys and review history |
| Packaging / new dependencies | No concurrent Gradle runs; final prebuild after dependencies settle |

## Release gates

Hardware reliability, real lecture accuracy and week-long usage cannot be certified by
unit tests. Google OAuth needs the owner's client configuration. These remain visible
gates; no fake completion badges or fabricated remote verification.

## Progress

- Recorder journal now verifies persisted bytes before deleting source chunks.
- Android compile found an unavailable O_DIRECTORY SDK symbol; corrected to O_RDONLY.
- Native compilation and 33 JVM tests pass; x86_64 APK assembly and emulator installation pass.
- Storage, library, playback, timetable editing, processing queue, manual FSRS cards,
  cited chat and manual Drive sync/sharing are implemented to the extent recorded in
  [delivery status](../../delivery-status.md).
- Client validation passes 119 tests, type checking and lint; web export and mobile
  browser smoke pass. Emulator navigation/library/recorder-readiness smoke passes.
- Full processing caution/fallbacks, generated practice/revision, background sync,
  setup/notifications, live-provider checks and physical recording gates remain open.

# Foundation status — 2026-09-20

M1 code is implemented on `codex/m1-foundation`. The repository has not been pushed, merged, or tagged as part of this work. The roadmap's release exit criteria still require hosted CI on `main` and `v0.1.0`.

## Implemented

- Expo SDK 57 client using the current default template's dependency versions, stripped of tutorial screens and unused direct dependencies. Native animation peer dependencies are explicitly pinned to Expo's compatible versions.
- Strict TypeScript, ESLint domain boundaries, Jest/Expo, npm lockfile, Node version declaration, and GitHub Actions checks.
- Timetable domain: calendar validation, dated occurrences, class detection, separate lecture/lab numbers, holidays, cancellations, explicit make-up sessions, names, dated teachers, missed-class prompts and Markdown import.
- A responsive, read-only timetable preview that uses the real domain functions. It supports date/week navigation, Today and expanding a class to inspect its display name and file name. Device date and responsive content are hydrated without disagreeing with static HTML.

## Verification

- 82 tests in eight suites pass in real Jest (the original plan contained 45).
- Domain coverage: 98.24% lines, 98.10% statements, 97.72% branches, 95.65% functions. CI enforces a 90% floor in each category.
- Type checking, lint, dependency compatibility check, static web export and Android JavaScript/Hermes export pass. No APK or physical-device run has been performed yet.
- Browser smoke checks pass in Chrome at desktop and 390-pixel mobile widths: week/day navigation, Accounting Lecture 5 on 21 September, Lecture 6 on 22 September, Today, recording-name expansion, no horizontal overflow or runtime errors.
- The real private timetable imports to six subjects and 16 slots matching the public seed. Teacher/room details and local verification scripts remain ignored.
- Public-file privacy and Git-history key-pattern scans pass.

## Decisions made while implementing

- Kept the approved pure-domain interfaces and used Expo's current `src/app/` layout.
- Added regression tests for malformed imports, overlapping slots, slug collisions, duplicated make-up sessions, seed object isolation, invalid dates/times, and exact detection/prompt boundaries.
- Replaced the sample date loop with a `while` loop after the Expo/Jest Babel transform failed on its mutable `for` loop. Behavior and boundary tests are unchanged.
- The importer is an initial snapshot, not a parser of informal teacher-history notes. Historical assignments must have explicit effective dates.
- Added a small preview to make the foundation inspectable; storage, editing, recording, AI, sign-in and sync remain in their planned milestones.

## Dependency follow-up

The installed compatible Expo dependency tree reports 13 moderate npm audit entries, rooted in two upstream dependencies: `decode-uri-component` through Expo Router's `query-string`, and `uuid` through Expo's `xcode` tooling. No high or critical entries were reported. npm proposes incompatible Expo/Router downgrades; the newer decoder also changes to ESM. No forced downgrade or unverified override was applied. Recheck these advisories when upgrading Expo and before public release.

## Next: M2 recorder

**2026-09-22 update:** M2 implementation is underway in [the recorder plan](superpowers/plans/2026-09-20-m2-recorder.md). Native sources and recording controls are implemented; Kotlin/APK and physical-device verification are tracked in [Android development](android-development.md). The TypeScript suite now has 95 passing tests, including 13 native-status contract tests. The historical M1 results above remain specific to that milestone.

1. Verify JDK 17, Android SDK/ADB and an Expo development build on the S23 Ultra.
2. Implement the Kotlin microphone foreground service and 30-second durable audio chunks, independently of the UI process.
3. Add stop/join, interruption handling and chunk recovery before connecting recording to the timetable.
4. Run the roadmap's real-device checklist: screen off, swipe-away, UI termination, call, reboot, storage pressure and measured battery use.

The current browser preview cannot demonstrate or validate background recording. SQLite persistence and the everyday in-class screens remain M3.

# Notes app client

Expo SDK 57, React Native 0.86, React 19, and strict TypeScript. Android and web share the timetable, lecture library, notes and study screens. See the [delivery report](../docs/delivery-status.md) for tested behavior and remaining implementation/release gates.

## Local development

Use Node 24 and npm 11 (the root `.nvmrc` records the Node version):

```sh
npm ci
npm run web
```

`npm run android` builds and installs a native Android development build. The recorder requires this build; Expo Go does not include the local Kotlin module. See [Android setup and verification](../docs/android-development.md) for the SDK/JDK requirements and Windows wrapper. No provider keys or account are needed. Do not add keys to Expo public environment variables.

## Checks

```sh
npm run check
npm run export:web
npx expo export --platform android --output-dir .expo/android-export
npx expo install --check
```

`npm test -- --watch` is useful during domain development. CI repeats installation, type checking, lint, coverage and both exports. A separate Android job prebuilds the app, compiles the recorder and runs its native unit tests. Exporting Android JavaScript checks bundling; it does not build or install an APK. Real-device recorder reliability is tracked separately in the Android checklist.

## Boundaries

- `src/app/`: routes only.
- `src/features/timetable/`: responsive preview, navigation and the device-local date. The static browser render waits for the client date before showing the schedule.
- `src/features/recorder/`: recording controls, permission/preflight feedback and validation of native status messages.
- `modules/recorder/`: Android-only Expo bridge, separate-process foreground service, atomic recording journals and durable AAC chunks. This is the source of truth for native code; `android/` is generated and ignored.
- `src/domain/calendar.ts`: validated local date/time operations, independent of device timezone.
- `src/domain/timetable/`: types, seed data, occurrences, detection, numbering, names, teacher history, prompts and Markdown import. Public exports are in `index.ts`.
- `src/data/`: SQLite/IndexedDB repositories, permanent media and device-only secrets.
- `src/features/processing/`: opt-in persisted jobs, provider transport, quotas and visible quality findings.
- `src/features/study/`: transcript/citation boundaries, FSRS and lecture-grounded chat.
- `src/features/sync/`: Google authorization, personal item/media sync and study-only publishing.
- The domain has no React, storage, network or implicit clock dependencies.

Timetable dates are `YYYY-MM-DD`, times are `HH:MM`, weekdays are Monday = 1 through Sunday = 7. Pass the university-local date/time at the boundary; do not derive a local date by slicing a UTC timestamp.

`detectClass` detects against the weekly slots supplied to it. Callers must exclude holiday/cancelled occurrences and dates before the semester before using it to start a recording. `sessionNumber` includes missed classes, excludes cancelled scheduled classes and holidays, and counts explicit make-up sessions. Duplicate sessions at the same subject/stream/date/start count once.

The Markdown importer accepts `Day | Time | Subject | Stream | Teacher | Room`. Invalid schedule rows throw line-specific errors. It imports an initial snapshot: parenthetical teacher notes are removed, and assignments begin at semester start. Add explicit dated assignments to preserve historical teacher changes; the importer does not infer dates from free text.

The built-in schedule has no teacher names or rooms. Local scripts under `scripts/local/`, private imports and verification output are git-ignored. See [foundation status](../docs/foundation-status.md) for limitations and the next milestone.

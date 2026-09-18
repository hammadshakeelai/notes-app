# Architecture decision records

Each record captures one significant decision: the context, what was decided, its consequences, and what was rejected. A record is never edited to change its decision. A new record supersedes it, and the old record's status becomes "Superseded by ADR-NNNN".

| ADR | Decision | Status |
| --- | --- | --- |
| [0001](0001-personal-android-app.md) | Personal Android app: one user, no iOS, no accounts | Accepted |
| [0002](0002-expo-single-codebase.md) | Expo + TypeScript for Android and web, with a custom Kotlin recorder | Accepted |
| [0003](0003-drive-as-shared-copy.md) | No backend: Google Drive is the shared copy | Accepted |
| [0004](0004-zero-budget-byok.md) | $0 budget: free tiers only, bring your own keys | Accepted |
| [0005](0005-gemini-listens-directly.md) | Transcribe with Gemini listening to the audio, not Whisper | Accepted |
| [0006](0006-website-style-transcripts.md) | Website-style transcripts: Roman Urdu original, English, speaker turns, context | Accepted |
| [0007](0007-whole-lecture-and-fallbacks.md) | Whole-lecture drafts on Gemini 3.5 Flash, with a model fallback chain | Accepted; chain superseded by 0015 |
| [0008](0008-caution-loop.md) | Caution loop: find doubtful parts, re-listen to short clips, learn from corrections | Accepted |
| [0009](0009-numbering-follows-timetable.md) | Lecture numbers follow the timetable | Accepted |
| [0010](0010-manual-recording-start.md) | Recording starts manually; everything after that is automatic | Accepted |
| [0011](0011-fsrs-flashcards.md) | Flashcards scheduled with FSRS | Accepted |
| [0012](0012-study-chat.md) | One study chat per subject: lectures first, then the web | Accepted |
| [0013](0013-class-share-folder.md) | Classmates get study material through a shared Drive folder | Accepted |
| [0014](0014-private-data-out-of-repo.md) | Personal data stays out of the public repo | Accepted |
| [0015](0015-model-roles-after-api-tests.md) | Model roles after the API tests | Accepted |

## Template

```markdown
# ADR-NNNN: Title

- **Status:** Proposed | Accepted | Superseded by ADR-NNNN
- **Date:** YYYY-MM-DD

## Context
## Decision
## Consequences
## Alternatives considered
```

# ADR-0013: Classmates get study material through a shared Drive folder

- **Status:** Accepted
- **Date:** 2026-09-18

## Context

Classmates need the notes and study material but not the audio, and only on a computer.

## Decision

The app keeps a Class share folder in Drive: per lecture, Notes and Transcript as Google Docs; per subject, Revision sheet and Practice questions (Docs) and Flashcards.csv (Anki/Quizlet). Never audio, chat, bookmarks, progress or keys. Sharing is switched on or off per subject. The student shares the folder once with Drive's Share button.

## Consequences

Classmates need no account or setup. The student must check that lecturers are fine with sharing.

## Alternatives considered

An offline HTML study page per subject, or guest mode in the web app: rejected (guest mode needs broader Google permissions and shows "unverified app" warnings).

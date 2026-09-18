# ADR-0003: No backend: Google Drive is the shared copy

- **Status:** Accepted
- **Date:** 2026-09-18

## Context

The budget is $0 and there is one user. The desktop must reach everything from anywhere. Audio is about 6 GB a semester.

## Decision

No server. The phone works offline first (SQLite) and the web app uses IndexedDB. Both sync with the user's own Google Drive using the `drive.file` scope: one small JSON file per item, the latest edit wins, and deletes are kept as markers. Audio and photos are ordinary Drive files. The web app is hosted on GitHub Pages; since Pages cannot send COOP/COEP headers, the web app uses IndexedDB rather than expo-sqlite.

## Consequences

No hosting costs. The Google OAuth app must be published to avoid sign-ins expiring every 7 days. Whether the Android and web clients share `drive.file` access must be tested (spike S4).

## Alternatives considered

The phone serving its own web page: rejected (same Wi-Fi only, and university Wi-Fi usually blocks it). Supabase or Firebase: rejected (1 GB free storage is too small for the audio).

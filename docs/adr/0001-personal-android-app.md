# ADR-0001: Personal Android app: one user, no iOS, no accounts

- **Status:** Accepted
- **Date:** 2026-09-18

## Context

One student needs to record about 16 classes a week on a Samsung Galaxy S23 Ultra. Classmates only need the study material, not the app. iOS stops recording when an app is swiped away, and building for iOS from Windows needs a Mac or a paid Apple account.

## Decision

Build a single-user Android app (Samsung S23 Ultra), installed directly as an APK. No accounts, no app store, no iOS. Desktop access is through a web app (ADR-0003).

## Consequences

No sign-in or multi-user logic. Samsung's battery optimisation must be handled (R-SET-2). iOS is out of scope.

## Alternatives considered

iPhone or both platforms: rejected (swipe-away limit, cost). A public app for classmates: rejected (accounts, support, AI costs).

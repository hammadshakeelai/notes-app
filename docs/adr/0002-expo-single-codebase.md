# ADR-0002: Expo + TypeScript for Android and web, with a custom Kotlin recorder

- **Status:** Accepted
- **Date:** 2026-09-18

## Context

Development is on Windows. The app must run on Android and in a desktop browser. Recording must keep going after the app is swiped away, save 30-second chunks and run in its own process, which standard Expo audio in Expo Go cannot do.

## Decision

Use Expo (React Native + TypeScript) with Expo Router as one codebase for Android and web. The Android app is an Expo development build, and recording is a custom Kotlin module: a foreground service of type `microphone`, in a separate process, writing chunks.

## Consequences

Development needs the Android SDK and JDK 17 for native builds. The web build has no recorder. Domain logic (timetable, numbering, checks) is shared, pure TypeScript.

## Alternatives considered

Flutter: rejected (a second language for the web app). Native Kotlin plus a separate web app: rejected (double the work).

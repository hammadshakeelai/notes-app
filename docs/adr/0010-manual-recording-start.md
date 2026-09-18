# ADR-0010: Recording starts manually; everything after that is automatic

- **Status:** Accepted
- **Date:** 2026-09-18

## Context

Android does not let an app start the microphone from the background. The student chose fully manual start and stop over a notification tap per class or one tap per day.

## Decision

The student taps Record and Stop. The app detects the class, names and files the recording, keeps recording through screen-off, pocket, swipe-away and calls (foreground service in its own process), saves audio in 30-second chunks, recovers after a crash or dead battery, and shows a sound-level meter.

## Consequences

A forgotten tap means no recording. A switched-off phone cannot record; audio from another recorder can be imported instead.

## Alternatives considered

Auto-start at class time: impossible on Android. A notification tap per class, or one tap per day: offered, not chosen.

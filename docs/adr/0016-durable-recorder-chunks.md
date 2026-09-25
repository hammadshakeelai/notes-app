# ADR-0016: Continuous AAC capture with recoverable chunks

- **Status:** Accepted for M2 implementation; real-device validation pending
- **Date:** 2026-09-23

## Context

The recorder must survive loss of the UI process, keep already captured audio after a crash or reboot, and produce one playable file after Stop. Restarting the microphone every 30 seconds risks gaps. An unfinished MP4 container can require metadata that was never written before a crash.

## Decision

A microphone foreground service in a separate Android process owns recording. The Expo UI uses Messenger requests rather than sharing recorder objects. A visible user action is required to start microphone access; reconnecting or recovering files does not start it.

One AudioRecord session feeds a continuous AAC encoder. Complete ADTS frames rotate into roughly 30-second files, with a file sync about once per second of audio. Manual pause drains the encoder before resuming in a fresh chunk. Microphone silencing records an interruption gap and excludes silenced samples from the audio timeline.

An atomic JSON journal records identity, state, bookmarks and gaps. On Stop, the service waits for capture to terminate, validates the source frames, remuxes them into M4A and verifies the resulting payloads, timestamps and duration. It publishes the file with a same-directory atomic rename, saves ready metadata, then removes chunks. Failed validation or writes retain the source audio. A timed-out worker retains exclusive file ownership until actual termination.

Initial audio settings are AAC-LC mono at 32 kHz and 32 kbit/s, using VOICE_RECOGNITION. The S5 lecture-quality comparison may change them.

## Consequences

Capture and file rotation are independent of JavaScript and UI lifetime. Recovery can recognize an incomplete final frame without silently skipping corrupt data inside a chunk. Finalizing requires enough free space for both source chunks and output, so storage estimates and automatic stopping reserve space for a second copy.

Unit tests cover frame parsing, rotation, shutdown ownership and journal failure handling. MediaCodec/MediaMuxer behavior, audio continuity, battery use and Android/Samsung lifecycle behavior still require the physical-device checklist. A successful build cannot establish these properties.

## Alternatives considered

- Restarting a recorder into independent MP4 chunks: easier initial code, but introduces recording boundaries and container-finalization risk.
- A single growing MP4: convenient playback after a clean stop, with weaker recovery after an interrupted finalization.
- Recording in JavaScript or the UI process: does not provide the required isolation from UI termination.

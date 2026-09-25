# Android recorder module

The UI calls `commandAsync(command, argsJson)` through the Expo module named `NotesRecorder`. Messenger IPC sends correlated requests to a non-exported microphone foreground service in the `:recorder` process. Binding, reading status and recovering files never open the microphone. Start requires a resumed activity and microphone permission; the UI requests microphone and notification access only after a deliberate tap.

## Storage and capture

The service is the only owner of `filesDir/recordings/<UUID>/`. A serial command executor owns journals, bookmarks, gap metadata and state transitions. The capture worker owns the microphone, AAC encoder and the current chunk. It captures mono PCM at 32 kHz and encodes AAC-LC at 32 kbit/s. These settings are provisional until the real-lecture quality spike.

Complete ADTS frames rotate about every 30 seconds without restarting capture. The writer syncs every second of audio and at stop/rotation. A manual pause drains the current encoder; resume creates another chunk without overwriting existing audio. On supported Android versions, microphone silencing marks a gap and discards silenced samples until access returns.

Stopping waits for the capture worker to release its files. A timed-out worker retains exclusive ownership, blocks a new capture and stays excluded from recovery until it terminates. Epoch checks discard callbacks queued by an earlier capture.

Joining validates all chunks and repairs only an incomplete final frame. It remuxes into a pending M4A, re-reads it with MediaExtractor, and verifies frame payloads, timestamps, format and duration. Atomic rename publishes the result. Only after the ready journal is durable may source chunks be removed. Failures retain source audio for another recovery attempt. There is no boot receiver or automatic microphone restart.

## Verification

JVM unit tests exercise ADTS parsing, torn tails, chunk rotation, capture shutdown ownership and journal/recovery failures. They do not prove device codecs, notification actions or background reliability. See [Android build commands and the physical-device checklist](../../../docs/android-development.md). The native Gradle project is `:notes-recorder`; Expo generates `client/android/` from configuration.

The TypeScript boundary validates every snapshot before rendering it. The recorder screen polls only while focused and the app is active. Web and Expo Go display an unavailable state.

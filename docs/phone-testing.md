# Phone test build and existing class recordings

[Download the October 2 phone-test APK](https://github.com/hammadshakeelai/notes-app/releases/download/phone-test-2026-10-02/notes-phone-test.apk)
or open its [GitHub release page](https://github.com/hammadshakeelai/notes-app/releases/tag/phone-test-2026-10-02)
for the checksum and installation guide. This is an
early test build, signed with the development certificate. It includes JavaScript and
works without Expo Go, Metro or a computer. It is not a Play Store release. Android 7
or later is required; the APK includes ARM64 for the S23 Ultra and x86_64 for emulators.

## Install

1. Open the APK in My Files or your browser's Downloads.
2. If Android asks, allow that app to install unknown apps, then install Notes.
3. Open Notes and review the timetable and past holidays. The bundled schedule is a
   public example; use the timetable editor for your actual classes.
4. Google IDs can be added later. Local import, playback, notes and manual flashcards
   work without Google or API keys.

Keep the existing Voice Recorder recordings. Import copies the chosen file into Notes;
it does not move or delete the original. Android uninstalling Notes removes its local
app data. Keep originals until personal Drive sync has been configured and verified.

## Import recordings already on your phone

1. Find a class file in Samsung Voice Recorder or My Files. If it is only visible in
   Voice Recorder, use its Share/save-file action to make a copy in a folder accessible
   to My Files. Menu names can vary with the installed recorder version.
2. In Notes, open **Library → Import audio**.
3. Enter the original recording date and class start time; select the subject and
   Lecture/Lab, or choose Other. Add an optional title.
4. Tap **Choose audio file** and select the recording. Import one file at a time.
5. Open **Listen & study**. Confirm audio plays and the displayed duration is sensible.
   You can write notes immediately. Search accepts the title, subject or date.

Typical M4A, MP3 and WAV files can be chosen through the audio file picker. Actual
decoding depends on Android and the file's codec; if playback fails, retain the
original and record the file format and error for investigation.

## Optional processing

Add your Gemini key in Settings, test it, then save. Review the configured model IDs
for your account and enable processing explicitly. This sends lecture audio to the
provider while Notes is open. Open imported audio first so Notes can read its duration.
Keep drafts marked for review: targeted clip checks, long-audio fallback and the full
semantic checking loop are still unfinished. Google sign-in and live provider calls
have not been verified with the owner's accounts.

## Phone checks before using Notes as the only recorder

Start with an existing recording import and a short synthetic recording. Check playback,
notes after reopening, pause/resume, bookmarks and Stop/save. Then follow the physical
device checklist in [Android development](android-development.md), including screen-off,
calls, swipe-away, process interruption and recovery. Continue keeping a backup recorder
until those checks pass. The complete remaining work is in [delivery status](delivery-status.md).

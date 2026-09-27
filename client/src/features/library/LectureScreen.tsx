import { Link, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Image, Text, View } from 'react-native';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { Workspace, Button, Field, Message, ui } from '@/components/Workspace';
import { Markdown } from '@/components/Markdown';
import { assetUri } from '@/data/assets';
import { saveItem, useItems } from '@/data/store';
import type { Lecture, Note, Photo } from '@/data/types';
import { useTimetable } from '@/features/timetable/useTimetable';
import { TranscriptReview } from '@/features/processing/TranscriptReview';
import { retryJob } from '@/features/processing/engine';
import type { Transcript, ProcessingJob } from '@/features/processing/engine';
import { lectureTitle, durationLabel } from './labels';

function SavedPhoto({ photo }: { photo: Photo }) {
  const [uri, setUri] = useState<string>();
  useEffect(() => { let active = true; void assetUri(photo.uri).then(value => { if (active) setUri(value); }).catch(() => {}); return () => { active = false; }; }, [photo.uri]);
  return <View>{uri && <Image accessibilityLabel={`Class photo at ${durationLabel(photo.offsetMs)}`} source={{ uri }} style={{ height: 240, width: '100%', borderRadius: 10 }} resizeMode="contain" />}<Text style={ui.body}>{durationLabel(photo.offsetMs)}</Text></View>;
}
export function LectureScreen() {
  const { id, at } = useLocalSearchParams<{ id: string; at?: string }>();
  const { items: lectures, loading, error } = useItems<Lecture>('lecture');
  const { items: notes } = useItems<Note>('note');
  const { items: transcripts } = useItems<Transcript>('transcript');
  const { items: jobs } = useItems<ProcessingJob>('processing-job');
  const { items: photos } = useItems<Photo>('photo');
  const { timetable } = useTimetable();
  const lecture = lectures.find(item => item.id === id);
  const note = notes.find(item => item.value.lectureId === id);
  const transcript = transcripts.find(item => item.id === `transcript:${id}`);
  const [uri, setUri] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [dirty, setDirty] = useState(false);
  const [preview, setPreview] = useState(false);
  const [original, setOriginal] = useState(false);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const loadedNote = useRef<string | undefined>(undefined);
  const player = useAudioPlayer(uri, { updateInterval: 500 });
  const status = useAudioPlayerStatus(player);
  const seeked = useRef<string | null>(null);
  useEffect(() => {
    const target = Number(at);
    if (at !== undefined && Number.isFinite(target) && target >= 0 && status.isLoaded && seeked.current !== `${id}:${at}`) {
      seeked.current = `${id}:${at}`;
      void player.seekTo(Math.min(target, status.duration)).catch(() => setMessage('Could not seek to the source timestamp.'));
    }
  }, [at, id, player, status.isLoaded, status.duration]);
  useEffect(() => {
    let active = true;
    if (lecture?.value.audioUri) void assetUri(lecture.value.audioUri).then(value => { if (active) setUri(value); }).catch(() => { if (active) setMessage('Audio could not be opened on this device.'); });
    return () => { active = false; };
  }, [lecture?.value.audioUri]);
  useEffect(() => {
    if (!dirty && loadedNote.current !== note?.updatedAt) { setDraft(note?.value.markdown ?? ''); loadedNote.current = note?.updatedAt; }
  }, [note, dirty]);
  useEffect(() => {
    if (lecture && lecture.value.durationMs === 0 && Number.isFinite(status.duration) && status.duration > 0) {
      void saveItem('lecture', lecture.id, { ...lecture.value, durationMs: Math.round(status.duration * 1000) }).catch(() => setMessage('Could not save the audio duration.'));
    }
  }, [lecture, status.duration]);
  async function seek(seconds: number) { try { await player.seekTo(Math.max(0, Math.min(seconds, status.duration))); } catch { setMessage('This audio position could not be opened.'); } }
  async function save() {
    setBusy(true);
    try { await saveItem<Note>('note', `note:${id}`, { lectureId: id, markdown: draft, edited: true }); setDirty(false); setMessage('Notes saved on this device.'); }
    catch { setMessage('Could not save notes. Your edits are still here; try again.'); }
    finally { setBusy(false); }
  }
  return <Workspace title={lecture ? lectureTitle(lecture.value, timetable) : loading ? 'Opening lecture…' : 'Lecture not found'}>
    <Link href="/library" dismissTo style={ui.link}>‹ Back to your library</Link>
    {(message || error) && <Message error={!!error}>{error || message}</Message>}
    {lecture && <>
      {jobs.filter(item => item.value.lectureId === id).map(item => <View key={item.id} style={ui.card}><Text style={ui.title}>Processing: {item.value.stage === 'review' ? 'Needs your check' : item.value.stage}</Text>{item.value.error && <><Message error>{item.value.error}</Message><Button secondary onPress={() => void retryJob(id).catch(() => setMessage('Could not retry processing.'))}>Retry processing</Button></>}</View>)}
      <View style={ui.card}><Text style={ui.title}>Listen again</Text><Text style={ui.body}>{durationLabel(status.currentTime * 1000)} / {durationLabel((status.duration || lecture.value.durationMs / 1000) * 1000)}</Text><View style={ui.row}><Button disabled={!status.isLoaded} onPress={() => { if (status.playing) player.pause(); else { if (status.didJustFinish) void seek(0); player.play(); } }}>{status.playing ? 'Pause audio' : 'Play audio'}</Button><Button disabled={!status.isLoaded} secondary onPress={() => void seek(status.currentTime - 15)}>−15 seconds</Button><Button disabled={!status.isLoaded} secondary onPress={() => void seek(status.currentTime + 15)}>+15 seconds</Button><Button secondary onPress={() => { player.setPlaybackRate(player.playbackRate === 1 ? 1.5 : 1); }}>{status.playbackRate === 1.5 ? 'Speed: 1.5×' : 'Speed: 1×'}</Button></View>
      {lecture.value.bookmarks.map(bookmark => <Button key={bookmark.id} secondary disabled={!status.isLoaded} onPress={() => void seek(bookmark.offsetMs / 1000)}>{durationLabel(bookmark.offsetMs)} · {bookmark.label || 'Bookmark'}</Button>)}
      {lecture.value.gaps.map((gap, i) => <Text key={i} style={ui.body}>Interruption at {durationLabel(gap.offsetMs)} · {gap.reason} · {durationLabel(gap.durationMs)}</Text>)}</View>
      <View style={ui.card}><Text style={ui.title}>Study notes</Text><Text style={ui.body}>{dirty ? 'Unsaved changes' : note ? 'Saved on this device' : 'Capture what you want to remember.'}</Text><View style={ui.row}><Button secondary onPress={() => setPreview(!preview)}>{preview ? 'Edit Markdown' : 'Preview notes'}</Button><Button disabled={busy || !dirty} onPress={() => void save()}>{busy ? 'Saving…' : 'Save notes'}</Button></View>{preview ? <Markdown text={draft || 'Your notes will appear here.'} /> : <Field label="Lecture notes (Markdown)" value={draft} onChangeText={value => { setDraft(value); setDirty(true); }} multiline />}</View>
      <View style={ui.card}><Text style={ui.title}>Transcript</Text>{transcript ? <><Button secondary onPress={() => setOriginal(!original)}>{original ? 'Show English' : 'Show original'}</Button>{transcript.value.findings?.map((finding, i) => <Message key={i} error>{finding.message}</Message>)}{transcript.value.segments.map((segment, i) => <View key={i} style={{ gap: 8 }}><Button secondary disabled={!status.isLoaded} onPress={() => void seek(segment.start)}>{durationLabel(segment.start * 1000)} · {segment.speaker}</Button><Text selectable style={ui.body}>{original ? segment.original : segment.english}</Text></View>)}</> : <Text style={ui.body}>No transcript yet. Configure processing in Settings to turn your audio into a transcript.</Text>}</View>
      {transcript && <TranscriptReview transcript={transcript.value} duration={lecture.value.durationMs / 1000} subjectId={lecture.value.subjectId} />}
      {photos.filter(photo => photo.value.lectureId === id).map(photo => <SavedPhoto key={photo.id} photo={photo.value} />)}
    </>}
  </Workspace>;
}

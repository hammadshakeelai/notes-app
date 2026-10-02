import { Link, useFocusEffect } from 'expo-router';
import * as DocumentPicker from 'expo-document-picker';
import * as Crypto from 'expo-crypto';
import { useCallback, useState } from 'react';
import { View, Text } from 'react-native';
import { Workspace, Button, Field, Message, ui } from '@/components/Workspace';
import { saveItem, useItems } from '@/data/store';
import { persistAsset } from '@/data/assets';
import type { Lecture } from '@/data/types';
import { weekdayOf, minutesOf } from '@/domain/calendar';
import { useTimetable, localDay } from '@/features/timetable/useTimetable';
import { lectureTitle, durationLabel } from './labels';
import { importNativeRecordings } from './nativeImport';

export function LibraryScreen() {
  const { items, error, loading } = useItems<Lecture>('lecture');
  const { timetable } = useTimetable();
  const [query, setQuery] = useState('');
  const [title, setTitle] = useState('');
  const [date, setDate] = useState(localDay);
  const [start, setStart] = useState('09:00');
  const [subjectId, setSubjectId] = useState<string | null>(null);
  const [stream, setStream] = useState<'lecture' | 'lab'>('lecture');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [importing, setImporting] = useState(false);
  useFocusEffect(useCallback(() => { void importNativeRecordings().catch(cause => setMessage(String(cause.message || cause))); }, []));

  async function importAudio() {
    if (busy) return;
    setMessage(''); setBusy(true);
    try {
      weekdayOf(date); minutesOf(start);
      if (date < timetable.semesterStart && subjectId) throw new Error('Choose a date in this semester, or file the recording as Other.');
      const result = await DocumentPicker.getDocumentAsync({ type: ['audio/*'], copyToCacheDirectory: true });
      if (result.canceled) return;
      const asset = result.assets[0];
      const audioUri = await persistAsset(asset.uri, asset.file);
      const id = Crypto.randomUUID();
      await saveItem<Lecture>('lecture', id, { title: title.trim() || asset.name, subjectId, date, start, stream: subjectId ? stream : 'other', durationMs: 0, audioUri, mimeType: asset.mimeType || 'audio/mp4', bookmarks: [], gaps: [], recovered: false });
      setImporting(false); setTitle(''); setMessage('Audio imported and saved. Open it to listen or add notes.');
    } catch (cause) { setMessage(cause instanceof Error ? cause.message : 'Import failed. Your original audio has not changed.'); }
    finally { setBusy(false); }
  }
  const filtered = items.filter(item => `${lectureTitle(item.value, timetable)} ${item.value.title} ${item.value.date}`.toLowerCase().includes(query.trim().toLowerCase())).sort((a, b) => b.value.date.localeCompare(a.value.date));
  return <Workspace title="Your lecture library" subtitle="Keep the recording. Find the important part. Come back prepared.">
    <View style={ui.row}><Link href="/recorder" style={ui.link}>Open recorder →</Link><Button onPress={() => setImporting(!importing)} secondary>{importing ? 'Close import' : 'Import audio'}</Button></View>
    {importing && <View style={ui.card}><Text style={ui.title}>Bring a recording with you</Text><Text style={ui.body}>For a recording from your phone’s Voice Recorder, save or copy it to a folder you can find in My Files, then choose it below. Set the original class date, time and subject. Notes keeps its own copy so your original recording stays available.</Text><Field label="Title (optional for a class)" value={title} onChangeText={setTitle} /><Field label="Recording date (YYYY-MM-DD)" value={date} onChangeText={setDate} /><Field label="Class start time (HH:MM)" value={start} onChangeText={setStart} />
      <View style={ui.row}><Button secondary={subjectId !== null} onPress={() => setSubjectId(null)}>Other</Button>{timetable.subjects.map(subject => <Button key={subject.id} secondary={subjectId !== subject.id} onPress={() => setSubjectId(subject.id)}>{subject.name}</Button>)}</View>
      {subjectId && <View style={ui.row}><Button secondary={stream !== 'lecture'} onPress={() => setStream('lecture')}>Lecture</Button><Button secondary={stream !== 'lab'} onPress={() => setStream('lab')}>Lab</Button></View>}
      <Button disabled={busy} onPress={() => void importAudio()}>{busy ? 'Saving audio…' : 'Choose audio file'}</Button>
    </View>}
    {(message || error) && <Message error={!!error}>{error || message}</Message>}
    <Field label="Find a lecture" value={query} onChangeText={setQuery} placeholder="Search by subject, title or date" />
    {loading ? <Text style={ui.body}>Loading your library…</Text> : filtered.length === 0 ? <View style={ui.card}><Text style={ui.title}>{query ? 'No matching lectures' : 'A place for your first lecture'}</Text><Text style={ui.body}>{query ? 'Try another subject or date.' : 'Record a class on your phone or import an audio file. Your saved lectures will appear here.'}</Text></View> : filtered.map(item => <View style={ui.card} key={item.id}><Link href={{ pathname: '/lecture', params: { id: item.id } }} style={ui.title}>{lectureTitle(item.value, timetable)}</Link><Text style={ui.body}>{item.value.date} · {item.value.durationMs ? durationLabel(item.value.durationMs) : 'Imported audio'} · {item.value.bookmarks.length} bookmarks{item.value.recovered ? ' · Recovered' : ''}</Text><Link href={{ pathname: '/lecture', params: { id: item.id } }} style={ui.link}>Listen & study →</Link></View>)}
  </Workspace>;
}

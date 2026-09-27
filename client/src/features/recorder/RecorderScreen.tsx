import { Link, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { AppState, Linking, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { recorderAvailable, recorderCommand, requestRecorderPermissions } from '../../../modules/recorder';
import type { RecorderSnapshot } from './contract';
import { saveItem } from '@/data/store';
import { persistAsset } from '@/data/assets';
import type { Lecture, Photo } from '@/data/types';
import { useTimetable, localDay } from '@/features/timetable/useTimetable';
import { detectClass, displayName, isExcepted, sessionNumber } from '@/domain/timetable';
import * as ImagePicker from 'expo-image-picker';
import * as Crypto from 'expo-crypto';

function elapsed(milliseconds: number) {
  const seconds = Math.floor(milliseconds / 1000);
  return `${Math.floor(seconds / 3600).toString().padStart(2, '0')}:${Math.floor(seconds / 60 % 60).toString().padStart(2, '0')}:${(seconds % 60).toString().padStart(2, '0')}`;
}

export function RecorderScreen() {
  const params = useLocalSearchParams<{ title?: string; subjectId?: string; stream?: string; date?: string; start?: string }>();
  const { timetable } = useTimetable();
  const [editedTitle, setTitle] = useState<string | null>(null);
  const title = editedTitle ?? params.title?.slice(0, 200) ?? 'Lecture recording';
  const [snapshot, setSnapshot] = useState<RecorderSnapshot | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const activeRequest = useRef(false);
  const currentPoll = useRef<Promise<RecorderSnapshot> | null>(null);
  const mounted = useRef(false);

  useFocusEffect(useCallback(() => {
    mounted.current = true;
    setBusy(activeRequest.current);
    if (!recorderAvailable) return () => { mounted.current = false; };
    let cancelled = false;
    let initialized = false;
    let timer: ReturnType<typeof setTimeout>;
    async function refresh() {
      if (cancelled) return;
      if (AppState.currentState === 'active' && !activeRequest.current) {
        const request = recorderCommand(initialized ? 'snapshot' : 'recover');
        currentPoll.current = request;
        try {
          const value = await request;
          initialized = true;
          if (!cancelled && !activeRequest.current) setSnapshot(value);
        } catch (cause) {
          if (!cancelled) setError(cause instanceof Error ? cause.message : 'Could not reconnect to the recorder.');
        } finally { if (currentPoll.current === request) currentPoll.current = null; }
      }
      if (!cancelled) timer = setTimeout(refresh, 750);
    }
    void refresh();
    return () => { cancelled = true; mounted.current = false; clearTimeout(timer); };
  }, []));

  async function run(command: 'pause' | 'resume' | 'stop' | 'bookmark' | 'recover') {
    if (activeRequest.current) return;
    activeRequest.current = true;
    setBusy(true);
    setError(null);
    try {
      await currentPoll.current?.catch(() => undefined);
      if (!mounted.current) return;
      const result = await recorderCommand(command);
      if (mounted.current) setSnapshot(result);
    } catch (cause) {
      if (mounted.current) setError(cause instanceof Error ? cause.message : 'The recorder could not complete that action.');
    } finally {
      activeRequest.current = false;
      if (mounted.current) setBusy(false);
    }
  }

  async function start(acknowledged = false) {
    if (activeRequest.current) return;
    if (!title.trim()) { setError('Give this recording a title first.'); return; }
    activeRequest.current = true;
    setBusy(true);
    setError(null);
    try {
      await currentPoll.current?.catch(() => undefined);
      if (!mounted.current) return;
      const before = await recorderCommand('snapshot');
      if (mounted.current) setSnapshot(before);
      const warnings = [
        ...(before.device.batteryPercent !== null && before.device.batteryPercent < 20 ? ['Battery is below 20%.'] : []),
        ...(before.device.availableBytes < 1024 ** 3 ? ['Less than 1 GB of storage remains.'] : []),
      ];
      if (warnings.length && !acknowledged) {
        if (mounted.current) setWarning(`${warnings.join(' ')} About ${Math.floor(before.device.estimatedMinutes)} minutes of audio will fit.`);
        return;
      }
      if (!mounted.current || AppState.currentState !== 'active') return;
      if (!await requestRecorderPermissions()) {
        if (mounted.current) setError('Allow microphone and notification permissions in Android settings to record with lock-screen controls.');
        return;
      }
      if (!mounted.current || AppState.currentState !== 'active') return;
      const id = Crypto.randomUUID();
      // Persist the class assignment before opening the microphone; a UI crash cannot lose it.
      await saveItem<Partial<Lecture>>('recording-label', `recording-label:${id}`, {
        subjectId: params.subjectId ?? null, stream: params.stream === 'lab' ? 'lab' : params.subjectId ? 'lecture' : 'other', date: params.date ?? localDay(), start: params.start ?? `${String(new Date().getHours()).padStart(2, '0')}:${String(new Date().getMinutes()).padStart(2, '0')}`,
      });
      const result = await recorderCommand('start', { id, title: title.trim(), warningsAcknowledged: acknowledged });
      if (mounted.current) { setSnapshot(result); setWarning(null); }
    } catch (cause) {
      if (mounted.current) setError(cause instanceof Error ? cause.message : 'Recording could not start.');
    } finally {
      activeRequest.current = false;
      if (mounted.current) setBusy(false);
    }
  }

  const active = snapshot?.state === 'recording' || snapshot?.state === 'paused';
  const finalizing = snapshot?.state === 'finalizing';
  const disabled = busy || finalizing || !snapshot;
  const session = snapshot?.session;
  const manualPause = snapshot?.state === 'paused' && session?.gaps.at(-1)?.reason === 'manual-pause';
  const savedRecordings = snapshot?.recordings.filter(recording => recording.state === 'ready' || recording.state === 'error') ?? [];
  const now = new Date();
  const detected = detectClass(timetable.slots, localDay(now), `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`);
  const suggested = detected.kind !== 'ask' && !isExcepted(timetable, { slot: detected.slot, date: localDay(now) }) ? detected.slot : null;
  async function photo() {
    if (!session || busy) return;
    const offsetMs = session.durationMs;
    setBusy(true);
    try {
      if (!(await ImagePicker.requestCameraPermissionsAsync()).granted) throw new Error('Allow camera permission to add a class photo.');
      const result = await ImagePicker.launchCameraAsync({ quality: 0.8, mediaTypes: ['images'] });
      if (!result.canceled) {
        const uri = await persistAsset(result.assets[0].uri);
        await saveItem<Photo>('photo', Crypto.randomUUID(), { lectureId: session.id, offsetMs, uri });
      }
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Photo could not be saved.'); }
    finally { setBusy(false); }
  }

  return <SafeAreaView style={styles.safe}>
    <ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
      <Link href="/" dismissTo style={styles.back}>‹ Your timetable</Link>
      <Link href="/library" style={styles.back}>Your lecture library →</Link>
      <Text style={styles.eyebrow}>KEEP THE WHOLE LECTURE</Text>
      <Text style={styles.heading}>Recorder</Text>
      <Text style={styles.intro}>Start when class begins. Add bookmarks for the moments you want to revisit.</Text>
      {!active && !params.subjectId && suggested && <Link href={{ pathname: '/recorder', params: { title: displayName(localDay(now), { kind: 'class', subjectName: timetable.subjects.find(s => s.id === suggested.subjectId)!.name, stream: suggested.stream, number: sessionNumber(timetable, { subjectId: suggested.subjectId, stream: suggested.stream, date: localDay(now), start: suggested.start }) }), subjectId: suggested.subjectId, stream: suggested.stream, date: localDay(now), start: suggested.start } }} replace style={styles.back}>Use detected class: {timetable.subjects.find(s => s.id === suggested.subjectId)?.name} →</Link>}

      {!recorderAvailable ? <View style={styles.card}>
        <Text style={styles.cardTitle}>{Platform.OS === 'web' ? 'Record on your Android phone' : 'Use the Android development build'}</Text>
        <Text style={styles.body}>{Platform.OS === 'web' ? 'The phone keeps recording when the screen is off. This browser view does not record audio.' : 'This recorder uses a native service that is not included in Expo Go. Install the Notes development build to use it.'}</Text>
      </View> : <>
        <View style={styles.card}>
          <Text style={styles.label}>Recording title</Text>
          <TextInput accessibilityLabel="Recording title" value={active || finalizing ? session?.title || title : title} onChangeText={setTitle} editable={!active && !finalizing && !busy} maxLength={200} style={styles.input} placeholder="Name this lecture" placeholderTextColor="#68728B" />
          <Text style={styles.timer}>{elapsed(session?.durationMs || 0)}</Text>
          <Text accessibilityLiveRegion="polite" style={styles.status}>{busy ? 'Working…' : finalizing ? 'Saving and checking your audio…' : active ? snapshot?.state === 'paused' ? manualPause ? 'Paused' : 'Waiting for the microphone · resumes automatically' : 'Recording' : 'Ready when you are'}</Text>
          <View accessibilityLabel={`Microphone level ${Math.round((snapshot?.level || 0) * 100)} percent`} style={styles.meter}><View style={[styles.meterFill, { width: `${Math.round((snapshot?.level || 0) * 100)}%` }]} /></View>
          {snapshot?.state === 'recording' && <Text style={styles.hint}>Watch the sound level. If it stays low, move closer to the lecturer.</Text>}
          <View style={styles.actions}>
            {!active ? <Pressable accessibilityRole="button" disabled={disabled} onPress={() => void start()} style={[styles.primary, disabled && styles.disabled]}><Text style={styles.primaryText}>Start recording</Text></Pressable> : <>
              <Pressable accessibilityRole="button" disabled={disabled} onPress={() => void run(manualPause ? 'resume' : 'pause')} style={[styles.secondary, disabled && styles.disabled]}><Text style={styles.secondaryText}>{manualPause ? 'Resume' : 'Pause'}</Text></Pressable>
              <Pressable accessibilityRole="button" disabled={disabled} onPress={() => void run('bookmark')} style={[styles.secondary, disabled && styles.disabled]}><Text style={styles.secondaryText}>Bookmark</Text></Pressable>
              <Pressable accessibilityRole="button" disabled={disabled} onPress={() => void photo()} style={[styles.secondary, disabled && styles.disabled]}><Text style={styles.secondaryText}>Photo</Text></Pressable>
              <Pressable accessibilityRole="button" disabled={disabled} onPress={() => void run('stop')} style={[styles.stop, disabled && styles.disabled]}><Text style={styles.primaryText}>Stop & save</Text></Pressable>
            </>}
          </View>
          {active && <Text style={styles.hint}>{session?.bookmarks.length || 0} bookmarks · {session?.gaps.length || 0} interruptions</Text>}
          {snapshot && <Text style={styles.hint}>{(snapshot.device.availableBytes / 1024 ** 3).toFixed(1)} GB free · About {Math.floor(snapshot.device.estimatedMinutes)} minutes of audio</Text>}
        </View>

        {warning && <View style={styles.warning}>
          <Text style={styles.cardTitle}>Check before recording</Text><Text style={styles.body}>{warning}</Text>
          <View style={styles.actions}><Pressable accessibilityRole="button" disabled={busy} onPress={() => void start(true)} style={styles.primary}><Text style={styles.primaryText}>Record anyway</Text></Pressable><Pressable accessibilityRole="button" disabled={busy} onPress={() => setWarning(null)} style={styles.secondary}><Text style={styles.secondaryText}>Cancel</Text></Pressable></View>
        </View>}
        {error && <View accessibilityRole="alert" style={styles.warning}>
          <Text style={styles.body}>{error}</Text>
          <View style={styles.actions}><Pressable accessibilityRole="button" onPress={() => void run('recover')} disabled={busy} style={styles.secondary}><Text style={styles.secondaryText}>Reconnect & recover</Text></Pressable><Pressable accessibilityRole="button" onPress={() => void Linking.openSettings()} style={styles.secondary}><Text style={styles.secondaryText}>App settings</Text></Pressable></View>
        </View>}

        <Text style={styles.sectionTitle}>Saved on this phone</Text>
        {savedRecordings.length === 0 && <Text style={styles.body}>Your first recording will appear here after you stop.</Text>}
        {savedRecordings.map(recording => <View style={styles.saved} key={recording.id}>
          <Text style={styles.cardTitle}>{recording.title}</Text>
          <Text style={styles.body}>{elapsed(recording.durationMs)} · {recording.recovered ? 'Recovered' : recording.state === 'ready' ? 'Saved' : 'Needs recovery'} · {recording.bookmarks.length} bookmarks</Text>
          {recording.error && <Text style={styles.error}>{recording.error}</Text>}
          {recording.gaps.length > 0 && <Text style={styles.hint}>{recording.gaps.length} interruption gaps marked</Text>}
        </View>)}
        {savedRecordings.some(recording => recording.state === 'error') && <Pressable accessibilityRole="button" disabled={disabled} onPress={() => void run('recover')} style={[styles.secondary, disabled && styles.disabled]}><Text style={styles.secondaryText}>Recover interrupted recordings</Text></Pressable>}
        <Text style={styles.hint}>Record only with your lecturer’s permission. Open the lecture library to play saved audio and write notes.</Text>
      </>}
    </ScrollView>
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F7F8FC' },
  page: { maxWidth: 760, width: '100%', alignSelf: 'center', padding: 24, paddingBottom: 48, gap: 16 },
  back: { color: '#6253CC', fontSize: 14, paddingVertical: 14 },
  eyebrow: { color: '#646D86', fontSize: 10, fontWeight: '700', letterSpacing: 1.5, marginTop: 12 },
  heading: { fontSize: 38, lineHeight: 44, fontWeight: '700', color: '#232748', letterSpacing: -1.4 },
  intro: { fontSize: 15, lineHeight: 24, color: '#646D86', marginBottom: 12 },
  card: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E4E7F0', borderRadius: 18, padding: 24, gap: 16 },
  cardTitle: { fontSize: 16, fontWeight: '600', color: '#232748' },
  label: { fontSize: 12, fontWeight: '500', color: '#646D86' },
  body: { fontSize: 14, lineHeight: 23, color: '#646D86' },
  input: { fontSize: 16, color: '#232748', borderWidth: 1, borderColor: '#D5D9E6', borderRadius: 10, padding: 14, minHeight: 48 },
  timer: { textAlign: 'center', fontSize: 45, color: '#232748', fontVariant: ['tabular-nums'], fontWeight: '500', marginTop: 12 },
  status: { textAlign: 'center', fontSize: 14, color: '#6253CC' },
  meter: { height: 8, backgroundColor: '#EEEBFC', borderRadius: 4, overflow: 'hidden' },
  meterFill: { height: 8, backgroundColor: '#6253CC', borderRadius: 4 },
  hint: { fontSize: 12, lineHeight: 20, color: '#646D86' },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 4 },
  primary: { minHeight: 48, backgroundColor: '#6253CC', borderRadius: 10, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 18, paddingVertical: 12 },
  primaryText: { color: '#FFFFFF', fontSize: 14, fontWeight: '600' },
  secondary: { minHeight: 48, backgroundColor: '#EEEBFC', borderRadius: 10, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16, paddingVertical: 12 },
  secondaryText: { color: '#4E42AC', fontSize: 14, fontWeight: '600' },
  stop: { minHeight: 48, backgroundColor: '#9C3747', borderRadius: 10, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 18, paddingVertical: 12 },
  disabled: { opacity: 0.45 },
  warning: { padding: 20, backgroundColor: '#FFF5E8', borderRadius: 14, borderWidth: 1, borderColor: '#E9D3B6', gap: 12 },
  sectionTitle: { fontSize: 22, color: '#232748', fontWeight: '600', marginTop: 16 },
  saved: { backgroundColor: '#FFFFFF', padding: 20, borderRadius: 14, borderWidth: 1, borderColor: '#E4E7F0', gap: 8 },
  error: { color: '#9C3747', fontSize: 13, lineHeight: 21 },
});

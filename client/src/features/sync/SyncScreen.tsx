import { Link } from 'expo-router';
import { useState } from 'react';
import { Linking, Text, View } from 'react-native';
import { Workspace, Button, Message, ui } from '@/components/Workspace';
import { useItems } from '@/data/store';
import { connectGoogle, disconnectGoogle } from './auth';
import { syncNow } from './engine';
import { useTimetable } from '@/features/timetable/useTimetable';
import { publishSubject, setSubjectSharing } from './sharing';
import type { SharePreference } from './sharing';

export function SyncScreen() {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const { items } = useItems<{ at: string; root: string }>('local');
  const last = items.find(item => item.id === 'last-sync')?.value;
  const share = items.find(item => item.id === 'class-share')?.value;
  const { timetable } = useTimetable();
  const { items: preferences } = useItems<SharePreference>('sharing');
  async function publish(subjectId: string, name: string, enabled: boolean) {
    setBusy(true); setMessage('');
    try {
      await setSubjectSharing(subjectId, enabled);
      if (enabled) { await publishSubject(subjectId, name); setMessage('Study materials published. Use Drive’s Share button to choose who can access the Class share folder.'); }
      else setMessage('Sharing stopped and the subject folder removed from Class share.');
    } catch (cause) { setMessage(cause instanceof Error ? cause.message : 'Sharing update failed; retry when connected.'); }
    finally { setBusy(false); }
  }
  async function run(action: 'connect' | 'sync' | 'disconnect') {
    setBusy(true); setMessage('');
    try {
      if (action === 'connect') { await connectGoogle(); setMessage('Google connected. Press Sync now to upload this library and bring in your saved items.'); }
      if (action === 'disconnect') { await disconnectGoogle(); setMessage('Disconnected. Your local library is still available.'); }
      if (action === 'sync') { const result = await syncNow(); setMessage(`Sync finished: ${result.uploaded} revisions uploaded, ${result.downloaded} items received.`); }
    } catch (cause) { setMessage(cause instanceof Error ? cause.message : 'Sync could not complete. Your local data is safe.'); }
    finally { setBusy(false); }
  }
  return <Workspace title="Your library, together" subtitle="Sync your personal audio and study materials to your own Google Drive.">
    {message && <Message>{message}</Message>}
    <View style={ui.card}><Text style={ui.title}>Connect your Google account</Text><Text style={ui.body}>This app requests access only to files it creates or you open with it. API keys stay on each device. Your personal NotesApp folder includes audio; keep it private.</Text><Link href="/settings" style={ui.link}>Configure Google client IDs →</Link><View style={ui.row}><Button disabled={busy} onPress={() => void run('connect')}>Connect Google</Button><Button disabled={busy} secondary onPress={() => void run('disconnect')}>Disconnect</Button></View></View>
    <View style={ui.card}><Text style={ui.title}>Sync your library</Text><Text style={ui.body}>{last ? `Last completed: ${new Date(last.at).toLocaleString()}` : 'No completed sync on this device yet.'}</Text><Text style={ui.body}>Sync uploads audio and photos and merges the newest version of each study item. Keep this screen open until it completes.</Text><Button disabled={busy} onPress={() => void run('sync')}>{busy ? 'Working…' : 'Sync now'}</Button>{last && <Button secondary onPress={() => void Linking.openURL(`https://drive.google.com/drive/folders/${last.root}`)}>Open personal folder in Drive</Button>}</View>
    <View style={ui.card}><Text style={ui.title}>Class share</Text><Text style={ui.body}>Publish notes, transcripts and flashcards for classmates. Audio, chat, bookmarks, keys and study progress are excluded. Sharing access is controlled by you in Drive.</Text>{timetable.subjects.map(subject => { const preference = preferences.find(p => p.value.subjectId === subject.id)?.value; return <View key={subject.id} style={ui.card}><Text style={ui.label}>{subject.name}</Text><View style={ui.row}><Button disabled={busy} secondary onPress={() => void publish(subject.id, subject.name, true)}>{preference?.enabled ? 'Update shared materials' : 'Enable & publish'}</Button>{preference?.folderId && <Button disabled={busy} secondary onPress={() => void publish(subject.id, subject.name, false)}>Stop sharing & remove folder</Button>}</View></View>; })}{share && <Button secondary onPress={() => void Linking.openURL(`https://drive.google.com/drive/folders/${share.root}`)}>Open Class share in Drive</Button>}</View>
  </Workspace>;
}

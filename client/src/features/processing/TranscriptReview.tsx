import { useState } from 'react';
import { Text, View } from 'react-native';
import { Button, Field, Message, ui } from '@/components/Workspace';
import { saveItem } from '@/data/store';
import { validateTranscript } from '@/features/study/core';
import type { Transcript } from './engine';

export function TranscriptReview({ transcript, duration, subjectId }: { transcript: Transcript; duration: number; subjectId: string | null }) {
  const [selected, setSelected] = useState<number | null>(null);
  const [english, setEnglish] = useState('');
  const [original, setOriginal] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  async function save() {
    if (selected === null) return;
    setBusy(true);
    try {
      const prior = transcript.segments[selected];
      const segments = transcript.segments.map((segment, i) => i === selected ? { ...segment, english: english.trim(), original: original.trim() } : segment);
      const validation = validateTranscript(segments, duration);
      if (validation.findings.some(f => f.segmentIndex === selected && ['empty', 'script', 'roman-urdu', 'repetition'].includes(f.code))) throw new Error('The correction still has empty, repeated or untranslated text. Please check it.');
      await saveItem('transcript', `transcript:${transcript.lectureId}`, { ...transcript, segments, findings: [...transcript.findings.filter(f => f.segmentIndex !== selected), ...validation.findings.filter(f => f.segmentIndex === selected)] });
      if (subjectId && prior.english !== english.trim()) await saveItem('glossary', `glossary:${transcript.lectureId}:${selected}`, { subjectId, wrong: prior.english, correct: english.trim() });
      setSelected(null); setMessage('Correction saved and added to this subject’s glossary.');
    } catch (cause) { setMessage(cause instanceof Error ? cause.message : 'Correction could not be saved.'); }
    finally { setBusy(false); }
  }
  return <View style={{ gap: 12 }}><Text style={ui.title}>Needs your check</Text>{message && <Message>{message}</Message>}
    <View style={ui.row}>{transcript.segments.map((segment, i) => <Button key={i} secondary onPress={() => { setSelected(i); setEnglish(segment.english); setOriginal(segment.original); }}>Edit {Math.floor(segment.start)}s</Button>)}</View>
    {selected !== null && <View style={ui.card}><Field label="Correct English" value={english} onChangeText={setEnglish} multiline /><Field label="Correct original (Latin script)" value={original} onChangeText={setOriginal} multiline /><Button disabled={busy} onPress={() => void save()}>Save correction</Button><Button secondary onPress={() => setSelected(null)}>Close correction</Button></View>}
  </View>;
}

import { Link, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Linking, Text, View } from 'react-native';
import { Workspace, Button, Field, Message, ui } from '@/components/Workspace';
import { Markdown } from '@/components/Markdown';
import { useItems } from '@/data/store';
import { useTimetable } from '@/features/timetable/useTimetable';
import { askStudyQuestion } from './chat';
import type { ChatMessage } from './chat';

export function ChatScreen() {
  const params = useLocalSearchParams<{ subjectId?: string }>();
  const { timetable } = useTimetable();
  const [selected, setSelected] = useState(params.subjectId ?? '');
  const subjectId = selected || timetable.subjects[0]?.id || 'other';
  const { items, error } = useItems<ChatMessage>('chat');
  const [question, setQuestion] = useState('');
  const [web, setWeb] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  async function ask() {
    setBusy(true); setMessage('');
    try { await askStudyQuestion(subjectId, question, web); setQuestion(''); }
    catch (cause) { setMessage(cause instanceof Error ? cause.message : 'Could not answer right now.'); }
    finally { setBusy(false); }
  }
  return <Workspace title="Ask your lectures" subtitle="Explore a concept, follow its source, and listen again when something needs a closer look.">
    <View style={ui.row}>{timetable.subjects.map(subject => <Button key={subject.id} secondary={subject.id !== subjectId} disabled={busy} onPress={() => setSelected(subject.id)}>{subject.name}</Button>)}</View>
    {(message || error) && <Message error>{error || message}</Message>}
    <View style={ui.card}><Field label="What would you like to understand?" value={question} onChangeText={setQuestion} multiline /><Button secondary disabled={busy} onPress={() => setWeb(!web)}>{web ? 'Web sources included' : 'Lecture sources only'}</Button><Text style={ui.body}>Questions and relevant excerpts are sent to Gemini. Web search sends your question to Tavily, or Wikipedia when no Tavily key is configured.</Text><Button disabled={busy || !question.trim()} onPress={() => void ask()}>{busy ? 'Finding a supported answer…' : 'Ask question'}</Button></View>
    {items.filter(item => item.value.subjectId === subjectId).sort((a, b) => b.value.createdAt.localeCompare(a.value.createdAt)).map(item => <View style={ui.card} key={item.id}><Text style={ui.title}>{item.value.question}</Text><Markdown text={item.value.answer} />{item.value.citations.map((citation, i) => <View key={i} style={{ gap: 5 }}><Text selectable style={ui.body}>“{citation.quote}”</Text>{citation.kind === 'lecture' ? <Link href={{ pathname: '/lecture', params: { id: citation.lectureId, at: citation.timestamp } }} style={ui.link}>From your lectures · {citation.timestamp}s →</Link> : <Button secondary onPress={() => void Linking.openURL(citation.url)}>From the web · {new URL(citation.url).hostname} →</Button>}</View>)}</View>)}
  </Workspace>;
}

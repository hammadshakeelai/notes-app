import { Link } from 'expo-router';
import * as Crypto from 'expo-crypto';
import { useState } from 'react';
import { Text, View } from 'react-native';
import { Workspace, Button, Field, Message, ui } from '@/components/Workspace';
import { deleteItem, saveItem, useItems } from '@/data/store';
import type { Lecture } from '@/data/types';
import { useTimetable } from '@/features/timetable/useTimetable';
import { dueCards, gradeCard, predictedRecall } from './scheduler';
import type { Flashcard } from './scheduler';

export function StudyScreen() {
  const { items, loading, error } = useItems<Flashcard>('flashcard');
  const { items: lectures } = useItems<Lecture>('lecture');
  const { timetable } = useTimetable();
  const [subject, setSubject] = useState<string | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [exam, setExam] = useState(false);
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [lectureId, setLectureId] = useState('');
  const [timestamp, setTimestamp] = useState('0');
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const allDue = dueCards(items);
  const filtered = items.filter(item => !subject || item.value.subjectId === subject);
  const queue = exam ? [...filtered].sort((a, b) => predictedRecall(a.value) - predictedRecall(b.value)) : allDue.filter(item => !subject || item.value.subjectId === subject);
  const card = queue[0];
  async function grade(rating: 'forgot' | 'remembered') {
    if (!card || busy) return;
    setBusy(true);
    try { await saveItem('flashcard', card.id, gradeCard(card.value, rating)); setRevealed(false); if (exam) setExam(false); }
    catch { setMessage('Could not save this review. Please try again.'); }
    finally { setBusy(false); }
  }
  async function saveCard() {
    setBusy(true);
    try {
      const lecture = lectures.find(item => item.id === lectureId);
      const seconds = Number(timestamp);
      if (!question.trim() || !answer.trim() || !lecture || !Number.isFinite(seconds) || seconds < 0 || seconds * 1000 > lecture.value.durationMs) throw new Error('Add a question, answer, source lecture and a timestamp within its audio.');
      const old = items.find(item => item.id === editing)?.value;
      await saveItem<Flashcard>('flashcard', editing || Crypto.randomUUID(), { ...old, lectureId, subjectId: lecture.value.subjectId ?? 'other', question: question.trim(), answer: answer.trim(), timestamp: seconds });
      setAdding(false); setEditing(null); setQuestion(''); setAnswer(''); setMessage('Card saved.');
    } catch (cause) { setMessage(cause instanceof Error ? cause.message : 'Could not save card.'); }
    finally { setBusy(false); }
  }
  return <Workspace title="A little practice, every day" subtitle="Recall first, then reveal. Reviews use FSRS with 90% desired retention and up to 20 new cards a day across subjects.">
    {(message || error) && <Message error={!!error}>{error || message}</Message>}
    <View style={ui.row}><Button secondary={subject !== null} onPress={() => { setSubject(null); setRevealed(false); }}>All subjects</Button>{timetable.subjects.map(s => <Button key={s.id} secondary={subject !== s.id} onPress={() => { setSubject(s.id); setRevealed(false); }}>{s.name}</Button>)}</View>
    <View style={ui.row}><Button secondary onPress={() => { setAdding(!adding); setEditing(null); }}>Add a card</Button><Button secondary onPress={() => { setExam(!exam); setRevealed(false); }}>{exam ? 'Return to due reviews' : 'Review weakest cards'}</Button><Link href={{ pathname: '/chat', params: { subjectId: subject ?? timetable.subjects[0]?.id } }} style={ui.link}>Study chat →</Link></View>
    <Text style={ui.body}>{items.length} cards · {allDue.length} ready to study</Text>
    {adding && <View style={ui.card}><Text style={ui.title}>{editing ? 'Edit card' : 'One idea worth remembering'}</Text><Field label="Question" value={question} onChangeText={setQuestion} /><Field label="Answer" value={answer} onChangeText={setAnswer} multiline /><Text style={ui.label}>Source lecture</Text><View style={ui.row}>{lectures.map(item => <Button key={item.id} secondary={lectureId !== item.id} onPress={() => setLectureId(item.id)}>{item.value.title}</Button>)}</View><Field label="Source timestamp (seconds)" value={timestamp} onChangeText={setTimestamp} /><Button disabled={busy} onPress={() => void saveCard()}>Save card</Button></View>}
    {loading ? <Text style={ui.body}>Loading your cards…</Text> : card ? <View style={ui.card}><Text style={ui.eyebrow}>{exam ? 'WEAKEST RECALL' : 'READY FOR REVIEW'}</Text><Text style={ui.title}>{card.value.question}</Text>{revealed ? <><Text selectable style={ui.body}>{card.value.answer}</Text><View style={ui.row}><Button disabled={busy} secondary onPress={() => void grade('forgot')}>Forgot</Button><Button disabled={busy} onPress={() => void grade('remembered')}>Remembered</Button></View></> : <Button onPress={() => setRevealed(true)}>Reveal answer</Button>}<Link href={{ pathname: '/lecture', params: { id: card.value.lectureId, at: card.value.timestamp } }} style={ui.link}>Open source lecture at {Math.floor(card.value.timestamp)}s →</Link><Button secondary onPress={() => { setEditing(card.id); setQuestion(card.value.question); setAnswer(card.value.answer); setLectureId(card.value.lectureId); setTimestamp(String(card.value.timestamp)); setAdding(true); }}>Edit this card</Button><Button secondary disabled={busy} onPress={() => { setBusy(true); void deleteItem('flashcard', card.id).then(() => { setMessage('Card removed.'); setRevealed(false); }).catch(() => setMessage('Could not remove card.')).finally(() => setBusy(false)); }}>Remove this card</Button></View> : <View style={ui.card}><Text style={ui.title}>{items.length ? 'You’re caught up' : 'Start with one idea'}</Text><Text style={ui.body}>{items.length ? 'No cards are due for this selection. Come back when the next review is ready.' : 'Add a card from a saved lecture. Each answer stays linked to its source.'}</Text></View>}
  </Workspace>;
}

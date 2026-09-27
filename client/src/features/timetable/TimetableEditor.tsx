import { useState } from 'react';
import { Text, View } from 'react-native';
import { Workspace, Button, Field, Message, ui } from '@/components/Workspace';
import { saveItem } from '@/data/store';
import { importTimetable, occurrencesBetween, isExcepted, teacherOn } from '@/domain/timetable';
import type { Timetable, CalendarException } from '@/domain/timetable';
import { weekdayOf } from '@/domain/calendar';
import { useTimetable, localDay } from './useTimetable';

const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
function asMarkdown(tt: Timetable) {
  return ['| Day | Time | Subject | Stream | Teacher | Room |', '| --- | --- | --- | --- | --- | --- |', ...tt.slots.map(slot => `| ${days[slot.weekday - 1]} | ${slot.start}-${slot.end} | ${tt.subjects.find(s => s.id === slot.subjectId)?.name ?? ''} | ${slot.stream} | ${teacherOn(tt.teachers, slot.subjectId, slot.stream, localDay()) ?? ''} | ${slot.room ?? ''} |`)].join('\n');
}
export function TimetableEditor() {
  const { timetable, loading, error } = useTimetable();
  const [editedDraft, setDraft] = useState<string | null>(null);
  const draft = editedDraft ?? asMarkdown(timetable);
  const [preview, setPreview] = useState<Timetable | null>(null);
  const [date, setDate] = useState(localDay);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [effective, setEffective] = useState(localDay);
  async function update(next: Timetable) {
    setBusy(true); setMessage('');
    try { await saveItem('timetable', 'timetable', next); setMessage('Saved. Lecture numbers now use the updated timetable.'); }
    catch (cause) { setMessage(cause instanceof Error ? cause.message : 'Could not save.'); }
    finally { setBusy(false); }
  }
  function review() {
    try { weekdayOf(effective); const parsed = importTimetable(draft, timetable.semesterStart); setPreview(parsed); setMessage('Review the classes below before saving.'); }
    catch (cause) { setMessage(cause instanceof Error ? cause.message : 'Check the timetable format.'); }
  }
  function savePreview() {
    if (!preview) return;
    // Preserve history; imported teacher changes start on the explicitly chosen date.
    const teachers = [...timetable.teachers, ...preview.teachers.map(item => ({ ...item, from: effective }))];
    const oldToNew = new Map(timetable.slots.map(old => [old.id, preview.slots.find(slot => slot.subjectId === old.subjectId && slot.weekday === old.weekday && slot.stream === old.stream && slot.start === old.start)?.id]));
    const exceptions = timetable.exceptions.flatMap<CalendarException>(exception => exception.kind === 'holiday' ? [exception] : oldToNew.get(exception.slotId) ? [{ ...exception, slotId: oldToNew.get(exception.slotId)! }] : []);
    void update({ ...preview, teachers, exceptions, extras: timetable.extras }); setPreview(null);
  }
  let selectedSlots: ReturnType<typeof occurrencesBetween> = [];
  try { weekdayOf(date); selectedSlots = occurrencesBetween(timetable.slots, date, date); } catch { /* inline validation on save */ }
  const holiday = timetable.exceptions.some(item => item.kind === 'holiday' && item.date === date);
  return <Workspace title="Make the timetable yours" subtitle="Import your Markdown timetable, correct a class, or mark the days that did not happen.">
    {(error || message) && <Message error={!!error}>{error || message}</Message>}
    <View style={ui.card}><Text style={ui.title}>Classes, teachers & rooms</Text><Text style={ui.body}>Edit or paste a table with Day, Time, Subject, Stream, Teacher and Room columns. Saving replaces the weekly schedule; teacher history is kept. Cancellations for removed or rescheduled slots are removed.</Text><Field label="Timetable Markdown" value={draft} onChangeText={value => { setDraft(value); setPreview(null); }} multiline /><Field label="Teacher changes effective from (YYYY-MM-DD)" value={effective} onChangeText={value => { setEffective(value); setPreview(null); }} /><Button onPress={review} disabled={busy || loading}>Review changes</Button>
      {preview && <View style={{ gap: 12 }}><Text style={ui.title}>{preview.subjects.length} subjects · {preview.slots.length} classes</Text>{preview.slots.map(slot => <Text key={slot.id} style={ui.body}>{days[slot.weekday - 1]} {slot.start}–{slot.end} · {preview.subjects.find(s => s.id === slot.subjectId)?.name} · {slot.stream}</Text>)}<Button disabled={busy} onPress={savePreview}>Save reviewed timetable</Button></View>}
    </View>
    <View style={ui.card}><Text style={ui.title}>Holidays & cancelled classes</Text><Text style={ui.body}>Missed classes still count. Only holidays and cancellations change lecture numbers.</Text><Field label="Day to review (YYYY-MM-DD)" value={date} onChangeText={setDate} /><Button disabled={busy} secondary onPress={() => { try { weekdayOf(date); void update({ ...timetable, exceptions: holiday ? timetable.exceptions.filter(e => !(e.kind === 'holiday' && e.date === date)) : [...timetable.exceptions, { kind: 'holiday', date }] }); } catch { setMessage('Enter a valid date in YYYY-MM-DD format.'); } }}>{holiday ? 'Remove holiday' : 'Mark whole day as holiday'}</Button>
      {selectedSlots.map(occ => <View key={occ.slot.id} style={ui.card}><Text style={ui.body}>{occ.slot.start} · {timetable.subjects.find(s => s.id === occ.slot.subjectId)?.name} · {occ.slot.stream}</Text><Button disabled={busy || holiday} secondary onPress={() => void update({ ...timetable, exceptions: isExcepted(timetable, occ) ? timetable.exceptions.filter(e => !(e.kind === 'cancelled' && e.slotId === occ.slot.id && e.date === date)) : [...timetable.exceptions, { kind: 'cancelled', slotId: occ.slot.id, date }] })}>{isExcepted(timetable, occ) ? 'Restore this class' : 'Mark cancelled'}</Button></View>)}
      {timetable.exceptions.map((exception, index) => <Text key={index} style={ui.body}>{exception.date} · {exception.kind === 'holiday' ? 'Holiday' : `Cancelled: ${timetable.slots.find(s => s.id === exception.slotId)?.start ?? 'class'}`}</Text>)}
    </View>
  </Workspace>;
}

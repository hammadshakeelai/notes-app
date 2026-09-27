import { repository, saveItem } from '@/data/store';
import type { Lecture, Note } from '@/data/types';
import type { Transcript } from '@/features/processing/engine';
import type { Flashcard } from '@/features/study/scheduler';
import { createShareExport } from '@/features/study/core';
import { driveRequest, folder, listFiles, uploadFile } from './drive';

export interface SharePreference { subjectId: string; enabled: boolean; folderId?: string }
const html = (text: string) => `<html><body><pre>${text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</pre></body></html>`;
const csv = (text: string) => `"${text.replace(/"/g, '""')}"`;
export async function setSubjectSharing(subjectId: string, enabled: boolean) {
  const old = await repository.get<SharePreference>(`sharing:${subjectId}`);
  // Stop updates first; retain the folder identity so a failed removal can be retried.
  await saveItem<SharePreference>('sharing', `sharing:${subjectId}`, { subjectId, enabled, folderId: old?.value.folderId });
  if (!enabled && old?.value.folderId) {
    await driveRequest(`files/${old.value.folderId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ trashed: true }) });
    await saveItem('sharing', `sharing:${subjectId}`, { subjectId, enabled: false });
  }
}
export async function publishSubject(subjectId: string, subjectName: string): Promise<string> {
  const preference = await repository.get<SharePreference>(`sharing:${subjectId}`);
  if (!preference?.value.enabled) throw new Error('Enable sharing for this subject first.');
  const lectures = (await repository.list<Lecture>('lecture')).filter(item => !item.deleted && item.value.subjectId === subjectId && item.value.stream !== 'other');
  const notes = await repository.list<Note>('note');
  const transcripts = await repository.list<Transcript>('transcript');
  const cards = await repository.list<Flashcard>('flashcard');
  const revision = await repository.get<{ markdown: string }>(`revision:${subjectId}`);
  const exported = createShareExport({ subjectId, enabled: true, revisionSheet: revision?.value.markdown ?? '', lectures: lectures.map(item => ({ id: item.id, title: item.value.title, notes: notes.find(n => !n.deleted && n.value.lectureId === item.id)?.value.markdown ?? '', segments: transcripts.find(t => !t.deleted && t.value.lectureId === item.id)?.value.segments ?? [] })), flashcards: cards.filter(c => !c.deleted && c.value.subjectId === subjectId).map(c => c.value), practice: [] })!;
  // Class share is deliberately outside the personal NotesApp root (which contains audio).
  const root = await folder('NotesApp Class share');
  const target = await folder(subjectName, root);
  await saveItem('sharing', `sharing:${subjectId}`, { subjectId, enabled: true, folderId: target });
  const existing = await listFiles(`trashed = false and '${target}' in parents`);
  async function document(name: string, text: string) {
    if (!text.trim()) return;
    await uploadFile(name, target, new Blob([html(text)], { type: 'text/html' }), 'text/html', existing.find(f => f.name === name)?.id, undefined, 'application/vnd.google-apps.document');
  }
  for (const lecture of exported.lectures) {
    await document(`${lecture.title} — Notes`, lecture.notes);
    await document(`${lecture.title} — Transcript`, lecture.transcript.map(segment => `${segment.start}s · ${segment.speaker}\n${segment.english}\n${segment.original}`).join('\n\n'));
  }
  await document('Revision sheet', exported.revisionSheet);
  const cardCsv = ['Question,Answer,Lecture,Timestamp', ...exported.flashcards.map(card => [card.question, card.answer, exported.lectures.find(l => l.id === card.lectureId)?.title ?? card.lectureId, String(card.timestamp)].map(csv).join(','))].join('\r\n');
  await uploadFile('Flashcards.csv', target, new Blob([cardCsv], { type: 'text/csv' }), 'text/csv', existing.find(f => f.name === 'Flashcards.csv')?.id);
  await saveItem('local', 'class-share', { root });
  return root;
}

import { recorderAvailable, recorderCommand } from '../../../modules/recorder';
import { repository, saveItem } from '@/data/store';
import type { Lecture } from '@/data/types';
import { localDay } from '@/features/timetable/useTimetable';

export async function importNativeRecordings() {
  if (!recorderAvailable) return;
  const snapshot = await recorderCommand('recover');
  for (const session of snapshot.recordings) {
    if (session.state !== 'ready' || !session.uri || await repository.get(session.id)) continue;
    const started = new Date(session.startedAt);
    const label = await repository.get<Partial<Lecture>>(`recording-label:${session.id}`);
    await saveItem<Lecture>('lecture', session.id, {
      title: session.title, subjectId: null, date: localDay(started), stream: 'other',
      start: `${String(started.getHours()).padStart(2, '0')}:${String(started.getMinutes()).padStart(2, '0')}`,
      ...label?.value, durationMs: session.durationMs, audioUri: session.uri, mimeType: 'audio/mp4',
      bookmarks: session.bookmarks, gaps: session.gaps, recovered: session.recovered,
    });
  }
}

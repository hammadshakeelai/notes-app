import { formatDisplayDate } from '../calendar';
import type { IsoDate } from '../calendar';
import type { Stream } from './types';

export type RecordingLabel =
  | { kind: 'class'; subjectName: string; stream: Stream; number: number }
  | { kind: 'other'; title: string };

const STREAM_LABEL: Record<Stream, string> = { lecture: 'Lecture', lab: 'Lab' };

function titleOf(label: RecordingLabel): string {
  if (label.kind === 'other') {
    const title = label.title.trim();
    if (!title) throw new Error('An "Other" recording needs a title');
    return title;
  }
  const subjectName = label.subjectName.trim();
  if (!subjectName) throw new Error('A class recording needs a subject');
  if (!Number.isSafeInteger(label.number) || label.number < 1) {
    throw new Error('A class recording number must be a positive integer');
  }
  return `${subjectName} – ${STREAM_LABEL[label.stream]} ${label.number}`;
}

/** R-NAME-1 / R-TT-4: a readable date and class label, or the title of an Other recording. */
export function displayName(date: IsoDate, label: RecordingLabel): string {
  return `${formatDisplayDate(date)} – ${titleOf(label)}`;
}

/** R-NAME-2: an ISO date prefix for sorting, with filename characters safe on Android and Windows. */
export function fileName(date: IsoDate, label: RecordingLabel): string {
  formatDisplayDate(date);
  const safe = titleOf(label)
    .replace(/[\p{Cc}\\/:*?"<>|]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[. ]+$/g, '');
  if (!safe) throw new Error('A recording needs a title with valid filename characters');
  return `${date} ${safe}`;
}

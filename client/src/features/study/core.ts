/** Pure study boundaries. All transcript offsets are seconds. */
export interface TranscriptSegment {
  start: number;
  end: number;
  speaker: string;
  original: string;
  english: string;
}
export interface TimeRange { start: number; end: number }
export interface QualityFinding {
  code: 'format' | 'timestamp' | 'coverage' | 'gap' | 'empty' | 'script' | 'roman-urdu' | 'repetition' | 'unclear';
  message: string;
  segmentIndex?: number;
}
export interface TranscriptValidation {
  segments: TranscriptSegment[];
  findings: QualityFinding[];
  passed: boolean;
}
const record = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);
const normalize = (text: string) => text.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
const urduScript = /[\u0600-\u06ff\u0750-\u077f\u08a0-\u08ff\ufb50-\ufdff\ufe70-\ufeff]/u;
// Conservative phrase detection: isolated words such as "main" also occur in English.
const romanUrdu = /\b(?:kya hai|yeh hai|ye hai|aap ko|aap ka|hum ne|kar rahe|nahi hai|nahin hai|samajh aya|jee jee|theek hai)\b/i;

export function validateTranscript(input: unknown, duration: number, speechRanges?: readonly TimeRange[]): TranscriptValidation {
  const findings: QualityFinding[] = [];
  const segments: TranscriptSegment[] = [];
  const add = (code: QualityFinding['code'], message: string, segmentIndex?: number) => findings.push({ code, message, segmentIndex });
  if (!finite(duration) || duration <= 0 || !Array.isArray(input)) {
    return { segments, findings: [{ code: 'format', message: 'Expected segments and a positive audio duration.' }], passed: false };
  }
  if (input.length === 0) add('empty', 'No transcript segments were returned.');
  let previousStart = -1;
  let coveredUntil = 0;
  const phrases = new Map<string, number>();
  input.forEach((value: unknown, index: number) => {
    if (!record(value) || !finite(value.start) || !finite(value.end) ||
      typeof value.speaker !== 'string' || typeof value.original !== 'string' || typeof value.english !== 'string') {
      add('format', 'Segment must contain numeric timestamps, speaker, original and English.', index);
      return;
    }
    const segment: TranscriptSegment = { start: value.start, end: value.end, speaker: value.speaker, original: value.original, english: value.english };
    segments.push(segment);
    if (segment.start < 0 || segment.end > duration || segment.end <= segment.start || segment.start < previousStart) {
      add('timestamp', 'Timestamps must be ordered, positive-length and within the audio.', index);
    }
    const gapStart = coveredUntil;
    if (segment.start - gapStart > 60 && (speechRanges === undefined || speechRanges.some(range => range.end > gapStart && range.start < segment.start))) {
      add('gap', 'More than 60 seconds are uncovered; check for missing speech.', index);
    }
    previousStart = segment.start;
    coveredUntil = Math.max(coveredUntil, segment.end);
    if (!segment.speaker.trim() || !segment.original.trim() || !segment.english.trim()) add('empty', 'Segment text and speaker must not be empty.', index);
    if (urduScript.test(`${segment.speaker} ${segment.original} ${segment.english}`)) add('script', 'Use Roman Urdu in the original and English in the translation.', index);
    if (romanUrdu.test(segment.english)) add('roman-urdu', 'Possible Roman Urdu remains in the English translation.', index);
    if (/\[unclear\]/i.test(`${segment.original} ${segment.english}`)) add('unclear', 'This segment needs your check.', index);
    const words = normalize(segment.english).split(/\s+/);
    for (let i = 0; i + 6 <= words.length; i++) {
      const phrase = words.slice(i, i + 6).join(' ');
      const count = (phrases.get(phrase) ?? 0) + 1;
      phrases.set(phrase, count);
      if (count === 3) add('repetition', `Repeated six-word phrase: “${phrase}”.`, index);
    }
  });
  if (segments.length && (segments[0].start > 20 || duration - coveredUntil > 45)) add('coverage', 'Transcript must start within 20 seconds and end within 45 seconds of the audio boundaries.');
  return { segments, findings, passed: findings.length === 0 };
}

export interface LectureSource { id: string; subjectId: string; segments: readonly TranscriptSegment[] }
export interface WebSource { url: string; text: string }
export type StudyCitation =
  | { kind: 'lecture'; lectureId: string; timestamp: number; quote: string }
  | { kind: 'web'; url: string; quote: string };
/** Validates source existence and exact quoted evidence, not the truth of generated claims. */
export function validateCitations(citations: readonly StudyCitation[], subjectId: string, lectures: readonly LectureSource[], webSources: readonly WebSource[] = []): string[] {
  if (!citations.length) return ['At least one source citation is required.'];
  return citations.flatMap((citation, index) => {
    const quote = normalize(citation.quote);
    if (!quote) return [`Citation ${index + 1} has no supporting quote.`];
    if (citation.kind === 'lecture') {
      const lecture = lectures.find(source => source.id === citation.lectureId && source.subjectId === subjectId);
      const matches = lecture?.segments.some(segment => finite(citation.timestamp) && citation.timestamp >= segment.start && citation.timestamp < segment.end && normalize(segment.english).includes(quote));
      return matches ? [] : [`Citation ${index + 1} does not match this subject's lecture at the cited timestamp.`];
    }
    let safeUrl = false;
    try { const url = new URL(citation.url); safeUrl = (url.protocol === 'https:' || url.protocol === 'http:') && !url.username && !url.password; } catch { /* invalid URL */ }
    return safeUrl && webSources.some(source => source.url === citation.url && normalize(source.text).includes(quote))
      ? [] : [`Citation ${index + 1} does not match a retrieved web source.`];
  });
}

export interface ShareInput {
  subjectId: string;
  enabled: boolean;
  revisionSheet: string;
  lectures: readonly { id: string; title: string; notes: string; segments: readonly TranscriptSegment[]; isOther?: boolean; shareOther?: boolean }[];
  flashcards: readonly { question: string; answer: string; lectureId: string; timestamp: number }[];
  practice: readonly { question: string; answer: string; lectureId: string }[];
}
/** Explicit construction prevents runtime extra fields (keys/audio/progress/chat) leaking. */
export function createShareExport(input: ShareInput) {
  if (!input.enabled) return null;
  const lectures = input.lectures.filter(lecture => !lecture.isOther || lecture.shareOther);
  const ids = new Set(lectures.map(lecture => lecture.id));
  return {
    subjectId: input.subjectId,
    revisionSheet: input.revisionSheet,
    lectures: lectures.map(lecture => ({
      id: lecture.id, title: lecture.title, notes: lecture.notes,
      transcript: lecture.segments.map(segment => ({ start: segment.start, end: segment.end, speaker: segment.speaker, original: segment.original, english: segment.english })),
    })),
    flashcards: input.flashcards.filter(card => ids.has(card.lectureId)).map(card => ({ question: card.question, answer: card.answer, lectureId: card.lectureId, timestamp: card.timestamp })),
    practice: input.practice.filter(question => ids.has(question.lectureId)).map(question => ({ question: question.question, answer: question.answer, lectureId: question.lectureId })),
  };
}

export interface SyncItem { id: string; updatedAt: string; updatedBy: string; deleted: boolean }
function canonical(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null';
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonical((value as Record<string, unknown>)[key])}`).join(',')}}`;
}
/** Equal clocks prefer tombstones, then device ID, then canonical content for convergence. */
export function mergeSyncItems<T extends SyncItem>(local: readonly T[], remote: readonly T[]): T[] {
  const result = new Map<string, T>();
  const compare = (a: T, b: T) => Date.parse(a.updatedAt) - Date.parse(b.updatedAt) || Number(a.deleted) - Number(b.deleted) ||
    (a.updatedBy < b.updatedBy ? -1 : a.updatedBy > b.updatedBy ? 1 : 0) ||
    (canonical(a) < canonical(b) ? -1 : canonical(a) > canonical(b) ? 1 : 0);
  for (const item of [...local, ...remote]) {
    if (!item.id || !item.updatedBy || !Number.isFinite(Date.parse(item.updatedAt)) || typeof item.deleted !== 'boolean') throw new Error('Invalid sync item metadata.');
    const current = result.get(item.id);
    if (!current || compare(item, current) > 0) result.set(item.id, item);
  }
  return [...result.values()].sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
}

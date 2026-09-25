export type RecorderState = 'idle' | 'recording' | 'paused' | 'finalizing' | 'ready' | 'error';

export interface RecordingSession {
  id: string;
  title: string;
  startedAt: number;
  durationMs: number;
  state: Exclude<RecorderState, 'idle'>;
  uri: string | null;
  recovered: boolean;
  bookmarks: { id: string; offsetMs: number; label: string }[];
  gaps: { offsetMs: number; durationMs: number; reason: string }[];
  error: string | null;
}

export interface RecorderSnapshot {
  state: RecorderState;
  session: RecordingSession | null;
  recordings: RecordingSession[];
  level: number;
  device: { batteryPercent: number | null; availableBytes: number; estimatedMinutes: number };
}

const states: readonly string[] = ['idle', 'recording', 'paused', 'finalizing', 'ready', 'error'];
const object = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value);
const nonnegative = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value >= 0;
const nullableText = (value: unknown) => value === null || typeof value === 'string';

function isSession(value: unknown): value is RecordingSession {
  return object(value) && typeof value.id === 'string' && typeof value.title === 'string' &&
    nonnegative(value.startedAt) && nonnegative(value.durationMs) && typeof value.state === 'string' &&
    value.state !== 'idle' && states.includes(value.state) && nullableText(value.uri) &&
    typeof value.recovered === 'boolean' && nullableText(value.error) &&
    Array.isArray(value.bookmarks) && value.bookmarks.every(item => object(item) &&
      typeof item.id === 'string' && nonnegative(item.offsetMs) && typeof item.label === 'string') &&
    Array.isArray(value.gaps) && value.gaps.every(item => object(item) &&
      nonnegative(item.offsetMs) && nonnegative(item.durationMs) && typeof item.reason === 'string');
}

/** Validate the process boundary before any native data is rendered or used by controls. */
export function parseRecorderSnapshot(json: string): RecorderSnapshot {
  let value: unknown;
  try { value = JSON.parse(json); } catch { throw new Error('The recorder returned an unreadable status. Refresh to reconnect.'); }
  if (!object(value) || typeof value.state !== 'string' || !states.includes(value.state) ||
    !(value.session === null || isSession(value.session)) ||
    !Array.isArray(value.recordings) || !value.recordings.every(isSession) ||
    !nonnegative(value.level) || value.level > 1 || !object(value.device) ||
    !(value.device.batteryPercent === null || nonnegative(value.device.batteryPercent) && value.device.batteryPercent <= 100) ||
    !nonnegative(value.device.availableBytes) || !nonnegative(value.device.estimatedMinutes)) {
    throw new Error('The recorder returned an invalid status. Refresh to reconnect.');
  }
  return value as unknown as RecorderSnapshot;
}

import type { Item, Lecture } from '@/data/types';
import { saveItem } from '@/data/store';
import { generate, uploadAudio } from '../api';
import { callModel, defaultSettings, enqueueLecture, quotaDay, runQueueOnce } from '../engine';
import type { ProcessingJob } from '../engine';
const mockItems = new Map<string, Item>();
jest.mock('@/data/store', () => ({
  repository: { get: jest.fn(async (id: string) => mockItems.get(id) ?? null), list: jest.fn(async (kind: string) => [...mockItems.values()].filter(item => item.kind === kind)) },
  saveItem: jest.fn(async (kind: string, id: string, value: unknown) => { mockItems.set(id, { kind, id, value, deleted: false, updatedAt: new Date().toISOString(), updatedBy: 'test' }); }),
}));
jest.mock('@/data/secrets', () => ({ getSecret: jest.fn(async () => 'test-key') }));
jest.mock('@/data/assets', () => ({ readAsset: jest.fn(async () => new Blob(['audio'])) }));
jest.mock('../api', () => {
  class ProviderError extends Error {
    status: number;
    retryAt?: number;
    constructor(message: string, status = 0, retryAt?: number) { super(message); this.status = status; this.retryAt = retryAt; }
  }
  return { ProviderError, uploadAudio: jest.fn(async () => ({ name: 'files/audio', uri: 'https://generativelanguage.googleapis.com/v1beta/files/audio', mimeType: 'audio/mp4', state: 'ACTIVE' })), getRemoteFile: jest.fn(async () => ({ name: 'files/audio', uri: 'https://generativelanguage.googleapis.com/v1beta/files/audio', mimeType: 'audio/mp4', state: 'ACTIVE' })), generate: jest.fn(async () => ({ value: [{ start: 0, end: 60, speaker: 'Teacher', original: 'Vectors have magnitude and direction.', english: 'Vectors have magnitude and direction.' }], tokens: 100 })) };
});
const lecture: Lecture = { title: 'Math', subjectId: 'math', date: '2026-09-25', stream: 'lecture', start: '09:00', durationMs: 60_000, audioUri: 'file://local', mimeType: 'audio/mp4', bookmarks: [], gaps: [], recovered: false };
beforeEach(() => { mockItems.clear(); jest.clearAllMocks(); });
test('disabled processing never uploads audio or creates a job', async () => {
  await saveItem('lecture', 'lecture', lecture);
  await runQueueOnce();
  expect(uploadAudio).not.toHaveBeenCalled();
  expect(mockItems.has('processing:lecture')).toBe(false);
});
test('queue resumes after upload with the same persisted job, without duplicate upload', async () => {
  await saveItem('settings', 'processing-settings', { ...defaultSettings, enabled: true });
  await saveItem('lecture', 'lecture', lecture);
  await enqueueLecture('lecture'); await enqueueLecture('lecture');
  await runQueueOnce(); await runQueueOnce();
  expect(uploadAudio).toHaveBeenCalledTimes(1);
  expect(generate).toHaveBeenCalledTimes(1);
  expect((mockItems.get('processing:lecture')!.value as ProcessingJob).stage).toBe('second-draft');
  expect(mockItems.get('transcript:lecture')).toBeDefined();
});
test('malformed drafts are not accepted and retries survive in the queue', async () => {
  await saveItem('settings', 'processing-settings', { ...defaultSettings, enabled: true });
  await saveItem('lecture', 'lecture', lecture); await runQueueOnce();
  jest.mocked(generate).mockResolvedValueOnce({ value: [{ english: 'bad' }], tokens: 1 });
  await runQueueOnce();
  expect(mockItems.has('transcript:lecture')).toBe(false);
  const job = mockItems.get('processing:lecture')!.value as ProcessingJob;
  expect(job.nextAttempt).toBeGreaterThan(Date.now()); expect(job.attempts).toBe(1);
});
test('quota exhaustion makes no network call', async () => {
  const model = defaultSettings.draftModels[0];
  await saveItem('usage', `usage:${model}:${quotaDay()}`, { model, day: quotaDay(), requests: 20, tokens: 0, lastRequest: 0 });
  await expect(callModel(model, 'test', {}, 20)).rejects.toThrow('daily free limit');
  expect(generate).not.toHaveBeenCalled();
});

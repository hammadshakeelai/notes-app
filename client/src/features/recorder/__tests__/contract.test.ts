import { parseRecorderSnapshot } from '../contract';

const session = {
  id: 'sample-recording', title: 'Practice session', startedAt: 1_790_000_000_000,
  durationMs: 60000, state: 'ready', uri: 'file:///recordings/sample/recording.m4a',
  recovered: true, bookmarks: [{ id: 'b1', offsetMs: 20000, label: '' }],
  gaps: [{ offsetMs: 30000, durationMs: 10000, reason: 'microphone' }], error: null,
};
const valid = () => ({ state: 'ready', session, recordings: [session], level: 0,
  device: { batteryPercent: 80, availableBytes: 2_000_000_000, estimatedMinutes: 1000 } });

describe('recorder process boundary', () => {
  it('preserves recovered recording metadata and interruption gaps', () => {
    expect(parseRecorderSnapshot(JSON.stringify(valid()))).toEqual(valid());
  });
  it('accepts an idle recorder and unknown battery charge', () => {
    const value = { ...valid(), state: 'idle', session: null, recordings: [], device: { ...valid().device, batteryPercent: null } };
    expect(parseRecorderSnapshot(JSON.stringify(value))).toEqual(value);
  });
  it('rejects corrupt JSON with an actionable error', () => {
    expect(() => parseRecorderSnapshot('{bad')).toThrow('unreadable status');
  });
  it.each([null, [], { ...valid(), state: 'unknown' }, { ...valid(), level: 2 },
    { ...valid(), recordings: [null] }, { ...valid(), session: { ...session, durationMs: -1 } },
    { ...valid(), session: { ...session, bookmarks: [{ offsetMs: -10 }] } },
    { ...valid(), session: { ...session, gaps: [{ offsetMs: 0, durationMs: null, reason: 'call' }] } },
    { ...valid(), device: { ...valid().device, batteryPercent: 101 } },
    { ...valid(), device: { ...valid().device, availableBytes: -1 } },
  ])('rejects invalid native data %#', value => {
    expect(() => parseRecorderSnapshot(JSON.stringify(value))).toThrow('invalid status');
  });
});

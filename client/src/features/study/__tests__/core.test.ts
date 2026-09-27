import { createShareExport, mergeSyncItems, TranscriptSegment, validateCitations, validateTranscript } from '../core';

const segment = (start = 0, end = 100): TranscriptSegment => ({ start, end, speaker: 'Teacher', original: 'A matrix has rows and columns.', english: 'A matrix has rows and columns.' });

describe('transcript quality boundary', () => {
  it('accepts a complete English transcript without mutating it', () => {
    const input = [segment()];
    expect(validateTranscript(input, 100)).toEqual({ segments: input, findings: [], passed: true });
  });
  it.each([null, {}, [null], [{ start: NaN }], []])('rejects malformed model output %#', input => {
    expect(validateTranscript(input, 100).passed).toBe(false);
  });
  it('finds missing coverage and invalid ordering or bounds', () => {
    const result = validateTranscript([segment(25, 30), segment(10, 15), segment(80, 101)], 100);
    expect(result.findings.map(f => f.code)).toEqual(expect.arrayContaining(['coverage', 'timestamp']));
  });
  it('flags speech gaps while allowing verified silence', () => {
    const input = [segment(0, 10), segment(80, 100)];
    expect(validateTranscript(input, 100).findings.some(f => f.code === 'gap')).toBe(true);
    expect(validateTranscript(input, 100, [{ start: 0, end: 10 }, { start: 80, end: 100 }]).passed).toBe(true);
    expect(validateTranscript(input, 100, [{ start: 50, end: 51 }]).passed).toBe(false);
  });
  it('detects script, untranslated English, empties and uncertain content', () => {
    const input = [{ ...segment(), original: 'یہ', english: 'yeh hai [unclear]', speaker: '' }];
    expect(validateTranscript(input, 100).findings.map(f => f.code)).toEqual(expect.arrayContaining(['script', 'roman-urdu', 'empty', 'unclear']));
    expect(validateTranscript([{ ...segment(), english: 'The main function returns a value.' }], 100).passed).toBe(true);
  });
  it('finds a repetition loop spanning multiple segments', () => {
    expect(validateTranscript([segment(0, 30), segment(30, 60), segment(60, 100)], 100).findings.some(f => f.code === 'repetition')).toBe(true);
  });
});

describe('source grounding', () => {
  const lectures = [{ id: 'lecture', subjectId: 'math', segments: [segment()] }];
  it('requires quoted support at the cited moment and in the correct subject', () => {
    const citation = { kind: 'lecture' as const, lectureId: 'lecture', timestamp: 10, quote: 'rows and columns' };
    expect(validateCitations([citation], 'math', lectures)).toEqual([]);
    expect(validateCitations([citation], 'physics', lectures)).toHaveLength(1);
    expect(validateCitations([{ ...citation, timestamp: 100 }], 'math', lectures)).toHaveLength(1);
    expect(validateCitations([{ ...citation, quote: 'a matrix is always square' }], 'math', lectures)).toHaveLength(1);
    expect(validateCitations([], 'math', lectures)).toHaveLength(1);
  });
  it('accepts retrieved web evidence and rejects invented links or unsafe protocols', () => {
    const sources = [{ url: 'https://example.com/math', text: 'Matrices have rows and columns.' }];
    const citation = { kind: 'web' as const, url: sources[0].url, quote: 'rows and columns' };
    expect(validateCitations([citation], 'math', lectures, sources)).toEqual([]);
    expect(validateCitations([{ ...citation, url: 'https://example.com/invented' }], 'math', lectures, sources)).toHaveLength(1);
    expect(validateCitations([{ ...citation, url: 'javascript:alert(1)' }], 'math', lectures, [{ url: 'javascript:alert(1)', text: citation.quote }])).toHaveLength(1);
  });
});

describe('class share allowlist', () => {
  const input = {
    subjectId: 'math', enabled: true, revisionSheet: 'Revision', apiKey: 'secret', audio: 'secret', chat: ['secret'],
    lectures: [{ id: 'lecture', title: 'Matrices', notes: 'Notes', segments: [{ ...segment(), audio: 'secret' }], bookmarks: ['secret'] },
      { id: 'other', title: 'Workshop', notes: 'Other', segments: [], isOther: true }],
    flashcards: [{ question: 'Rows?', answer: 'Yes', lectureId: 'lecture', timestamp: 0, progress: 'secret' }, { question: 'Other', answer: '', lectureId: 'other', timestamp: 0 }],
    practice: [{ question: 'Define a matrix', answer: 'Rows and columns', lectureId: 'lecture', chat: 'secret' }],
  };
  it('never copies extra fields, private progress, or unshared Other content', () => {
    const output = createShareExport(input);
    expect(JSON.stringify(output)).not.toContain('secret');
    expect(output?.lectures).toHaveLength(1);
    expect(output?.flashcards).toHaveLength(1);
    expect(output?.practice).toHaveLength(1);
  });
  it('exports nothing when subject sharing is disabled', () => {
    expect(createShareExport({ ...input, enabled: false })).toBeNull();
  });
});

describe('deterministic item sync', () => {
  const old = { id: 'a', updatedAt: '2026-09-18T00:00:00Z', updatedBy: 'phone', deleted: false, text: 'Old' };
  it('latest edit wins and tombstones remain for future sync', () => {
    const deleted = { ...old, updatedAt: '2026-09-19T00:00:00Z', deleted: true };
    expect(mergeSyncItems([old], [deleted])).toEqual([deleted]);
    expect(mergeSyncItems([deleted], [old])).toEqual([deleted]);
  });
  it('converges for equal clocks, equal devices and differing property order', () => {
    const other = { ...old, text: 'New', updatedBy: 'web' };
    expect(mergeSyncItems([old], [other])).toEqual(mergeSyncItems([other], [old]));
    const sameDevice = { ...old, text: 'Different' };
    expect(mergeSyncItems([old], [sameDevice])).toEqual(mergeSyncItems([sameDevice], [old]));
    expect(mergeSyncItems([old], [{ ...old, deleted: true }])[0].deleted).toBe(true);
  });
  it('rejects invalid clocks rather than silently losing a deletion', () => {
    expect(() => mergeSyncItems([old], [{ ...old, updatedAt: 'bad', deleted: true }])).toThrow('Invalid sync');
  });
});

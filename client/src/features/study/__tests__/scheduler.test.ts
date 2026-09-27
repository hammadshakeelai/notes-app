import { dueCards, gradeCard, predictedRecall } from '../scheduler';
import type { Flashcard } from '../scheduler';

const card: Flashcard = { lectureId: 'lecture', subjectId: 'math', question: 'What is a vector?', answer: 'An ordered collection.', timestamp: 0 };
const now = new Date('2026-09-25T09:00:00Z');
test('FSRS review survives JSON persistence and schedules a subsequent review', () => {
  const remembered = gradeCard(card, 'remembered', now);
  const restored = JSON.parse(JSON.stringify(remembered));
  const next = gradeCard(restored, 'remembered', new Date('2026-09-27T09:00:00Z'));
  expect(next.scheduling!.reps).toBe(2);
  expect(Date.parse(next.scheduling!.due)).toBeGreaterThan(Date.parse('2026-09-27T09:00:00Z'));
  expect(next.introducedOn).toBe(remembered.introducedOn);
  expect(predictedRecall(next, new Date('2026-09-27T09:00:00Z'))).toBeGreaterThan(0.9);
});
test('forgot schedules sooner than remembered and never mutates the source', () => {
  expect(Date.parse(gradeCard(card, 'forgot', now).scheduling!.due)).toBeLessThan(Date.parse(gradeCard(card, 'remembered', now).scheduling!.due));
  expect(card.scheduling).toBeUndefined();
});
test('daily new cap counts all subjects and never hides overdue reviews', () => {
  const started = Array.from({ length: 20 }, (_, i) => ({ id: `old${i}`, value: gradeCard({ ...card, subjectId: String(i) }, 'forgot', now) }));
  const fresh = Array.from({ length: 30 }, (_, i) => ({ id: `new${i}`, value: card }));
  expect(dueCards(fresh, now)).toHaveLength(20);
  const due = dueCards([...started, ...fresh], new Date(now.getTime() + 600_000));
  expect(due).toHaveLength(20);
  expect(due.every(item => item.id.startsWith('old'))).toBe(true);
});

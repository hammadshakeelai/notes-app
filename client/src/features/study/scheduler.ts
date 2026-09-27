import { createEmptyCard, fsrs, Rating, State } from 'ts-fsrs';
import type { Card } from 'ts-fsrs';

export interface Flashcard {
  lectureId: string;
  subjectId: string;
  question: string;
  answer: string;
  timestamp: number;
  scheduling?: Omit<Card, 'due' | 'last_review'> & { due: string; last_review?: string };
  introducedOn?: string;
}
const scheduler = fsrs({ request_retention: 0.9, enable_fuzz: false });
function hydrate(value: Flashcard, now: Date): Card {
  return value.scheduling ? { ...value.scheduling, due: new Date(value.scheduling.due), last_review: value.scheduling.last_review ? new Date(value.scheduling.last_review) : undefined } : createEmptyCard(now);
}
export function reviewDay(date: Date) { return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`; }
export function gradeCard(value: Flashcard, rating: 'forgot' | 'remembered', now = new Date()): Flashcard {
  const next = scheduler.next(hydrate(value, now), now, rating === 'forgot' ? Rating.Again : Rating.Good).card;
  return { ...value, introducedOn: value.introducedOn ?? reviewDay(now), scheduling: { ...next, due: next.due.toISOString(), last_review: next.last_review?.toISOString() } };
}
export function dueCards<T extends { id: string; value: Flashcard }>(cards: T[], now = new Date(), dailyNewLimit = 20): T[] {
  const introduced = cards.filter(card => card.value.introducedOn === reviewDay(now)).length;
  const reviews = cards.filter(card => card.value.scheduling && card.value.scheduling.state !== State.New && Date.parse(card.value.scheduling.due) <= now.getTime()).sort((a, b) => Date.parse(a.value.scheduling!.due) - Date.parse(b.value.scheduling!.due));
  const fresh = cards.filter(card => !card.value.scheduling || card.value.scheduling.state === State.New).sort((a, b) => a.id.localeCompare(b.id)).slice(0, Math.max(0, dailyNewLimit - introduced));
  return [...reviews, ...fresh];
}
export function predictedRecall(card: Flashcard, now = new Date()): number {
  if (!card.scheduling) return 0;
  return scheduler.get_retrievability(hydrate(card, now), now, false);
}

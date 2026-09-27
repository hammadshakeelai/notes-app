export interface Item<T = unknown> {
  id: string;
  kind: string;
  value: T;
  updatedAt: string;
  updatedBy: string;
  deleted: boolean;
}

export interface Repository {
  list<T>(kind: string): Promise<Item<T>[]>;
  get<T>(id: string): Promise<Item<T> | null>;
  put(item: Item): Promise<void>;
}

export interface Lecture {
  title: string;
  subjectId: string | null;
  date: string;
  stream: 'lecture' | 'lab' | 'other';
  start: string;
  durationMs: number;
  audioUri: string;
  mimeType: string;
  bookmarks: { id: string; offsetMs: number; label: string }[];
  gaps: { offsetMs: number; durationMs: number; reason: string }[];
  recovered: boolean;
}

export interface Note { lectureId: string; markdown: string; edited: boolean }
export interface Photo { lectureId: string; uri: string; offsetMs: number }

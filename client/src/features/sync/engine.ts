import { repository, saveItem } from '@/data/store';
import type { Item, Lecture, Photo } from '@/data/types';
import { readAsset } from '@/data/assets';
import { mergeSyncItems } from '@/features/study/core';
import { driveRequest, folder, listFiles, uploadFile } from './drive';

export const syncKinds = ['lecture', 'note', 'transcript', 'flashcard', 'practice', 'chat', 'glossary', 'timetable', 'photo', 'revision'] as const;
interface MediaMapping { uri: string; driveId: string }
let running = false;
export function exportItem(item: Item, mediaId?: string): Item {
  if (!(syncKinds as readonly string[]).includes(item.kind)) throw new Error('This item is local-only.');
  if (item.kind === 'lecture') {
    const lecture = item.value as Lecture;
    return { ...item, value: { title: lecture.title, subjectId: lecture.subjectId, date: lecture.date, stream: lecture.stream, start: lecture.start, durationMs: lecture.durationMs, mimeType: lecture.mimeType, bookmarks: lecture.bookmarks, gaps: lecture.gaps, recovered: lecture.recovered, audioDriveId: mediaId ?? null } };
  }
  if (item.kind === 'photo') {
    const photo = item.value as Photo;
    return { ...item, value: { lectureId: photo.lectureId, offsetMs: photo.offsetMs, photoDriveId: mediaId ?? null } };
  }
  return item;
}
function validateRemote(value: unknown): Item {
  if (!value || typeof value !== 'object') throw new Error('Invalid synced item.');
  const item = value as Item;
  if (typeof item.id !== 'string' || item.id.length > 300 || !item.id || typeof item.kind !== 'string' || !(syncKinds as readonly string[]).includes(item.kind) || typeof item.updatedBy !== 'string' || typeof item.updatedAt !== 'string' || !Number.isFinite(Date.parse(item.updatedAt)) || typeof item.deleted !== 'boolean' || !item.value || typeof item.value !== 'object') throw new Error('A Drive item is invalid; sync stopped without replacing local data.');
  return item;
}
export async function syncNow(): Promise<{ uploaded: number; downloaded: number }> {
  if (running) throw new Error('Sync is already running.');
  running = true;
  let uploaded = 0; let downloaded = 0;
  try {
    const account = (await (await driveRequest('about?fields=user(permissionId)')).json()).user.permissionId;
    const prior = await repository.get<{ account: string }>('drive-account');
    if (prior && prior.value.account !== account) throw new Error('This local library belongs to a different Google account. Reconnect its original account to avoid mixing libraries.');
    await saveItem('local', 'drive-account', { account });
    const root = await folder('NotesApp');
    const data = await folder('data', root);
    const audio = await folder('audio', root);
    const photos = await folder('photos', root);
    const files = await listFiles(`trashed = false and '${data}' in parents and mimeType = 'application/json'`);
    const remote: Item[] = [];
    for (const file of files) {
      const result = await driveRequest(`files/${encodeURIComponent(file.id)}?alt=media`);
      const content = await result.text();
      if (content.length > 10_000_000) throw new Error('A synced item is too large to open safely.');
      remote.push(validateRemote(JSON.parse(content)));
    }
    const local = (await Promise.all(syncKinds.map(kind => repository.list(kind)))).flat();
    const portable: Item[] = [];
    for (const item of local) {
      let mediaId: string | undefined;
      if (!item.deleted && (item.kind === 'lecture' || item.kind === 'photo')) {
        const uri = item.kind === 'lecture' ? (item.value as Lecture).audioUri : (item.value as Photo).uri;
        if (uri.startsWith('drive://')) mediaId = uri.slice(8);
        else {
          const mapping = await repository.get<MediaMapping>(`media-map:${item.id}`);
          if (mapping?.value.uri === uri) mediaId = mapping.value.driveId;
          else {
            const parent = item.kind === 'lecture' ? audio : photos;
            const existing = await listFiles(`trashed = false and '${parent}' in parents and appProperties has { key='itemId' and value='${item.id.replace(/'/g, "\\'")}' }`);
            mediaId = existing[0]?.id ?? await uploadFile(`${item.id}${item.kind === 'lecture' ? '.audio' : '.jpg'}`, parent, await readAsset(uri), item.kind === 'lecture' ? (item.value as Lecture).mimeType : 'image/jpeg', undefined, { itemId: item.id });
            await saveItem('local', `media-map:${item.id}`, { uri, driveId: mediaId });
          }
        }
      }
      portable.push(exportItem(item, mediaId));
    }
    const winners = mergeSyncItems(portable, remote);
    for (const winner of winners) {
      const localItem = local.find(item => item.id === winner.id);
      const localPortable = portable.find(item => item.id === winner.id);
      if (!localPortable || JSON.stringify(winner) !== JSON.stringify(localPortable)) {
        const value = { ...(winner.value as Record<string, unknown>) };
        if (winner.kind === 'lecture') {
          value.audioUri = localItem ? (localItem.value as Lecture).audioUri : value.audioDriveId ? `drive://${value.audioDriveId}` : '';
          delete value.audioDriveId;
        }
        if (winner.kind === 'photo') { value.uri = localItem ? (localItem.value as Photo).uri : value.photoDriveId ? `drive://${value.photoDriveId}` : ''; delete value.photoDriveId; }
        await repository.put({ ...winner, value }); downloaded++;
      }
      // Immutable revisions avoid lost updates when phone and browser upload concurrently.
      // Each revision is one JSON item; merge chooses the newest, including tombstones.
      const revision = `${winner.id}__${winner.updatedAt}__${winner.updatedBy}.json`;
      if (!files.some(file => file.name === revision)) {
        await uploadFile(revision, data, new Blob([JSON.stringify(winner)], { type: 'application/json' }), 'application/json'); uploaded++;
      }
    }
    await saveItem('local', 'last-sync', { at: new Date().toISOString(), root, uploaded, downloaded });
    return { uploaded, downloaded };
  } finally { running = false; }
}

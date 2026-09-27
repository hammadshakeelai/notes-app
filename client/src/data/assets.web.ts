import { readRecord, writeRecord } from './idb';
const prefix = 'asset://';
const objectUrls = new Map<string, string>();

export async function persistAsset(sourceUri: string, blob?: Blob): Promise<string> {
  let content = blob;
  if (!content) {
    if (sourceUri.startsWith(prefix)) content = await readAsset(sourceUri);
    else {
      const response = await fetch(sourceUri);
      if (!response.ok) throw new Error('Unable to read the selected media.');
      content = await response.blob();
    }
  }
  const id = crypto.randomUUID();
  await writeRecord('assets', id, content);
  return `${prefix}${id}`;
}
export async function readAsset(uri: string): Promise<Blob> {
  if (uri.startsWith('drive://')) return (await import('@/features/sync/drive')).readDriveMedia(uri.slice(8));
  if (!uri.startsWith(prefix)) {
    const response = await fetch(uri);
    if (!response.ok) throw new Error('Unable to read media.');
    return response.blob();
  }
  const blob = await readRecord<Blob>('assets', uri.slice(prefix.length));
  if (!blob) throw new Error('The saved media is missing from this browser.');
  return blob;
}
export async function assetUri(uri: string): Promise<string> {
  if (!uri.startsWith(prefix) && !uri.startsWith('drive://')) return uri;
  const existing = objectUrls.get(uri);
  if (existing) return existing;
  const url = URL.createObjectURL(await readAsset(uri));
  objectUrls.set(uri, url);
  return url;
}

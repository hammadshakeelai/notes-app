import { Directory, File, Paths } from 'expo-file-system';
import { randomUUID } from 'expo-crypto';

export async function persistAsset(sourceUri: string, blob?: Blob): Promise<string> {
  const directory = new Directory(Paths.document, 'lecture-assets');
  directory.create({ idempotent: true, intermediates: true });
  const extension = sourceUri.split(/[?#]/)[0].match(/\.[a-zA-Z0-9]{1,8}$/)?.[0] ?? '';
  const destination = new File(directory, `${randomUUID()}${extension}`);
  if (blob) {
    destination.create();
    destination.write(new Uint8Array(await blob.arrayBuffer()));
  } else {
    new File(sourceUri).copy(destination);
  }
  return destination.uri;
}
export async function readAsset(uri: string): Promise<Blob> {
  if (uri.startsWith('drive://')) return (await import('@/features/sync/drive')).readDriveMedia(uri.slice(8));
  const file = new File(uri);
  if (!file.exists) throw new Error('The saved media file is missing from this device.');
  return file;
}
export async function assetUri(uri: string): Promise<string> {
  if (uri.startsWith('drive://')) return persistAsset('', await readAsset(uri));
  return uri;
}

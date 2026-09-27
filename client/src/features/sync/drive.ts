import { getAccessToken } from './auth';
import { fetch } from 'expo/fetch';

const API = 'https://www.googleapis.com/drive/v3';
export interface DriveFile { id: string; name: string; mimeType?: string; appProperties?: Record<string, string> }
export async function driveRequest(path: string, init: RequestInit = {}) {
  const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), 120_000);
  try {
    const token = await getAccessToken();
    const response = await fetch(`${API}/${path}`, { ...init, signal: controller.signal, headers: { ...init.headers, Authorization: `Bearer ${token}` } });
    if (!response.ok) throw new Error(response.status === 401 ? 'Google sign-in expired. Reconnect to continue.' : `Drive request failed (${response.status}). Local data is safe.`);
    return response;
  } finally { clearTimeout(timer); }
}
export async function listFiles(query: string): Promise<DriveFile[]> {
  const files: DriveFile[] = []; let page = '';
  do {
    const response = await driveRequest(`files?q=${encodeURIComponent(query)}&fields=nextPageToken,files(id,name,mimeType,appProperties)&pageSize=1000${page ? `&pageToken=${encodeURIComponent(page)}` : ''}`);
    const result = await response.json(); files.push(...result.files); page = result.nextPageToken ?? '';
  } while (page);
  return files;
}
export async function folder(name: string, parent?: string): Promise<string> {
  const safe = name.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
  const existing = await listFiles(`trashed = false and mimeType = 'application/vnd.google-apps.folder' and name = '${safe}'${parent ? ` and '${parent}' in parents` : " and appProperties has { key='notesRoot' and value='v1' }"}`);
  if (existing.length) return existing.sort((a, b) => a.id.localeCompare(b.id))[0].id;
  const result = await driveRequest('files?fields=id', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, mimeType: 'application/vnd.google-apps.folder', ...(parent ? { parents: [parent] } : { appProperties: { notesRoot: 'v1' } }) }) });
  return (await result.json()).id;
}
export async function uploadFile(name: string, parent: string, content: Blob, mimeType: string, existingId?: string, properties?: Record<string, string>, convertTo?: string): Promise<string> {
  const token = await getAccessToken();
  const metadata = { ...(existingId ? { name } : { name, parents: [parent] }), ...(properties ? { appProperties: properties } : {}), ...(convertTo ? { mimeType: convertTo } : {}) };
  const response = await fetch(`https://www.googleapis.com/upload/drive/v3/files${existingId ? `/${encodeURIComponent(existingId)}` : ''}?uploadType=resumable&fields=id`, { method: existingId ? 'PATCH' : 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', 'X-Upload-Content-Type': mimeType, 'X-Upload-Content-Length': String(content.size) }, body: JSON.stringify(metadata) });
  if (!response.ok) throw new Error(`Drive upload could not start (${response.status}).`);
  const location = response.headers.get('location');
  if (!location || new URL(location).origin !== 'https://www.googleapis.com') throw new Error('Drive returned an invalid upload URL.');
  // 8 MiB chunks bound request sizes and follow Drive's 256 KiB multiple requirement.
  const chunk = 8 * 1024 * 1024;
  for (let offset = 0; offset < content.size; offset += chunk) {
    const end = Math.min(offset + chunk, content.size);
    const part = await fetch(location, { method: 'PUT', headers: { Authorization: `Bearer ${token}`, 'Content-Type': mimeType, 'Content-Range': `bytes ${offset}-${end - 1}/${content.size}` }, body: content.slice(offset, end) });
    if (end < content.size && part.status === 308) continue;
    if (!part.ok) throw new Error(`Drive upload interrupted (${part.status}). Retry sync; local audio is safe.`);
    return (await part.json()).id;
  }
  throw new Error('Cannot upload an empty file.');
}
export async function readDriveMedia(id: string): Promise<Blob> {
  if (!/^[a-zA-Z0-9_-]+$/.test(id)) throw new Error('Invalid Drive file identity.');
  return (await driveRequest(`files/${id}?alt=media`)).blob();
}

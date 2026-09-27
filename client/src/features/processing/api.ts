import { fetch } from 'expo/fetch';
const API = 'https://generativelanguage.googleapis.com';

export class ProviderError extends Error {
  constructor(message: string, public status = 0, public retryAt?: number) { super(message); }
}

export interface RemoteFile { name: string; uri: string; mimeType: string; state: string; expirationTime?: string }

// REST protocol: https://ai.google.dev/api/files. Never put keys into URLs or stored jobs.
export async function request(url: string, init: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 180_000);
  try {
    const result = await fetch(url, { ...init, signal: controller.signal });
    if (!result.ok) {
      const retry = result.headers.get('retry-after');
      const retryAt = retry ? (/^\d+$/.test(retry) ? Date.now() + Number(retry) * 1000 : Date.parse(retry)) : undefined;
      // Provider bodies may echo private input. Do not persist them in status messages.
      throw new ProviderError(`Provider request failed (${result.status})`, result.status, retryAt);
    }
    return result;
  } finally { clearTimeout(timeout); }
}

export async function uploadAudio(blob: Blob, mimeType: string, key: string): Promise<RemoteFile> {
  const start = await request(`${API}/upload/v1beta/files`, {
    method: 'POST', headers: { 'x-goog-api-key': key, 'Content-Type': 'application/json',
      'X-Goog-Upload-Protocol': 'resumable', 'X-Goog-Upload-Command': 'start',
      'X-Goog-Upload-Header-Content-Length': String(blob.size), 'X-Goog-Upload-Header-Content-Type': mimeType },
    body: JSON.stringify({ file: { display_name: 'Lecture audio' } }),
  });
  const url = start.headers.get('x-goog-upload-url');
  if (!url || new URL(url).origin !== API) throw new Error('Provider returned an invalid upload URL');
  const result = await request(url, { method: 'POST', headers: {
    'X-Goog-Upload-Offset': '0', 'X-Goog-Upload-Command': 'upload, finalize', 'Content-Type': mimeType,
  }, body: blob });
  const data = await result.json();
  if (!data.file?.name || !data.file?.uri) throw new Error('Upload response did not contain a file');
  return data.file;
}

export async function getRemoteFile(name: string, key: string): Promise<RemoteFile> {
  if (!/^files\/[a-zA-Z0-9_-]+$/.test(name)) throw new Error('Invalid remote file name');
  return (await request(`${API}/v1beta/${name}`, { headers: { 'x-goog-api-key': key } })).json();
}

export async function generate(model: string, key: string, prompt: string, schema: object, maxOutputTokens: number, file?: RemoteFile): Promise<{ value: unknown; tokens: number }> {
  if (!/^[a-zA-Z0-9._-]+$/.test(model)) throw new Error('Configure a valid model ID in settings');
  const response = await request(`${API}/v1beta/models/${model}:generateContent`, {
    method: 'POST', headers: { 'x-goog-api-key': key, 'Content-Type': 'application/json' },
    body: JSON.stringify({ contents: [{ role: 'user', parts: [
      ...(file ? [{ file_data: { mime_type: file.mimeType, file_uri: file.uri } }] : []), { text: prompt },
    ] }], generationConfig: { responseMimeType: 'application/json', responseSchema: schema,
      temperature: 0, maxOutputTokens } }),
  });
  const data = await response.json();
  const candidate = data.candidates?.[0];
  if (candidate?.finishReason !== 'STOP') throw new Error('Model response was blocked or incomplete; retry with a different model');
  const text = candidate.content?.parts?.filter((p: { thought?: boolean }) => !p.thought)
    .map((p: { text?: string }) => p.text ?? '').join('');
  try { return { value: JSON.parse(text), tokens: Number(data.usageMetadata?.totalTokenCount ?? 0) }; }
  catch { throw new Error('Model returned invalid JSON'); }
}

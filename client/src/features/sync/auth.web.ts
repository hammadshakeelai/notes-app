import { repository } from '@/data/store';

interface TokenReply { access_token?: string; expires_in?: number; error?: string }
interface GoogleIdentity { accounts: { oauth2: { initTokenClient(config: { client_id: string; scope: string; callback: (reply: TokenReply) => void; error_callback: () => void }): { requestAccessToken(): void }; revoke(token: string, callback: () => void): void } } }
let load: Promise<void> | undefined;
let token: { value: string; expires: number } | undefined;
function identity() { return (window as Window & { google?: GoogleIdentity }).google; }
export async function prepareGoogle() {
  if (identity()) return;
  if (!load) load = new Promise<void>((resolve, reject) => {
    const script = document.createElement('script'); script.src = 'https://accounts.google.com/gsi/client'; script.async = true;
    script.onload = () => resolve(); script.onerror = () => { script.remove(); reject(new Error('Google sign-in could not load. Check your connection.')); };
    document.head.appendChild(script);
  }).catch(error => { load = undefined; throw error; });
  await load;
}
export async function connectGoogle(): Promise<string> {
  const config = await repository.get<{ webId: string }>('google-oauth');
  if (!config?.value.webId) throw new Error('Add your Google web client ID in Settings first.');
  await prepareGoogle();
  return new Promise((resolve, reject) => {
    const google = identity();
    if (!google) { reject(new Error('Google sign-in is unavailable.')); return; }
    google.accounts.oauth2.initTokenClient({ client_id: config.value.webId, scope: 'https://www.googleapis.com/auth/drive.file',
      callback: reply => { if (!reply.access_token || reply.error) reject(new Error('Google authorization was not completed.')); else { token = { value: reply.access_token, expires: Date.now() + (reply.expires_in ?? 3600) * 1000 - 60_000 }; resolve(token.value); } },
      error_callback: () => reject(new Error('Google sign-in was closed or blocked. Please retry.')),
    }).requestAccessToken();
  });
}
export async function getAccessToken(): Promise<string> {
  if (!token || token.expires < Date.now()) throw new Error('Connect Google Drive to sync.');
  return token.value;
}
export async function disconnectGoogle() { token = undefined; }

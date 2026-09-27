import { GoogleSignin, isSuccessResponse } from '@react-native-google-signin/google-signin';
import { repository } from '@/data/store';

export async function prepareGoogle() {
  const config = await repository.get<{ webId: string }>('google-oauth');
  if (!config?.value.webId) throw new Error('Add your Google client IDs in Settings first.');
  GoogleSignin.configure({ webClientId: config.value.webId, scopes: ['https://www.googleapis.com/auth/drive.file'] });
}
export async function connectGoogle() {
  await prepareGoogle();
  await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
  const result = await GoogleSignin.signIn();
  if (!isSuccessResponse(result)) throw new Error('Google sign-in was cancelled.');
  return getAccessToken();
}
export async function getAccessToken(): Promise<string> {
  await prepareGoogle();
  if (!GoogleSignin.hasPreviousSignIn()) throw new Error('Connect Google Drive to sync.');
  const result = await GoogleSignin.signInSilently();
  if (result.type !== 'success') throw new Error('Reconnect Google Drive.');
  return (await GoogleSignin.getTokens()).accessToken;
}
export async function disconnectGoogle() { await GoogleSignin.signOut(); }

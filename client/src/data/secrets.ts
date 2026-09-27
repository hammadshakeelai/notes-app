import * as SecureStore from 'expo-secure-store';
const key = (provider: string) => `lecture-notes.${provider.replace(/[^a-zA-Z0-9_.-]/g, '_')}`;
export async function getSecret(provider: string): Promise<string | null> {
  return SecureStore.getItemAsync(key(provider));
}
export async function setSecret(provider: string, value: string): Promise<void> {
  if (!value) await SecureStore.deleteItemAsync(key(provider));
  else await SecureStore.setItemAsync(key(provider), value);
}

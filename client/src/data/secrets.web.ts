const key = (provider: string) => `lecture-notes.secret.${provider}`;
export async function getSecret(provider: string): Promise<string | null> {
  return localStorage.getItem(key(provider));
}
export async function setSecret(provider: string, value: string): Promise<void> {
  if (!value) localStorage.removeItem(key(provider));
  else localStorage.setItem(key(provider), value);
}

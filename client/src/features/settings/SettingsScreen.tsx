import { Link } from 'expo-router';
import { useEffect, useState } from 'react';
import { Linking, Platform, Text, View } from 'react-native';
import { Workspace, Button, Field, Message, ui } from '@/components/Workspace';
import { getSecret, setSecret } from '@/data/secrets';
import { saveItem, repository, useItems } from '@/data/store';
import { defaultSettings, getProcessingSettings, saveProcessingSettings } from '@/features/processing/engine';
import type { ProcessingSettings, Usage } from '@/features/processing/engine';

const providers = ['gemini', 'groq', 'tavily'] as const;
const keyLinks = { gemini: 'https://aistudio.google.com/apikey', groq: 'https://console.groq.com/keys', tavily: 'https://app.tavily.com/home' };
export function SettingsScreen() {
  const [keys, setKeys] = useState({ gemini: '', groq: '', tavily: '' });
  const [settings, setSettings] = useState<ProcessingSettings>(defaultSettings);
  const [webId, setWebId] = useState('');
  const [androidId, setAndroidId] = useState('');
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const { items: usage } = useItems<Usage>('usage');
  useEffect(() => { void (async () => {
    const [gemini, groq, tavily, processing, oauth] = await Promise.all([getSecret('gemini'), getSecret('groq'), getSecret('tavily'), getProcessingSettings(), repository.get<{ webId: string; androidId: string }>('google-oauth')]);
    setKeys({ gemini: gemini ?? '', groq: groq ?? '', tavily: tavily ?? '' }); setSettings(processing); setWebId(oauth?.value.webId ?? ''); setAndroidId(oauth?.value.androidId ?? ''); setLoaded(true);
  })().catch(() => setMessage('Could not load settings. Return to this screen to retry before making changes.')); }, []);
  async function save() {
    setBusy(true); setMessage('');
    try {
      for (const provider of providers) await setSecret(provider, keys[provider].trim());
      await saveProcessingSettings(settings);
      for (const id of [webId, androidId]) if (id && !/^[a-zA-Z0-9-]+\.apps\.googleusercontent\.com$/.test(id)) throw new Error('Google client IDs should end in .apps.googleusercontent.com.');
      await saveItem('settings', 'google-oauth', { webId: webId.trim(), androidId: androidId.trim() });
      setMessage('Settings saved. Keys remain on this device.');
    } catch (cause) { setMessage(cause instanceof Error ? cause.message : 'Could not save settings.'); }
    finally { setBusy(false); }
  }
  async function test(provider: typeof providers[number]) {
    setBusy(true); setMessage('');
    try {
      const key = keys[provider].trim();
      if (!key) throw new Error('Enter a key first.');
      const controller = new AbortController(); const timeout = setTimeout(() => controller.abort(), 20_000);
      try {
        const response = await fetch(provider === 'gemini' ? 'https://generativelanguage.googleapis.com/v1beta/models?pageSize=1' : provider === 'groq' ? 'https://api.groq.com/openai/v1/models' : 'https://api.tavily.com/search', {
          signal: controller.signal, method: provider === 'tavily' ? 'POST' : 'GET',
          headers: provider === 'gemini' ? { 'x-goog-api-key': key } : { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
          ...(provider === 'tavily' ? { body: JSON.stringify({ query: 'study', max_results: 1 }) } : {}),
        });
        if (!response.ok) throw new Error(`Key test returned HTTP ${response.status}. Check this key and provider quota.`);
        setMessage(`${provider} key accepted. Save settings to keep it.`);
      } finally { clearTimeout(timeout); }
    } catch (cause) { setMessage(cause instanceof Error ? cause.message : 'Provider could not be reached.'); }
    finally { setBusy(false); }
  }
  return <Workspace title="Your app, your settings" subtitle="Use your own free-tier accounts. Keys stay on each device and are never included in sync or sharing.">
    {message && <Message>{message}</Message>}
    <View style={ui.card}><Text style={ui.title}>Set up for class</Text><Text style={ui.body}>Microphone and camera permissions are requested when you use them. On Samsung, set Notes battery usage to Unrestricted and add it to Never sleeping apps.</Text>{Platform.OS === 'android' && <Button secondary onPress={() => void Linking.openSettings()}>Open Android app settings</Button>}<Link href="/timetable-edit" style={ui.link}>Review timetable & past holidays →</Link></View>
    {providers.map(provider => <View key={provider} style={ui.card}><Text style={ui.title}>{provider === 'gemini' ? 'Gemini' : provider === 'groq' ? 'Groq' : 'Tavily'}</Text><Field label={`${provider} API key`} value={keys[provider]} onChangeText={value => setKeys({ ...keys, [provider]: value })} secureTextEntry /><View style={ui.row}><Button disabled={busy || !loaded} secondary onPress={() => void test(provider)}>Test key</Button><Button secondary onPress={() => void Linking.openURL(keyLinks[provider])}>Get a free key</Button></View></View>)}
    <View style={ui.card}><Text style={ui.title}>Lecture processing</Text><Text style={ui.body}>Enabling processing sends saved lecture audio to Gemini while the app is open. Your provider’s free-tier terms apply. Drafts and notes stay marked for review until unresolved checks are completed.</Text><Button disabled={!loaded} secondary onPress={() => setSettings({ ...settings, enabled: !settings.enabled })}>{settings.enabled ? 'Processing enabled — tap to disable' : 'Processing disabled — tap to enable'}</Button><Field label="Draft models, comma separated" value={settings.draftModels.join(', ')} onChangeText={value => setSettings({ ...settings, draftModels: value.split(',').map(s => s.trim()) })} /><Field label="Independent draft model" value={settings.checkerModel} onChangeText={value => setSettings({ ...settings, checkerModel: value })} /><Field label="Notes and study model" value={settings.textModel} onChangeText={value => setSettings({ ...settings, textModel: value })} /><Field label="Draft requests per model per day" value={String(settings.dailyDraftLimit)} onChangeText={value => setSettings({ ...settings, dailyDraftLimit: Number(value) })} /><Field label="Study requests per model per day" value={String(settings.dailyTextLimit)} onChangeText={value => setSettings({ ...settings, dailyTextLimit: Number(value) })} /></View>
    <View style={ui.card}><Text style={ui.title}>Google Drive</Text><Text style={ui.body}>Add both client IDs from the same Google Cloud project when ready. Your files stay local until you connect Google.</Text><Field label="Google web client ID" value={webId} onChangeText={setWebId} /><Field label="Google Android client ID" value={androidId} onChangeText={setAndroidId} /><Link href="/sync" style={ui.link}>Open Drive sync →</Link></View>
    <Button disabled={busy || !loaded} onPress={() => void save()}>{busy ? 'Working…' : 'Save settings'}</Button>
    <View style={ui.card}><Text style={ui.title}>Usage on this device</Text><Text style={ui.body}>Requests are reserved before sending, including failures. Daily counters use Pacific time; activity outside this app also uses your provider quota.</Text>{usage.length ? usage.slice(0, 15).map(item => <Text key={item.id} style={ui.body}>{item.value.day} · {item.value.model}: {item.value.requests} requests · {item.value.tokens.toLocaleString()} reported tokens</Text>) : <Text style={ui.body}>No model requests yet.</Text>}</View>
  </Workspace>;
}

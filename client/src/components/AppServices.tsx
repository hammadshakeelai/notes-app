import { useEffect } from 'react';
import { AppState } from 'react-native';
import { initializeStore } from '@/data/store';
import { runQueueOnce } from '@/features/processing/engine';
import { importNativeRecordings } from '@/features/library/nativeImport';

export function AppServices() {
  useEffect(() => {
    let active = true;
    let timer: ReturnType<typeof setTimeout>;
    async function tick() {
      if (!active) return;
      try { if (AppState.currentState === 'active') { await initializeStore(); await importNativeRecordings(); await runQueueOnce(); } }
      catch { /* Screens expose storage and persisted job errors. Never log keys or lecture content. */ }
      finally { if (active) timer = setTimeout(tick, 15_000); }
    }
    void tick();
    return () => { active = false; clearTimeout(timer); };
  }, []);
  return null;
}

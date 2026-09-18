// Throwaway spike S1: stream audio to a Gemini Live model and collect what it writes.
// usage: node live_test.mjs <model> <audio.pcm (16 kHz mono s16le)> <speed x realtime> <out.json> [instruction]
import fs from 'node:fs';

const [model, pcmPath, speedArg, outPath, instruction] = process.argv.slice(2);
const env = Object.fromEntries(
  fs.readFileSync(new URL('../../.env', import.meta.url), 'utf8').split(/\r?\n/)
    .filter((l) => l.includes('=') && !l.startsWith('#')).map((l) => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()]),
);
const pcm = fs.readFileSync(pcmPath);
const speed = Number(speedArg);
const CHUNK = 16000 * 2; // 1 second of 16 kHz 16-bit mono
const url = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent?key=${env.GEMINI_API_KEY}`;

const events = { input: [], model: [], other: [] };
const t0 = Date.now();
const ws = new WebSocket(url);
const log = (...a) => console.log(`[${((Date.now() - t0) / 1000).toFixed(1)}s]`, ...a);
let sent = 0, lastMsg = Date.now(), finished = false;

function finish(reason) {
  if (finished) return;
  finished = true;
  const out = { model, speed, reason, seconds: (Date.now() - t0) / 1000, audioSeconds: pcm.length / CHUNK, ...events };
  fs.writeFileSync(outPath, JSON.stringify(out, null, 1));
  log(`done (${reason}); input-transcription pieces=${events.input.length}, model-text pieces=${events.model.length}, other=${events.other.length}`);
  try { ws.close(); } catch {}
  process.exit(0);
}

ws.onopen = () => {
  const setup = {
    model: `models/${model}`,
    generationConfig: { responseModalities: ['TEXT'] },
    inputAudioTranscription: {},
    ...(instruction ? { systemInstruction: { parts: [{ text: instruction }] } } : {}),
  };
  ws.send(JSON.stringify({ setup }));
  log('connected, setup sent');
};

ws.onmessage = async (e) => {
  lastMsg = Date.now();
  const text = typeof e.data === 'string' ? e.data : await e.data.text();
  const msg = JSON.parse(text);
  if (msg.setupComplete) {
    log('setup complete; streaming audio');
    const timer = setInterval(() => {
      if (sent >= pcm.length) {
        clearInterval(timer);
        ws.send(JSON.stringify({ realtimeInput: { audioStreamEnd: true } }));
        log('audio end sent');
        return;
      }
      const piece = pcm.subarray(sent, sent + CHUNK);
      sent += CHUNK;
      ws.send(JSON.stringify({ realtimeInput: { audio: { data: piece.toString('base64'), mimeType: 'audio/pcm;rate=16000' } } }));
    }, 1000 / speed);
    return;
  }
  const sc = msg.serverContent;
  if (sc?.inputTranscription?.text) events.input.push({ at: sent / CHUNK, text: sc.inputTranscription.text });
  const parts = sc?.modelTurn?.parts ?? [];
  for (const p of parts) if (p.text) events.model.push({ at: sent / CHUNK, text: p.text });
  if (!sc?.inputTranscription && !parts.length) events.other.push(Object.keys(msg).concat(sc ? Object.keys(sc) : []).join(','));
  if (msg.goAway || msg.error) log('server:', JSON.stringify(msg).slice(0, 300));
};

ws.onerror = (e) => { log('error', e.message ?? e); finish('error'); };
ws.onclose = (e) => { log(`closed code=${e.code} reason=${String(e.reason).slice(0, 300)}`); finish(`closed ${e.code}`); };
setInterval(() => { if (sent >= pcm.length && Date.now() - lastMsg > 20000) finish('idle after audio end'); }, 2000);
setTimeout(() => finish('timeout'), 15 * 60 * 1000);

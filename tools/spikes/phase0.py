"""Phase 0 spike (throwaway): compare free transcription + English translation
on real lecture excerpts. Standard library only. Keys come from the repo-root .env
(copy .env.example to .env and add your own keys).

  py -3 tools/spikes/phase0.py models                  # list Gemini models
  py -3 tools/spikes/phase0.py groq whisper-large-v3    # transcribe (original language)
  py -3 tools/spikes/phase0.py groq whisper-large-v3-turbo
  py -3 tools/spikes/phase0.py groq whisper-large-v3 --translate   # Whisper's own English
  py -3 tools/spikes/phase0.py gemini <model>           # Gemini: transcript + English in one pass
  py -3 tools/spikes/phase0.py translate <model> groq_whisper-large-v3   # Whisper text -> English via Gemini
  py -3 tools/spikes/phase0.py report                   # side-by-side report.md
"""
import base64, json, sys, time, urllib.error, urllib.request, uuid
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
# Audio, transcripts and results stay in the git-ignored private/ folder (ADR-0014).
DATA = REPO / "private" / "phase0"
EXCERPTS = DATA / "excerpts"
RESULTS = DATA / "results"
ENV_FILE = REPO / ".env"


def load_keys():
    keys = {}
    if ENV_FILE.exists():
        for line in ENV_FILE.read_text(encoding="utf-8").splitlines():
            if "=" in line and not line.strip().startswith("#"):
                k, v = line.split("=", 1)
                keys[k.strip()] = v.strip().strip('"')
    return keys


def need(keys, name):
    if not keys.get(name):
        sys.exit(f"Missing {name} in {ENV_FILE}")
    return keys[name]


def http(req, label):
    for attempt in range(3):
        try:
            with urllib.request.urlopen(req, timeout=600) as r:
                limits = {k: v for k, v in r.headers.items() if k.lower().startswith("x-ratelimit")}
                return json.loads(r.read().decode("utf-8")), limits
        except urllib.error.HTTPError as e:
            body = e.read().decode("utf-8", "replace")[:500]
            if e.code == 429 and attempt < 2:
                wait = int(float(e.headers.get("retry-after", "30")))
                print(f"  {label}: rate limited, waiting {wait}s ({body[:120]})")
                time.sleep(wait)
                continue
            sys.exit(f"  {label}: HTTP {e.code}: {body}")


def mmss(seconds):
    return f"{int(seconds) // 60:02d}:{int(seconds) % 60:02d}"


def excerpts():
    files = sorted(EXCERPTS.glob("*.mp3"))
    if not files:
        sys.exit(f"No excerpts in {EXCERPTS}")
    return files


# ---------- Groq Whisper ----------
def groq(model, translate=False):
    key = need(load_keys(), "GROQ_API_KEY")
    endpoint = "translations" if translate else "transcriptions"
    out = RESULTS / f"groq_{model}{'_translate' if translate else ''}"
    out.mkdir(parents=True, exist_ok=True)
    for f in excerpts():
        boundary = uuid.uuid4().hex
        fields = {"model": model, "response_format": "verbose_json", "temperature": "0"}
        body = b""
        for k, v in fields.items():
            body += f'--{boundary}\r\nContent-Disposition: form-data; name="{k}"\r\n\r\n{v}\r\n'.encode()
        body += (f'--{boundary}\r\nContent-Disposition: form-data; name="file"; filename="{f.name}"\r\n'
                 f"Content-Type: audio/mpeg\r\n\r\n").encode() + f.read_bytes() + f"\r\n--{boundary}--\r\n".encode()
        req = urllib.request.Request(
            f"https://api.groq.com/openai/v1/audio/{endpoint}", data=body, method="POST",
            headers={"Authorization": f"Bearer {key}", "Content-Type": f"multipart/form-data; boundary={boundary}",
                     "User-Agent": "notes-app-phase0"})
        t0 = time.time()
        data, limits = http(req, f.name)
        segs = [{"start": s["start"], "end": s["end"], "text": s["text"].strip()} for s in data.get("segments", [])]
        (out / f"{f.stem}.json").write_text(json.dumps(
            {"language": data.get("language"), "segments": segs, "rate_limits": limits}, ensure_ascii=False, indent=1),
            encoding="utf-8")
        print(f"  {f.name}: {len(segs)} segments, language={data.get('language')}, {time.time() - t0:.1f}s")
    print(f"  rate-limit headers (last call): {json.dumps(limits)}")


# ---------- Gemini ----------
SEGMENTS_SCHEMA = {"type": "ARRAY", "items": {"type": "OBJECT", "properties": {
    "start": {"type": "STRING"}, "original": {"type": "STRING"}, "english": {"type": "STRING"}},
    "required": ["start", "original", "english"]}}


def gemini_call(model, parts, key, schema=None, raw_path=None):
    config = {"responseMimeType": "application/json", "temperature": 0,
              "maxOutputTokens": 65536, "thinkingConfig": {"thinkingLevel": "low"}}
    if "transcribe" in model:
        del config["thinkingConfig"]
    if schema:
        config["responseSchema"] = schema
    payload = {"contents": [{"parts": parts}], "generationConfig": config}
    req = urllib.request.Request(
        f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent",
        data=json.dumps(payload).encode(), method="POST",
        headers={"x-goog-api-key": key, "Content-Type": "application/json"})
    data, _ = http(req, model)
    cand = data["candidates"][0]
    text = "".join(p.get("text", "") for p in cand["content"]["parts"])
    try:
        return json.loads(text), data.get("usageMetadata", {})
    except json.JSONDecodeError as e:
        if raw_path:
            raw_path.write_text(text, encoding="utf-8")
        sys.exit(f"  bad JSON ({e}); finishReason={cand.get('finishReason')}; raw saved to {raw_path}")


TRANSCRIBE_PROMPT = """This is a 10-minute excerpt of a university lecture (BS Artificial Intelligence),
recorded on a phone in a noisy classroom in Pakistan. The lecturer mixes English, Urdu and Pashto,
often inside one sentence. Transcribe everything that is said, in order, without summarising or skipping.
Return a JSON array of segments of roughly 10-30 seconds each:
[{"start": "MM:SS", "original": "<exactly as spoken; Urdu/Pashto in their own script, English as English>",
  "english": "<faithful English translation, keep technical terms>"}]
Write [unclear] for parts you cannot make out."""

TRANSLATE_PROMPT = """These are consecutive segments of a university lecture transcript (BS Artificial Intelligence).
The speech mixes English, Urdu and Pashto and the transcript may contain recognition errors.
Translate each segment into clear, faithful English. Keep technical terms. Fix obvious recognition
errors only when the meaning is clear from context; otherwise translate literally.
Return a JSON array: [{"id": <same id>, "english": "<translation>"}]

Segments:
"""


def gemini(model):
    key = need(load_keys(), "GEMINI_API_KEY")
    out = RESULTS / f"gemini_{model.replace('/', '_')}"
    out.mkdir(parents=True, exist_ok=True)
    for f in excerpts():
        if (out / f"{f.stem}.json").exists():
            print(f"  {f.name}: already done, skipping")
            continue
        t0 = time.time()
        audio = {"inline_data": {"mime_type": "audio/mp3", "data": base64.b64encode(f.read_bytes()).decode()}}
        segs, usage = gemini_call(model, [audio, {"text": TRANSCRIBE_PROMPT}], key,
                                  schema=SEGMENTS_SCHEMA, raw_path=out / f"{f.stem}.raw.txt")
        (out / f"{f.stem}.json").write_text(json.dumps({"segments": segs, "usage": usage}, ensure_ascii=False,
                                                       indent=1), encoding="utf-8")
        print(f"  {f.name}: {len(segs)} segments, {time.time() - t0:.1f}s, usage={usage}")


def translate(model, groq_dir):
    key = need(load_keys(), "GEMINI_API_KEY")
    src = RESULTS / groq_dir
    out = RESULTS / f"{groq_dir}__en_{model.replace('/', '_')}"
    out.mkdir(parents=True, exist_ok=True)
    for f in sorted(src.glob("*.json")):
        segs = json.loads(f.read_text(encoding="utf-8"))["segments"]
        lines = "\n".join(json.dumps({"id": i, "text": s["text"]}, ensure_ascii=False) for i, s in enumerate(segs))
        t0 = time.time()
        result, usage = gemini_call(model, [{"text": TRANSLATE_PROMPT + lines}], key)
        english = {r["id"]: r["english"] for r in result}
        merged = [{**s, "english": english.get(i, "")} for i, s in enumerate(segs)]
        (out / f.name).write_text(json.dumps({"segments": merged, "usage": usage}, ensure_ascii=False, indent=1),
                                  encoding="utf-8")
        print(f"  {f.name}: {len(merged)} segments translated, {time.time() - t0:.1f}s")


def models():
    key = need(load_keys(), "GEMINI_API_KEY")
    req = urllib.request.Request("https://generativelanguage.googleapis.com/v1beta/models?pageSize=200",
                                 headers={"x-goog-api-key": key})
    data, _ = http(req, "models")
    for m in data.get("models", []):
        if "generateContent" in m.get("supportedGenerationMethods", []):
            print(f"  {m['name'].removeprefix('models/'):45} {m.get('displayName', '')}")


# ---------- Caution loop: automatic checks ----------
import re, subprocess

ARABIC = re.compile(r"[؀-ۿ]")
ROMAN_URDU = set("""hai hain ho hota hoti hote tha thi the ko ka ki ke se mein mai main nahi nahin wo woh yeh ye
aur kya kyun kyon kaise kahan jab tab bhi toh to theek thik haan han acha achha agar lekin magar yaar ap aap apka
apki apke mera meri mere mujhe hum humne tum kar karo karna karta karte kiya gaya gayi raha rahe rahi wala wali
wale inko unko isko usko ki kuch sab bohat bahut abhi phir matlab yani""".split())


def roman_urdu_ratio(text):
    words = re.findall(r"[a-z]+", text.lower())
    return sum(w in ROMAN_URDU for w in words) / len(words) if len(words) >= 4 else 0.0


def duration(f):
    out = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(f)],
                         capture_output=True, text=True).stdout
    return float(out.strip())


def silences(f):
    err = subprocess.run(["ffmpeg", "-hide_banner", "-i", str(f), "-af", "silencedetect=n=-45dB:d=8", "-f", "null",
                          "-"], capture_output=True, text=True).stderr
    starts = [float(x) for x in re.findall(r"silence_start: ([\d.]+)", err)]
    ends = [float(x) for x in re.findall(r"silence_end: ([\d.]+)", err)]
    return list(zip(starts, ends))


def check_segments(segs, field, dur, quiet):
    issues = []
    if not segs:
        return ["no segments"]
    starts = [start_seconds(s) for s in segs]
    if starts[0] > 20:
        issues.append(f"starts late ({mmss(starts[0])})")
    if starts[-1] < dur - 45:
        issues.append(f"ends early (last {mmss(starts[-1])} of {mmss(dur)})")
    if any(b < a for a, b in zip(starts, starts[1:])):
        issues.append("timestamps go backwards")
    if any(t > dur + 5 for t in starts):
        issues.append("timestamps beyond the audio")
    for a, b in zip(starts, starts[1:]):
        if b - a > 60 and not any(qs <= a + 10 and qe >= b - 10 for qs, qe in quiet):
            issues.append(f"gap {mmss(a)}-{mmss(b)} with speech in it")
    texts = [str(s.get(field, "")).strip() for s in segs]
    if field == "english":
        n = sum(1 for t in texts if ARABIC.search(t))
        if n:
            issues.append(f"{n} segments not translated")
        n = sum(1 for t in texts if not t)
        if n:
            issues.append(f"{n} empty segments")
        n = sum(1 for t in texts if roman_urdu_ratio(t) > 0.25)
        if n:
            issues.append(f"{n}/{len(texts)} segments left in Roman Urdu")
    words = " ".join(texts).lower().split()
    grams = {}
    for i in range(len(words) - 5):
        g = " ".join(words[i:i + 6])
        grams[g] = grams.get(g, 0) + 1
    loops = [g for g, c in grams.items() if c >= 3]
    if loops:
        issues.append(f"repetition loop x{max(grams[g] for g in loops)}: \"{loops[0]}\"")
    return issues


def check():
    for f in excerpts():
        dur, quiet = duration(f), silences(f)
        print(f"\n{f.stem}  ({mmss(dur)}, {len(quiet)} silent stretches)")
        for d in sorted(x for x in RESULTS.iterdir() if x.is_dir()):
            p = d / f"{f.stem}.json"
            if not p.exists():
                continue
            data = json.loads(p.read_text(encoding="utf-8"))
            if "segments" not in data:
                continue
            segs = data["segments"]
            field = "english" if any("english" in s for s in segs) else "text"
            issues = check_segments(segs, field, dur, quiet)
            print(f"  {'OK  ' if not issues else 'FAIL'} {d.name}: {'; '.join(issues) if issues else 'passed'}")


VERIFY_PROMPT = """You are the quality checker for a lecture transcript. Listen to the WHOLE audio and compare it
with the draft transcript below (segments with start time, original text, English translation).
The lecture mixes English, Urdu and Pashto. Report only real problems:
- "missing": speech in the audio that the draft skipped
- "wrong": the draft's original or English does not match what was said
- "invented": text in the draft that was not said
- "untranslated": English field not actually in English
- "untranslated": English field left in Urdu script OR Roman Urdu (e.g. "wo khas fark nahi pada")
For each problem give the start time and the corrected original and English for that stretch.
fix_english MUST be fluent English. Never put Urdu, Pashto or Roman Urdu in fix_english.
If the draft is correct, return an empty list.

Draft:
"""

VERIFY_SCHEMA = {"type": "ARRAY", "items": {"type": "OBJECT", "properties": {
    "start": {"type": "STRING"}, "type": {"type": "STRING"},
    "fix_original": {"type": "STRING"}, "fix_english": {"type": "STRING"}},
    "required": ["start", "type", "fix_english"]}}


def verify(model, result_dir):
    key = need(load_keys(), "GEMINI_API_KEY")
    src = RESULTS / result_dir
    out = RESULTS / f"{result_dir}__verified_by_{model}"
    out.mkdir(parents=True, exist_ok=True)
    for f in excerpts():
        draft = json.loads((src / f"{f.stem}.json").read_text(encoding="utf-8"))["segments"]
        t0 = time.time()
        audio = {"inline_data": {"mime_type": "audio/mp3", "data": base64.b64encode(f.read_bytes()).decode()}}
        fixes, usage = gemini_call(model, [audio, {"text": VERIFY_PROMPT + json.dumps(draft, ensure_ascii=False)}],
                                   key, schema=VERIFY_SCHEMA, raw_path=out / f"{f.stem}.raw.txt")
        (out / f"{f.stem}.json").write_text(json.dumps({"fixes": fixes, "usage": usage}, ensure_ascii=False,
                                                       indent=1), encoding="utf-8")
        kinds = {}
        for x in fixes:
            kinds[x.get("type")] = kinds.get(x.get("type"), 0) + 1
        print(f"  {f.name}: {len(fixes)} problems found {kinds}, {time.time() - t0:.1f}s")


# ---------- Report ----------
def start_seconds(s):
    v = s.get("start", 0)
    if isinstance(v, str) and ":" in v:
        m, sec = v.split(":")[-2:]
        return int(m) * 60 + float(sec)
    return float(v)


def report():
    lines = ["# Phase 0 report (private)", "",
             "Each table shows the same minute of lecture from every method. Read the English columns and judge: "
             "could you follow the lecture from this?", ""]
    methods = sorted(d for d in RESULTS.iterdir() if d.is_dir()) if RESULTS.exists() else []
    for f in excerpts():
        lines += [f"## {f.stem}", ""]
        columns = []
        for d in methods:
            p = d / f"{f.stem}.json"
            if not p.exists():
                continue
            data = json.loads(p.read_text(encoding="utf-8"))
            field = "english" if any("english" in s for s in data["segments"]) else "text"
            by_minute = {}
            for s in data["segments"]:
                by_minute.setdefault(int(start_seconds(s) // 60), []).append(str(s.get(field, "")).replace("|", "/"))
            columns.append((f"{d.name} ({field})", by_minute))
        if not columns:
            lines += ["_no results yet_", ""]
            continue
        lines.append("| min | " + " | ".join(c[0] for c in columns) + " |")
        lines.append("|---" * (len(columns) + 1) + "|")
        for minute in range(0, 11):
            row = [" ".join(c[1].get(minute, [])) for c in columns]
            if any(row):
                lines.append(f"| {minute} | " + " | ".join(row) + " |")
        lines.append("")
    (DATA / "report.md").write_text("\n".join(lines), encoding="utf-8")
    print(f"  wrote {DATA / 'report.md'}")


if __name__ == "__main__":
    args = sys.argv[1:]
    if not args:
        sys.exit(__doc__)
    cmd = args[0]
    if cmd == "groq":
        groq(args[1], translate="--translate" in args)
    elif cmd == "gemini":
        gemini(args[1])
    elif cmd == "translate":
        translate(args[1], args[2])
    elif cmd == "models":
        models()
    elif cmd == "report":
        report()
    elif cmd == "check":
        check()
    elif cmd == "verify":
        verify(args[1], args[2])
    else:
        sys.exit(__doc__)

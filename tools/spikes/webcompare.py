"""Throwaway: how close can the free API get to the Gemini website transcript?

  py -3 tools/spikes/webcompare.py run <model> <label> [thinking]   # thinking: low|medium|high
  py -3 tools/spikes/webcompare.py score
"""
import base64, difflib, json, re, sys, time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
import phase0 as p

HERE = p.DATA / "webcompare"  # private: the call excerpt and its reference transcript
AUDIO = HERE / "meeting_00-10.mp3"
REF = HERE / "web_reference.txt"

WEB_STYLE_PROMPT = """Transcribe this audio verbatim, like a careful professional transcriber.
The speakers are Pakistani and switch between Urdu, English and sometimes Pashto inside sentences.
Rules:
- Write Urdu, Hindi and Pashto speech in Roman Urdu (Latin letters), the way Pakistanis text,
  e.g. "Kese hai aap?", "Shukar hai, theek hai", "aap ne kya kiya?". Never use Urdu or Arabic script.
- Keep English words and sentences exactly as spoken, in English.
- One segment per speaker turn: start a new segment whenever the speaker changes. Split long turns
  at sentence ends, roughly every 30 seconds.
- Keep every word, including short replies such as "Jee jee", "Achha", "Haan". Do not summarise,
  skip, merge or improve what was said.
- Spell names, companies, brands, places, courses and technical terms correctly.
- Use normal punctuation.
For each segment give: start (MM:SS), speaker ("Speaker 1", "Speaker 2", ... or the person's name once
it is said), original (the Roman Urdu / English text as above), english (a faithful, fluent English translation)."""

SCHEMA = {"type": "ARRAY", "items": {"type": "OBJECT", "properties": {
    "start": {"type": "STRING"}, "speaker": {"type": "STRING"},
    "original": {"type": "STRING"}, "english": {"type": "STRING"}},
    "required": ["start", "speaker", "original", "english"]}}


import os


def run(model, label, thinking="low"):
    key = p.need(p.load_keys(), "GEMINI_API_KEY")
    audio = {"inline_data": {"mime_type": "audio/mp3", "data": base64.b64encode(AUDIO.read_bytes()).decode()}}
    orig = p.gemini_call
    # same call as phase0, but with a chosen thinking level
    import urllib.request
    thinking_config = {"thinkingBudget": 1024} if model.startswith("gemini-2.5") else {"thinkingLevel": thinking}
    config = {"responseMimeType": "application/json", "temperature": 0, "maxOutputTokens": 65536,
              "responseSchema": SCHEMA, "thinkingConfig": thinking_config}
    context = os.environ.get("CONTEXT")
    prompt = WEB_STYLE_PROMPT + (f"\n\nContext (use it to spell names and terms correctly): {context}" if context else "")
    payload = {"contents": [{"parts": [audio, {"text": prompt}]}], "generationConfig": config}
    req = urllib.request.Request(
        f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent",
        data=json.dumps(payload).encode(), method="POST",
        headers={"x-goog-api-key": key, "Content-Type": "application/json"})
    t0 = time.time()
    data, _ = p.http(req, model)
    cand = data["candidates"][0]
    text = "".join(x.get("text", "") for x in cand["content"]["parts"])
    try:
        segs = json.loads(text)
    except json.JSONDecodeError as e:
        (HERE / f"{label}.raw.txt").write_text(text, encoding="utf-8")
        sys.exit(f"bad JSON: {e}; finishReason={cand.get('finishReason')}")
    (HERE / f"{label}.json").write_text(json.dumps({"segments": segs, "usage": data.get("usageMetadata")},
                                                   ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"{label}: {len(segs)} segments, {time.time() - t0:.0f}s, usage={data.get('usageMetadata')}")


CHECK_PROMPT = """You are the quality checker. Listen to the WHOLE audio and compare it with the draft transcript below.
Report only real problems: missing speech, wrong words (e.g. a misheard word or name), invented text,
or English that does not match. For each problem give the segment start time and the corrected
"fix_original" (Roman Urdu / English exactly as spoken - never Urdu script) and "fix_english" (fluent English).
If the draft is correct, return an empty list.

Draft:
"""

FIX_SCHEMA = {"type": "ARRAY", "items": {"type": "OBJECT", "properties": {
    "start": {"type": "STRING"}, "fix_original": {"type": "STRING"}, "fix_english": {"type": "STRING"}},
    "required": ["start", "fix_original", "fix_english"]}}


def loop(src_label, out_label, checker="gemini-3.5-flash"):
    key = p.need(p.load_keys(), "GEMINI_API_KEY")
    segs = json.loads((HERE / f"{src_label}.json").read_text(encoding="utf-8"))["segments"]
    audio = {"inline_data": {"mime_type": "audio/mp3", "data": base64.b64encode(AUDIO.read_bytes()).decode()}}
    t0 = time.time()
    context = os.environ.get("CONTEXT")
    prompt = CHECK_PROMPT.replace("Draft:", (f"Context (use it to spell names and terms correctly): {context}" + chr(10) + chr(10)
                                             if context else "") + "Draft:")
    fixes, usage = p.gemini_call(checker, [audio, {"text": prompt + json.dumps(segs, ensure_ascii=False)}], key,
                                 schema=FIX_SCHEMA, raw_path=HERE / f"{out_label}.raw.txt")
    applied = rejected = 0
    for x in fixes:
        o, e = x.get("fix_original", "").strip(), x.get("fix_english", "").strip()
        if not o or not e or p.ARABIC.search(o + e) or p.roman_urdu_ratio(e) > 0.25:
            rejected += 1
            continue
        t = p.start_seconds(x)
        i = min(range(len(segs)), key=lambda k: abs(p.start_seconds(segs[k]) - t))
        segs[i] = {**segs[i], "original": o, "english": e}
        applied += 1
    (HERE / f"{out_label}.json").write_text(json.dumps({"segments": segs, "fixes": fixes}, ensure_ascii=False,
                                                       indent=1), encoding="utf-8")
    print(f"{out_label}: checker found {len(fixes)}, applied {applied}, rejected {rejected}, {time.time() - t0:.0f}s")


def words(text):
    return re.findall(r"[a-z0-9]+", text.lower())


def score():
    ref_words = words(REF.read_text(encoding="utf-8"))
    for f in sorted(HERE.glob("*.json")):
        data = json.loads(f.read_text(encoding="utf-8"))
        if "segments" not in data or f.stem.startswith("pai_full"):
            continue
        segs = data["segments"]
        hyp = words(" ".join(s["original"] for s in segs))
        # find how far into the reference this 10-minute excerpt reaches, then compare against that span
        sm = difflib.SequenceMatcher(None, ref_words[:len(hyp) * 2], hyp, autojunk=False)
        blocks = [b for b in sm.get_matching_blocks() if b.size >= 3]
        end = blocks[-1].a + blocks[-1].size if blocks else len(hyp)
        ref_span = ref_words[:end]
        sm2 = difflib.SequenceMatcher(None, ref_span, hyp, autojunk=False)
        matched = sum(b.size for b in sm2.get_matching_blocks())
        arabic = sum(1 for s in segs if p.ARABIC.search(s["original"]))
        speakers = len({s.get("speaker") for s in segs})
        print(f"{f.stem:28} words={len(hyp):5}  ref_span={len(ref_span):5}  "
              f"match_vs_web={matched / max(len(ref_span), 1):.0%}  segments={len(segs):3}  "
              f"speakers={speakers}  urdu_script_segments={arabic}")


if __name__ == "__main__":
    if sys.argv[1] == "run":
        run(sys.argv[2], sys.argv[3], *(sys.argv[4:5] or []))
    elif sys.argv[1] == "loop":
        loop(sys.argv[2], sys.argv[3], *(sys.argv[4:5] or []))
    elif sys.argv[1] == "score":
        score()

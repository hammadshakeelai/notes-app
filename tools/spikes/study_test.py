"""Throwaway: can free models turn a transcript into good notes, flashcards and grading?"""
import json, re, sys, time, urllib.error, urllib.request
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
import phase0 as p

KEY = p.load_keys()["GEMINI_API_KEY"]
HERE = p.DATA / "webcompare"  # private: transcripts from the earlier tests
segs = json.loads((HERE / "s2_pai_gemini-3.1-flash-lite.json").read_text(encoding="utf-8"))["segments"]
transcript = "\n".join(f"[{s['start']}] {s.get('speaker', '')}: {s['english']}" for s in segs)

STUDY_PROMPT = """You are making study material from a university lecture transcript (Programming for AI, BS AI).
Use ONLY what the lecture says. Return JSON with:
- "summary": 3-5 sentences
- "key_concepts": list of short strings
- "notes_markdown": clean study notes in Markdown with headings and bullet points
- "flashcards": exactly 8 cards, each {"type": "qa" or "cloze", "front", "back", "source_start": "MM:SS" of the transcript line it comes from}.
  One fact per card; include "why/how" questions, not only definitions; cloze cards use {{...}} around the hidden words.

Transcript:
"""

SCHEMA = {"type": "OBJECT", "properties": {
    "summary": {"type": "STRING"}, "key_concepts": {"type": "ARRAY", "items": {"type": "STRING"}},
    "notes_markdown": {"type": "STRING"},
    "flashcards": {"type": "ARRAY", "items": {"type": "OBJECT", "properties": {
        "type": {"type": "STRING"}, "front": {"type": "STRING"}, "back": {"type": "STRING"}, "source_start": {"type": "STRING"}},
        "required": ["type", "front", "back", "source_start"]}}},
    "required": ["summary", "key_concepts", "notes_markdown", "flashcards"]}


def call(model, prompt, schema=None):
    config = {"temperature": 0.2, "maxOutputTokens": 16000}
    if schema:
        config.update(responseMimeType="application/json", responseSchema=schema)
    body = {"contents": [{"parts": [{"text": prompt}]}], "generationConfig": config}
    req = urllib.request.Request(f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent",
                                 data=json.dumps(body).encode(), method="POST",
                                 headers={"x-goog-api-key": KEY, "Content-Type": "application/json"})
    t0 = time.time()
    try:
        with urllib.request.urlopen(req, timeout=300) as r:
            data = json.loads(r.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        return None, f"HTTP {e.code}: {e.read().decode('utf-8', 'replace')[:160]}", time.time() - t0
    text = "".join(x.get("text", "") for x in data["candidates"][0]["content"]["parts"])
    return text, data.get("usageMetadata", {}), time.time() - t0


def parse_json(text):
    text = re.sub(r"^```(?:json)?\s*|\s*```$", "", text.strip())
    return json.loads(text)


starts = {s["start"] for s in segs}
for model, use_schema in [("gemini-3.5-flash-lite", True), ("gemma-4-31b-it", True), ("gemma-4-31b-it", False)]:
    prompt = STUDY_PROMPT + transcript
    if not use_schema:
        prompt += "\n\nReply with the JSON object only, no other text."
    text, usage, secs = call(model, prompt, SCHEMA if use_schema else None)
    label = f"{model} ({'schema' if use_schema else 'plain JSON'})"
    if text is None:
        print(f"{label}: {usage}")
        continue
    try:
        out = parse_json(text)
    except Exception as e:
        print(f"{label}: {secs:.0f}s, invalid JSON ({e})")
        continue
    cards = out.get("flashcards", [])
    valid_src = sum(c.get("source_start") in starts for c in cards)
    cloze_ok = sum("{{" in c["front"] for c in cards if c.get("type") == "cloze")
    n_cloze = sum(c.get("type") == "cloze" for c in cards)
    why_how = sum(bool(re.match(r"\s*(why|how)\b", c["front"], re.I)) for c in cards)
    (HERE / f"study_{model}_{'schema' if use_schema else 'plain'}.json").write_text(json.dumps(out, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"{label}: {secs:.0f}s | cards={len(cards)} (cloze {n_cloze}, well-formed {cloze_ok}; why/how {why_how}) | "
          f"source times valid {valid_src}/{len(cards)} | concepts={len(out.get('key_concepts', []))} | "
          f"notes {len(out.get('notes_markdown', '').split())} words")

# Grading an "explain in your own words" answer (synthetic answer, not from the lecture)
grade_prompt = ("Grade a student's answer against the lecture excerpt. Return JSON {\"score\": 0, 1 or 2, \"feedback\": one or two sentences}.\n"
                "Question: What is the difference between an absolute and a relative path?\n"
                "Student answer: An absolute path starts from the root, a relative path starts from the folder you are in.\n"
                "Lecture excerpt:\n" + transcript[:3000] + "\n\nReply with the JSON object only.")
text, usage, secs = call("gemma-4-31b-it", grade_prompt)
print(f"grading (gemma-4-31b-it): {secs:.0f}s ->", (text or usage)[:220].replace("\n", " "))

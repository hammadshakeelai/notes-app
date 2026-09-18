"""Re-run the tests embedded in an implementation plan, without installing anything.

Extracts every "Create `client/src/…ts`:" code block from the plan into a temporary folder and runs the
Jest-style tests with run-jest-shim.mjs under Node's built-in TypeScript support (Node 22.6+ / 24).
This checks behaviour only; strict type checking happens when the plan is executed (`npm run typecheck`).

  py -3 tools/spikes/verify_plan.py docs/superpowers/plans/2026-09-18-m1-domain-core.md
"""
import re
import subprocess
import sys
import tempfile
from pathlib import Path

BLOCK = re.compile(r"Create `client/(src/[^`]+\.ts)`:\s*\n\s*```ts\n(.*?)\n```", re.DOTALL)


def main(plan_path: str) -> int:
    plan = Path(plan_path).read_text(encoding="utf-8")
    files = BLOCK.findall(plan)
    if not files:
        sys.exit(f"No code blocks found in {plan_path}")
    with tempfile.TemporaryDirectory() as tmp:
        for rel, code in files:
            target = Path(tmp) / rel
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_text(code + "\n", encoding="utf-8")
        print(f"extracted {len(files)} files from {plan_path}")
        shim = Path(__file__).parent / "run-jest-shim.mjs"
        return subprocess.run(["node", str(shim), str(Path(tmp) / "src"), str(Path(tmp) / "run" / "src")]).returncode


if __name__ == "__main__":
    sys.exit(main(sys.argv[1] if len(sys.argv) > 1 else "docs/superpowers/plans/2026-09-18-m1-domain-core.md"))

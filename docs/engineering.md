# Engineering conventions

How this project is built. Short on purpose: when a rule stops helping, change it here with a commit that says why.

## Repository layout

```
notes-app/
├─ client/                Expo app (Android + web), created in Milestone 1
│  ├─ app/                screens (Expo Router)
│  ├─ src/domain/         pure TypeScript logic: timetable, numbering, checks (no React, no I/O)
│  ├─ src/data/           storage and sync adapters
│  └─ modules/recorder/   custom Kotlin recorder module (Milestone 2)
├─ docs/
│  ├─ specs/              requirements and design (the source of truth for "what")
│  ├─ adr/                architecture decision records (the source of truth for "why")
│  ├─ superpowers/plans/  implementation plans, one per milestone or sub-milestone
│  ├─ roadmap.md          milestones, exit criteria, requirement traceability
│  ├─ project-log.md      dated log of what happened
│  └─ phase0-findings.md  spike results
├─ private/               git-ignored: timetable with names, recordings, transcripts, spike scripts
└─ .env.example           template for your own API keys (.env is git-ignored)
```

## Workflow

- **Trunk-based.** `main` always builds and passes tests. Work happens on short-lived branches (`feat/…`, `fix/…`, `docs/…`, `spike/…`), merged through a pull request.
- **One plan task = one commit or a small group of commits.** Each commit leaves the tests passing.
- **Commit messages** follow [Conventional Commits](https://www.conventionalcommits.org): `feat:`, `fix:`, `test:`, `docs:`, `chore:`, `refactor:`. The body says *why*.
- **Pull requests** link the plan task and the requirement IDs (e.g. `R-NUM-1`), and must pass CI.
- **Versioning:** `0.x.y` until the app is used daily. Each milestone ends with a tag (`v0.1.0` = Milestone 1).

## Definition of Ready (before a task starts)

- The requirement IDs it implements exist in the spec.
- Its plan task names the files, the interfaces it consumes and produces, and the tests.
- Any external unknown (model quality, API behaviour) has been settled by a spike.

## Definition of Done (before a task is merged)

- Tests written first and passing (TDD for all logic in `src/domain/`).
- Type check (`npx tsc --noEmit`) and lint clean.
- No secrets, personal names or lecture content in the diff (see Security and privacy).
- Docs updated if behaviour or a decision changed (spec, ADR, or log).
- CI green on the pull request.

## Testing strategy

| Level | What | Where | When |
| --- | --- | --- | --- |
| Unit | Pure domain logic: timetable, numbering, naming, caution-loop checks, sync merge rules, FSRS wrapper | `client/src/**/__tests__` (Jest) | Every commit, CI |
| Integration | Processing queue and sync engine against fake providers and a fake Drive | `client/src/**/__tests__` | Every commit, CI |
| Device | Recorder behaviour on the S23 Ultra: screen off, swipe-away, call, reboot, battery drain | Checklist in the Milestone 2 plan | Before each release tag |
| Spike | Model quality and free limits on real lectures | `private/` scripts, results in `docs/` | Before the milestone that depends on it |

Test data built from real lectures stays in `private/`. Committed fixtures are synthetic or anonymised.

## Security and privacy

- Never commit: API keys, `.env`, OAuth client secrets, recordings, transcripts, teacher names, rooms.
- Before every push, run the history scan:

  ```bash
  git grep -n -E "gsk_[A-Za-z0-9]{10}|AIza[0-9A-Za-z_-]{20}|tvly-[A-Za-z0-9]{10}" $(git rev-list --all)
  ```

  Expected: no output.
- Then check that no teacher name or room from the private timetable appears anywhere in the repo. The terms are read from the private file, so they are never written into the repo themselves:

  ```bash
  cut -s -d'|' -f6,7 private/timetable.md | tr '|(),' '\n\n\n\n' | sed 's/^ *//; s/ *$//; s/^replaced //' \
    | grep -v -i -E '^(teacher|room|-+|.{0,3}|[0-9a-z]+ floor|sept [0-9]{4})$' | sort -u > /tmp/private-terms.txt
  git grep -l -i -F -f /tmp/private-terms.txt --untracked -- . ':!private' ':!.remember' && echo "LEAK: fix before pushing"
  rm -f /tmp/private-terms.txt
  ```

  Expected: no output. It reads teacher names and room codes, including text in brackets, from the private file. Any file it lists contains one of them.
- The app uses its own dedicated Google Cloud project. It never uses several projects or accounts to stretch free limits (ADR-0007).

## CI

GitHub Actions, added in Milestone 1 Task 1: on every push and pull request, `npm ci`, type check, lint and Jest, run in `client/`.

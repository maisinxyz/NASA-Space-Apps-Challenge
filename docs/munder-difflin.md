# Running Stardew Earth work with Munder Difflin (optional dev tool)

[Munder Difflin](https://github.com/HarnessMD/munder-difflin) is a desktop app (Electron, MIT) that
runs several coding-agent CLIs (Claude Code, Codex, Gemini CLI, …) side by side. Each agent gets its
own terminal, long-term memory and a mailbox. An orchestrator agent ("Michael", the GOD agent) routes
work between them and escalates to you only when it needs a human.

We use it **only as a dev workflow tool** to run implementation-plan prompts in parallel. It is not
part of the Stardew Earth product, nothing from it ships in `apps/` or `services/`, and nobody on the team
is required to use it. Plain Claude Code sessions following `CLAUDE.md` remain the default.

Sources: repo README, `HIVE.md` and `TELEMETRY.md` at
<https://github.com/HarnessMD/munder-difflin> (read 2026-11-14; README says v0.5.6, latest GitHub release is v0.5.5).

## How it maps onto our plan

`implementation-plan/README.md` already has the same structure as a Munder Difflin office:

| Our role (implementation-plan) | Munder Difflin seat | Works in | Reads first |
| --- | --- | --- | --- |
| Integrator (owns contract, keeps sides compatible) | GOD agent (Michael) | repo root, read-mostly | `implementation-plan/README.md`, `contract-request-v1.1.md` |
| Section 1: web experience / 3D UI | agent `s1-web` | own worktree, edits `apps/web/` | `section-1-web-experience-3d-ui/Prompts.md` + `progress.md` |
| Section 2: NASA data / algorithm | agent `s2-data` | own worktree, edits `services/api/`, `data/seed/`, `scripts/` | `section-2-nasa-data-algorithm/Prompts.md` + `PRD.md` |
| (optional) Verifier | agent `verifier` | own worktree, no feature edits | `CLAUDE.md` end-of-task checklist |

One agent per section. Don't run two agents on the same section: the prompts are sequential and
build on each other's `progress.md` entries.

## Setup (once per machine)

1. Install the app from the [download page](https://harnessmd.com/download) (signed macOS build),
   or from the [GitHub releases](https://github.com/HarnessMD/munder-difflin/releases). You need at
   least one agent CLI on your `PATH`. We use `claude`.
2. Finish the onboarding wizard. The GOD agent seats itself in Michael's office.
3. Turn on **per-agent git worktrees** so agents never share a checkout (see *Git rules* below).
4. Use **Add agent** for each seat in the table above. Set the working directory to this repo and
   paste the matching role brief below into the role field.

Core features are free and open source. Pro features (Capabilities, agent files, Stapler) are paid
since 2026-10-24. We don't need them.

## Rules that still apply (CLAUDE.md wins)

Every agent is an ordinary Claude Code session in this repo, so it loads `CLAUDE.md`
automatically. If anything in Munder Difflin's protocol conflicts with `CLAUDE.md`, `CLAUDE.md`
wins. In particular:

- **"STOP and ask the user" means escalate to a human.** Missing contract fields, contract changes,
  `verify` facts the agent can't confirm, and scope questions go to Michael *and* Michael must
  surface them to you. He must not resolve them himself.
- **Contract changes** (`packages/contracts/openapi.yaml`) are made only by the integrator seat,
  after a human approves. Section agents send a request message instead of editing the contract.
- **Scope:** one prompt at a time. An agent finishes its prompt, writes its progress entry, then
  waits for Michael or you before starting the next one.
- **Honesty rules** (basis labels, relative not predictive, Pre-built and mock badges) are not
  negotiable by any agent.

## Git rules for parallel agents

The plan says commit directly to `main`. Two agents in one checkout would fight over the git
index, so give each agent its own worktree and have it publish to `main`:

```bash
git pull --rebase origin main          # before starting a prompt
# … work, small commits with the prompt ID, e.g. "S1-07: …" …
git pull --rebase origin main && git push origin HEAD:main
```

- Only push when `make test` (and `pnpm build` for web changes) pass in that worktree.
- Pushing to the shared remote is a human-approved step. Leave Claude Code's permission prompt on
  for `git push`, and approve it from the app (or from your phone via remote control).
- Munder Difflin's own hive (memory, mailboxes, task ledger) lives in the app's home directory,
  **not** in this repo. It writes per-agent hooks to `<cwd>/.claude/settings.local.json`, which is
  gitignored here. Never commit it.

## Role briefs (paste into "Add agent")

### Michael / GOD: integrator

```
You are the Stardew Earth integrator. Read CLAUDE.md, implementation-plan/README.md and
implementation-plan/contract-request-v1.1.md. You do not write feature code.
Job: hand each section agent its next prompt from its section's Prompts.md, one at a time, in order;
check that every finished prompt has a progress entry and that `make test` passed; keep the
"Interfaces" table in implementation-plan/README.md current.
Escalate to the human, never decide yourself: any openapi.yaml / contract change, any external API
URL, dataset, constant or license that is not already verified in the repo, any scope change, any
destructive git operation, and any request to push to main that has failing tests.
```

### `s1-web`: Section 1, web experience / 3D UI

```
You are the Section 1 (web / 3D UI) agent for Stardew Earth. Follow CLAUDE.md exactly.
Read implementation-plan/section-1-web-experience-3d-ui/PRD.md, Prompts.md and progress.md, and only
the files the current prompt lists. Work only in apps/web/ unless the prompt says otherwise.
Build against fixtures (NEXT_PUBLIC_API_MODE=mock). If you need a field or endpoint that is not in
packages/contracts/openapi.yaml, STOP and message the integrator; do not invent it.
Do one prompt, run pnpm lint / typecheck / test / build, append to progress.md, then report done and wait.
```

### `s2-data`: Section 2, NASA data / algorithm

```
You are the Section 2 (NASA data / algorithm) agent for Stardew Earth. Follow CLAUDE.md exactly.
Read implementation-plan/section-2-nasa-data-algorithm/PRD.md and Prompts.md, implementation-plan/
Databases.md for datasets, and only the files the current prompt lists. Work in services/api/,
data/seed/ and scripts/. Every external URL, parameter, dataset or license must be verified with a
source URL in a comment, or marked TODO(verify) and reported to the integrator.
Outputs must match packages/contracts/openapi.yaml shapes; if they can't, STOP and message the integrator.
Keep OFFLINE=1 working and outputs deterministic. Do one prompt, run make test, write the progress
note, then report done and wait.
```

### `verifier` (optional)

```
You are the Stardew Earth verifier. You do not write feature code. When the integrator tells you a prompt
is done, pull main, run make test, pnpm lint / typecheck / build in apps/web, and OFFLINE=1 make dev
smoke checks. Check the prompt's acceptance criteria and the CLAUDE.md honesty rules. Report pass/fail
with the command output to the integrator. Never fix things yourself; report them.
```

## Licensing and privacy notes

- App source is MIT. Its bundled pixel-art tilesets are LimeZu assets under a separate license that
  requires credit. We copy **nothing** from that repo into ours, so no attribution is needed in
  Stardew Earth's dataset/license list.
- The app sends anonymous usage events (app version, OS, provider name, counts). It never sends
  message content. The full list is in its `TELEMETRY.md`.
- Agents run with your own Claude subscription and its limits. Running 3 or 4 at once uses quota
  roughly 3 to 4 times as fast.

# Codex Session Recovery

Read-only Codex session recovery scanner plus an installable Codex Skill.

It helps diagnose cases where old Codex threads exist on disk but are hidden,
missing from the app, or fail to resume because provider metadata/config changed.

## What It Does

- Scans `CODEX_HOME` or `~/.codex`.
- Indexes `sessions/**/*.jsonl` and `archived_sessions/**/*.jsonl`.
- Reads `config.toml` provider definitions.
- Detects missing provider definitions and provider mismatch risks.
- Flags sessions containing `encrypted_content`.
- Generates Markdown and JSON reports.
- Installs a reusable `codex-session-recovery` Skill for future Codex runs.

The scanner is read-only. It does not edit JSONL files, SQLite, or `config.toml`.

## Quick Start

Run directly from a local clone:

```bash
node bin/codex-session-recovery.mjs \
  --out codex-session-recovery-report.md \
  --json-out codex-session-recovery-report.json
```

Filter by keyword:

```bash
node bin/codex-session-recovery.mjs --keyword my-project --out report.md
```

Use another Codex home:

```bash
node bin/codex-session-recovery.mjs --codex-home /path/to/.codex --out report.md
```

## Install the Codex Skill

From the repo root:

```bash
npm run install-skill
```

This copies `skills/codex-session-recovery` to:

```text
${CODEX_HOME:-~/.codex}/skills/codex-session-recovery
```

Then in a new Codex conversation, ask:

```text
Use codex-session-recovery to recover missing Codex threads.
```

## Working With codex-provider-sync

This project diagnoses provider mismatch issues. It does not silently download
or run external repair tools.

If you use `codex-provider-sync`, pass its local path so the report can record
whether the CLI is present:

```bash
node bin/codex-session-recovery.mjs \
  --provider-sync-dir /path/to/codex-provider-sync \
  --out report.md
```

If the report says provider metadata needs syncing, inspect and back up before
running any write operation.

## Windows

PowerShell examples:

```powershell
node .\bin\codex-session-recovery.mjs --out .\report.md
npm run install-skill
```

The scanner uses Node built-ins only and supports macOS, Windows, and Linux.

## Safety Notes

- Do not publish generated reports if they contain private prompts, paths, or session IDs.
- Do not edit raw `.jsonl` conversation files by hand.
- Back up `~/.codex` before running any external tool that mutates sessions, SQLite, or config.
- `encrypted_content` can still fail to continue across provider/account boundaries even after visibility is restored.

## Development

```bash
npm run check
node bin/codex-session-recovery.mjs --help
```

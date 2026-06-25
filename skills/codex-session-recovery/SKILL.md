---
name: codex-session-recovery
description: Recover hidden, missing, or unloadable Codex threads by inspecting ~/.codex sessions, archived_sessions, SQLite state, config.toml, model_provider metadata, and provider definitions. Use when Codex App cannot find old conversations, a thread cannot resume, config.toml reports a missing provider, or the user wants to restore Codex history from local session records.
---

# Codex Session Recovery

## Purpose

Restore Codex thread visibility and resumability from local state. Treat Markdown notes as clues only; the source of truth is `~/.codex/sessions`, `~/.codex/archived_sessions`, `~/.codex/sqlite/state_5.sqlite`, and `~/.codex/config.toml`.

## Workflow

1. Query memory for prior recovery operations and known backup paths.
2. Read any user-provided notes only as search hints: project names, dates, cwd values, session IDs, and keywords.
3. Run the bundled Node recovery runner first:

```bash
node scripts/recovery-runner.mjs --out codex-session-recovery-report.md --json-out codex-session-recovery-report.json
```

Use `--keyword <text>` to narrow the scan. Use `--codex-home <dir>` when `CODEX_HOME` is not the target Codex directory. The runner is read-only: it scans sessions, config, provider definitions, encrypted content, and optional `codex-provider-sync` location, then writes a diagnosis report.

4. If the runner is unavailable, locate raw session records manually:

```bash
find ~/.codex/sessions ~/.codex/archived_sessions -type f -name '*.jsonl'
```

5. Build a compact index from each JSONL file:
   - `session_meta.payload.id` or `session_id`
   - `timestamp`
   - `cwd`
   - `model_provider`
   - first meaningful user message
   - last meaningful user message

6. Search Codex App threads with `list_threads`; verify targets with `read_thread`.
7. If raw JSONL exists but App search cannot find it, inspect provider metadata with `codex-provider-sync status`.
8. If `codex-provider-sync` is missing, ask before cloning it. Do not download dependencies silently.
9. If current provider differs from old session metadata, run `codex-provider-sync sync` after confirming it will back up `~/.codex`.
10. If thread loading fails with `Model provider <name> not found`, restore the missing `[model_providers.<name>]` block from a backup `config.toml` or ask the user for the provider definition.
11. Re-run `list_threads` and `read_thread` for the target session IDs.
12. Write a short recovery index document with session IDs, file paths, backup paths, and remaining risks.

## Safety Rules

- Never edit message bodies in JSONL files.
- Always create or confirm a backup before writing to `~/.codex/config.toml`, SQLite, or session metadata.
- Use escalation for commands that read or write `~/.codex/sqlite` or mutate `~/.codex`.
- Keep the Node runner read-only unless the user explicitly asks for a write/apply mode.
- Do not assume Markdown notes are complete history; they are only navigation aids.
- Preserve the user's current default provider unless explicitly asked to switch it.
- Warn when `encrypted_content` is present: visibility can be restored, but continuing or compacting cross-provider histories may fail with `invalid_encrypted_content`.

## Diagnosis Map

| Symptom | Likely cause | Fix |
| --- | --- | --- |
| Raw `.jsonl` exists but App search cannot find it | `model_provider` mismatch between sessions/SQLite and current provider | Run `codex-provider-sync status`, then `sync` if appropriate |
| `Model provider custom not found` | Thread metadata references provider missing from `config.toml` | Restore `[model_providers.custom]` from backup or add a valid definition |
| `unable to open database file` during status | SQLite needs journal/shm access outside sandbox | Re-run with escalation |
| Thread visible but continuation fails | Old `encrypted_content` belongs to another provider/account | Use thread for reading context; start a fresh thread for new work |

## Bundled Script

- `scripts/recovery-runner.mjs`: cross-platform Node.js scanner for macOS, Windows, and Linux. It uses only Node built-ins and respects `CODEX_HOME`.
- Optional flags:
  - `--keyword <text>` narrows by session ID, path, cwd, provider, or user messages.
  - `--provider-sync-dir <dir>` records whether a local `codex-provider-sync/src/cli.js` exists.
  - `--out <file.md>` and `--json-out <file.json>` save reusable recovery artifacts.

## References

Read [recovery-playbook.md](references/recovery-playbook.md) when you need the full command sequence, output interpretation, or a known-good example from 2026-06-25.

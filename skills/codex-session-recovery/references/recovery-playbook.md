# Codex Session Recovery Playbook

## Known Good Recovery Pattern

This playbook documents a known-good recovery pattern.

### Inputs

- User had Markdown operation notes under a local project/output folder.
- Raw Codex sessions existed under `~/.codex/sessions/**/*.jsonl`.
- Codex App could not find old project threads.
- Later, one thread failed with: `Model provider custom not found`.

### What the Markdown Did

Markdown files helped identify:

- project names, repository names, or workspace paths
- dates near the missing conversations
- output documents and project paths

Markdown did not contain complete thread history. The complete records were in JSONL and SQLite.

### Discovery Commands

Prefer the bundled Node runner:

```bash
node scripts/recovery-runner.mjs --out codex-session-recovery-report.md --json-out codex-session-recovery-report.json
node scripts/recovery-runner.mjs --keyword my-project --out codex-session-recovery-report.md
```

The runner is cross-platform and read-only. It scans:

- `CODEX_HOME` or `~/.codex`
- `sessions/**/*.jsonl`
- `archived_sessions/**/*.jsonl`
- `config.toml`
- provider definitions and provider mismatch risks
- `encrypted_content` risk markers

Manual fallback:

```bash
find ~/.codex/sessions -maxdepth 5 -type f -name '*.jsonl'
find ~/.codex/archived_sessions -maxdepth 5 -type f -name '*.jsonl'
rg -n "my-project|important keyword|恢复" ~/.codex/sessions ~/.codex/archived_sessions
```

For large output, parse JSONL instead of dumping full matches. Extract only metadata and user messages.

### Provider Visibility Check

Use the provider sync repository:

```bash
cd /path/to/codex-provider-sync
node src/cli.js status
```

If sandbox blocks SQLite, rerun with escalation.

If `codex-provider-sync` is missing, do not download it silently. Ask the user first, then clone:

```bash
git clone https://github.com/Dailin521/codex-provider-sync.git
```

On Windows, use the same Node commands in PowerShell:

```powershell
node .\scripts\recovery-runner.mjs --out .\codex-session-recovery-report.md
node .\src\cli.js status
```

### Recovery Command

```bash
node src/cli.js sync
```

Example result:

- current provider: `openai`
- backup: `~/.codex/backups_state/provider-sync/<timestamp>`
- updated rollout files: `<count>`
- updated SQLite rows: `<count>`
- updated workspace roots: `<count>`
- after status: rollout and SQLite sessions should match the target provider

### Verified Thread IDs

| Thread | sessionId |
| --- | --- |
| my-project | `<session-id>` |
| old-debug-thread | `<session-id>` |
| planning-thread | `<session-id>` |

Verify with Codex App tools:

```text
list_threads(query="my-project")
read_thread(threadId="<session-id>")
```

### Missing Provider Fix

Error:

```text
Codex can't load config.toml
Model provider `custom` not found
```

Cause: old thread metadata still referenced `custom`, but current `~/.codex/config.toml` did not define `[model_providers.custom]`.

Fix used on 2026-06-25:

1. Read provider definition from backup:

```bash
sed -n '1,40p' ~/.codex/backups_state/provider-sync/<timestamp>/config.toml
```

2. Back up current config:

```bash
cp ~/.codex/config.toml ~/.codex/config.toml.bak-<timestamp>
```

3. Add this block without changing the current default provider:

```toml
[model_providers.custom]
name = "custom"
wire_api = "responses"
requires_openai_auth = true
base_url = "https://example.com/v1"
```

4. Verify `read_thread` works.

### Output Document Template

Create a short recovery index with:

- target project/thread name
- timestamp
- sessionId
- raw JSONL path
- App visibility status
- backup path
- commands run
- remaining risks

### Risks

- `encrypted_content` warning means visibility restoration can succeed while continuation/compaction may fail.
- Do not rewrite raw conversation content.
- Do not switch the default provider unless user explicitly wants that.
- Keep all backup paths in the final answer and in memory.

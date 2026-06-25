# Codex Session Recovery Playbook / Codex 会话恢复操作手册

## 中文

### 已验证的恢复模式

这个 playbook 记录一套已验证的 Codex 会话恢复模式。

### 输入线索

- 用户可能有本地项目或输出目录里的 Markdown 操作记录。
- 原始 Codex 会话通常在 `~/.codex/sessions/**/*.jsonl`。
- 归档会话可能在 `~/.codex/archived_sessions/**/*.jsonl`。
- Codex App 可能搜不到旧项目线程。
- 线程加载可能报：`Model provider custom not found`。

### Markdown 的作用

Markdown 文件只负责提供线索，例如：

- 项目名、仓库名或工作目录路径
- 缺失会话附近的日期
- 输出文档和项目路径

Markdown 不包含完整线程历史。完整记录通常在 JSONL 和 SQLite 中。

### 发现命令

优先使用内置 Node runner：

```bash
node scripts/recovery-runner.mjs --out codex-session-recovery-report.md --json-out codex-session-recovery-report.json
node scripts/recovery-runner.mjs --keyword my-project --out codex-session-recovery-report.md
```

runner 是跨平台、只读的。它会扫描：

- `CODEX_HOME` 或 `~/.codex`
- `sessions/**/*.jsonl`
- `archived_sessions/**/*.jsonl`
- `config.toml`
- provider 定义和 provider mismatch 风险
- `encrypted_content` 风险标记

手动兜底：

```bash
find ~/.codex/sessions -maxdepth 5 -type f -name '*.jsonl'
find ~/.codex/archived_sessions -maxdepth 5 -type f -name '*.jsonl'
rg -n "my-project|important keyword|恢复" ~/.codex/sessions ~/.codex/archived_sessions
```

输出很大时，不要直接 dump 全量内容，优先解析 JSONL，只提取 metadata 和用户消息摘要。

### Provider 可见性检查

如果使用 `codex-provider-sync`：

```bash
cd /path/to/codex-provider-sync
node src/cli.js status
```

如果 sandbox 阻止 SQLite 访问，提权重跑。

如果缺少 `codex-provider-sync`，不要静默下载，先询问用户，再执行：

```bash
git clone https://github.com/Dailin521/codex-provider-sync.git
```

Windows PowerShell 示例：

```powershell
node .\scripts\recovery-runner.mjs --out .\codex-session-recovery-report.md
node .\src\cli.js status
```

### 恢复命令

```bash
node src/cli.js sync
```

示例结果：

- current provider: `openai`
- backup: `~/.codex/backups_state/provider-sync/<timestamp>`
- updated rollout files: `<count>`
- updated SQLite rows: `<count>`
- updated workspace roots: `<count>`
- after status: rollout 和 SQLite sessions 应该匹配目标 provider

### 验证线程

| Thread / 线程 | sessionId |
| --- | --- |
| my-project | `<session-id>` |
| old-debug-thread | `<session-id>` |
| planning-thread | `<session-id>` |

使用 Codex App 工具验证：

```text
list_threads(query="my-project")
read_thread(threadId="<session-id>")
```

### 修复缺失 Provider

错误：

```text
Codex can't load config.toml
Model provider `custom` not found
```

原因：旧线程 metadata 仍引用 `custom`，但当前 `~/.codex/config.toml` 没有定义 `[model_providers.custom]`。

处理：

1. 从备份读取 provider 定义：

```bash
sed -n '1,40p' ~/.codex/backups_state/provider-sync/<timestamp>/config.toml
```

2. 备份当前 config：

```bash
cp ~/.codex/config.toml ~/.codex/config.toml.bak-<timestamp>
```

3. 补充 provider block，且不要擅自切换默认 provider：

```toml
[model_providers.custom]
name = "custom"
wire_api = "responses"
requires_openai_auth = true
base_url = "https://example.com/v1"
```

4. 用 `read_thread` 验证线程可读。

### 输出文档模板

恢复索引建议记录：

- 目标项目/线程名称
- 时间戳
- sessionId
- 原始 JSONL 路径
- App 可见性状态
- 备份路径
- 执行过的命令
- 剩余风险

### 风险

- `encrypted_content` 表示可见性可能恢复，但跨 provider/account 继续或压缩仍可能失败。
- 不要改写原始对话正文。
- 除非用户明确要求，不要切换默认 provider。
- 最终答复和 memory 中保留备份路径。

## English

### Known-Good Recovery Pattern

This playbook documents a known-good Codex session recovery pattern.

### Inputs

- The user may have Markdown operation notes under a local project/output folder.
- Raw Codex sessions usually live under `~/.codex/sessions/**/*.jsonl`.
- Archived sessions may live under `~/.codex/archived_sessions/**/*.jsonl`.
- Codex App may not find old project threads.
- A thread may fail with: `Model provider custom not found`.

### What Markdown Does

Markdown files provide clues only, such as:

- project names, repository names, or workspace paths
- dates near the missing conversations
- output documents and project paths

Markdown does not contain complete thread history. Complete records are usually in JSONL and SQLite.

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

For large output, parse JSONL instead of dumping full matches. Extract only metadata and user message summaries.

### Provider Visibility Check

If using `codex-provider-sync`:

```bash
cd /path/to/codex-provider-sync
node src/cli.js status
```

If sandbox blocks SQLite, rerun with escalation.

If `codex-provider-sync` is missing, do not download it silently. Ask first, then clone:

```bash
git clone https://github.com/Dailin521/codex-provider-sync.git
```

PowerShell examples:

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

### Verify Threads

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

Cause: old thread metadata still references `custom`, but the current `~/.codex/config.toml` does not define `[model_providers.custom]`.

Fix:

1. Read provider definition from backup:

```bash
sed -n '1,40p' ~/.codex/backups_state/provider-sync/<timestamp>/config.toml
```

2. Back up current config:

```bash
cp ~/.codex/config.toml ~/.codex/config.toml.bak-<timestamp>
```

3. Add the provider block without changing the current default provider:

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

- `encrypted_content` means visibility restoration can succeed while continuation/compaction may still fail across providers/accounts.
- Do not rewrite raw conversation content.
- Do not switch the default provider unless the user explicitly wants that.
- Keep backup paths in the final answer and in memory.

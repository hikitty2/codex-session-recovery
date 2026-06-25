# Codex Session Recovery / Codex 会话恢复

[中文](#中文) | [English](#english)

## 中文

一个只读的 Codex 会话恢复扫描器，同时提供可安装的 Codex Skill。

它用于诊断这些情况：旧 Codex 对话明明还在本地磁盘里，却在 App 里搜不到、无法恢复，或因为 provider metadata / config 变化导致线程无法继续。

### 能做什么

- 扫描 `CODEX_HOME` 或 `~/.codex`。
- 索引 `sessions/**/*.jsonl` 和 `archived_sessions/**/*.jsonl`。
- 读取 `config.toml` 里的 provider 定义。
- 检测缺失的 provider 定义和 provider 不一致风险。
- 标记包含 `encrypted_content` 的会话。
- 生成 Markdown 和 JSON 报告。
- 安装可复用的 `codex-session-recovery` Skill，方便后续 Codex 会话自动使用。

扫描器默认只读，不会修改 JSONL、SQLite 或 `config.toml`。

### 快速开始

在本地仓库直接运行：

```bash
node bin/codex-session-recovery.mjs \
  --out codex-session-recovery-report.md \
  --json-out codex-session-recovery-report.json
```

按关键词过滤：

```bash
node bin/codex-session-recovery.mjs --keyword my-project --out report.md
```

扫描另一个 Codex home：

```bash
node bin/codex-session-recovery.mjs --codex-home /path/to/.codex --out report.md
```

### 安装 Codex Skill

在仓库根目录运行：

```bash
npm run install-skill
```

它会把 `skills/codex-session-recovery` 复制到：

```text
${CODEX_HOME:-~/.codex}/skills/codex-session-recovery
```

然后在新的 Codex 对话里可以说：

```text
使用 codex-session-recovery 恢复丢失的 Codex 会话。
```

### 配合 codex-provider-sync

本项目负责诊断 provider metadata 不一致问题，不会静默下载或运行外部修复工具。

如果你使用 `codex-provider-sync`，可以传入它的本地路径，报告会记录 CLI 是否存在：

```bash
node bin/codex-session-recovery.mjs \
  --provider-sync-dir /path/to/codex-provider-sync \
  --out report.md
```

如果报告提示需要同步 provider metadata，请先检查并备份，再执行任何写入操作。

### Windows

PowerShell 示例：

```powershell
node .\bin\codex-session-recovery.mjs --out .\report.md
npm run install-skill
```

扫描器只使用 Node.js 内置模块，支持 macOS、Windows 和 Linux。

### 安全说明

- 不要公开包含私人 prompt、本机路径或 session ID 的生成报告。
- 不要手动改写原始 `.jsonl` 对话文件。
- 运行任何会修改 sessions、SQLite 或 config 的外部工具前，先备份 `~/.codex`。
- 即使会话可见性恢复，含 `encrypted_content` 的会话仍可能因 provider/account 边界无法继续。

### 开发

```bash
npm run check
node bin/codex-session-recovery.mjs --help
```

## English

A read-only Codex session recovery scanner, plus an installable Codex Skill.

It helps diagnose cases where old Codex conversations still exist on disk but are hidden in the app, missing from search, or unable to resume because provider metadata or config changed.

### What It Does

- Scans `CODEX_HOME` or `~/.codex`.
- Indexes `sessions/**/*.jsonl` and `archived_sessions/**/*.jsonl`.
- Reads provider definitions from `config.toml`.
- Detects missing provider definitions and provider mismatch risks.
- Flags sessions containing `encrypted_content`.
- Generates Markdown and JSON reports.
- Installs a reusable `codex-session-recovery` Skill for future Codex runs.

The scanner is read-only. It does not edit JSONL files, SQLite, or `config.toml`.

### Quick Start

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

### Install the Codex Skill

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

### Working With codex-provider-sync

This project diagnoses provider mismatch issues. It does not silently download or run external repair tools.

If you use `codex-provider-sync`, pass its local path so the report can record whether the CLI is present:

```bash
node bin/codex-session-recovery.mjs \
  --provider-sync-dir /path/to/codex-provider-sync \
  --out report.md
```

If the report says provider metadata needs syncing, inspect and back up before running any write operation.

### Windows

PowerShell examples:

```powershell
node .\bin\codex-session-recovery.mjs --out .\report.md
npm run install-skill
```

The scanner uses Node built-ins only and supports macOS, Windows, and Linux.

### Safety Notes

- Do not publish generated reports if they contain private prompts, local paths, or session IDs.
- Do not edit raw `.jsonl` conversation files by hand.
- Back up `~/.codex` before running any external tool that mutates sessions, SQLite, or config.
- `encrypted_content` can still fail to continue across provider/account boundaries even after visibility is restored.

### Development

```bash
npm run check
node bin/codex-session-recovery.mjs --help
```

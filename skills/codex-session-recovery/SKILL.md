---
name: codex-session-recovery
description: Recover hidden, missing, or unloadable Codex threads by inspecting ~/.codex sessions, archived_sessions, SQLite state, config.toml, model_provider metadata, and provider definitions. Use when Codex App cannot find old conversations, a thread cannot resume, config.toml reports a missing provider, or the user wants to restore Codex history from local session records. 支持诊断 Codex 旧会话丢失、无法恢复、provider 缺失或本地 JSONL 需要恢复索引的场景。
---

# Codex Session Recovery / Codex 会话恢复

## Purpose / 目的

Restore Codex thread visibility and resumability from local state.

从本地状态恢复 Codex 线程的可见性和可继续性。

Treat Markdown notes as clues only. The source of truth is:

Markdown 笔记只能当线索，真实来源是：

- `~/.codex/sessions`
- `~/.codex/archived_sessions`
- `~/.codex/sqlite/state_5.sqlite`
- `~/.codex/config.toml`

## Workflow / 工作流

1. Query memory for prior recovery operations and known backup paths.
   查询 memory，确认过去是否做过恢复、是否有已知备份路径。
2. Read user-provided notes only as hints: project names, dates, cwd values, session IDs, and keywords.
   用户提供的 md/笔记只作为搜索线索：项目名、日期、cwd、session ID、关键词。
3. Run the bundled Node recovery runner first.
   优先运行内置 Node 恢复扫描器。

```bash
node scripts/recovery-runner.mjs --out codex-session-recovery-report.md --json-out codex-session-recovery-report.json
```

Use `--keyword <text>` to narrow the scan. Use `--codex-home <dir>` when `CODEX_HOME` is not the target Codex directory.

使用 `--keyword <text>` 缩小扫描范围。如果目标 Codex 目录不是当前 `CODEX_HOME`，使用 `--codex-home <dir>`。

The runner is read-only. It scans sessions, config, provider definitions, encrypted content, and optional `codex-provider-sync` location, then writes a diagnosis report.

该脚本默认只读，会扫描 sessions、config、provider 定义、加密内容标记，以及可选的 `codex-provider-sync` 路径，然后生成诊断报告。

4. If the runner is unavailable, locate raw session records manually.
   如果脚本不可用，再手动定位原始会话记录。

```bash
find ~/.codex/sessions ~/.codex/archived_sessions -type f -name '*.jsonl'
```

5. Build a compact index from each JSONL file.
   为每个 JSONL 生成紧凑索引。

- `session_meta.payload.id` or `session_id`
- `timestamp`
- `cwd`
- `model_provider`
- first meaningful user message / 第一条有效用户消息
- last meaningful user message / 最后一条有效用户消息

6. Search Codex App threads with `list_threads`; verify targets with `read_thread`.
   用 `list_threads` 搜索 Codex App 线程，用 `read_thread` 验证目标。
7. If raw JSONL exists but App search cannot find it, inspect provider metadata with `codex-provider-sync status`.
   如果 JSONL 存在但 App 搜不到，使用 `codex-provider-sync status` 检查 provider metadata。
8. If `codex-provider-sync` is missing, ask before cloning it. Do not download dependencies silently.
   如果缺少 `codex-provider-sync`，克隆前必须先询问；不要静默下载依赖。
9. If current provider differs from old session metadata, run `codex-provider-sync sync` only after confirming it will back up `~/.codex`.
   如果当前 provider 与旧会话 metadata 不一致，确认会备份 `~/.codex` 后再运行 `codex-provider-sync sync`。
10. If thread loading fails with `Model provider <name> not found`, restore the missing `[model_providers.<name>]` block from a backup `config.toml` or ask the user for the provider definition.
    如果线程加载报 `Model provider <name> not found`，从备份 `config.toml` 恢复缺失的 `[model_providers.<name>]`，或向用户索要 provider 定义。
11. Re-run `list_threads` and `read_thread` for target session IDs.
    对目标 session ID 重新运行 `list_threads` 和 `read_thread`。
12. Write a short recovery index document with session IDs, file paths, backup paths, and remaining risks.
    输出简短恢复索引，记录 session ID、文件路径、备份路径和剩余风险。

## Safety Rules / 安全规则

- Never edit message bodies in JSONL files.
  不要修改 JSONL 里的消息正文。
- Always create or confirm a backup before writing to `~/.codex/config.toml`, SQLite, or session metadata.
  写入 `~/.codex/config.toml`、SQLite 或 session metadata 前，必须创建或确认备份。
- Use escalation for commands that read/write `~/.codex/sqlite` or mutate `~/.codex`.
  读取/写入 `~/.codex/sqlite` 或修改 `~/.codex` 的命令需要提权。
- Keep the Node runner read-only unless the user explicitly asks for a write/apply mode.
  除非用户明确要求写入/应用模式，否则保持 Node runner 只读。
- Do not assume Markdown notes are complete history; they are only navigation aids.
  不要把 Markdown 笔记当完整历史，它们只是导航线索。
- Preserve the user's current default provider unless explicitly asked to switch it.
  除非用户明确要求切换，否则保留当前默认 provider。
- Warn when `encrypted_content` is present.
  出现 `encrypted_content` 时必须提醒：可见性可能恢复，但跨 provider/account 继续或压缩仍可能失败。

## Diagnosis Map / 诊断表

| Symptom / 现象 | Likely cause / 可能原因 | Fix / 处理方式 |
| --- | --- | --- |
| Raw `.jsonl` exists but App search cannot find it / JSONL 存在但 App 搜不到 | `model_provider` mismatch between sessions/SQLite and current provider / sessions、SQLite 与当前 provider 不一致 | Run `codex-provider-sync status`, then `sync` if appropriate / 先跑 status，确认后再 sync |
| `Model provider custom not found` | Thread metadata references provider missing from `config.toml` / 线程 metadata 引用了 config 中缺失的 provider | Restore `[model_providers.custom]` from backup or add a valid definition / 从备份恢复或补充有效定义 |
| `unable to open database file` during status / status 时无法打开数据库 | SQLite needs journal/shm access outside sandbox / SQLite 需要访问 sandbox 外的 journal/shm | Re-run with escalation / 提权重跑 |
| Thread visible but continuation fails / 线程可见但无法继续 | Old `encrypted_content` belongs to another provider/account / 加密内容属于另一个 provider/account | Use thread for reading context; start a fresh thread for new work / 读取上下文后开新线程继续 |

## Bundled Script / 内置脚本

- `scripts/recovery-runner.mjs`: cross-platform Node.js scanner for macOS, Windows, and Linux. It uses only Node built-ins and respects `CODEX_HOME`.
  跨平台 Node.js 扫描器，支持 macOS、Windows、Linux；只使用 Node 内置模块，并尊重 `CODEX_HOME`。
- Optional flags / 可选参数：
  - `--keyword <text>`: narrow by session ID, path, cwd, provider, or user messages / 按 session ID、路径、cwd、provider 或用户消息过滤。
  - `--provider-sync-dir <dir>`: record whether local `codex-provider-sync/src/cli.js` exists / 记录本地 `codex-provider-sync/src/cli.js` 是否存在。
  - `--out <file.md>` and `--json-out <file.json>`: save reusable recovery artifacts / 保存可复用恢复报告。

## References / 参考

Read [recovery-playbook.md](references/recovery-playbook.md) when you need the full command sequence, output interpretation, or a known-good example.

需要完整命令序列、输出解释或参考案例时，阅读 [recovery-playbook.md](references/recovery-playbook.md)。

#!/usr/bin/env node
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const DEFAULT_LIMIT = 200;
const BUILT_IN_PROVIDERS = ["openai"];

function parseArgs(argv) {
  const args = {
    codexHome: process.env.CODEX_HOME || path.join(os.homedir(), ".codex"),
    out: "",
    jsonOut: "",
    limit: DEFAULT_LIMIT,
    keywords: [],
    providerSyncDir: process.env.CODEX_PROVIDER_SYNC_DIR || "",
    help: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const next = argv[i + 1];

    if (arg === "--help" || arg === "-h") args.help = true;
    else if (arg === "--codex-home") args.codexHome = requireValue(arg, next, ++i);
    else if (arg === "--out") args.out = requireValue(arg, next, ++i);
    else if (arg === "--json-out") args.jsonOut = requireValue(arg, next, ++i);
    else if (arg === "--limit") args.limit = Number(requireValue(arg, next, ++i));
    else if (arg === "--keyword") args.keywords.push(requireValue(arg, next, ++i));
    else if (arg === "--provider-sync-dir") args.providerSyncDir = requireValue(arg, next, ++i);
    else throw new Error(`Unknown argument: ${arg}`);
  }

  if (!Number.isFinite(args.limit) || args.limit < 1) args.limit = DEFAULT_LIMIT;
  return args;
}

function requireValue(name, value) {
  if (!value || value.startsWith("--")) throw new Error(`${name} requires a value`);
  return value;
}

function usage() {
  return `Codex session recovery runner

Usage:
  node scripts/recovery-runner.mjs [options]

Options:
  --codex-home <dir>          Codex home directory. Defaults to CODEX_HOME or ~/.codex.
  --out <file.md>             Write a Markdown report.
  --json-out <file.json>      Write a JSON report.
  --keyword <text>            Keep sessions matching a keyword. Repeatable.
  --limit <number>            Max sessions shown in Markdown. Default ${DEFAULT_LIMIT}.
  --provider-sync-dir <dir>   Path to local codex-provider-sync repository.
  -h, --help                  Show this help.

This script is read-only. It never edits JSONL, SQLite, or config.toml.`;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    process.stdout.write(`${usage()}\n`);
    return;
  }

  const codexHome = path.resolve(expandHome(args.codexHome));
  const report = await buildReport(codexHome, args);

  const jsonText = `${JSON.stringify(report, null, 2)}\n`;
  const markdownText = renderMarkdown(report, args.limit);

  if (args.jsonOut) writeFile(args.jsonOut, jsonText);
  if (args.out) writeFile(args.out, markdownText);

  if (!args.out && !args.jsonOut) {
    process.stdout.write(markdownText);
  } else {
    process.stdout.write(`Recovery report created: ${args.out || "(markdown skipped)"}\n`);
    if (args.jsonOut) process.stdout.write(`Recovery JSON created: ${args.jsonOut}\n`);
  }
}

function expandHome(value) {
  if (value === "~") return os.homedir();
  if (value.startsWith(`~${path.sep}`)) return path.join(os.homedir(), value.slice(2));
  return value;
}

function writeFile(filePath, content) {
  const target = path.resolve(expandHome(filePath));
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, content, "utf8");
}

async function buildReport(codexHome, args) {
  const configPath = path.join(codexHome, "config.toml");
  const config = readConfig(configPath);
  const sessionFiles = [
    ...walkJsonl(path.join(codexHome, "sessions")),
    ...walkJsonl(path.join(codexHome, "archived_sessions")),
  ];

  const allSessions = sessionFiles.map((filePath) => parseSessionFile(filePath, codexHome));
  const sessions = filterSessions(allSessions, args.keywords);
  const providersInSessions = unique(sessions.map((item) => item.modelProvider).filter(Boolean));
  const knownProviders = unique([...BUILT_IN_PROVIDERS, ...config.providerDefinitions]);
  const missingProviders = providersInSessions.filter((name) => !knownProviders.includes(name));
  const mismatchedProviders = providersInSessions.filter(
    (name) => config.currentProvider && name !== config.currentProvider,
  );

  return {
    generatedAt: new Date().toISOString(),
    platform: process.platform,
    codexHome,
    config,
    providerSync: inspectProviderSync(args.providerSyncDir),
    totals: {
      scannedFiles: sessionFiles.length,
      matchedSessions: sessions.length,
      encryptedSessions: sessions.filter((item) => item.hasEncryptedContent).length,
      parseErrors: sessions.reduce((sum, item) => sum + item.parseErrors.length, 0),
    },
    diagnosis: {
      providersInSessions,
      missingProviders,
      mismatchedProviders,
      knownProviders,
      keywords: args.keywords,
    },
    sessions: sessions.sort(compareSessions),
    suggestions: buildSuggestions({
      config,
      missingProviders,
      mismatchedProviders,
      providerSync: inspectProviderSync(args.providerSyncDir),
      encryptedCount: sessions.filter((item) => item.hasEncryptedContent).length,
    }),
  };
}

function readConfig(configPath) {
  if (!fs.existsSync(configPath)) {
    return {
      path: configPath,
      exists: false,
      currentProvider: "",
      providerDefinitions: [],
    };
  }

  const text = fs.readFileSync(configPath, "utf8");
  const providerDefinitions = [];
  let currentProvider = "";

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;

    const sectionMatch = line.match(/^\[model_providers\.([^\]]+)\]$/);
    if (sectionMatch) providerDefinitions.push(unquoteTomlKey(sectionMatch[1]));

    const providerMatch = line.match(/^model_provider\s*=\s*["']([^"']+)["']/);
    if (providerMatch && !currentProvider) currentProvider = providerMatch[1];
  }

  return {
    path: configPath,
    exists: true,
      currentProvider,
      providerDefinitions: unique(providerDefinitions),
      knownProviders: unique([...BUILT_IN_PROVIDERS, ...providerDefinitions]),
  };
}

function unquoteTomlKey(value) {
  return value.replace(/^["']|["']$/g, "");
}

function walkJsonl(root) {
  if (!fs.existsSync(root)) return [];
  const found = [];
  const stack = [root];

  while (stack.length > 0) {
    const current = stack.pop();
    let entries = [];
    try {
      entries = fs.readdirSync(current, { withFileTypes: true });
    } catch {
      continue;
    }

    for (const entry of entries) {
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) stack.push(fullPath);
      else if (entry.isFile() && entry.name.endsWith(".jsonl")) found.push(fullPath);
    }
  }

  return found;
}

function parseSessionFile(filePath, codexHome) {
  const item = {
    filePath,
    relativePath: path.relative(codexHome, filePath),
    sessionId: "",
    firstTimestamp: "",
    lastTimestamp: "",
    cwd: "",
    modelProvider: "",
    firstUserMessage: "",
    lastUserMessage: "",
    userMessageCount: 0,
    hasEncryptedContent: false,
    parseErrors: [],
  };

  const text = fs.readFileSync(filePath, "utf8");
  const lines = text.split(/\r?\n/).filter(Boolean);

  lines.forEach((line, index) => {
    let event;
    try {
      event = JSON.parse(line);
    } catch (error) {
      item.parseErrors.push(`line ${index + 1}: ${error.message}`);
      return;
    }

    const timestamp = findFirstString(event, ["timestamp", "time", "created_at"]);
    if (timestamp) {
      if (!item.firstTimestamp) item.firstTimestamp = timestamp;
      item.lastTimestamp = timestamp;
    }

    const sessionId = findSessionId(event);
    if (sessionId && !item.sessionId) item.sessionId = sessionId;

    const cwd = findFirstString(event, ["cwd", "workspace_root", "workspaceRoot"]);
    if (cwd && !item.cwd) item.cwd = cwd;

    const provider = findFirstString(event, ["model_provider", "modelProvider"]);
    if (provider && !item.modelProvider) item.modelProvider = provider;

    if (containsKey(event, "encrypted_content")) item.hasEncryptedContent = true;

    const userText = extractUserText(event);
    if (userText) {
      item.userMessageCount += 1;
      if (!item.firstUserMessage) item.firstUserMessage = compactText(userText);
      item.lastUserMessage = compactText(userText);
    }
  });

  if (!item.sessionId) item.sessionId = path.basename(filePath, ".jsonl");
  return item;
}

function findSessionId(event) {
  if (event?.type === "session_meta" && event?.payload?.id) return String(event.payload.id);
  return findFirstString(event, ["session_id", "sessionId", "id"]);
}

function findFirstString(value, keys) {
  const seen = new Set();
  const stack = [value];

  while (stack.length > 0) {
    const current = stack.pop();
    if (!current || typeof current !== "object" || seen.has(current)) continue;
    seen.add(current);

    for (const key of keys) {
      if (typeof current[key] === "string" && current[key]) return current[key];
    }

    for (const child of Object.values(current)) {
      if (child && typeof child === "object") stack.push(child);
    }
  }

  return "";
}

function containsKey(value, keyName) {
  const seen = new Set();
  const stack = [value];

  while (stack.length > 0) {
    const current = stack.pop();
    if (!current || typeof current !== "object" || seen.has(current)) continue;
    seen.add(current);
    if (Object.prototype.hasOwnProperty.call(current, keyName)) return true;
    for (const child of Object.values(current)) {
      if (child && typeof child === "object") stack.push(child);
    }
  }

  return false;
}

function extractUserText(event) {
  const payload = event?.payload || event;
  const role = payload?.role || payload?.message?.role;
  if (role !== "user") return "";

  const content = payload?.content ?? payload?.message?.content;
  return flattenContent(content);
}

function flattenContent(content) {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part === "string") return part;
        if (typeof part?.text === "string") return part.text;
        if (typeof part?.content === "string") return part.content;
        return "";
      })
      .filter(Boolean)
      .join("\n");
  }
  if (typeof content?.text === "string") return content.text;
  return "";
}

function compactText(value) {
  return value.replace(/\s+/g, " ").trim().slice(0, 180);
}

function filterSessions(sessions, keywords) {
  if (keywords.length === 0) return sessions;
  const normalized = keywords.map((keyword) => keyword.toLowerCase());

  return sessions.filter((session) => {
    const haystack = [
      session.sessionId,
      session.relativePath,
      session.cwd,
      session.modelProvider,
      session.firstUserMessage,
      session.lastUserMessage,
    ]
      .join("\n")
      .toLowerCase();
    return normalized.some((keyword) => haystack.includes(keyword));
  });
}

function inspectProviderSync(providerSyncDir) {
  const dir = providerSyncDir ? path.resolve(expandHome(providerSyncDir)) : "";
  const cliPath = dir ? path.join(dir, "src", "cli.js") : "";

  return {
    dir,
    cliPath,
    found: Boolean(cliPath && fs.existsSync(cliPath)),
  };
}

function buildSuggestions({ config, missingProviders, mismatchedProviders, providerSync, encryptedCount }) {
  const suggestions = [];

  if (!config.exists) {
    suggestions.push("config.toml was not found. Verify CODEX_HOME points at the right Codex directory.");
  }

  if (missingProviders.length > 0) {
    suggestions.push(
      `Restore missing provider definitions in config.toml: ${missingProviders.map((name) => `[model_providers.${name}]`).join(", ")}.`,
    );
  }

  if (mismatchedProviders.length > 0) {
    suggestions.push(
      "Raw sessions reference providers different from the current provider. Use codex-provider-sync status before any sync.",
    );
  }

  if (!providerSync.found) {
    suggestions.push(
      "codex-provider-sync was not found. Clone it only after user approval: git clone https://github.com/Dailin521/codex-provider-sync.git",
    );
  }

  if (encryptedCount > 0) {
    suggestions.push(
      "Some sessions contain encrypted_content. Reading may work after visibility recovery, but continuing or compacting may still fail across providers/accounts.",
    );
  }

  if (suggestions.length === 0) {
    suggestions.push("No obvious provider/config issue found in the scanned sessions.");
  }

  return suggestions;
}

function renderMarkdown(report, limit) {
  const sessions = report.sessions.slice(0, limit);
  const lines = [
    "# Codex Session Recovery Report",
    "",
    `Generated: ${report.generatedAt}`,
    `Platform: ${report.platform}`,
    `Codex home: \`${report.codexHome}\``,
    "",
    "## Summary",
    "",
    `- Scanned JSONL files: ${report.totals.scannedFiles}`,
    `- Matched sessions: ${report.totals.matchedSessions}`,
    `- Sessions with encrypted_content: ${report.totals.encryptedSessions}`,
    `- Parse errors: ${report.totals.parseErrors}`,
    "",
    "## Config",
    "",
    `- config.toml: ${report.config.exists ? `\`${report.config.path}\`` : "not found"}`,
    `- Current provider: ${report.config.currentProvider || "(not detected)"}`,
    `- Provider definitions: ${report.config.providerDefinitions.join(", ") || "(none detected)"}`,
    `- Known providers: ${report.config.knownProviders.join(", ") || "(none detected)"}`,
    "",
    "## Provider Diagnosis",
    "",
    `- Providers in matched sessions: ${report.diagnosis.providersInSessions.join(", ") || "(none detected)"}`,
    `- Missing provider definitions: ${report.diagnosis.missingProviders.join(", ") || "(none)"}`,
    `- Providers different from current: ${report.diagnosis.mismatchedProviders.join(", ") || "(none)"}`,
    "",
    "## codex-provider-sync",
    "",
    `- CLI found: ${report.providerSync.found ? "yes" : "no"}`,
    `- CLI path: ${report.providerSync.cliPath ? `\`${report.providerSync.cliPath}\`` : "(not configured)"}`,
    "",
    "## Suggestions",
    "",
    ...report.suggestions.map((item) => `- ${item}`),
    "",
    "## Sessions",
    "",
  ];

  if (report.sessions.length > limit) {
    lines.push(`Showing ${limit} of ${report.sessions.length} sessions. Re-run with --limit to show more.`, "");
  }

  if (sessions.length === 0) {
    lines.push("No sessions matched the current filters.", "");
    return `${lines.join("\n")}\n`;
  }

  lines.push("| Timestamp | Provider | Session ID | CWD | First / Last User Message |");
  lines.push("| --- | --- | --- | --- | --- |");
  for (const session of sessions) {
    const message = [session.firstUserMessage, session.lastUserMessage]
      .filter(Boolean)
      .map(escapeTable)
      .join("<br>");
    lines.push(
      `| ${escapeTable(session.lastTimestamp || session.firstTimestamp || "")} | ${escapeTable(session.modelProvider || "")} | \`${escapeTable(session.sessionId)}\` | ${escapeTable(session.cwd || session.relativePath)} | ${message} |`,
    );
  }

  lines.push("");
  return `${lines.join("\n")}\n`;
}

function escapeTable(value) {
  return String(value).replace(/\|/g, "\\|").replace(/\r?\n/g, " ");
}

function compareSessions(a, b) {
  return String(b.lastTimestamp || b.firstTimestamp).localeCompare(String(a.lastTimestamp || a.firstTimestamp));
}

function unique(values) {
  return [...new Set(values)];
}

main().catch((error) => {
  process.stderr.write(`${error.stack || error.message}\n`);
  process.exitCode = 1;
});

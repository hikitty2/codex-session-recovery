#!/usr/bin/env node
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const sourceSkillDir = path.join(repoRoot, "skills", "codex-session-recovery");
const codexHome = process.env.CODEX_HOME || path.join(os.homedir(), ".codex");
const targetSkillDir = path.join(codexHome, "skills", "codex-session-recovery");

if (!fs.existsSync(sourceSkillDir)) {
  throw new Error(`Skill source not found: ${sourceSkillDir}`);
}

fs.mkdirSync(path.dirname(targetSkillDir), { recursive: true });

// Remove stale files from older installs so deleted references do not linger.
fs.rmSync(targetSkillDir, { recursive: true, force: true });
fs.cpSync(sourceSkillDir, targetSkillDir, { recursive: true });

process.stdout.write(`Installed codex-session-recovery skill to ${targetSkillDir}\n`);

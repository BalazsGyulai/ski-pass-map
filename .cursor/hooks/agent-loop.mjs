/**
 * Cursor hooks for the loop in AGENTS.md.
 *
 *   node .cursor/hooks/agent-loop.mjs edited   (afterFileEdit) remembers that this conversation changed files.
 *   node .cursor/hooks/agent-loop.mjs stop     (stop) runs the checks when such a conversation stops.
 *
 * A failure comes back as the next message, so the agent keeps going until the checks pass. The first
 * green run in a conversation asks once for the Learn step. Conversations that only talk, or only edit
 * Markdown, are left alone. State is one small JSON file per conversation in the OS temp folder.
 */
import { execFileSync, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, statSync, writeFileSync, writeSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

/** From this automatic round on, the agent is told to stop and report. Cursor's loop_limit (5) ends it. */
const LAST_ROUND = 3;
/** Lines of output kept per failing check. */
const TAIL_LINES = 40;

const mode = process.argv[2];
const input = readInput();
const root = process.env.CURSOR_PROJECT_DIR || process.cwd();
const conversation = String(input.conversation_id ?? "unknown").replace(/[^\w.-]/g, "_");
const statePath = path.join(tmpdir(), "cursor-agent-loop", sha(root).slice(0, 12), `${conversation}.json`);
const state = readState();

if (mode === "edited") {
  state.baseHead ??= git("rev-parse", "HEAD");
  state.edited = true;
  saveState();
  reply({});
}

if (mode !== "stop" || input.status !== "completed" || !state.edited) reply({});

const fingerprint = currentFingerprint();
if (fingerprint === state.verified) reply({});

const changed = changedFiles(state.baseHead ?? "HEAD");
if (changed.every((file) => file.endsWith(".md"))) {
  state.verified = fingerprint;
  saveState();
  reply({});
}

const results = runChecks(changed);
const failed = results.filter((result) => !result.ok);
if (failed.length > 0) {
  // Nothing changed since the last failing run: the agent is reporting, not fixing. Let it finish.
  if (fingerprint === state.failed) reply({});
  state.failed = fingerprint;
  saveState();
  const report = failed.map((result) => `### ${result.name}\n\`\`\`\n${result.tail}\n\`\`\``).join("\n\n");
  const next =
    Number(input.loop_count ?? 0) >= LAST_ROUND
      ? "This is the last automatic round. Stop changing code, and tell the owner exactly which check fails, why, and what you tried."
      : "Fix the cause, then stop again; the checks run again automatically. Do not skip, delete, or weaken a check or a test to get green. If a failure comes from code this conversation did not touch, tell the owner instead of fixing it.";
  reply({ followup_message: `The checks failed after your last change (hook from AGENTS.md).\n\n${report}\n\n${next}` });
}

state.verified = fingerprint;
const askLearn = !state.learnAsked;
state.learnAsked = true;
saveState();
if (!askLearn) reply({});
reply({
  followup_message: [
    `All checks passed: ${results.map((result) => result.name).join(", ")}.`,
    "Now do the Learn step in AGENTS.md: answer its three questions for this conversation.",
    "If any answer is yes, update AGENTS.md (fix the section it belongs to, or add or merge one line under Lessons, at most 30).",
    "If all are no, change nothing. Then give the owner your final report.",
  ].join(" "),
});

function runChecks(files) {
  const touches = (pattern) => files.some((file) => pattern.test(file));
  const checks = [
    { name: "lint", args: ["run", "lint"] },
    { name: "typecheck", args: ["run", "typecheck"] },
    { name: "test", args: ["test"] },
  ];
  if (touches(/^package(-lock)?\.json$/)) checks.push({ name: "check:lockfile", args: ["run", "check:lockfile"] });
  // The build also runs `validate`. Skip it when a fast check already failed: it would fail the same way, slower.
  const buildInputs = /^(src|functions|scripts|config|data|imports|public)\/|^(package\.json|next\.config\.ts|tsconfig\.json)$/;
  const results = [];
  for (const check of checks) results.push(run(check));
  if (touches(buildInputs) && results.every((result) => result.ok)) {
    // next build empties .next, which a running `next dev` (Next 15) still uses.
    if (devServerRunning()) results.push({ name: "build (skipped: next dev is running; run npm run build after stopping it)", ok: true });
    else results.push(run({ name: "build", args: ["run", "build"] }));
  }
  return results;
}

function devServerRunning() {
  return spawnSync("pgrep", ["-f", "next dev"], { encoding: "utf8" }).status === 0;
}

function run({ name, args }) {
  // Any FORCE_COLOR, even "0", turns colours on in some tools. NO_COLOR turns them off.
  const env = { ...process.env, NO_COLOR: "1" };
  delete env.FORCE_COLOR;
  const result = spawnSync("npm", args, { cwd: root, encoding: "utf8", env, maxBuffer: 64 * 1024 * 1024 });
  const output = `${result.stdout ?? ""}${result.stderr ?? ""}${result.error ? `\n${result.error.message}` : ""}`;
  const plain = output.replace(/\u001b\[[0-9;]*m/g, "").trim();
  return { name, ok: result.status === 0, tail: plain.split("\n").slice(-TAIL_LINES).join("\n") };
}

/** Files that differ from where this conversation started, committed or not, plus new files. */
function changedFiles(base) {
  const diffed = git("diff", "--name-only", base).split("\n");
  const added = git("ls-files", "--others", "--exclude-standard").split("\n");
  return [...new Set([...diffed, ...added].filter(Boolean))];
}

/** Changes whenever the code does: HEAD, the diff against it, and every new file's size and time. */
function currentFingerprint() {
  const added = git("ls-files", "--others", "--exclude-standard")
    .split("\n")
    .filter(Boolean)
    .map((file) => {
      try {
        const info = statSync(path.join(root, file));
        return `${file}:${info.size}:${info.mtimeMs}`;
      } catch {
        return file;
      }
    });
  return sha([git("rev-parse", "HEAD"), git("diff", "HEAD"), ...added].join("\n"));
}

function git(...args) {
  try {
    return execFileSync("git", args, { cwd: root, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 }).trim();
  } catch {
    return "";
  }
}

function sha(text) {
  return createHash("sha256").update(text).digest("hex");
}

function readInput() {
  try {
    return JSON.parse(readFileSync(0, "utf8") || "{}");
  } catch {
    return {};
  }
}

function readState() {
  try {
    return JSON.parse(readFileSync(statePath, "utf8"));
  } catch {
    return {};
  }
}

function saveState() {
  mkdirSync(path.dirname(statePath), { recursive: true });
  writeFileSync(statePath, JSON.stringify(state));
}

/** Cursor reads one JSON object from stdout. Written synchronously so exit cannot cut it off. */
function reply(output) {
  writeSync(1, JSON.stringify(output));
  process.exit(0);
}

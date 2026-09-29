/**
 * Cursor beforeShellExecution hook. The matcher in hooks.json only sends commands that can publish,
 * deploy, delete, or rewrite history. Those always wait for the owner's OK, and a few are refused.
 * This hook never answers "allow", so it can only add a confirmation, never skip one.
 */
import { readFileSync, writeSync } from "node:fs";

let command = "";
try {
  command = String(JSON.parse(readFileSync(0, "utf8") || "{}").command ?? "");
} catch {
  // Unreadable input: ask, below.
}

const refused = [
  {
    test: /\bgit\s+push\b/.test(command) && /(\s--force(-with-lease)?\b|\s-f\b|\s\+)/.test(command) && /\b(main|master)\b/.test(command),
    why: "Force-pushing main rewrites history that is already published.",
  },
  {
    test: /\bwrangler\b/.test(command) && /--remote\b/.test(command) && /\b(drop|delete|truncate|update|alter)\b/i.test(command),
    why: "This changes production data in D1.",
  },
  {
    test: /\brm\s+-[a-zA-Z]*r[a-zA-Z]*\s+(\/|~\/?|\*)(\s|$)/.test(command),
    why: "This deletes far more than the project.",
  },
].find((rule) => rule.test);

if (refused) {
  answer({
    permission: "deny",
    user_message: `Blocked by .cursor/hooks/guard-shell.mjs: ${refused.why} Run it yourself if you really mean it.`,
    agent_message: `This command is blocked: ${refused.why} Do not try another way around it. Tell the owner what you wanted to run and why.`,
  });
}

answer({
  permission: "ask",
  user_message: "This command can publish, deploy, delete, or rewrite history. Allow it only if you asked for it.",
  agent_message: "The owner has to approve this command. If they did not ask for it in this conversation, do not run it.",
});

function answer(output) {
  writeSync(1, JSON.stringify(output));
  process.exit(0);
}

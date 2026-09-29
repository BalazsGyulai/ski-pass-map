/**
 * Cloudflare Pages installs with its own npm (10.9.2 on build image v3) before the build command
 * runs, and `npm ci` refuses a lockfile that this npm would resolve differently. npm 11 writes the
 * optional @emnapi packages in a way npm 10 rejects, so a lockfile from a newer machine can pass
 * locally and in GitHub Actions and still fail on Cloudflare. This runs `npm ci --dry-run` with
 * each npm the project meets, in a scratch copy, so node_modules is never touched.
 */
import { execFileSync } from "node:child_process";
import { copyFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

/** Cloudflare Pages build image v3, and the npm the lockfile is usually written with locally. */
const NPM_VERSIONS = ["10.9.2", "11.6.2"];

const scratch = mkdtempSync(path.join(tmpdir(), "lockfile-check-"));
const failures = [];
try {
  for (const file of ["package.json", "package-lock.json"]) {
    copyFileSync(path.join(process.cwd(), file), path.join(scratch, file));
  }
  for (const version of NPM_VERSIONS) {
    try {
      execFileSync("npx", ["--yes", `npm@${version}`, "ci", "--dry-run", "--ignore-scripts", "--no-audit", "--no-fund"], {
        cwd: scratch,
        stdio: "pipe",
        encoding: "utf8",
      });
      console.log(`npm ${version}: npm ci accepts package-lock.json`);
    } catch (error) {
      const output = `${error.stdout ?? ""}${error.stderr ?? ""}`;
      const reasons = output.split("\n").filter((line) => /Missing:|Invalid:/.test(line));
      failures.push({ version, reasons: reasons.length > 0 ? reasons : output.trim().split("\n").slice(-5) });
    }
  }
} finally {
  rmSync(scratch, { recursive: true, force: true });
}

if (failures.length > 0) {
  for (const { version, reasons } of failures) {
    console.error(`npm ${version}: npm ci rejects package-lock.json`);
    for (const reason of reasons) console.error(`  ${reason.replace(/^npm error\s*/, "")}`);
  }
  console.error("\nRewrite the lockfile with Cloudflare's npm, then run this check again:");
  console.error("  npx -y npm@10.9.2 install --package-lock-only --ignore-scripts --no-audit --no-fund");
  process.exit(1);
}

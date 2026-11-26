import { spawn } from "node:child_process";
import {
  closeSync, existsSync, mkdirSync, mkdtempSync, openSync,
  renameSync, writeFileSync,
} from "node:fs";
import { join, resolve } from "node:path";
import { constants } from "node:os";

const [version, label, separator, program, ...args] = process.argv.slice(2);
const validName = /^[\p{L}\p{N}][\p{L}\p{N}_.-]{0,99}$/u;
if (!version || !label || !validName.test(version) || !validName.test(label)
    || separator !== "--" || !program) {
  console.error("Usage: bun run-experiment.ts <version> <label> -- <program> [args...]");
  process.exit(2);
}

const project = process.cwd();
const runs = resolve(project, "experiment", version, "runs");
mkdirSync(runs, { recursive: true });
const runDir = mkdtempSync(join(runs, label + "-"));
const record = {
  version, label, cwd: project, command: [program, ...args],
  startedAt: new Date().toISOString(),
  stdout: "stdout.log", stderr: "stderr.log",
};
function writeRecord(fields: Record<string, unknown>) {
  const temporary = join(runDir, "run.json.tmp");
  writeFileSync(temporary, JSON.stringify({ ...record, ...fields }, null, 2) + "\n");
  renameSync(temporary, join(runDir, "run.json"));
}

console.log(runDir);
const stdout = openSync(join(runDir, record.stdout), "w");
const stderr = openSync(join(runDir, record.stderr), "w");
writeRecord({ status: "starting" });
const child = spawn(program, args, {
  cwd: project,
  env: { ...process.env, RESEARCH_RUN_DIR: runDir },
  stdio: ["ignore", stdout, stderr],
});
closeSync(stdout);
closeSync(stderr);

child.once("spawn", () => writeRecord({ status: "running", pid: child.pid }));
for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.once(signal, () => child.kill(signal));
}
let launchError: string | undefined;
child.once("error", (error) => {
  launchError = error.message;
  console.error(launchError);
});
child.once("close", (code, signal) => {
  const exitCode = launchError ? 127 : code ?? (signal ? 128 + constants.signals[signal] : 1);
  writeRecord({
    status: exitCode === 0 ? "completed" : "failed", pid: child.pid,
    finishedAt: new Date().toISOString(), exitCode, signal, launchError,
    metrics: existsSync(join(runDir, "metrics.json")) ? "metrics.json" : null,
  });
  process.exitCode = exitCode;
});

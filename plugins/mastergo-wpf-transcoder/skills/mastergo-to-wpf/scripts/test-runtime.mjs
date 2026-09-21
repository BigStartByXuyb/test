import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const tests = path.join(path.dirname(fileURLToPath(import.meta.url)), "tests");
const files = fs.readdirSync(tests).sort();
const js = files.filter((name) => name.endsWith(".test.js")).map((name) => path.join(tests, name));
const ps = files.filter((name) => name.endsWith(".tests.ps1")).map((name) => path.join(tests, name));
if (!js.length || !ps.length) throw new Error("Both Node and PowerShell test suites are required");
const commands = [
  [process.execPath, ["--version"]],
  ["pwsh", ["-NoProfile", "-NonInteractive", "-Command", "$PSVersionTable.PSVersion.ToString()"]],
  [process.execPath, ["--test", ...js]],
  ...ps.map((file) => ["pwsh", ["-NoProfile", "-NonInteractive", "-File", file]])
];
let failed = false;
for (const [command, args] of commands) {
  console.log("\nRUN " + command + " " + args.join(" "));
  const result = spawnSync(command, args, { stdio: "inherit", timeout: 300000 });
  if (result.error || result.status !== 0 || result.signal) {
    failed = true;
    console.error("FAILED", result.error ? result.error.message : result.signal || result.status);
  }
}
process.exitCode = failed ? 1 : 0;

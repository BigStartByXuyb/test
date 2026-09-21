"use strict";

// Validate actual reference targets and runnable CLI options, not a blacklist of words.
// Behavioral consistency is exercised by run-all-boundaries and the generated-contract test.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");
const skill = path.resolve(__dirname, "../..");
const source = fs.readFileSync(path.join(skill, "SKILL.md"), "utf8");
const authority = "references/adapters/mtslg-iocontrol/bundle-manifest.md";
assert.ok(source.includes(authority), "Skill must link to its Bundle contract");
assert.ok(fs.statSync(path.join(skill, authority)).isFile());
const script = path.join(skill, "scripts/run-all.ps1");
const declared = JSON.parse(execFileSync("pwsh", ["-NoProfile", "-NonInteractive", "-Command",
  "@((Get-Command '" + script.replace(/'/g, "''") + "').Parameters.Keys) | ConvertTo-Json -Compress"
], { encoding: "utf8" }));
const names = new Set(declared.map((name) => name.toLowerCase()));
for (const line of source.split(/\r?\n/).filter((line) => line.includes("pwsh ") && line.includes("run-all.ps1"))) {
  const tail = line.slice(line.indexOf("run-all.ps1") + "run-all.ps1".length);
  for (const match of tail.matchAll(/(?:^|\s)-([A-Za-z][A-Za-z0-9]*)/g)) {
    assert.ok(names.has(match[1].toLowerCase()), "Unsupported documented run-all option: " + match[1]);
  }
}
console.log("PASS contract reference and actual CLI parameter checks");

#!/usr/bin/env node
"use strict";

// 脚本复用硬门禁回归：
//   1) 真实 scripts/ 目录必须通过 audit-script-duplication.js（没有跨脚本的重复实现）；
//   2) 复制体必须被判 R1 失败（同一个功能抄第二份要被拦下）；
//   3) 未登记的同名函数必须被判 R2 失败（分开写第二套实现要被拦下）；
//   4) 共享模块必须真的被需要的脚本 require（防止「抽了 lib 又抄回脚本里」）。

const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");

const SCRIPT_DIR = path.join(__dirname, "..");
const AUDIT = path.join(SCRIPT_DIR, "audit-script-duplication.js");
const REGISTRY = path.join(SCRIPT_DIR, "lib", "script-reuse-registry.json");

function runAudit(args) {
  return spawnSync(process.execPath, [AUDIT].concat(args || []), { encoding: "utf8" });
}

// 1) 真实脚本目录：必须通过。
const real = runAudit([]);
assert.strictEqual(real.status, 0, real.stderr);
assert.match(real.stdout, /PASS 脚本复用检查/);

// 2) 复制体（同一函数体两个脚本）→ R1 失败。
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "script-dup-"));
fs.writeFileSync(path.join(tmp, "a.js"), "function sharedHelper(value) { return String(value).trim(); }\n", "utf8");
fs.writeFileSync(path.join(tmp, "b.js"), "function sharedHelper(value) { return String(value).trim(); }\n", "utf8");
const copied = runAudit(["--scripts", tmp, "--registry", REGISTRY]);
assert.strictEqual(copied.status, 2, "复制体必须被判失败: " + copied.stdout + copied.stderr);
assert.match(copied.stderr, /\[R1\]/);
assert.match(copied.stderr, /sharedHelper/);

// 3) 同名不同体、又没登记原因 → R2 失败。
fs.writeFileSync(path.join(tmp, "b.js"), "function sharedHelper(value, extra) { return String(extra || value).split(','); }\n", "utf8");
const sameName = runAudit(["--scripts", tmp, "--registry", REGISTRY]);
assert.strictEqual(sameName.status, 2, "未登记的同名函数必须被判失败");
assert.match(sameName.stderr, /\[R2\]/);

// 4) 登记了 reason 的同名函数 → 放行（登记是显式决定，不是隐藏白名单）。
const registryCopy = path.join(tmp, "registry.json");
fs.writeFileSync(registryCopy, JSON.stringify({
  entries: [{ name: "sharedHelper", reason: "测试用：两个脚本各有一份语义不同的同名函数" }]
}, null, 2), "utf8");
const registered = runAudit(["--scripts", tmp, "--registry", registryCopy]);
assert.strictEqual(registered.status, 0, registered.stderr);
assert.match(registered.stdout, /sharedHelper/);

// 5) 登记表条目必须写 reason（否则失败，防止把登记表当白名单滥用）。
fs.writeFileSync(registryCopy, JSON.stringify({ entries: [{ name: "sharedHelper" }] }, null, 2), "utf8");
const noReason = runAudit(["--scripts", tmp, "--registry", registryCopy]);
assert.strictEqual(noReason.status, 2);
assert.match(noReason.stderr, /必须写 reason/);

// 6) 共享模块必须真的被需要的脚本 require（抽了 lib 又抄回脚本里 = 违规）。
const requiredBy = [
  ["lib/project-csproj.js", ["gen-mastergo-page-bundle.js", "gen-mw-wpf-page.js"]],
  ["lib/iocontrol-map-rules.js", ["gen-iocontrol-xml.js", "validate-iocontrol-provenance.js"]],
  ["lib/mastergo-rules.js", ["gen-mtslg-mapping-from-dsl.js", "apply-container-containment.js"]],
  ["lib/script-helpers.js", [
    "gen-mastergo-page-bundle.js", "gen-mw-wpf-page.js", "gen-mtslg-layout.js",
    "gen-mtslg-layout-manifest.js", "gen-mtslg-page-icons.js", "discover-mtslg-page-icon-map.js",
    "gen-mtslg-lang-keys-from-dsl.js", "gen-mtslg-page-lang.js", "resolve-mastergo-visibility.js",
    "resolve-mtslg-template-mapping.js", "gen-mtslg-mapping-from-dsl.js",
    "apply-container-containment.js", "check-iocontrol-coords.js", "validate-iocontrol-provenance.js"
  ]]
];
for (const [libRelative, scripts] of requiredBy) {
  assert.ok(fs.existsSync(path.join(SCRIPT_DIR, libRelative)), "共享模块必须存在: " + libRelative);
  for (const script of scripts) {
    const text = fs.readFileSync(path.join(SCRIPT_DIR, script), "utf8");
    const libName = path.basename(libRelative);
    assert.ok(text.includes(libName), script + " 必须 require 共享模块 " + libName + "（不许再写一份）");
  }
}

console.log("PASS 脚本复用硬门禁（复制体 / 未登记同名 / 共享模块必须被 require）");

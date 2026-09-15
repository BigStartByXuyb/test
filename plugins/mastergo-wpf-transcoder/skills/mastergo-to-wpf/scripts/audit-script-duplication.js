#!/usr/bin/env node
"use strict";

/**
 * audit-script-duplication.js —— 「同一个功能不许再写一份」的硬门禁
 *
 * 背景：本插件的脚本各自可独立运行，历史上因此把同一套工具函数抄了很多份
 * （fail / xmlAttr / backupFile / readJson / inferHostPaths / num / 模板表规则读取 …），
 * 抄完就开始漂移：inferHostPaths 两处一份用 startsWith、一份用 includes；
 * num 一处 parseFloat、一处 Number。修一处漏一处，产物就不一致。
 *
 * 判定（只做机械可判定的两件事，不做语义猜测）：
 *   R1 复制体：同一函数体（去注释/空白/引号风格后逐 token 相同）出现在 ≥2 个脚本 → 失败。
 *      处理方式：抽到 scripts/lib/ 下的共享模块，各脚本 require。
 *   R2 同名函数：同名函数出现在 ≥2 个脚本，且未登记在 scripts/lib/script-reuse-registry.json
 *      （登记必须写 reason）→ 失败。处理方式：复用共享实现，或登记「为什么同名是合理的」。
 *   INFO 同名不同体且已登记：只打印清单，供人复核，不影响退出码。
 *
 * 范围：scripts/*.js（不含 scripts/lib/ 共享模块与 scripts/tests/）。
 * 用法：node audit-script-duplication.js [--scripts <目录>] [--registry <json>]
 * 退出码：0 = 通过；2 = 有未登记的重复实现。
 */

const fs = require("fs");
const path = require("path");
const { fail } = require(path.join(__dirname, "lib", "script-helpers.js"));

const SCRIPT_DIR = __dirname;
const DEFAULT_REGISTRY = path.join(SCRIPT_DIR, "lib", "script-reuse-registry.json");

function parseArgs(argv) {
  const out = { scripts: SCRIPT_DIR, registry: DEFAULT_REGISTRY };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === "--scripts") out.scripts = argv[++i];
    else if (argv[i] === "--registry") out.registry = argv[++i];
    else fail("无法识别的参数: " + argv[i]);
  }
  return out;
}

// 取出文件里所有顶层 `function name(args) { ... }`（含花括号配平）。
function functionsOf(sourceText) {
  const result = [];
  const re = /(?:^|\n)\s*function\s+([A-Za-z_$][\w$]*)\s*\(([^)]*)\)/g;
  let match;
  while ((match = re.exec(sourceText)) !== null) {
    const braceStart = sourceText.indexOf("{", match.index + match[0].length - 1);
    if (braceStart < 0) continue;
    let depth = 0;
    let end = -1;
    for (let i = braceStart; i < sourceText.length; i += 1) {
      const ch = sourceText[i];
      if (ch === "{") depth += 1;
      else if (ch === "}") {
        depth -= 1;
        if (depth === 0) { end = i; break; }
      }
    }
    if (end < 0) continue;
    const line = sourceText.slice(0, match.index).split("\n").length;
    result.push({
      name: match[1],
      args: match[2].split(",").map(function (item) { return item.trim(); }).filter(Boolean).join(","),
      body: sourceText.slice(braceStart, end + 1),
      line: line
    });
  }
  return result;
}

// 归一化：去注释、去空白、去引号风格差异，只留 token 序列。
function normalizeBody(body) {
  return body
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/[^\n]*/g, "")
    .replace(/[\s]+/g, "")
    .replace(/['"]/g, "");
}

function loadRegistry(registryPath) {
  const raw = JSON.parse(fs.readFileSync(registryPath, "utf8"));
  const entries = Array.isArray(raw.entries) ? raw.entries : [];
  const byName = new Map();
  entries.forEach(function (entry) {
    if (!entry || typeof entry.name !== "string" || !entry.name) {
      fail("script-reuse-registry 条目缺少 name: " + JSON.stringify(entry));
    }
    if (typeof entry.reason !== "string" || !entry.reason.trim()) {
      fail("script-reuse-registry 条目必须写 reason（为什么同名的两处不是复制）: " + entry.name);
    }
    byName.set(entry.name, entry);
  });
  return byName;
}

function audit(scriptDir, registryPath) {
  const registry = loadRegistry(registryPath);
  const files = fs.readdirSync(scriptDir).filter(function (name) { return name.endsWith(".js"); });
  const byName = new Map();
  const byBody = new Map();
  files.forEach(function (file) {
    functionsOf(fs.readFileSync(path.join(scriptDir, file), "utf8")).forEach(function (fn) {
      const normalized = normalizeBody(fn.body);
      const record = { file: file, line: fn.line, name: fn.name, args: fn.args, normalized: normalized };
      if (!byName.has(fn.name)) byName.set(fn.name, []);
      byName.get(fn.name).push(record);
      if (!byBody.has(normalized)) byBody.set(normalized, []);
      byBody.get(normalized).push(record);
    });
  });

  const violations = [];
  // R1：同一函数体出现在多个脚本 = 复制体。
  byBody.forEach(function (group) {
    const filesInGroup = [...new Set(group.map(function (item) { return item.file; }))];
    if (filesInGroup.length < 2) return;
    violations.push({
      rule: "R1",
      name: group[0].name,
      detail: "同一函数体被复制到多个脚本：" +
        group.map(function (item) { return item.file + ":" + item.line + " (" + item.name + ")"; }).join(", "),
      hint: "抽到 scripts/lib/ 下的共享模块，各脚本 require 复用"
    });
  });
  // R2：同名函数跨脚本，且未登记原因。
  const registered = [];
  byName.forEach(function (group, name) {
    const filesInGroup = [...new Set(group.map(function (item) { return item.file; }))];
    if (filesInGroup.length < 2) return;
    const entry = registry.get(name);
    if (!entry) {
      violations.push({
        rule: "R2",
        name: name,
        detail: "同名函数出现在多个脚本：" +
          group.map(function (item) { return item.file + ":" + item.line; }).join(", "),
        hint: "复用同一份实现；确实职责不同的，登记到 scripts/lib/script-reuse-registry.json 并写 reason"
      });
      return;
    }
    registered.push({ name: name, files: filesInGroup, reason: entry.reason });
  });
  // 登记表里的名字如果已经不复用了，提示清理（不失败）。
  const stale = [...registry.keys()].filter(function (name) { return !byName.has(name); });
  return { files: files.length, violations: violations, registered: registered, stale: stale };
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const report = audit(args.scripts, args.registry);
  console.log(JSON.stringify({
    scannedScripts: report.files,
    violations: report.violations,
    registeredDuplicates: report.registered.map(function (item) { return item.name; }),
    staleRegistryEntries: report.stale
  }, null, 2));
  if (report.violations.length > 0) {
    console.error("脚本重复实现检查未通过（同一个功能必须复用，不许再写一份）：");
    report.violations.forEach(function (item) {
      console.error("  [" + item.rule + "] " + item.name + " —— " + item.detail + "\n        处理：" + item.hint);
    });
    process.exit(2);
  }
  console.log("PASS 脚本复用检查：未发现跨脚本的重复实现（" + report.registered.length + " 处同名已登记原因）");
}

if (require.main === module) {
  try { main(); } catch (error) { console.error(error && error.message ? error.message : String(error)); process.exit(2); }
}

module.exports = { functionsOf: functionsOf, normalizeBody: normalizeBody, audit: audit };

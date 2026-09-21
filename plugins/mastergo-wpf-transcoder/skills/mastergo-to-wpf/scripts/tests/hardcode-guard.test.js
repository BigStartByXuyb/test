#!/usr/bin/env node
"use strict";

// 插件脚本里不得出现"某个项目/某个页面"的字面量回归。
// 背景（v1.0.233 实测）：
//   1) run-all.ps1 的 `-FileId` 参数默认值写死了一个具体项目的 MasterGo 文件 id，并把它当"哨兵值"
//      （`$FileId -eq '<该项目 id>'` → 用登记表覆盖），后果是别的项目不传参数时静默取到该项目的设计稿；
//   2) gen-mastergo-page-bundle.js 用 `manifest.area || "F2-Manual"` 给区域前缀兜底，
//      让"清单漏字段"变成"写到另一个区域目录"。
// 插件是通用发布物：项目事实（fileId / layerId / 区域前缀）只能来自命令行或目标项目登记表。

const assert = require("assert");
const fs = require("fs");
const path = require("path");

const SCRIPTS = path.join(__dirname, "..");
const SKILL = path.join(SCRIPTS, "..");

const scriptFiles = fs.readdirSync(SCRIPTS, { withFileTypes: true })
  .filter((entry) => entry.isFile() && /\.(ps1|js|mjs)$/.test(entry.name))
  .map((entry) => path.join(SCRIPTS, entry.name));
assert.ok(scriptFiles.length > 10, "必须能枚举到插件脚本");

// MasterGo 文件 id 是 15 位数字；图层 id 形如 79:149312。两者都不得写进脚本。
const FILE_ID = /(?<![\w.])\d{15}(?![\w.])/g;
const LAYER_ID = /(?<![\w.:])\d{2,6}:\d{5,}(?![\w.:])/g;
const AREA_FALLBACK = /F\d+-[A-Za-z]+/;

for (const file of scriptFiles) {
  const rel = path.relative(SKILL, file);
  const text = fs.readFileSync(file, "utf8");
  // 注释里出现 id 形状只用于说明口径（如「页面键形如 123:4567890」），不算写死项目事实；
  // 真正要守的是代码/参数默认值里不得出现某个具体项目的 id。
  const lines = text.split(/\r?\n/);
  const isCommentLine = (index) => /^\s*(\/\/|\/\*|\*|#|<!--)/.test(lines[index] || "");
  const violations = (pattern) => {
    const hits = [];
    pattern.lastIndex = 0;
    let match;
    while ((match = pattern.exec(text))) {
      const lineIndex = text.slice(0, match.index).split("\n").length - 1;
      if (!isCommentLine(lineIndex)) hits.push(match[0] + "（第 " + (lineIndex + 1) + " 行）");
    }
    return hits;
  };
  const fileIds = violations(FILE_ID);
  const layerIds = violations(LAYER_ID);
  assert.deepStrictEqual(fileIds, [],
    rel + " 不得写死 MasterGo 文件 id（应来自 -FileId 或项目登记表）: " + fileIds.join(", "));
  assert.deepStrictEqual(layerIds, [],
    rel + " 不得写死 MasterGo 图层 id（应来自 -LayerId 或项目登记表）: " + layerIds.join(", "));
  if (file.endsWith("gen-mastergo-page-bundle.js")) {
    assert.ok(!AREA_FALLBACK.test(text),
      rel + " 不得给区域前缀写兜底默认值（清单缺字段必须直接失败）");
  }
}

// run-all.ps1：-FileId 不得有默认值，也不得用某个具体 id 当"哨兵值"。
const runAll = fs.readFileSync(path.join(SCRIPTS, "run-all.ps1"), "utf8");
const paramBlock = runAll.slice(0, runAll.indexOf("$ErrorActionPreference"));
assert.ok(/\[string\]\s*\$FileId\s*(,|\r?\n)/.test(paramBlock.replace(/\[string\]\s*\$FileId\s*=/, "SENTINEL")),
  "run-all.ps1 的 -FileId 参数不得带默认值（必须由命令行或项目登记表提供）");
assert.ok(!/\[string\]\s*\$FileId\s*=\s*'/.test(paramBlock),
  "run-all.ps1 的 -FileId 参数不得带字符串默认值");
assert.ok(runAll.includes("if (-not $FileId) { $FileId = $Registry.FileId }"),
  "run-all.ps1 必须按「命令行 → 项目登记表」解析 fileId");
assert.ok(!/if \(-not \$FileId -or \$FileId -eq/.test(runAll),
  "run-all.ps1 不得再用某个具体 fileId 当哨兵值（显式传入必须生效）");
assert.ok(runAll.includes("缺少 MasterGo 文件 id"),
  "run-all.ps1 必须在 fileId 取不到时明确报错，而不是静默用默认值");

console.log("PASS 插件脚本无项目专属字面量（fileId / layerId / 区域前缀兜底）回归测试");

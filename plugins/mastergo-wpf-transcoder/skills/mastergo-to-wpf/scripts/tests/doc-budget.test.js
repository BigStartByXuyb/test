#!/usr/bin/env node
"use strict";

// SKILL.md 分层与预算回归。
// 背景：SKILL.md 会在技能触发时整份进入上下文（references/ 才是按需读取）。
// v1.0.233 的 SKILL.md 是 415 行 / 46.8k 字符（≈2.6 万 token），加上 MTSLG 路线必读的
// mtslg-mode.md，每转一页就要常驻 4 万 token 量级的"读规矩"成本，而且大量内容与脚本/reference 重复。
// 本测试守住两件事：
//   1) SKILL.md 只做"路由 + 契约 + 索引"，篇幅有硬预算，防止再次长回去；
//   2) SKILL.md 里出现的每个 references/ 路径都必须真实存在（死链会让执行者按不存在的文档走）。

const assert = require("assert");
const fs = require("fs");
const path = require("path");

const SKILL = path.join(__dirname, "..", "..");
const skillMd = path.join(SKILL, "SKILL.md");
const text = fs.readFileSync(skillMd, "utf8");
const lines = text.split(/\r?\n/);

const MAX_LINES = 150;
const MAX_CHARS = 15000;
assert.ok(lines.length <= MAX_LINES,
  `SKILL.md 必须保持在 ${MAX_LINES} 行以内（当前 ${lines.length} 行）：细节放 reference，SKILL.md 只留路由/契约/索引`);
assert.ok(text.length <= MAX_CHARS,
  `SKILL.md 必须保持在 ${MAX_CHARS} 字符以内（当前 ${text.length} 字符）：它是常驻上下文，不是规则手册`);

// 指针必须存在：references/**/*.md（含目录形式的 ** 通配）逐个落盘校验。
const pointerRe = /references\/[A-Za-z0-9_\-./*]+/g;
const pointers = new Set();
for (const match of text.matchAll(pointerRe)) {
  const raw = match[0].replace(/[./]+$/, "");
  if (!raw || raw === "references") continue;
  pointers.add(raw);
}
assert.ok(pointers.size >= 5, "SKILL.md 必须点名它引用的参考文件（当前命中 " + pointers.size + " 个）");
for (const pointer of pointers) {
  const target = path.join(SKILL, pointer.replace(/\/\*\*$/, ""));
  assert.ok(fs.existsSync(target),
    "SKILL.md 指向了不存在的路径: " + pointer + "（解析为 " + target + "）");
  if (pointer.endsWith(".md")) {
    assert.ok(fs.statSync(target).isFile(), "文档指针必须指向文件: " + pointer);
  }
}

// 每条分流/契约的入口都必须能被找到（名字写在 SKILL.md 里，内容在 reference 里）。
for (const needle of [
  "references/adapters/mtslg-iocontrol/mtslg-mode.md",
  "references/adapters/mtslg-iocontrol/pipeline-contract.md",
  "references/adapters/mtslg-iocontrol/bundle-manifest.md",
  "references/adapters/mtslg-iocontrol/feishu-layout-mapping.md",
]) {
  assert.ok(text.includes(needle), "SKILL.md 必须给出入口指针: " + needle);
}

// 触发边界、入口分流、12 步流水线、三类页面级输入、交付清单必须留在 SKILL.md（模型必须判断的部分）。
for (const heading of ["## 触发边界", "## 入口分流", "## 一键流水线", "## 硬门禁索引", "## 交付与验收", "## 参考文件读取条件"]) {
  assert.ok(lines.some((line) => line.trim().startsWith(heading)), "SKILL.md 必须保留小节: " + heading);
}
assert.ok(text.includes("--merge"), "SKILL.md 必须写明修改现有页面走 --merge");
assert.ok(text.includes("gen-mastergo-page-bundle.js"), "SKILL.md 必须写明新建页面走 Bundle 入口");
// 一键流水线必须写明"一次调用跑完全部 12 步"：表里的步骤是失败定位/续跑单元，
// 不是 12 条要分别执行的命令（否则模型会逐步手工调用子脚本）。
assert.ok(text.includes("一次调用跑完全部 12 步"),
  "SKILL.md 必须写明一键流水线是一次调用跑完 12 步");
assert.ok(text.includes("不要为每一步单独起一次"),
  "SKILL.md 必须写明不要为每一步单独起一次 run-all");
assert.ok(text.includes("登记表有多页时必须用 `-Target` 或 `-LayerId` 选中本次页面"),
  "SKILL.md 必须写明多页登记表下要先选中本次页面（不得取第一页顶上）");
for (const input of ["icon-naming.json", "lang-translations.json", "lang-glossary.json"]) {
  assert.ok(text.includes(input), "SKILL.md 必须写明模型要提供的页面级输入: " + input);
}
for (const step of ["fetch", "capture", "svg", "visibility", "mapping", "discover",
  "ledger", "layout", "inputs", "bundle", "gates", "verify"]) {
  assert.ok(text.includes(step), "SKILL.md 的流水线表必须列出步骤 " + step);
}

// SKILL.md 不得再复述脚本已强制的长篇细节（以"必须包含大段口径"的方式长回去）。
const forbidden = [
  /\bF2-Manual\b/,
  /\[string\]\s*\$FileId\s*=/,
];
for (const pattern of forbidden) {
  assert.ok(!pattern.test(text), "SKILL.md 不得包含项目专属字面量/默认值: " + pattern);
}

console.log("PASS SKILL.md 分层与预算（" + lines.length + " 行 / " + text.length + " 字符，" +
  pointers.size + " 个参考指针全部存在）");

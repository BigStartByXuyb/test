#!/usr/bin/env node
"use strict";

// 跨脚本共用的纯工具：**唯一实现**，各脚本一律 require 本文件，禁止再抄一份。
// 硬门禁：scripts/tests/script-duplication.test.js（调 scripts/audit-script-duplication.js）
// 会扫描 scripts/*.js，发现「同一个函数在多个脚本里出现完全相同的实现」即失败。
// 共享边界：只共享语义完全一致的纯工具。各脚本自己的入口解析（parseArgs/usage/main）
// 与专属规则读取函数保留在脚本内——它们的参数、默认值与失败口径本来就不同。

const fs = require("fs");

// 通用失败：抛错，由各脚本顶层 catch 转成 stderr + 退出码。
function fail(message) {
  throw new Error(message);
}

// 带模块前缀的失败（如「语言键派生失败: xxx」）：返回一个装配好的 fail，脚本里只绑定一次。
function failWithPrefix(prefix) {
  return function (message) {
    throw new Error(prefix + ": " + message);
  };
}

// 立即失败并退出（不抛错）：给「参数校验 + 顶层 catch 会改变退出码」的脚本用。
function failAndExit(code) {
  return function (message) {
    console.error(message);
    process.exit(code);
  };
}

// XML 属性转义：写 XML 属性的脚本共用（&quot; 必须转）。
function xmlAttr(value) {
  return String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

// XML 文本转义：XAML 文本与 C# XML 文档注释共用（文本不转义引号）。
function xmlDocText(value) {
  return String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// 匹配键归一化：去空白后比对（组件集名、属性名等）。
function normalizeToken(value) {
  return String(value || "").replace(/\s+/g, "");
}

// XML 属性取数：空值 → null，字面量 'NaN' → 'NaN'（表示设计侧无坐标），其余严格按 Number。
// 严格口径（Number 而非 parseFloat）：非数字内容一律 null，宁可让坐标校验报 MISMATCH，也不放过脏值。
function numberOrNull(value) {
  if (value === undefined || value === null || value === "") return null;
  if (value === "NaN") return "NaN";
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

// 读 JSON：失败信息带调用方给的 label，便于定位是哪个输入坏了。
function readJson(filePath, label) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (error) {
    throw new Error("Cannot read " + (label || "JSON") + " " + filePath + ": " + error.message);
  }
}

// 覆盖前备份：<文件>.bak-<时间戳>，同一秒内多次备份自动加序号。
function backupFile(filePath) {
  const stamp = new Date().toISOString().replace(/[-:TZ.]/g, "").slice(0, 14);
  let backup = filePath + ".bak-" + stamp;
  let index = 2;
  while (fs.existsSync(backup)) backup = filePath + ".bak-" + stamp + "-" + index++;
  fs.copyFileSync(filePath, backup);
  return backup;
}

module.exports = {
  fail: fail,
  failWithPrefix: failWithPrefix,
  failAndExit: failAndExit,
  xmlAttr: xmlAttr,
  xmlDocText: xmlDocText,
  normalizeToken: normalizeToken,
  numberOrNull: numberOrNull,
  readJson: readJson,
  backupFile: backupFile
};

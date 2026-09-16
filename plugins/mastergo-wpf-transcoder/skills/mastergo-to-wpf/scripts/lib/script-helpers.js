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

// 设计换行归一：MasterGo DSL 的换行码点（U+2028 行分隔符、U+2029 段分隔符、CR、CRLF、LF）
// 统一归一成 LF（U+000A）。这是「设计文本 → 发射文本」换行口径的**实现真值源**：
// 生成器、校验器、Bundle、字典发射器都只从这里取；映射表 textNewlinePolicy 只登记同一口径
// 供人读与回归断言比对（它不是脚本的运行期输入）。
function normalizeNewlines(value) {
  return String(value === undefined || value === null ? "" : value).replace(/\r\n|[\r\u2028\u2029]/g, "\n");
}

// 语言字典**值**的文案变换（实现真值源）：
//   1) 归一换行（与页面 XML 属性同口径）；
//   2) 行内空白（空格 / 制表符等非换行空白）折叠成单个空格；
//   3) 去掉行首行尾空白（trim）。
// 页面 XML 属性文案只做第 1 步、其余空白原样保留；键派生 / 查译文 / 术语表匹配另用全量压平值
// （见 gen-mtslg-lang-keys-from-dsl.js 的 normalizeText）。三者用途不同，不是同一份字符串。
function langValueText(value) {
  return normalizeNewlines(value)
    .replace(/[^\S\n]+/g, " ")
    .replace(/ *\n */g, "\n")
    .trim();
}

// XML 字符引用解码：校验器/比对器拿到的是 XML 原始文本（可能是 &#x0a; 这类引用），
// 与 mapping 文案比较前必须解码（命名实体 + 十进制/十六进制数字引用）。
function decodeXmlEntities(value) {
  return String(value === undefined || value === null ? "" : value).replace(
    /&(?:#x([0-9A-Fa-f]+)|#([0-9]+)|(lt|gt|quot|apos|amp));/g,
    function (_match, hex, dec, named) {
      if (hex) return String.fromCodePoint(parseInt(hex, 16));
      if (dec) return String.fromCodePoint(parseInt(dec, 10));
      return { lt: "<", gt: ">", quot: '"', apos: "'", amp: "&" }[named];
    }
  );
}

// 文案比对归一：先解码字符引用、再把换行码点归一成 LF。
// 页面 XML 的原属性值 与 mapping 文案 的比较只走这一条（换行口径变化的唯一兼容点）。
function normalizeForCompare(value) {
  return normalizeNewlines(decodeXmlEntities(value));
}

// XML 属性转义：写 XML 属性的脚本共用（&quot; 必须转）。
// 属性值里不能出现字面换行——XML 解析器会把它归一成空格——所以 LF 必须写成字符引用 &#x0a;。
function xmlAttr(value) {
  return normalizeNewlines(value).replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/\n/g, "&#x0a;");
}

// XML 文本转义：XAML 文本与 C# XML 文档注释共用（文本不转义引号）。
function xmlDocText(value) {
  return String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// XML 元素内容转义：换行同样写成 &#x0a;（元素内容里字面 LF 也合法，但显式引用避免行结构歧义）。
function xmlElementText(value) {
  return xmlDocText(normalizeNewlines(value)).replace(/\n/g, "&#x0a;");
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
  normalizeNewlines: normalizeNewlines,
  langValueText: langValueText,
  decodeXmlEntities: decodeXmlEntities,
  normalizeForCompare: normalizeForCompare,
  xmlAttr: xmlAttr,
  xmlDocText: xmlDocText,
  xmlElementText: xmlElementText,
  normalizeToken: normalizeToken,
  numberOrNull: numberOrNull,
  readJson: readJson,
  backupFile: backupFile
};

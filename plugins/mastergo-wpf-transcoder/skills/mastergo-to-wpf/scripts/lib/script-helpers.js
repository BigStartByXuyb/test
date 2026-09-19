#!/usr/bin/env node
"use strict";

// 跨脚本共用的纯工具：**唯一实现**，各脚本一律 require 本文件，禁止再抄一份。
// 硬门禁：scripts/tests/script-duplication.test.js（调 scripts/audit-script-duplication.js）
// 会扫描 scripts/*.js，发现「同一个函数在多个脚本里出现完全相同的实现」即失败。
// 共享边界：只共享语义完全一致的纯工具。各脚本自己的入口解析（parseArgs/usage/main）
// 与专属规则读取函数保留在脚本内——它们的参数、默认值与失败口径本来就不同。

const fs = require("fs");
const path = require("path");

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
  // 数组入参按「同一行的多个 text run」处理：空串拼接（与 DSL 文本取值同口径），不做逗号连接。
  const text = Array.isArray(value) ? value.join("") : value;
  return normalizeNewlines(text)
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

// 同一目标文件保留的备份份数：只留最近 MAX_BACKUPS 个 .bak，更早的副本在下次备份时自动删除。
const MAX_BACKUPS = 2;

// 列出某个目标文件的全部备份，**最近的在前**。
// 排序键：先修改时间（同一秒内的 -2/-3 序号也据此定序），时间相同再按文件名倒序。
function listBackups(filePath) {
  const dir = path.dirname(filePath);
  const prefix = path.basename(filePath) + ".bak-";
  let names;
  try {
    names = fs.readdirSync(dir);
  } catch (error) {
    return [];
  }
  const entries = [];
  names.forEach(function (name) {
    if (!name.startsWith(prefix)) return;
    const full = path.join(dir, name);
    try {
      const stat = fs.statSync(full);
      if (stat.isFile()) entries.push({ path: full, mtime: stat.mtimeMs });
    } catch (error) {
      // 期间被删/被占用：跳过，不作为备份参与保留判定。
    }
  });
  entries.sort(function (a, b) {
    if (b.mtime !== a.mtime) return b.mtime - a.mtime;
    return a.path < b.path ? 1 : (a.path > b.path ? -1 : 0);
  });
  return entries.map(function (entry) { return entry.path; });
}

// 清理超出保留份数的旧备份；删除失败不影响生成（备份只是回滚手段）。
// keepPath（刚创建的那份）必定保留：备份文件名在同一秒内会被复用（旧副本删掉后名字空出来），
// 只按名字/时间排序存在把"新建的那份"判成旧副本的可能，因此这里显式钉住它。
function pruneBackups(filePath, keepPath) {
  const backups = listBackups(filePath);
  const keep = [];
  if (keepPath && backups.indexOf(keepPath) !== -1) keep.push(keepPath);
  backups.forEach(function (candidate) {
    if (keep.length >= MAX_BACKUPS || keep.indexOf(candidate) !== -1) return;
    keep.push(candidate);
  });
  backups.forEach(function (stale) {
    if (keep.indexOf(stale) !== -1) return;
    try {
      fs.unlinkSync(stale);
    } catch (error) {
      // 忽略：清理失败时保留旧副本比中断生成更安全。
    }
  });
  return keep;
}

// 覆盖前备份：<文件>.bak-<时间戳>，同一秒内多次备份自动加序号；
// 备份后只保留最近 MAX_BACKUPS 份（默认 2），避免项目里越攒越多副本。
function backupFile(filePath) {
  const stamp = new Date().toISOString().replace(/[-:TZ.]/g, "").slice(0, 14);
  let backup = filePath + ".bak-" + stamp;
  let index = 2;
  while (fs.existsSync(backup)) backup = filePath + ".bak-" + stamp + "-" + index++;
  fs.copyFileSync(filePath, backup);
  pruneBackups(filePath, backup);
  return backup;
}

// 变体登记 omitRequiredAttrs 的节点：这些必写字段一律不发射、也不参与校验。
// 唯一真值源是映射表的变体登记（解析器把它盖成节点上的 omitAttrs）；生成器与校验器共用本实现。
function omittedAttrs(node) {
  const list = node && node.omitAttrs;
  if (!Array.isArray(list)) return new Set();
  return new Set(list.map(function (name) { return String(name).trim(); }).filter(Boolean));
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
  omittedAttrs: omittedAttrs,
  backupFile: backupFile,
  listBackups: listBackups,
  pruneBackups: pruneBackups,
  MAX_BACKUPS: MAX_BACKUPS
};

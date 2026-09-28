#!/usr/bin/env node
"use strict";

// 映射变更工具：把「新增/删除一个变体」做成一次原子改动。
//
// 为什么要有它：一次映射改动要动好几个地方（映射表、人读文档的总数行与枚举、变体小节、
// 版本号、回归），漏一处不会立刻报错，只会等到生成页面时以「未命中变体」暴露 ——
// 2026-09-29 的「底部栏/非首页-长方形」就是这么漏的。
//
// 它做什么：校验 → 改映射表 → 改人读文档 → 递增版本号 → 跑门禁（覆盖审计、node --test、
// 两个 .tests.ps1）；任何一项失败就把已改的文件**写回原文**，不留半改状态。
//
// 它不做什么：不发明语义 —— 新小节的正文要么从 --like 克隆，要么由 --template 提供；
// 也不碰飞书在线文档（规范第 6 项，属于发版节奏，工具会提示）。
//
// 支持范围：目前只有 layoutRules.bottomBar（「一个变体一节」的形态）。组件库文档那边是
// 「一节覆盖多个变体」（如 组件集=输入框，变体=整数），与映射表的粒度（输入框-整数-40）
// 不一致，改法要看具体那一节，工具不猜。
//
// 用法：
//   node scripts/tools/mapping-change.js add-variant --family layoutRules.bottomBar \
//        --name <新名字> (--like <现有变体> | --template <小节片段文件>) [--value k=v]… \
//        [--allow-residual-mentions] [--dry-run]
//   node scripts/tools/mapping-change.js remove-variant --family layoutRules.bottomBar --name <名字>
//   node scripts/tools/mapping-change.js check        # 只跑门禁
//   node scripts/tools/mapping-change.js audit        # 拉最近的 CI 语义审计结果（gh）
//
// --template 片段的第一行必须是「### 变体：<新名字>」；--like 克隆时若小节里还有别处提到
// 参照变体（说明不是只换名字），工具会报出来并要求改用 --template 或显式加
// --allow-residual-mentions。

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

// 真值源的读取入口只有一个（见规范「新增/修改映射的同步清单」第 1 项）：
// 校验一律走它读合并结果，不自己拼两份文件。
const { loadTemplateMap } = require(path.join(__dirname, "..", "lib", "load-template-map.js"));

const SKILL_ROOT = path.join(__dirname, "..", "..");
const PLUGIN_ROOT = path.join(SKILL_ROOT, "..", "..");
const SCRIPTS_DIR = path.join(SKILL_ROOT, "scripts");

const SHARED_MAP = path.join(SKILL_ROOT, "references", "component-types.json");
const ROUTE_MAP = path.join(SKILL_ROOT, "references", "adapters", "mtslg-iocontrol", "mtslg-iocontrol-map.json");
const LAYOUT_DOC = path.join(SKILL_ROOT, "references", "adapters", "mtslg-iocontrol", "feishu-layout-mapping.md");
const COMPONENT_DOC = path.join(SKILL_ROOT, "references", "adapters", "mtslg-iocontrol", "feishu-component-library-mapping.md");
const PLUGIN_JSON = path.join(PLUGIN_ROOT, ".claude-plugin", "plugin.json");

const SUPPORTED_FAMILY = "layoutRules.bottomBar";
const SECTION_PREFIX = "### 变体：";
const COUNT_LINE_RE = /(`layoutRules\.bottomBar\.variants`\s*共\s*)(\d+)(\s*个)/;
const ENUM_RE = /(\*\*逐个列全\*\*——)([^。]*)(。)/;

function fail(message, hint) {
  console.error("✗ " + message);
  if (hint) console.error("  " + hint);
  process.exit(2);
}

function escapeRe(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function parseArgs(argv) {
  const out = { _: [] };
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith("--")) {
      out._.push(token);
      continue;
    }
    const key = token.slice(2);
    const next = argv[index + 1];
    if (next === undefined || next.startsWith("--")) {
      out[key] = true;
      continue;
    }
    index += 1;
    if (key === "value") out.value = (out.value || []).concat([next]);
    else out[key] = next;
  }
  return out;
}

function eolOf(text) {
  return text.includes("\r\n") ? "\r\n" : "\n";
}

/*
 * 文档按行编辑：拿行数组改、最后按原行尾风格拼回去，所以未触碰的行一个字节都不变。
 */
function loadDoc(file) {
  const text = fs.readFileSync(file, "utf8");
  const eol = eolOf(text);
  return { file: file, eol: eol, lines: text.split(/\r?\n/) };
}

function docText(doc) {
  return doc.lines.join(doc.eol);
}

function countLineIndex(doc) {
  const index = doc.lines.findIndex((line) => COUNT_LINE_RE.test(line));
  if (index < 0) fail("人读文档里找不到 `layoutRules.bottomBar.variants` 的总数行");
  return index;
}

function addCount(doc, delta) {
  const index = countLineIndex(doc);
  doc.lines[index] = doc.lines[index].replace(COUNT_LINE_RE, (all, head, count, tail) => {
    const next = Number(count) + delta;
    if (next < 0) fail("变体总数会变成负数：" + next);
    return head + next + tail;
  });
}

function editEnumeration(doc, options) {
  const index = countLineIndex(doc);
  const hit = ENUM_RE.exec(doc.lines[index]);
  if (!hit) fail("总数行里找不到「逐个列全——…。」枚举段");
  const names = hit[2].split("、").map((item) => item.trim()).filter(Boolean);

  if (options.remove) {
    const at = names.indexOf(options.remove);
    if (at < 0) fail("枚举里没有「" + options.remove + "」");
    names.splice(at, 1);
  }
  if (options.add) {
    if (names.includes(options.add)) fail("枚举里已经有「" + options.add + "」");
    const at = options.afterName ? names.indexOf(options.afterName) : -1;
    if (options.afterName && at < 0) fail("枚举里没有参照变体「" + options.afterName + "」");
    names.splice(at < 0 ? names.length : at + 1, 0, options.add);
  }
  doc.lines[index] = doc.lines[index].replace(ENUM_RE, () => hit[1] + names.join("、") + hit[3]);
}

// 小节范围：标题行 → 下一个一/二/三级标题之前（末尾空行不算在本节里）。
function sectionRange(doc, name) {
  const start = doc.lines.findIndex((line) => line.trim() === SECTION_PREFIX + name);
  if (start < 0) return null;
  let end = doc.lines.length;
  for (let index = start + 1; index < doc.lines.length; index += 1) {
    if (/^#{1,3} /.test(doc.lines[index])) {
      end = index;
      break;
    }
  }
  while (end > start && doc.lines[end - 1].trim() === "") end -= 1;
  return { start: start, end: end };
}

// 插在参照小节**之后**，不替换它：range.end 已排除小节末尾的空行，
// 所以往这里插「空行 + 新小节」就落在两者之间。
function insertSectionAfter(doc, range, block) {
  doc.lines.splice(range.end, 0, "", ...block);
}

function sectionNames(doc) {
  return doc.lines
    .map((line) => line.trim())
    .filter((line) => line.startsWith(SECTION_PREFIX))
    .map((line) => line.slice(SECTION_PREFIX.length));
}

/*
 * 自检：编辑前后的小节集合必须严格是「原集合 ± 本次那个变体」。
 * 门禁查不出「某一节被顶掉」—— 变体名只要还在总数行里逐字出现就算过，
 * 所以工具自己必须证明没有动到别人的小节。
 */
function assertSectionSet(before, after, expectedNames, action) {
  const left = before.slice().sort().join("|");
  const right = after.slice().sort().join("|");
  const want = expectedNames.slice().sort().join("|");
  if (right === want) return;
  fail(
    "自检失败：编辑后的小节集合与预期不一致（" + action + "）",
    "编辑前：" + (left || "（无）") + "\n  编辑后：" + (right || "（无）") + "\n  预期：" + (want || "（无）")
  );
}

/*
 * 从 --like 克隆一节：只换两处 —— 标题里的名字，和「组件名精确等于“<like>”」这句。
 * 小节里若还有别处提到 like 的名字（原文在拿它做对比之类），一律报出来：那说明这节不是
 * 「只换名字」就能复用的，必须改用 --template —— 工具不替人决定文案。
 */
function cloneSection(doc, likeName, newName, allowResidualMentions) {
  const range = sectionRange(doc, likeName);
  if (!range) fail("人读文档里没有「" + SECTION_PREFIX + likeName + "」小节，无法克隆", "改用 --template <小节片段文件>。");
  const block = doc.lines.slice(range.start, range.end);
  const ruleRe = new RegExp("组件名精确等于[“\"]" + escapeRe(likeName) + "[”\"]");
  let headingDone = false;
  let ruleDone = false;
  const mapped = block.map((line) => {
    if (!headingDone && line.trim() === SECTION_PREFIX + likeName) {
      headingDone = true;
      return SECTION_PREFIX + newName;
    }
    if (!ruleDone && ruleRe.test(line)) {
      ruleDone = true;
      return line.replace(ruleRe, "组件名精确等于“" + newName + "”");
    }
    return line;
  });
  if (!ruleDone) {
    fail(
      "被克隆的小节里找不到『组件名精确等于“" + likeName + "”』这句，不能安全换名",
      "改用 --template <小节片段文件> 提供这一节的正文。"
    );
  }
  const residuals = [];
  mapped.forEach((line, index) => {
    // 新名字常常包含旧名字（「底部栏/首页-长方形」⊃「首页-长方形」），先摘掉新名字再判，
    // 否则刚换好的标题会被当成残留。
    const rest = line.split(newName).join("");
    if (rest.includes(likeName)) residuals.push("  " + (index + 1) + " 行：" + line.trim());
  });
  if (residuals.length > 0 && allowResidualMentions !== true) {
    fail(
      "克隆出来的小节里还有 " + residuals.length + " 处提到「" + likeName + "」，说明它不只是换名字",
      residuals.join("\n") + "\n  确认无误就加 --allow-residual-mentions，否则用 --template。"
    );
  }
  return mapped;
}

// ---------- 映射表 ----------

function variantsOf(shared) {
  const bar = shared.layoutRules && shared.layoutRules.bottomBar;
  if (!bar || !bar.variants) fail("映射表缺少 layoutRules.bottomBar.variants");
  return bar.variants;
}

/*
 * 允许写回的那份文件必须**确实是这个键的主人**：`layoutRules.bottomBar.variants` 目前登记在
 * 共享类型表里，但规范把它归在「跨路线共用的 layoutRules」，日后可能挪到路线映射表去。
 * 校验读的是加载器合并结果（键在哪都看得见），写回只能落到具体文件，所以这里显式确认归属，
 * 确认不了就停 —— 不在不知情的情况下改错文件。
 */
function ownerOfBottomBarVariants(mapText) {
  let raw = null;
  try {
    raw = JSON.parse(mapText);
  }
  catch (error) {
    fail("共享类型表不是合法 JSON：" + error.message);
  }
  if (!raw.layoutRules || !raw.layoutRules.bottomBar || !raw.layoutRules.bottomBar.variants) {
    fail(
      "共享类型表里没有 layoutRules.bottomBar.variants —— 这个键可能已挪到路线映射表",
      "本工具只按原文改写共享类型表，不做跨文件猜测；请手工同步那一处。"
    );
  }
  return raw;
}

function insertVariant(variants, name, entry, afterName) {
  const out = {};
  for (const [key, value] of Object.entries(variants)) {
    out[key] = value;
    if (afterName && key === afterName) out[name] = entry;
  }
  if (!(name in out)) out[name] = entry;
  return out;
}

/*
 * 共享类型表用 JSON 往返改写：本仓库这份文件在「2 空格缩进 + 原行尾」下往返后字节一致，
 * 所以不会产生整文件 diff。路由映射表不是这个格式（往返会变），本工具不改它。
 */
function serializeJson(value, originalText) {
  return (JSON.stringify(value, null, 2) + "\n").split("\n").join(eolOf(originalText));
}

function bumpVersion(text) {
  const hit = /("version"\s*:\s*")(\d+)\.(\d+)\.(\d+)(")/.exec(text);
  if (!hit) fail("plugin.json 里找不到 semver 版本号");
  return text.replace(hit[0], hit[1] + hit[2] + "." + hit[3] + "." + (Number(hit[4]) + 1) + hit[5]);
}

// ---------- 门禁 ----------

function runGate(label, file, args, cwd) {
  const result = spawnSync(file, args, { cwd: cwd, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  return {
    label: label,
    ok: result.status === 0,
    output: String(result.stdout || "") + String(result.stderr || "")
  };
}

function runGates() {
  const testsDir = path.join(SCRIPTS_DIR, "tests");
  const list = [
    runGate("覆盖审计", process.execPath, [
      path.join(SCRIPTS_DIR, "adapters", "mtslg-iocontrol", "audit-mtslg-feishu-map.js"),
      COMPONENT_DOC,
      ROUTE_MAP
    ], SCRIPTS_DIR),
    runGate("单元回归", process.execPath, ["--test", "tests/*.test.js"], SCRIPTS_DIR)
  ];
  for (const name of fs.readdirSync(testsDir).filter((item) => item.endsWith(".tests.ps1"))) {
    list.push(runGate("PowerShell 回归 " + name, "pwsh", ["-NoProfile", "-File", path.join(testsDir, name)], SCRIPTS_DIR));
  }
  return list;
}

function reportGates(list) {
  let ok = true;
  for (const gate of list) {
    console.log("  " + (gate.ok ? "✓" : "✗") + " " + gate.label);
    if (!gate.ok) {
      ok = false;
      console.log(gate.output.split(/\r?\n/).slice(-12).map((line) => "      " + line).join("\n"));
    }
  }
  return ok;
}

// ---------- 命令 ----------

function requireBottomBar(args) {
  if (args.family !== SUPPORTED_FAMILY) {
    fail(
      "暂不支持 --family " + (args.family || "（未给）"),
      "目前只有 " + SUPPORTED_FAMILY + "（一变体一节的形态）。组件库文档那边一节覆盖多个变体，" +
        "与映射表粒度不一致，请手工同步后跑 `mapping-change check`。"
    );
  }
}

// 收集本次要改的文件与原文（原文用于门禁失败时回滚）。
function writeAll(changes, dryRun) {
  if (dryRun) {
    console.log("（--dry-run）将要改写：");
    for (const item of changes) console.log("  " + path.relative(PLUGIN_ROOT, item.file).replace(/\\/g, "/"));
    return;
  }
  for (const item of changes) fs.writeFileSync(item.file, item.text, "utf8");
}

function rollback(changes) {
  for (const item of changes) fs.writeFileSync(item.file, item.originalText, "utf8");
}

function apply(changes, dryRun) {
  writeAll(changes, dryRun);
  if (dryRun) return true;
  console.log("改动的文件：" + changes.map((item) => path.relative(PLUGIN_ROOT, item.file).replace(/\\/g, "/")).join("、"));
  console.log("跑门禁：");
  if (!reportGates(runGates())) {
    rollback(changes);
    console.error("✗ 门禁未通过，已把 " + changes.length + " 个文件写回原文");
    process.exit(1);
  }
  console.log("✓ 全部门禁通过。下一步：git 提交；飞书在线文档未同步（规范第 6 项，发版前处理）。");
  return true;
}

function commandAdd(args) {
  requireBottomBar(args);
  const name = String(args.name || "");
  if (!name) fail("缺少 --name");
  if (!args.like && !args.template) fail("必须给 --like <现有变体> 或 --template <小节片段文件>");
  if (args.like && args.template) fail("--like 与 --template 只能给一个");

  // 校验读加载器的合并结果；写回用原文（保留缩进与行尾），并先确认键的主人。
  const merged = loadTemplateMap(ROUTE_MAP);
  const mergedVariants = variantsOf(merged);
  const mapText = fs.readFileSync(SHARED_MAP, "utf8");
  const shared = ownerOfBottomBarVariants(mapText);
  const variants = variantsOf(shared);
  if (variants[name]) fail("映射表里已经有「" + name + "」");
  if (args.like && !mergedVariants[args.like]) fail("映射表里没有参照变体「" + args.like + "」");
  if (args.like) {
    const mergedEntry = mergedVariants[args.like];
    const ownEntry = variants[args.like];
    if (JSON.stringify(mergedEntry) !== JSON.stringify(ownEntry)) {
      fail(
        "参照变体「" + args.like + "」在合并结果里与共享表不一致（路线映射表可能覆盖了它）",
        "本工具只改写共享表，遇到覆盖会写错来源；请手工同步。"
      );
    }
  }

  const likeEntry = args.like ? variants[args.like] : {};
  const values = {};
  for (const pair of args.value || []) {
    const at = pair.indexOf("=");
    if (at <= 0) fail("--value 的格式是 key=value：" + pair);
    const key = pair.slice(0, at);
    if (args.like && !(key in likeEntry)) {
      fail("参照变体没有字段「" + key + "」，--value 不能凭空新增字段", "现有字段：" + Object.keys(likeEntry).join("、"));
    }
    values[key] = pair.slice(at + 1);
  }

  const doc = loadDoc(LAYOUT_DOC);
  const sectionsBefore = sectionNames(doc);
  addCount(doc, 1);
  editEnumeration(doc, { add: name, afterName: args.like });

  let block;
  let afterSectionName = args.like;
  if (args.template) {
    const raw = fs.readFileSync(path.resolve(args.template), "utf8");
    block = raw.replace(/\s+$/, "").split(/\r?\n/);
    if (block[0].trim() !== SECTION_PREFIX + name) {
      fail("--template 片段的第一行必须是「" + SECTION_PREFIX + name + "」", "现在是：" + block[0]);
    }
  }
  else {
    block = cloneSection(doc, args.like, name, args.allowResidualMentions === true);
  }

  if (afterSectionName && sectionRange(doc, afterSectionName)) {
    insertSectionAfter(doc, sectionRange(doc, afterSectionName), block);
  }
  else {
    const sections = doc.lines
      .map((line, index) => (line.trim().startsWith(SECTION_PREFIX) ? { index: index, name: line.trim().slice(SECTION_PREFIX.length) } : null))
      .filter(Boolean);
    if (sections.length === 0) fail("人读文档里没有任何「" + SECTION_PREFIX + "」小节，无法定位插入点");
    afterSectionName = sections[sections.length - 1].name;
    insertSectionAfter(doc, sectionRange(doc, afterSectionName), block);
  }
  assertSectionSet(sectionsBefore, sectionNames(doc), sectionsBefore.concat([name]), "新增 " + name);

  const pluginText = fs.readFileSync(PLUGIN_JSON, "utf8");
  const changes = [
    { file: SHARED_MAP, originalText: mapText, text: serializeJson(Object.assign({}, shared, {
      layoutRules: Object.assign({}, shared.layoutRules, {
        bottomBar: Object.assign({}, shared.layoutRules.bottomBar, {
          variants: insertVariant(variants, name, Object.assign({}, likeEntry, values), args.like)
        })
      })
    }), mapText) },
    { file: LAYOUT_DOC, originalText: fs.readFileSync(LAYOUT_DOC, "utf8"), text: docText(doc) },
    { file: PLUGIN_JSON, originalText: pluginText, text: bumpVersion(pluginText) }
  ];
  console.log("新增变体 " + name + "（参照：" + (args.like || "模板片段") + "）");
  return apply(changes, args.dryRun === true);
}

function commandRemove(args) {
  requireBottomBar(args);
  const name = String(args.name || "");
  if (!name) fail("缺少 --name");

  const merged = loadTemplateMap(ROUTE_MAP);
  if (!variantsOf(merged)[name]) fail("映射表里没有「" + name + "」");
  const mapText = fs.readFileSync(SHARED_MAP, "utf8");
  const shared = ownerOfBottomBarVariants(mapText);
  const variants = variantsOf(shared);
  if (!variants[name]) {
    fail(
      "变体「" + name + "」在合并结果里有、在共享类型表里没有",
      "它可能登记在路线映射表里；本工具只按原文改写共享类型表，请手工同步那一处。"
    );
  }
  const next = Object.assign({}, variants);
  delete next[name];

  const doc = loadDoc(LAYOUT_DOC);
  const sectionsBefore = sectionNames(doc);
  addCount(doc, -1);
  editEnumeration(doc, { remove: name });
  const range = sectionRange(doc, name);
  if (range) doc.lines.splice(range.start, range.end - range.start + 1);
  assertSectionSet(sectionsBefore, sectionNames(doc), sectionsBefore.filter((item) => item !== name), "删除 " + name);

  const pluginText = fs.readFileSync(PLUGIN_JSON, "utf8");
  const changes = [
    { file: SHARED_MAP, originalText: mapText, text: serializeJson(Object.assign({}, shared, {
      layoutRules: Object.assign({}, shared.layoutRules, {
        bottomBar: Object.assign({}, shared.layoutRules.bottomBar, { variants: next })
      })
    }), mapText) },
    { file: LAYOUT_DOC, originalText: fs.readFileSync(LAYOUT_DOC, "utf8"), text: docText(doc) },
    { file: PLUGIN_JSON, originalText: pluginText, text: bumpVersion(pluginText) }
  ];
  console.log("删除变体 " + name + (range ? "（小节一并删除）" : "（没有小节）"));
  return apply(changes, args.dryRun === true);
}

function commandCheck() {
  console.log("跑门禁：");
  if (!reportGates(runGates())) process.exit(1);
  console.log("✓ 全部门禁通过。");
  return true;
}

function gh(args) {
  return spawnSync("gh", args, { cwd: PLUGIN_ROOT, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
}

function commandAudit() {
  const head = spawnSync("git", ["rev-parse", "HEAD"], { cwd: PLUGIN_ROOT, encoding: "utf8" });
  if (head.status !== 0) fail("拿不到当前提交（git rev-parse HEAD 失败）");
  const sha = String(head.stdout).trim();

  const listed = gh(["run", "list", "--commit", sha, "--limit", "5", "--json", "databaseId,status,conclusion"]);
  if (listed.status !== 0) fail("调不起 gh（或未登录）", "审计结果也可以直接在 GitHub 的 Plugin CI/CD 里看。");
  const runs = JSON.parse(String(listed.stdout) || "[]");
  if (runs.length === 0) fail("这个提交还没有 CI 运行：" + sha.slice(0, 7));
  const run = runs[0];
  console.log("CI run " + run.databaseId + "（" + run.status + " / " + run.conclusion + "）");

  const viewed = gh(["run", "view", String(run.databaseId), "--json", "jobs"]);
  const jobs = JSON.parse(String(viewed.stdout) || "{}").jobs || [];
  const auditJob = jobs.find((job) => /semantic-audit/.test(job.name || ""));
  if (!auditJob) fail("这次运行里没有 semantic-audit 作业");

  const logged = gh(["run", "view", "--job", String(auditJob.databaseId), "--log"]);
  const log = String(logged.stdout || "");
  const hit = /"result":\s*"([A-Z]+)"[\s\S]*?"blockingFindings":\s*(\d+)[\s\S]*?"reviewFindings":\s*(\d+)/.exec(log);
  if (!hit) fail("没有从审计日志里解析出结果（日志格式可能变了）");
  console.log("语义审计：result=" + hit[1] + "  blocking=" + hit[2] + "  review=" + hit[3]);
  const ids = Array.from(new Set(Array.from(log.matchAll(/"id":\s*"(REVIEW-\d+)"/g)).map((item) => item[1])));
  if (ids.length > 0) {
    console.log("  待收：" + ids.join("、"));
    console.log("  逐条证据：gh run view --job " + auditJob.databaseId + " --log");
  }
  return true;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const command = args._[0] || "";
  if (command === "add-variant") commandAdd(args);
  else if (command === "remove-variant") commandRemove(args);
  else if (command === "check") commandCheck();
  else if (command === "audit") commandAudit();
  else {
    console.error("用法：mapping-change.js <add-variant|remove-variant|check|audit> [选项]");
    console.error("  add-variant 需要 --family layoutRules.bottomBar --name <名字> (--like <现有变体> | --template <文件>)");
    process.exit(2);
  }
}

main();

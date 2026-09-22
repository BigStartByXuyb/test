#!/usr/bin/env node
"use strict";

const fs = require("fs");

// 组件库映射文档（人读的、也是飞书在线文档的离线副本）↔ 映射表（机器真值源）的覆盖审计。
//
// 两个方向都要查，缺一条就会单边漂移：
//   ① 表 → 文档：映射表登记的每个变体都必须在文档正文出现（`undocumented` / `unregisteredFamilies`）；
//   ② 文档 → 表：文档里**结构化写出**的变体必须能在映射表里找到归属（`unregisteredVariants`）。
// 文档侧的期望值**全部从文档解析**，不维护"族 → 变体"手写清单：那种清单是同一份事实的第二个登记点，
// 曾实际漂移（`infoGroupTemplates` 漏了《信息模块-手动控制弹层》，该变体在①方向的输入里整条消失）。

// 列举分隔符：文档里用「、，,/」混合列举变体。
function splitVariants(text) {
  return text
    .split(/[、，,/]/)
    .map(item => item.trim())
    .filter(Boolean);
}

// 文档侧解析：只认结构化写法（不猜散文）。每个 token 带一个 `kind`，**判据只有一处** —— 下面这张三分类表
// （classifyDocTokens 按它判去留，本文件其它注释不再复述）：
//   variant —— `属性 1` / `按钮类型` / `变体`：后面的值就是变体值，解析不到映射表就是文档凭空多写；
//   section —— `组件集` / `聚合集合` / `独立组件`：后面的值是"这一节属于哪个组件集/聚合"，解析不到时
//              要看同组里有没有别的变体锚定（有 → 算标签；整组都没有 → 孤儿章节，报错）；
//   label   —— `结构分支` / `父节点`：写作规范允许的文档组织维度（结构分支名、父节点语义名），
//              按定义不等于任何变体名，一律算标签。
// 标题值的拆法：先剥掉括注说明（如「聚合集合=右侧栏（全部按钮类型变体）」里的括号），再按列举分隔符切开，
// 每段取**最后一个** `=` 之后的内容；没有 `=` 的段继承上一段的键 ——
// `组件集=选择框，变体=选择框-40/选择框-36` → 组件集段(选择框) + 变体段(选择框-40、选择框-36)。
const SECTION_KEYS = ["组件集", "聚合集合", "独立组件"];
const LABEL_KEYS = ["结构分支", "父节点"];

function extractDocumentedRules(markdown) {
  // 按一级/二级标题分组：同一组件集/同一按钮族的所有结构化 token 落在同一组里，
  // classifyDocTokens 用"这一组里有没有解析得通的 token"判断某个章节名到底是"标签"还是"凭空多写"。
  const groups = [];
  let current = { title: "", tokens: [] };
  const pushToken = (text, kind) => {
    for (const item of splitVariants(text)) if (item) current.tokens.push({ value: item, kind });
  };
  for (const line of markdown.split(/\r?\n/)) {
    if (/^#{1,2}\s+\S/.test(line)) {
      current = { title: line.replace(/^#{1,2}\s+/, "").trim(), tokens: [] };
      groups.push(current);
      continue;
    }
    const variantLine = line.match(/MasterGo 变体：([^\r\n。]+)/);
    if (variantLine) {
      pushToken(variantLine[1], "variant");
      continue;
    }
    const heading = line.match(/^#{2,3}\s*(?:固定模板|待确认变体)：(.+)$/);
    if (!heading) continue;
    const raw = heading[1].replace(/（[^）]*）/g, "");
    let kind = "variant";
    for (const part of raw.split(/[、，,/]/)) {
      if (part.indexOf("=") >= 0) {
        const key = part.slice(0, part.indexOf("=")).trim();
        kind = LABEL_KEYS.includes(key) ? "label" : (SECTION_KEYS.includes(key) ? "section" : "variant");
        pushToken(part.slice(part.lastIndexOf("=") + 1), kind);
        continue;
      }
      pushToken(part, kind);
    }
  }
  const tokens = groups.reduce((all, group) => all.concat(group.tokens), []);

  const ambiguous = [];
  markdown.split(/\r?\n/).forEach((line, index) => {
    if (/^固定结构：L TextBlock \+ R (ComboBox|IntNumberBox|TextBox)/.test(line.trim())) {
      ambiguous.push(`第${index + 1}行：${line.trim()}（缺少独立组件集/变体标题）`);
    }
  });

  return { groups, tokens, ambiguous };
}

// 变体 → 所属模板族（来自映射表），用于把文档标题里的变体归属到真实家族。
function buildVariantOwners(templateMap) {
  const owners = new Map();
  for (const [family, spec] of Object.entries(templateMap)) {
    if (family.startsWith("_") || !family.endsWith("Templates")) continue;
    if (!spec || typeof spec !== "object") continue;
    if (!spec.variants || typeof spec.variants !== "object") continue;
    for (const variant of Object.keys(spec.variants)) {
      if (variant && !owners.has(variant)) owners.set(variant, family);
    }
  }
  return owners;
}

// 文档 token 的判据全部来自映射表（不手写清单），按顺序判定：
//   ① 命中 variants            → covered（文档→表这条能落地）
//   ② 命中 unconfirmedVariants → unconfirmed（映射表自己登记为「待确认」，不算错）
//   ③ 是某个变体名的子串        → labels（尺寸/分组这类片段：整数、小数、文字、晶圆图…）
//   ④ kind=label（`结构分支=` 这类纯结构名）→ labels
//      kind=section（章节名）且同组里有解析得通的 token → labels
//      （《单选+多选》《右侧栏》这类章节标题本来就不等于任何变体名，只要它所在的组件集章节
//       确实登记了变体，就说明这个标题是标签；反过来，整组一个变体都解析不到 → 该章节是孤儿，报错）
//   ⑤ 其余                     → unregisteredVariants（文档写了映射表没有的变体值/组件集，退 2）
function classifyDocTokens(groups, templateMap) {
  const owners = buildVariantOwners(templateMap);
  const pendingOwners = new Map();
  const variantNames = [];
  for (const [family, spec] of Object.entries(templateMap)) {
    if (family.startsWith("_") || !family.endsWith("Templates")) continue;
    if (!spec || typeof spec !== "object") continue;
    for (const variant of Array.isArray(spec.unconfirmedVariants) ? spec.unconfirmedVariants : []) {
      if (variant && !pendingOwners.has(variant)) pendingOwners.set(variant, family);
    }
    for (const variant of Object.keys(spec.variants || {})) variantNames.push(variant);
  }
  const covered = [];
  const unconfirmed = [];
  const labels = [];
  const unregisteredVariants = [];
  const seen = new Set();
  const unresolvedSections = [];
  for (const group of groups) {
    // 先看这一组有没有"锚"：任何一个 token 能解析成变体或待确认变体。
    const anchored = group.tokens.some(token => owners.has(token.value) || pendingOwners.has(token.value));
    for (const token of group.tokens) {
      const owner = owners.get(token.value);
      if (owner) { if (!seen.has(token.value)) { seen.add(token.value); covered.push(`${owner}/${token.value}`); } continue; }
      const pendingOwner = pendingOwners.get(token.value);
      if (pendingOwner) { if (!seen.has(token.value)) { seen.add(token.value); unconfirmed.push(`${pendingOwner}/${token.value}`); } continue; }
      if (seen.has(token.value)) continue;
      seen.add(token.value);
      if (variantNames.some(variant => variant.includes(token.value))) { labels.push(token.value); continue; }
      if (token.kind === "label") { labels.push(token.value); continue; }
      if (token.kind === "section" && anchored) { labels.push(token.value); continue; }
      unregisteredVariants.push(token.value);
      if (token.kind === "section") unresolvedSections.push(group.title || token.value);
    }
  }
  return { covered, unconfirmed, labels, unregisteredVariants, unresolvedSections };
}

function auditMappingCoverage(markdown, templateMap) {
  const documented = extractDocumentedRules(markdown);
  const classified = classifyDocTokens(documented.groups, templateMap);
  // 族级：映射表里的族，其变体在文档正文里一个都没出现（新增族时最先看到的就是这一项）。
  const unregisteredFamilies = Object.keys(templateMap).filter((family) => {
    if (family.startsWith("_") || !family.endsWith("Templates")) return false;
    const spec = templateMap[family];
    if (!spec || typeof spec !== "object" || !spec.variants || typeof spec.variants !== "object") return false;
    const variants = Object.keys(spec.variants);
    if (!variants.length) return false;
    return !variants.some(variant => isVariantDocumented(markdown, variant));
  });
  return {
    documented: { tokens: documented.tokens.map(token => token.value), labels: classified.labels },
    covered: classified.covered,
    unregisteredVariants: classified.unregisteredVariants,
    unresolvedSections: classified.unresolvedSections,
    unregisteredFamilies,
    undocumented: findUndocumentedVariants(markdown, templateMap),
    unconfirmed: classified.unconfirmed,
    ambiguous: documented.ambiguous,
    duplicateMatchKeys: findDuplicateMatchKeys(templateMap)
  };
}

// 映射表里登记的模板族/变体（机器真值源）。单靠「文档 → 映射表」方向看不见
// 「表加了、文档忘了写」，所以还要跑这个反向核对。
function collectMapVariants(templateMap) {
  const rows = [];
  for (const [family, spec] of Object.entries(templateMap)) {
    if (family.startsWith("_") || !family.endsWith("Templates")) continue;
    if (!spec || typeof spec !== "object") continue;
    if (!spec.variants || typeof spec.variants !== "object") continue;
    for (const variant of Object.keys(spec.variants)) {
      if (variant) rows.push({ family, variant });
    }
  }
  return rows;
}

// 反向覆盖：映射表里登记、但映射文档正文没有提到的变体。
// 只统计正文：HTML 注释里的「属性1=…」示例不算文档内容，否则注释能伪装成已登记。
// 这是关键词级覆盖检查（证明"文档提到了"），不是结构级校验（不证明模板已写全）；
// 模板是否成体系仍由人工/agent 按本 Skill 的层级与固定模板规则审查。
function isVariantDocumented(markdown, variant) {
  return stripHtmlComments(markdown).includes(variant);
}

function stripHtmlComments(markdown) {
  return markdown.replace(/<!--[\s\S]*?-->/g, "");
}

function findUndocumentedVariants(markdown, templateMap) {
  return collectMapVariants(templateMap)
    .filter(({ variant }) => !isVariantDocumented(markdown, variant))
    .map(({ family, variant }) => `${family}/${variant}`);
}

// 同一个「匹配属性名 + 属性值」不得登记在两个模板族（否则会互相抢模板）。
function findDuplicateMatchKeys(templateMap) {
  const index = new Map();
  for (const [family, spec] of Object.entries(templateMap)) {
    if (!family.endsWith("Templates") || !spec || !spec.variants) continue;
    const property = (spec.match && spec.match.property) || "";
    for (const variant of Object.keys(spec.variants)) {
      const key = property + "||" + variant;
      if (!index.has(key)) index.set(key, []);
      index.get(key).push(family);
    }
  }
  return [...index.entries()]
    .filter(([, families]) => families.length > 1)
    .map(([key, families]) => ({ matchKey: key, families }));
}

function main() {
  const [docPath, mapPath] = process.argv.slice(2);
  if (!docPath || !mapPath) {
    console.error("用法: node audit-mtslg-feishu-map.js <feishu.md> <mtslg-iocontrol-map.json>");
    process.exitCode = 1;
    return;
  }
  const report = auditMappingCoverage(
    fs.readFileSync(docPath, "utf8"),
    JSON.parse(fs.readFileSync(mapPath, "utf8"))
  );
  console.log(JSON.stringify(report, null, 2));
  if (report.undocumented.length || report.unregisteredFamilies.length ||
      report.unregisteredVariants.length || report.duplicateMatchKeys.length) {
    process.exitCode = 2;
  }
}

if (require.main === module) main();

module.exports = {
  extractDocumentedRules,
  classifyDocTokens,
  auditMappingCoverage,
  findDuplicateMatchKeys,
  buildVariantOwners,
  collectMapVariants,
  findUndocumentedVariants,
  isVariantDocumented
};

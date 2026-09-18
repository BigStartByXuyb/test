#!/usr/bin/env node
"use strict";

const fs = require("fs");

function splitVariants(text) {
  return text
    .split(/[、，,]/)
    .map(item => item.trim())
    .filter(Boolean);
}

function extractDocumentedRules(markdown) {
  const families = {
    componentTemplates: [],
    // 右栏按钮族按公开属性「按钮类型」的真实值匹配（不是父节点语义）。
    rightSidebarTemplates: [
      "F+文案", "文案 大button", "上下结构-icon+文案", "左右结构-icon+文案",
      "stop", "start", "恢复切割", "删除料盒-1", "删除料盒-2", "文案-小button",
      "enter", "exit", "startstop"
    ],
    rightSidebarComponentTemplates: ["右侧栏-左右结构-icon+文案", "右侧栏-上下结构-icon+文案", "start"],
    inputTemplates: [],
    selectBoxTemplates: ["选择框-40", "选择框-36", "选择框-32", "选择框-28"],
    selectionInfoTemplates: ["单选-选中/未选择", "多选-选中/未选中"],
    selectionTemplates: ["单选-选中", "单选-未选择", "多选-选中", "多选-未选择"],
    infoGroupTemplates: ["信息分组-模块化"],
    // 相机视口族：团队组件库「集成图像 UI汇总」画廊里的相机组件集（按组件集名命中）。
    // 注意变体名里带空格/全角括号，必须与映射表 variants 的键逐字一致。
    cameraTemplates: [
      "集成图像", "集成图像-XIS 模式", "集成图像-晶圆图 - 线条模式", "晶圆图 - 工件模式",
      "集成图像-低倍率", "集成图像-JOG mode", "集成图像-结果检查（预对准）",
      "集成图像=结果检查（预对准）展开", "组件 1065"
    ],
    // The mapping document names this component set "主菜单button" and
    // "主菜单button-文字".  Do not invent a separate "主菜单" variant.
    mainMenuTemplates: ["主菜单button", "主菜单button-文字"],
    tableTemplates: ["Table"],
    textTemplates: ["独立文本"]
  };

  const inputVariantLines = markdown.match(/MasterGo 变体：([^\r\n。]+)/g) || [];
  for (const line of inputVariantLines) {
    const values = line.replace(/^MasterGo 变体：/, "");
    if (values.includes("输入框-")) families.inputTemplates.push(...splitVariants(values));
  }

  // `### 固定模板：属性 1=…` 标题里列出的变体先原样收集，随后由映射表归属到真实模板族，
  // 因此这类变体不依赖本文件里的家族清单就能被核对。但家族清单本身仍是新增模板族的登记位
  // （`missing` 方向按它遍历），未登记的族由 unregisteredFamilies 报出并以退出码 2 结束。
  const headingVariants = [];
  const operationHeadings = markdown.match(/^### 固定模板：属性 1=([^\r\n]+)/gm) || [];
  for (const heading of operationHeadings) {
    headingVariants.push(...splitVariants(heading.replace(/^### 固定模板：属性 1=/, "").trim()));
  }

  const uniqueFamilies = {};
  for (const [family, variants] of Object.entries(families)) {
    uniqueFamilies[family] = [...new Set(variants)];
  }

  const ambiguous = [];
  const unconfirmed = {
    inputTemplates: ["密码输入框"]
  };
  markdown.split(/\r?\n/).forEach((line, index) => {
    if (/^固定结构：L TextBlock \+ R (ComboBox|IntNumberBox|TextBox)/.test(line.trim())) {
      ambiguous.push(`第${index + 1}行：${line.trim()}（缺少独立组件集/变体标题）`);
    }
  });

  return { families: uniqueFamilies, headingVariants, unconfirmed, ambiguous };
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

function auditMappingCoverage(markdown, templateMap) {
  const documented = extractDocumentedRules(markdown);
  const owners = buildVariantOwners(templateMap);
  // 映射表里存在、但本文件家族清单没登记的模板族：这类族的文档侧变体没有期望值可比，
  // `missing` 方向会整族失效，必须显式报出来（新增模板族时最先看到的就是这一项）。
  const registeredFamilies = new Set(Object.keys(documented.families));
  const unregisteredFamilies = Object.keys(templateMap).filter((family) => {
    if (family.startsWith("_") || !family.endsWith("Templates")) return false;
    const spec = templateMap[family];
    if (!spec || typeof spec !== "object") return false;
    if (!spec.variants || typeof spec.variants !== "object") return false;
    return !registeredFamilies.has(family);
  });
  const unregisteredVariants = [];
  for (const variant of documented.headingVariants) {
    const owner = owners.get(variant);
    if (!owner) {
      unregisteredVariants.push(variant);
      continue;
    }
    if (!documented.families[owner]) documented.families[owner] = [];
    if (!documented.families[owner].includes(variant)) documented.families[owner].push(variant);
  }
  const missing = [];
  const covered = [];
  for (const [family, variants] of Object.entries(documented.families)) {
    const actualFamily = templateMap[family];
    if (!actualFamily || !actualFamily.variants) {
      for (const variant of variants) missing.push(`${family}/${variant}`);
      continue;
    }
    for (const variant of variants) {
      if (actualFamily.variants[variant]) covered.push(`${family}/${variant}`);
      else missing.push(`${family}/${variant}`);
    }
  }
  const unconfirmed = [];
  for (const [family, variants] of Object.entries(documented.unconfirmed)) {
    const actualFamily = templateMap[family];
    for (const variant of variants) {
      if (actualFamily && Array.isArray(actualFamily.unconfirmedVariants) && actualFamily.unconfirmedVariants.includes(variant)) {
        unconfirmed.push(`${family}/${variant}`);
      } else {
        missing.push(`${family}/待确认:${variant}`);
      }
    }
  }
  return {
    documented: documented.families,
    covered,
    missing,
    undocumented: findUndocumentedVariants(markdown, templateMap),
    unregisteredFamilies,
    unregisteredVariants,
    unconfirmed,
    ambiguous: documented.ambiguous,
    duplicateMatchKeys: findDuplicateMatchKeys(templateMap)
  };
}

// 映射表里登记的模板族/变体（机器真值源）。文档侧的家族清单是人工登记的，
// 单靠「文档 → 映射表」方向看不见「表加了、文档忘了写」，所以需要反向核对。
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
  if (report.missing.length || report.undocumented.length || report.unregisteredFamilies.length ||
      report.unregisteredVariants.length || report.duplicateMatchKeys.length) {
    process.exitCode = 2;
  }
}

if (require.main === module) main();

module.exports = {
  extractDocumentedRules,
  auditMappingCoverage,
  findDuplicateMatchKeys,
  buildVariantOwners,
  collectMapVariants,
  findUndocumentedVariants,
  isVariantDocumented
};

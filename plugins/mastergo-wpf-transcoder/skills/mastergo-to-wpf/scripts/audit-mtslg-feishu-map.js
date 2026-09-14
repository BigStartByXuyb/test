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
    rightSidebarComponentTemplates: ["右侧栏-左右结构-icon+文案", "start"],
    inputTemplates: [],
    selectBoxTemplates: ["选择框-40", "选择框-36", "选择框-32", "选择框-28"],
    selectionInfoTemplates: ["单选-选中/未选择", "多选-选中/未选中"],
    selectionTemplates: ["单选-选中", "单选-未选择", "多选-选中", "多选-未选择"],
    infoGroupTemplates: ["信息分组-模块化"],
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

  const operationHeadings = markdown.match(/^### 固定模板：属性 1=([^\r\n]+)/gm) || [];
  for (const heading of operationHeadings) {
    const variants = heading.replace(/^### 固定模板：属性 1=/, "").trim();
    const values = splitVariants(variants);
    // Main-menu variants belong to mainMenuTemplates, not the generic
    // componentTemplates family.
    families.componentTemplates.push(...values.filter(value => !["主菜单button", "主菜单button-文字"].includes(value)));
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

  return { families: uniqueFamilies, unconfirmed, ambiguous };
}

function auditMappingCoverage(markdown, templateMap) {
  const documented = extractDocumentedRules(markdown);
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
  if (report.missing.length || report.undocumented.length || report.duplicateMatchKeys.length) {
    process.exitCode = 2;
  }
}

if (require.main === module) main();

module.exports = {
  extractDocumentedRules,
  auditMappingCoverage,
  findDuplicateMatchKeys,
  collectMapVariants,
  findUndocumentedVariants,
  isVariantDocumented
};

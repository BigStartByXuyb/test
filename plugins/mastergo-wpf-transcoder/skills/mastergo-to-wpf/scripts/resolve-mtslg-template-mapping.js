#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");
// 跨脚本共用工具的唯一实现（见 scripts/lib/script-helpers.js；禁止在本脚本再抄一份）。
const helpers = require(path.join(__dirname, "lib", "script-helpers.js"));
const fail = helpers.failWithPrefix("MTSLG 模板映射失败");
const normalizeToken = helpers.normalizeToken;

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function loadJson(filePath, label) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (error) {
    fail((label || "JSON") + "读取失败: " + filePath + " - " + error.message);
  }
}

function loadTemplateMap(filePath) {
  const map = loadJson(filePath, "模板 map");
  if (!map.componentTemplates || !map.componentTemplates.variants) {
    fail("模板 map 缺少 componentTemplates.variants");
  }
  for (const [familyName, family] of Object.entries(map)) {
    if (!familyName.endsWith("Templates") || familyName === "componentTemplates") continue;
    if (!family || typeof family !== "object" || !family.variants || typeof family.variants !== "object") {
      fail("模板 map 的 " + familyName + " 缺少 variants");
    }
  }
  return map;
}

function templatesForName(templateMap, templateName) {
  if (!templateName || templateName === "componentTemplates") return templateMap.componentTemplates;
  if (templateName === "rightSidebar") return templateMap.rightSidebarTemplates;
  return templateMap[templateName];
}

// 属性名归一化：唯一实现在 lib/script-helpers.js（normalizeToken），本脚本只做别名。
const normalizedPropertyName = normalizeToken;

function instanceVariant(instance, matchProperty) {
  const properties = instance.properties || {};
  const wanted = normalizedPropertyName(matchProperty || "属性 1");
  for (const key of Object.keys(properties)) {
    if (normalizedPropertyName(key) === wanted) return properties[key];
  }
  if (typeof instance.variant === "string") return instance.variant;
  return null;
}

// 变体来源：属性型模板族按公开属性值；componentSet 族（独立组件直接放置）按组件名。
function resolveInstanceVariant(instance, templates) {
  const match = templates.match || {};
  if (match.componentSet === true) {
    const componentSet = instance.componentSet || instance.componentName;
    return componentSet && templates.variants[componentSet] ? componentSet : null;
  }
  return instanceVariant(instance, match.property);
}

function sourceByRef(mapping) {
  return new Map((mapping.sourceNodes || []).map(source => [source.ref, source]));
}

function nodeBySourceRef(mapping) {
  const result = new Map();
  for (const node of mapping.nodes || []) {
    if (node.sourceRef) result.set(node.sourceRef, node);
  }
  return result;
}

function assertSourceAndNode(sourceMap, nodeMap, slot, variant, usedSources) {
  if (!slot || typeof slot.slot !== "string" || typeof slot.sourceRef !== "string") {
    fail("固定模板槽位缺少 slot/sourceRef: " + variant);
  }
  if (!sourceMap.has(slot.sourceRef)) {
    fail("固定模板槽位 sourceRef 不存在: " + variant + "/" + slot.slot + " -> " + slot.sourceRef);
  }
  if (usedSources.has(slot.sourceRef)) {
    fail("固定模板槽位重复使用 sourceRef: " + variant + "/" + slot.slot + " -> " + slot.sourceRef);
  }
  usedSources.add(slot.sourceRef);
  const node = nodeMap.get(slot.sourceRef);
  if (!node) fail("固定模板槽位没有对应输出节点: " + variant + "/" + slot.slot);
  const source = sourceMap.get(slot.sourceRef);
  if (node.sourceParent !== undefined && node.sourceParent !== (source.parentRef || null)) {
    fail("固定模板槽位 sourceParent 不匹配: " + variant + "/" + slot.slot);
  }
  return { source, node };
}

function validateSlot(spec, slot, sourceMap, nodeMap, variant, usedSources) {
  const pair = assertSourceAndNode(sourceMap, nodeMap, slot, variant, usedSources);
  const nodeType = nodeMap.get(slot.sourceRef).controlType || (nodeMap.get(slot.sourceRef).attrs || {}).ControlType;
  if (spec.controlType && nodeType && spec.controlType !== nodeType) {
    fail("固定模板槽位 ControlType 不匹配: " + variant + "/" + slot.slot);
  }
  const attrs = nodeMap.get(slot.sourceRef).attrs || {};
  if (spec.controlType) {
    nodeMap.get(slot.sourceRef).controlType = spec.controlType;
    attrs.ControlType = spec.controlType;
  }
  if (spec.style === null) delete attrs.Style;
  else if (typeof spec.style === "string") attrs.Style = spec.style;
  if (spec.iconPolicy === "none") {
    delete attrs.Icon;
    delete attrs.IconWidth;
    delete attrs.IconHeight;
    // 节点级图标尺寸同样作废：iconSize 只允许与 Icon 同现，避免留下会被
    // 生成器/校验器以不同判据解释的「有尺寸无 Icon」映射。
    delete nodeMap.get(slot.sourceRef).iconSize;
  }
  // iconPolicy=runtime 的槽位由变体级固定图标提供（见 validateInstance 的 applyVariantFixedFields），
  // 页面台账里本来就不该有这两条（它们由目标项目提供），因此不在这里要求 DSL 图标来源。
  if (spec.iconRequired && spec.iconPolicy !== "runtime" && typeof attrs.Icon !== "string") {
    fail("固定模板槽位缺少 DSL 图标来源: " + variant + "/" + slot.slot);
  }
  const valueSourceRef = slot.valueSourceRef;
  if (valueSourceRef !== undefined) {
    const valueSource = sourceMap.get(valueSourceRef);
    if (!valueSource) fail("固定模板槽位 valueSourceRef 不存在: " + variant + "/" + slot.slot);
    if (typeof valueSource.text === "string") {
      // 文案承载属性：带 Value 的控件比 Value；容器类（GroupBox）以 Header 承载标题文案，此时比 Header。
      const carrier = attrs.Value !== undefined ? "Value" : (attrs.Header !== undefined ? "Header" : null);
      if (carrier === null) {
        fail("固定模板槽位既没有 Value 也没有 Header 承载 DSL 文本: " + variant + "/" + slot.slot);
      }
      if (attrs[carrier] !== valueSource.text) {
        fail("固定模板槽位 " + carrier + " 不是 DSL 文本: " + variant + "/" + slot.slot);
      }
    }
    if (nodeMap.get(slot.sourceRef).valueSource !== undefined && nodeMap.get(slot.sourceRef).valueSource !== "dsl.text") {
      fail("固定模板槽位 valueSource 必须是 dsl.text: " + variant + "/" + slot.slot);
    }
  } else if (spec.controlType === "TextBlock") {
    fail("TextBlock 固定模板槽位缺少 valueSourceRef: " + variant + "/" + slot.slot);
  }
  return {
    slot: slot.slot,
    sourceRef: slot.sourceRef,
    ...(valueSourceRef === undefined ? {} : { valueSourceRef })
  };
}

function validateOmittedSlot(slot, sourceMap, nodeMap, variant, usedSources) {
  if (!slot || typeof slot.slot !== "string" || typeof slot.sourceRef !== "string") {
    fail("省略槽位缺少 slot/sourceRef: " + variant);
  }
  if (!sourceMap.has(slot.sourceRef)) {
    fail("省略槽位 sourceRef 不存在: " + variant + "/" + slot.slot + " -> " + slot.sourceRef);
  }
  if (usedSources.has(slot.sourceRef)) {
    fail("省略槽位重复使用 sourceRef: " + variant + "/" + slot.slot + " -> " + slot.sourceRef);
  }
  usedSources.add(slot.sourceRef);
  if (nodeMap.has(slot.sourceRef)) {
    fail("省略槽位不得存在输出节点: " + variant + "/" + slot.slot);
  }
  if (!["hidden", "page-title", "host-shell"].includes(slot.omitReason)) {
    fail("省略槽位缺少合法 omitReason: " + variant + "/" + slot.slot);
  }
  return { slot: slot.slot, sourceRef: slot.sourceRef, omitReason: slot.omitReason };
}

function validateInstance(instance, spec, mapping, sourceMap, nodeMap, usedSources, variant) {
  // 组件级固定字段（变体级登记、不在槽位重复）：运行时图标 / 逐变体固定属性 / 固定语言键。
  // 只有变体显式登记了对应字段时才生效；未登记的变体行为与改动前完全一致。
  const applyVariantFixedFields = function (node) {
    if (!node) return;
    const targetAttrs = node.attrs || (node.attrs = {});
    if (spec.iconPolicy === "runtime") {
      // Icon 是目标项目已存在的资源键，本页不生成该图标资源；iconSize 仍保留，供 IconWidth/IconHeight 发射。
      if (typeof spec.runtimeIcon !== "string" || spec.runtimeIcon === "") {
        fail("固定变体 iconPolicy=runtime 缺少 runtimeIcon: " + variant);
      }
      targetAttrs.Icon = spec.runtimeIcon;
      node.runtimeIcon = spec.runtimeIcon;
    }
    if (spec.fixedAttrs && typeof spec.fixedAttrs === "object" && !Array.isArray(spec.fixedAttrs)) {
      for (const [attrName, attrValue] of Object.entries(spec.fixedAttrs)) targetAttrs[attrName] = attrValue;
    }
    // 必写字段收窄：变体登记 omitRequiredAttrs 时这些字段不发射——生成器与校验器按同一个
    // 节点标记跳过（不是删模板真值源，只对本变体生效）。
    if (spec.omitRequiredAttrs !== undefined) {
      if (!Array.isArray(spec.omitRequiredAttrs) || spec.omitRequiredAttrs.length === 0) {
        fail("固定变体 omitRequiredAttrs 必须是非空字符串数组: " + variant);
      }
      const omitted = spec.omitRequiredAttrs.map(String).map(function (name) { return name.trim(); });
      if (omitted.some(function (name) { return name === ""; })) {
        fail("固定变体 omitRequiredAttrs 含空项: " + variant);
      }
      node.omitAttrs = omitted;
      for (const name of omitted) delete targetAttrs[name];
    }
    if (spec.langPolicy === "fixed") {
      if (typeof spec.langKeyTemplate !== "string" || spec.langKeyTemplate === "") {
        fail("固定变体 langPolicy=fixed 缺少 langKeyTemplate: " + variant);
      }
      node.fixedLang = {
        keyTemplate: spec.langKeyTemplate,
        text: spec.langText && typeof spec.langText === "object" ? spec.langText : {}
      };
    }
  };
  const supplied = instance.requiredSlots || instance.slots || [];
  if (!Array.isArray(supplied)) fail("固定模板实例缺少 requiredSlots: " + variant);
  const expected = spec.slots || [];
  const omitted = Array.isArray(instance.omittedSlots) ? instance.omittedSlots : [];
  const omittedByName = new Map(omitted.map(slot => [slot.slot, slot]));
  const visibleExpected = expected.filter(slot => !omittedByName.has(slot.slot));
  const suppliedByName = new Map(supplied.map(slot => [slot.slot, slot]));
  for (const slot of supplied) {
    if (!visibleExpected.some(expectedSlot => expectedSlot.slot === slot.slot)) {
      fail("固定模板包含未登记或已省略槽位: " + variant + "/" + slot.slot);
    }
  }
  // 必经槽位必须全部提供；标记 optional 的槽位（例如只有在设计稿里出现的 SCAN 文案）
  // 允许缺席，缺席时不参与计数，也不写入 requiredSlots。
  const missingRequired = visibleExpected.filter(
    expectedSlot => expectedSlot.optional !== true && !suppliedByName.has(expectedSlot.slot)
  );
  if (missingRequired.length > 0) {
    fail("固定模板缺失必经槽位: " + variant + "/" + missingRequired.map(slot => slot.slot).join(", "));
  }
  const requiredSlots = visibleExpected
    .filter(expectedSlot => suppliedByName.has(expectedSlot.slot))
    .map(expectedSlot => validateSlot(expectedSlot, suppliedByName.get(expectedSlot.slot), sourceMap, nodeMap, variant, usedSources));
  for (const slot of requiredSlots) applyVariantFixedFields(nodeMap.get(slot.sourceRef));
  const omittedSlots = omitted.map(slot => {
    if (!expected.some(expectedSlot => expectedSlot.slot === slot.slot)) {
      fail("省略槽位未在固定模板登记: " + variant + "/" + slot.slot);
    }
    return validateOmittedSlot(slot, sourceMap, nodeMap, variant, usedSources);
  });
  const extraTextSlots = Array.isArray(instance.extraTextSlots) ? instance.extraTextSlots.map(slot => {
    if (typeof slot.slot !== "string") fail("额外文本槽位缺少 slot: " + variant);
    return validateSlot({ controlType: "TextBlock" }, slot, sourceMap, nodeMap, variant, usedSources);
  }) : [];
  return {
    variant,
    ...(instance.template ? { template: instance.template } : {}),
    instanceRef: instance.instanceRef,
    requiredSlots,
    ...(omittedSlots.length > 0 ? { omittedSlots } : {}),
    ...(extraTextSlots.length > 0 ? { extraTextSlots } : {})
  };
}

function resolveTemplateMapping(mapping, templateMap) {
  const result = clone(mapping);
  const sourceMap = sourceByRef(result);
  const nodeMap = nodeBySourceRef(result);
  const instances = Array.isArray(result.componentInstances) ? result.componentInstances : null;
  if (!instances) fail("mapping 必须使用 componentInstances 字段");

  const usedSources = new Set();
  const resolved = [];
  for (const instance of instances) {
    const templateName = instance.template || "componentTemplates";
    const templates = templatesForName(templateMap, templateName);
    if (!templates) fail("未登记的 MTSLG 模板族: " + templateName);
    const variant = resolveInstanceVariant(instance, templates);
    if (!variant) {
      fail("组件实例缺少真实变体值（公开属性或组件名）: " + (instance.instanceRef || "(missing)"));
    }
    if (templates.unconfirmedVariants && templates.unconfirmedVariants.includes(variant)) {
      fail("尚未确认的 MTSLG 模板变体: " + variant);
    }
    const spec = templates.variants[variant];
    if (!spec) fail("未登记的 MTSLG 模板变体: " + variant);
    if (spec.componentSet && instance.componentSet && spec.componentSet !== instance.componentSet) {
      fail("组件集与公开属性值不一致: 变体 " + variant + " 登记组件 " + spec.componentSet +
        "，实例组件名 " + instance.componentSet);
    }
    resolved.push(validateInstance(instance, spec, result, sourceMap, nodeMap, usedSources, variant));
  }
  result.resolvedTemplates = resolved;
  return result;
}

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--mapping") args.mapping = argv[++i];
    else if (arg === "--map") args.map = argv[++i];
    else if (arg === "--out") args.out = argv[++i];
    else fail("用法: node resolve-mtslg-template-mapping.js --mapping <mapping.json> --map <mtslg-iocontrol-map.json> --out <resolved.json>");
  }
  if (!args.mapping || !args.map || !args.out) {
    fail("必须提供 --mapping、--map 和 --out");
  }
  return args;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const mapping = loadJson(args.mapping, "页面 mapping");
  const templateMap = loadTemplateMap(args.map);
  const resolved = resolveTemplateMapping(mapping, templateMap);
  fs.writeFileSync(args.out, JSON.stringify(resolved, null, 2) + "\n", "utf8");
}

if (require.main === module) {
  try { main(); } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}

module.exports = {
  loadTemplateMap,
  resolveTemplateMapping
};

#!/usr/bin/env node
"use strict";

// mtslg-iocontrol-map.json 里「规则块」的解析：唯一实现。
// 生成器（gen-iocontrol-xml.js）与校验器（validate-iocontrol-provenance.js）共用同一份解析，
// 各自只保留自己的**回退策略**（生成器回退到内置默认；校验器在没有 --map 时跳过校验）。
// 这两处曾各写一份 loadControlTypeRequiredAttrs / loadButtonFamilyRules，是历史漂移点，
// 由 scripts/tests/script-duplication.test.js 守护「不许再复制一份」。

const path = require("path");
// 映射表读取的唯一实现（含共享类型域的 extends 合并）：scripts/lib/load-template-map.js
const { loadTemplateMap } = require(path.join(__dirname, "..", "..", "..", "lib", "load-template-map.js"));

// 读模板表：路径缺失/不可读直接抛错（fail-closed），错误信息由 readTemplateMapOrFail 包装。
function readTemplateMap(mapPath) {
  return loadTemplateMap(mapPath);
}

// 读模板表：错误信息带路径，便于定位；解析失败直接失败（fail-closed）。生成器与校验器共用。
function readTemplateMapOrFail(mapPath) {
  try {
    return readTemplateMap(mapPath);
  } catch (error) {
    throw new Error("读取模板表失败: " + mapPath + " - " + error.message);
  }
}

// controlTypeRequiredAttrs：每个 ControlType 的固定必写字段集。表里没有该块时返回 null。
function parseControlTypeRequiredAttrs(templateMap) {
  const spec = templateMap && templateMap.controlTypeRequiredAttrs;
  if (!spec || typeof spec !== "object") return null;
  const result = {};
  for (const [type, list] of Object.entries(spec)) {
    if (type.startsWith("_")) continue;
    if (Array.isArray(list)) result[type] = list.map(String);
  }
  return Object.keys(result).length ? result : null;
}

// buttonFamily：按钮族（IconButton / Button / StatusButton）的固定参数与图标尺寸字段名。
// 表里没有该块时返回 null；缺单项时用调用方传进来的 defaults 补齐。
function parseButtonFamilyRules(templateMap, defaults) {
  const spec = templateMap && templateMap.buttonFamily;
  if (!spec || typeof spec !== "object") return null;
  const fallback = defaults || {};
  const pick = function (key, predicate) {
    const value = spec[key];
    return Array.isArray(value) && predicate(value) ? value.map(String) : fallback[key];
  };
  return {
    controlTypes: pick("controlTypes", function (list) { return list.length > 0; }),
    alwaysWrittenAttrs: pick("alwaysWrittenAttrs", function () { return true; }),
    iconSizeAttrs: pick("iconSizeAttrs", function (list) { return list.length === 2; })
  };
}

// tableTemplates：表格族的「结构签名命中」+ 列定义模板 + 行列内容处置。
// 表里没有该块时返回 null（调用方按「表未登记表格族」处理）。
// 声明了 match.structural 就要求签名字段齐全（fail-closed）：命中路径、列模板、文本处置
// 必须是映射表里的真值，禁止在脚本里另立一份默认值——那正是本仓库反复踩过的漂移点。
function parseTableTemplate(templateMap) {
  const spec = templateMap && templateMap.tableTemplates;
  if (!spec || typeof spec !== "object") return null;
  const result = {
    match: spec.match && typeof spec.match === "object" ? spec.match : {},
    structural: null,
    variants: spec.variants && typeof spec.variants === "object" ? spec.variants : {},
    columnTemplate: null,
    columnControlTypePolicy: spec.columnControlTypePolicy || null,
    rowPolicy: spec.rowPolicy || null,
    innerTextPolicy: spec.innerTextPolicy || null,
    valuePolicy: spec.valuePolicy || null
  };
  const structural = spec.match && spec.match.structural;
  if (structural && typeof structural === "object") {
    const signature = structural.signature;
    if (!signature || typeof signature !== "object") {
      throw new Error("映射表 tableTemplates.match.structural 缺少 signature（结构签名字段）");
    }
    const headerNames = Array.isArray(signature.headerGroupNames) ? signature.headerGroupNames.map(String).filter(Boolean) : [];
    const rowNames = Array.isArray(signature.rowGroupNames) ? signature.rowGroupNames.map(String).filter(Boolean) : [];
    if (!headerNames.length || !rowNames.length) {
      throw new Error("映射表 tableTemplates.match.structural.signature 必须登记 headerGroupNames 与 rowGroupNames");
    }
    if (typeof structural.variant !== "string" || !structural.variant) {
      throw new Error("映射表 tableTemplates.match.structural 必须登记 variant（命中的变体名）");
    }
    if (!result.variants[structural.variant]) {
      throw new Error("映射表 tableTemplates.match.structural.variant 未在 variants 里登记: " + structural.variant);
    }
    result.structural = {
      nodeTypes: Array.isArray(structural.nodeTypes) && structural.nodeTypes.length
        ? structural.nodeTypes.map(String) : ["GROUP"],
      variant: structural.variant,
      headerGroupNames: headerNames,
      rowGroupNames: rowNames,
      minRows: Number.isFinite(Number(signature.minRows)) ? Number(signature.minRows) : 1,
      minHeaderTexts: Number.isFinite(Number(signature.minHeaderTexts)) ? Number(signature.minHeaderTexts) : 1
    };
  }
  const column = spec.columnTemplate;
  if (column && typeof column === "object") {
    const geometry = column.geometry;
    if (!geometry || typeof geometry !== "object") {
      throw new Error("映射表 tableTemplates.columnTemplate 缺少 geometry（列定义几何）");
    }
    const pickNumber = function (key) {
      const value = Number(geometry[key]);
      if (!Number.isFinite(value)) throw new Error("映射表 tableTemplates.columnTemplate.geometry." + key + " 必须是数值");
      return value;
    };
    result.columnTemplate = {
      left: pickNumber("left"),
      top: pickNumber("top"),
      height: pickNumber("height"),
      omitWidth: column.omitWidth !== false,
      alwaysWrittenAttrs: Array.isArray(column.alwaysWrittenAttrs) ? column.alwaysWrittenAttrs.map(String) : [],
      requiredAttrsPolicy: column.requiredAttrsPolicy || "column-template"
    };
  }
  // 登记了结构签名却没有列模板时**不在这里失败**：列模板是"该路线怎么写表格"的写规则，不是判定数据。
  // 类型判定只读共享类型表（没有列模板）；只有真正命中表格、需要发射列定义时才是错误——
  // 那个 fail-closed 在发射分支里，错误信息同样点名列模板缺失。
  return result;
}

module.exports = {
  readTemplateMap: readTemplateMap,
  readTemplateMapOrFail: readTemplateMapOrFail,
  parseControlTypeRequiredAttrs: parseControlTypeRequiredAttrs,
  parseButtonFamilyRules: parseButtonFamilyRules,
  parseTableTemplate: parseTableTemplate
};

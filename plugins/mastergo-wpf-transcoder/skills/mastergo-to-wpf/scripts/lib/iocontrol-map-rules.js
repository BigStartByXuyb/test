#!/usr/bin/env node
"use strict";

// mtslg-iocontrol-map.json 里「规则块」的解析：唯一实现。
// 生成器（gen-iocontrol-xml.js）与校验器（validate-iocontrol-provenance.js）共用同一份解析，
// 各自只保留自己的**回退策略**（生成器回退到内置默认；校验器在没有 --map 时跳过校验）。
// 这两处曾各写一份 loadControlTypeRequiredAttrs / loadButtonFamilyRules，是历史漂移点，
// 由 scripts/tests/script-duplication.test.js 守护「不许再复制一份」。

const fs = require("fs");

// 读取 JSON；map 路径缺失/不可读由调用方决定如何处理（这里直接抛错）。
function readTemplateMap(mapPath) {
  return JSON.parse(fs.readFileSync(mapPath, "utf8"));
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

module.exports = {
  readTemplateMap: readTemplateMap,
  readTemplateMapOrFail: readTemplateMapOrFail,
  parseControlTypeRequiredAttrs: parseControlTypeRequiredAttrs,
  parseButtonFamilyRules: parseButtonFamilyRules
};

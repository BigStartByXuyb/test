#!/usr/bin/env node
"use strict";

// 映射表加载器（唯一实现）：路由映射表声明 `extends` 时，把共享的类型域合并进来。
// 合并结果的形状与「拆分前的单文件映射表」完全一致 —— 生成器/校验器不需要知道拆成了几个文件。
//
//   references/component-types.json                      共享：设计稿 → ControlType + 槽位 + Layout 推导
//   references/adapters/<路线>/<路线>-map.json            路由：该路线的写入规则（extends 指向共享文件）
//
// 合并语义：共享在前、路由在后（路由同名键覆盖共享）；`familyOverlays` 把路由专属的族内子键
// 贴回对应族；`extends` / `familyOverlays` 本身不出现在结果里。

const fs = require("fs");
const path = require("path");

function readJsonFile(filePath, label) {
  const abs = path.resolve(filePath);
  if (!fs.existsSync(abs)) throw new Error(label + "不存在: " + abs);
  try {
    return JSON.parse(fs.readFileSync(abs, "utf8"));
  } catch (error) {
    throw new Error(label + "不是合法 JSON: " + abs + " - " + error.message);
  }
}

function loadTemplateMap(filePath) {
  if (!filePath) throw new Error("loadTemplateMap: 缺少映射表路径");
  const abs = path.resolve(filePath);
  const route = readJsonFile(abs, "映射表");
  if (!route.extends) return route;

  const sharedPath = path.resolve(path.dirname(abs), route.extends);
  const shared = readJsonFile(sharedPath, "共享类型表（extends 指向）");
  const merged = { ...shared, ...route };
  delete merged.extends;

  const overlays = merged.familyOverlays || {};
  delete merged.familyOverlays;
  for (const [family, overlay] of Object.entries(overlays)) {
    merged[family] = { ...(merged[family] || {}), ...overlay };
  }
  return merged;
}

module.exports = { loadTemplateMap };

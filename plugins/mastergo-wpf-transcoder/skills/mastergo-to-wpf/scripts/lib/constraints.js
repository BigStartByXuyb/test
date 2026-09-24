#!/usr/bin/env node
"use strict";

// 尺寸约束（min/max 宽高）的唯一实现：键集、归一化口径、键名→WPF 属性名、DSL 遍历与收集。
// 消费者：core/apply-constraints.js（合并进 DSL）、adapters/mw-wpf/gen-mw-wpf-layout.js（成层判据与透传）、
//         adapters/mw-wpf/gen-mw-wpf-xaml.js（发射属性）、adapters/mw-wpf/check-wpf-layout.js（门禁一致性）。

// 设计稿的四个尺寸约束；顺序即产物里的属性顺序。
const CONSTRAINT_KEYS = ["minWidth", "maxWidth", "minHeight", "maxHeight"];

// 键名 → WPF 属性名。
const CONSTRAINT_ATTRS = {
  minWidth: "MinWidth",
  maxWidth: "MaxWidth",
  minHeight: "MinHeight",
  maxHeight: "MaxHeight"
};

// 未设置 = 0（插件 API 对"没设约束"返回 0，不是 null）；只保留 > 0 的项。
function normalizeConstraints(value) {
  const out = {};
  if (!value) return out;
  CONSTRAINT_KEYS.forEach(function (key) {
    const number = Number(value[key]);
    if (Number.isFinite(number) && number > 0) out[key] = number;
  });
  return out;
}

// 值取整成字符串（WPF 尺寸属性不接受小数像素）。
function constraintAttributes(value) {
  const normalized = normalizeConstraints(value);
  const attrs = {};
  CONSTRAINT_KEYS.forEach(function (key) {
    if (normalized[key]) attrs[CONSTRAINT_ATTRS[key]] = String(Math.round(normalized[key]));
  });
  return attrs;
}

// DSL 节点遍历（唯一实现）：node.children 递归，回调按节点调用。
function eachDslNode(node, visit) {
  if (!node || typeof node !== "object") return;
  if (Array.isArray(node)) {
    node.forEach(function (item) { eachDslNode(item, visit); });
    return;
  }
  visit(node);
  (node.children || []).forEach(function (child) { eachDslNode(child, visit); });
}

// id → 归一化 constraints（门禁按它逐格比对）。
function collectConstraints(roots) {
  const out = {};
  eachDslNode(roots, function (node) {
    if (typeof node.id !== "string" || !node.id) return;
    const normalized = normalizeConstraints(node.constraints);
    if (Object.keys(normalized).length) out[node.id] = normalized;
  });
  return out;
}

module.exports = {
  CONSTRAINT_KEYS,
  CONSTRAINT_ATTRS,
  normalizeConstraints,
  constraintAttributes,
  eachDslNode,
  collectConstraints
};

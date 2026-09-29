#!/usr/bin/env node
"use strict";

// 映射文档标题取值的唯一实现。
//
// 标题形如 `### 固定模板：组件集=输入框，变体=整数`：值按 `、，,/` 切成若干段，每段是「键=值」。
// 键取自固定集合（属性 1 / 按钮类型 / 变体 / 组件集 / 聚合集合 / 独立组件 / 结构分支），键里不含 `=`，
// 所以值一律取**第一个** `=` 之后的内容 —— 变体名本身可以含 `=`（如「集成图像=结果检查（预对准）展开」）。
// 没有 `=` 的段是上一段的续列，键为空、值是整段。
//
// 使用者：scripts/tools/mapping-change.js（改文档落点）、
//         scripts/adapters/mtslg-iocontrol/audit-mtslg-feishu-map.js（覆盖审计）。

const HEADING_RE = /^#{2,3}\s*(?:固定模板|待确认变体)\s*[：:]\s*(.*)$/;
const VALUE_SEP_RE = /[、，,/]/;
const NOTE_RE = /（[^）]*）/g;

// `### 固定模板：组件集=输入框，变体=整数` → [「组件集=输入框」,「变体=整数」]；不是这种标题返回 null。
// stripNotes：去掉括注说明（如「聚合集合=右侧栏（全部按钮类型变体）」的括号），审计归一章节名时用。
function headingPieces(line, options) {
  const hit = HEADING_RE.exec(String(line === undefined || line === null ? "" : line).trim());
  if (!hit) return null;
  const text = options && options.stripNotes ? hit[1].replace(NOTE_RE, "") : hit[1];
  return text.split(VALUE_SEP_RE).map(function (piece) { return piece.trim(); }).filter(Boolean);
}

// 「组件集=输入框」→ {key:"组件集", value:"输入框"}；「晶圆图」→ {key:"", value:"晶圆图"}。
function splitKeyValue(piece) {
  const at = piece.indexOf("=");
  if (at < 0) return { key: "", value: piece.trim() };
  return { key: piece.slice(0, at).trim(), value: piece.slice(at + 1).trim() };
}

// 标题里的全部取值（不含空段）：`### 固定模板：组件集=输入框，变体=整数` → ["输入框","整数"]。
function headingValues(line) {
  const pieces = headingPieces(line);
  if (!pieces) return null;
  return pieces.map(function (piece) { return splitKeyValue(piece).value; }).filter(Boolean);
}

module.exports = {
  HEADING_RE: HEADING_RE,
  VALUE_SEP_RE: VALUE_SEP_RE,
  headingPieces: headingPieces,
  headingValues: headingValues,
  splitKeyValue: splitKeyValue
};

#!/usr/bin/env node
"use strict";

// 图标台账条目 ↔ 目标 PATH 的归属判据（唯一实现，禁止在脚本里再抄一份）。
//
// 真值口径见 references/adapters/mtslg-iocontrol/mtslg-mode.md 的「图标台账与按钮的归属匹配」：
//   ① 树判据优先：条目节点的 PATH 子树与目标 PATH 集合有交集 → 命中；
//   ② 仅当没有任何树命中时，才回退到 id 字符串前缀（相等/包含）——前缀不是并列条件；
//   ③ 多条命中取树深度最深者（最专属），并列再取 id 更长者。
//
// 为什么必须有 ② 的"仅当"：部分设计稿里「图标组 / 按钮组」的 id 不是其子 PATH id 的
// 字符串前缀，只按前缀匹配会静默匹配不到；反过来，若把前缀与树并列进同一个候选池，
// 同一份数据可能因为排序差异选出与树判据不同的归属。
//
// 调用方提供一个「树索引」适配器（各脚本按自己的索引结构组装）：
//   {
//     hasNode(ref) -> boolean,
//     childrenOf(ref) -> string[],   // 直接子节点 ref，按树序
//     parentOf(ref) -> string|null,
//     isPathNode(ref) -> boolean,
//   }
//
// 用法:
//   const ICON_OWNERSHIP = require("./lib/icon-ownership.js");
//   const owners = ICON_OWNERSHIP.selectOwningEntries({
//     index, entries, entryRef: (entry) => entry.sourceRef, targetPathRefs
//   });

function isPrefixOf(sourceId, ref) {
  return typeof sourceId === "string" && sourceId !== "" &&
    typeof ref === "string" && ref !== "" &&
    (ref === sourceId || ref.startsWith(sourceId + "/"));
}

// 子树内的 PATH ref（含自身若是 PATH），按树序。
function subtreePathIds(index, ref) {
  if (!index || !index.hasNode(ref)) return [];
  const out = [];
  const stack = [ref];
  while (stack.length > 0) {
    const current = stack.pop();
    if (index.isPathNode(current)) out.push(current);
    const children = index.childrenOf(current);
    for (let i = children.length - 1; i >= 0; i -= 1) stack.push(children[i]);
  }
  return out;
}

// 节点在树中的深度（根 = 0）。
function depthOf(index, ref) {
  if (!index || !index.hasNode(ref)) return -1;
  let depth = 0;
  let current = index.parentOf(ref);
  const seen = new Set();
  while (current && !seen.has(current)) {
    seen.add(current);
    depth += 1;
    current = index.parentOf(current);
  }
  return depth;
}

// 条目节点的 PATH 子树里，是否含有目标 PATH 集合中的任意一条。
function subtreeContainsAny(index, containerRef, targetPathRefs) {
  const wanted = targetPathRefs instanceof Set ? targetPathRefs : new Set(targetPathRefs);
  if (wanted.size === 0) return false;
  return subtreePathIds(index, containerRef).some((path) => wanted.has(path));
}

// 归属选择：返回排好序的命中条目（树命中优先；无树命中才回退 id 前缀）。
//   options.index          树索引适配器
//   options.entries        候选条目数组（台账条目 / extractSvg 条目）
//   options.entryRef       (entry) => 该条目的来源节点 ref
//   options.targetPathRefs 目标 PATH ref 数组（按钮的图标 PATH / 候选 PATH）
function selectOwningEntries(options) {
  const index = options && options.index;
  const entries = Array.isArray(options && options.entries) ? options.entries : [];
  const entryRef = options && options.entryRef;
  const targetPathRefs = Array.isArray(options && options.targetPathRefs) ? options.targetPathRefs : [];
  if (typeof entryRef !== "function" || targetPathRefs.length === 0) return [];

  const byTree = entries.filter((entry) => {
    const ref = entryRef(entry);
    return typeof ref === "string" && ref !== "" && subtreeContainsAny(index, ref, targetPathRefs);
  });
  const pool = byTree.length > 0
    ? byTree
    : entries.filter((entry) => {
      const ref = entryRef(entry);
      return typeof ref === "string" && ref !== "" &&
        targetPathRefs.some((path) => isPrefixOf(ref, path) || isPrefixOf(path, ref));
    });

  return pool.slice().sort((a, b) => {
    const byDepth = depthOf(index, entryRef(b)) - depthOf(index, entryRef(a));
    if (byDepth !== 0) return byDepth;
    return String(entryRef(b)).length - String(entryRef(a)).length;
  });
}

module.exports = {
  isPrefixOf,
  subtreePathIds,
  depthOf,
  subtreeContainsAny,
  selectOwningEntries,
};

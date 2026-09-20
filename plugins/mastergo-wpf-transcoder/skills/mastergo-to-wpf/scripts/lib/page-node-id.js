#!/usr/bin/env node
"use strict";
/*
 * 页面节点 ID 口径的**唯一实现**（生成器与查询工具共用；禁止各写一份）。
 *
 *   ID = "MX_" + sha256(页面键 + "\n" + 节点 ref) 前 32 位小写十六进制
 *      页面键 = DSL 快照根节点自己的 id（= 设计帧 layerId，如 "79:162125"）
 *      节点 ref = 快照里的全路径 ref（父链 + 自身 id，页内唯一，兄弟增删不影响）
 *
 * 口径全文见 references/adapters/mtslg-iocontrol/mtslg-mode.md 第 2 节「页面节点 ID 口径」。
 * C# 侧 `tools/page-node-id/PageNodeId.cs` 是同一公式的独立实现，供不装 Node 的开发使用；
 * 两者一致性由 tests/resolve-page-node-id.test.js 比对（exe 存在时）。
 */
const crypto = require("crypto");

const ID_PREFIX = "MX_";

// 页面键：取 DSL 快照的根节点 id；缺根节点时直接失败（不能悄悄换一个键，否则整页 ID 都会变）。
function pageKeyOf(dslSnapshot) {
  const root = dslSnapshot && dslSnapshot.dsl && Array.isArray(dslSnapshot.dsl.nodes)
    ? dslSnapshot.dsl.nodes[0] : null;
  const key = root && root.id !== undefined && root.id !== null ? String(root.id) : "";
  if (!key) throw new Error("DSL 快照缺少根节点 id，无法派生页面节点 ID");
  return key;
}

// 单个节点的 ID（纯函数：同 pageKey + 同 ref → 同 ID）。
function derivePageNodeId(pageKey, ref) {
  if (typeof pageKey !== "string" || !pageKey) throw new Error("派生页面节点 ID 需要页面键");
  if (typeof ref !== "string" || !ref) throw new Error("派生页面节点 ID 需要节点 ref");
  return ID_PREFIX + crypto.createHash("sha256").update(pageKey + "\n" + ref, "utf8").digest("hex").slice(0, 32);
}

module.exports = { ID_PREFIX, pageKeyOf, derivePageNodeId };

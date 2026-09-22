#!/usr/bin/env node
"use strict";

// 「这个 PATH 要不要进本页图标台账」的**唯一实现**。discover 直接输出结论，
// 调用方（模型/审阅者）不再去读 page-build-rules.md 的判定表推一遍。
//
// 判据只有一条：该图形是否落在**本页会从句图标台账取图形的发射点**子树里。发射点只有两处：
//   ① 命中模板族变体的控件——变体登记的 `iconPolicy` 说明该槽位有图标，`Icon=` 取台账条目；
//   ② 布局族底部栏里**会生成 MenuItem** 的按钮——`MenuItem` 的 `Icon` 由
//      `gen-mtslg-layout-manifest.js` 的 `iconEntryOf()` 从本页台账取值。
// 其余位置（相机视口内部绘制、常驻分组按钮、宿主公共栏、背景/分割装饰、未登记组件内部、
// 页面级自由绘制）没有任何发射点引用它们；登记了就是 Icons.xaml 里的死资源。
//
// 取值一律从真值源读，本文件不另立枚举：
//   iconPolicy / layoutRules.bottomBar.*  → references/adapters/mtslg-iocontrol/mtslg-iocontrol-map.json
//   宿主壳标记词                          → scripts/lib/mastergo-rules.js（isHostShellName，唯一实现）
//
// 结论字段：{ register, basis, family, variant, instanceRef, source, matchedName }
//   basis 是机器可读的判据名（run-all 的台账门禁与回归测试按它断言）：
//     icon-policy-<映射表里登记的值>  该变体有图标槽位 → 登记
//     icon-policy-none                该变体声明该槽位没有图标 → 不登记（没有图形可登记）
//     icon-policy-runtime             图标由目标项目提供 → 不登记（多出来的条目会被 Bundle 剔除并记 runtimeIcons）
//     camera-viewport-internal        相机视口内部绘制（角色取自映射表 cameraTemplates.innerTextPolicy.role）→ 不登记
//     bottom-bar-menu-item            底部栏 MenuItem 的图标 → 登记
//     bottom-bar-resident             常驻分组里的按钮（不发 MenuItem、不占 Index）→ 不登记
//     bottom-bar-decorative           底部栏 MenuItem 内的背景/分割 → 不登记
//     host-shell                      宿主公共栏（顶部栏/底部栏/常驻信息标记词）→ 不登记
//     decorative                      背景/分割装饰 → 不登记
//     no-icon-slot                    没有任何发射点引用它 → 不登记
//     unregistered-variant            命中实例但映射表里查不到该变体 → 不登记并列入人工核对（映射表缺登记）
//     variant-without-icon-policy     变体已登记、但漏登记 iconPolicy → 不登记并列入人工核对（映射表漏字段）

const { isHostShellName } = require("./mastergo-rules.js");
// 变体归属判据的唯一实现（见 resolve-mtslg-template-mapping.js；缺失时 componentInstances 没有 variant 字段）。
const { resolveInstanceVariant } = require("../resolve-mtslg-template-mapping.js");

// 映射表里的**块名**（结构定位，不是可枚举的取值清单）。
const CAMERA_BLOCK = "cameraTemplates";
const LAYOUT_RULES_BLOCK = "layoutRules";

// 该族登记的 iconPolicy → 是否登记。任何未登记进这张判据表的值都按"有图标槽位"处理
// （映射表新增取值时默认登记，宁可多登记也不静默丢图标），取值本身仍由映射表决定。
const POLICY_DECISION = {
  none: { register: false, basis: "icon-policy-none" },
  runtime: { register: false, basis: "icon-policy-runtime" },
};

function regexOf(pattern, what) {
  if (typeof pattern !== "string" || !pattern) {
    throw new Error("映射表缺少 " + what + "（登记判据无法机械判定，禁止在脚本里另写一份）");
  }
  return new RegExp(pattern);
}

// DSL 快照的父子索引：唯一实现（discover 的祖先链/朝向提示与登记判据共用这一份）。
function buildDslIndex(snapshot) {
  const byRef = new Map();
  const parentOf = new Map();
  const root = snapshot && snapshot.dsl && Array.isArray(snapshot.dsl.nodes) ? snapshot.dsl.nodes[0] : null;
  (function visit(node, parentRef) {
    if (!node || typeof node.id !== "string") return;
    byRef.set(node.id, node);
    parentOf.set(node.id, parentRef);
    for (const child of node.children || []) visit(child, node.id);
  })(root, null);
  return { byRef: byRef, parentOf: parentOf };
}

// 从图形节点向上一路收集祖先链（含自身），到页面根为止。
function ancestorChain(index, ref) {
  const chain = [];
  let current = ref;
  let guard = 0;
  while (current && guard < 256) {
    const node = index.byRef.get(current);
    if (node) chain.push(node);
    current = index.parentOf.get(current) || null;
    guard += 1;
  }
  return chain;
}

function buildRegistrationPolicy(options) {
  const templateMap = options && options.templateMap;
  const mapping = options && options.mapping;
  const snapshot = options && options.snapshot;
  if (!templateMap || typeof templateMap !== "object") {
    throw new Error("登记判据需要映射表（mtslg-iocontrol-map.json）：没有它就只能在文档里再推一遍，禁止");
  }
  if (!mapping || typeof mapping !== "object") throw new Error("登记判据需要本页 mapping");
  if (!snapshot) throw new Error("登记判据需要 DSL 快照（祖先链与所属实例都取自真实节点树）");

  const layoutRules = templateMap[LAYOUT_RULES_BLOCK] || {};
  const bottomBar = layoutRules.bottomBar || {};
  const variantNames = new Set(Object.keys(bottomBar.variants || {}));
  const residentPattern = regexOf(bottomBar.residentGroupPattern, "layoutRules.bottomBar.residentGroupPattern");
  const decorPattern = regexOf(bottomBar.decorativeNamePattern, "layoutRules.bottomBar.decorativeNamePattern");
  const cameraRole = ((templateMap[CAMERA_BLOCK] || {}).innerTextPolicy || {}).role || CAMERA_BLOCK;
  const index = buildDslIndex(snapshot);

  // 变体归属只认两处真值源，都是生成期产物、都不在这里重跑匹配：
  //   ① mapping.resolvedTemplates —— 解析器（resolve-mtslg-template-mapping.js）跑过之后的形状；
  //   ② mapping.componentInstances —— 生成器（gen-mtslg-mapping-from-dsl.js）直接产出的形状，
  //      **run-all 第 6 步喂给 discover 的正是这一种（草稿 mapping）**，它没有 resolvedTemplates，
  //      变体要用与解析器同一份判据从公开属性/组件名取（resolveInstanceVariant，禁止另写一份）。
  const instanceByRef = new Map();
  for (const entry of Array.isArray(mapping.resolvedTemplates) ? mapping.resolvedTemplates : []) {
    if (!entry || typeof entry.instanceRef !== "string" || !entry.instanceRef) continue;
    instanceByRef.set(entry.instanceRef, { template: entry.template, variant: entry.variant, instanceRef: entry.instanceRef });
  }
  if (instanceByRef.size === 0) {
    for (const entry of Array.isArray(mapping.componentInstances) ? mapping.componentInstances : []) {
      if (!entry || typeof entry.instanceRef !== "string" || !entry.instanceRef) continue;
      const family = entry.template || "componentTemplates";
      const block = templateMap[family];
      const variant = block && entry.variant ? entry.variant : (block ? resolveInstanceVariant(entry, block) : null);
      instanceByRef.set(entry.instanceRef, { template: family, variant: variant, instanceRef: entry.instanceRef });
    }
  }

  function variantSpec(family, variant) {
    const block = templateMap[family];
    const variants = block && block.variants;
    const spec = variants && variants[variant];
    return spec && typeof spec === "object" ? spec : null;
  }

  // 单个图形节点的登记结论。ref 必须是 DSL 里真实存在的节点。
  function evaluate(ref) {
    const chain = ancestorChain(index, ref);
    for (const node of chain) {
      const instance = instanceByRef.get(node.id);
      if (!instance) continue;
      const family = instance.template;
      const variant = instance.variant;
      if (family === CAMERA_BLOCK) {
        // 相机视口是整体：内部一切绘制内容都不处理，只发射外层 Camera 控件。
        return verdict(false, family, variant, node.id, CAMERA_BLOCK + ".innerTextPolicy.role", node.name, cameraRole);
      }
      const spec = variantSpec(family, variant);
      if (!spec) {
        return verdict(false, family, variant, node.id, family + ".variants." + variant, node.name, "unregistered-variant");
      }
      const policy = typeof spec.iconPolicy === "string" ? spec.iconPolicy : null;
      if (policy === null) {
        return verdict(false, family, variant, node.id, family + ".variants." + variant + ".iconPolicy", node.name, "variant-without-icon-policy");
      }
      const decision = POLICY_DECISION[policy];
      if (decision) {
        return verdict(decision.register, family, variant, node.id,
          family + ".variants." + variant + ".iconPolicy=" + policy, node.name, decision.basis);
      }
      return verdict(true, family, variant, node.id,
        family + ".variants." + variant + ".iconPolicy=" + policy, node.name, "icon-policy-" + policy);
    }
    // 没有命中模板族实例：按布局族 / 宿主壳 / 装饰的**位置**判定（顺序即判据优先级）。
    const barIndex = chain.findIndex(node => node.type === "INSTANCE" && variantNames.has(node.name));
    const residentIndex = chain.findIndex(node => node.type === "INSTANCE" && residentPattern.test(String(node.name || "")));
    const decorIndex = chain.findIndex(node => decorPattern.test(String(node.name || "")));
    const shellIndex = chain.findIndex(node => isHostShellName(node.name));
    if (barIndex >= 0 && residentIndex > barIndex) {
      // 常驻分组里的按钮复用布局族变体，但不发 MenuItem、不占 Index（框架单独处理）→ 无发射点。
      return verdict(false, null, chain[barIndex].name, null, LAYOUT_RULES_BLOCK + ".bottomBar.residentGroupPattern",
        chain[barIndex].name, "bottom-bar-resident");
    }
    if (barIndex >= 0 && decorIndex >= 0 && decorIndex < barIndex) {
      return verdict(false, null, chain[barIndex].name, null, LAYOUT_RULES_BLOCK + ".bottomBar.variants",
        chain[barIndex].name, "bottom-bar-decorative");
    }
    if (barIndex >= 0) {
      return verdict(true, null, chain[barIndex].name, null, LAYOUT_RULES_BLOCK + ".bottomBar.variants",
        chain[barIndex].name, "bottom-bar-menu-item");
    }
    if (shellIndex >= 0) {
      return verdict(false, null, null, null, "lib/mastergo-rules.js#HOST_SHELL_NAME_MARKERS",
        chain[shellIndex].name, "host-shell");
    }
    if (decorIndex >= 0) {
      return verdict(false, null, null, null, LAYOUT_RULES_BLOCK + ".bottomBar.decorativeNamePattern",
        chain[decorIndex].name, "decorative");
    }
    return verdict(false, null, null, null, null, chain.length ? chain[chain.length - 1].name : null, "no-icon-slot");
  }

  function verdict(register, family, variant, instanceRef, source, matchedName, basis) {
    return {
      register: register,
      basis: basis,
      family: family,
      variant: variant,
      instanceRef: instanceRef,
      source: source,
      matchedName: matchedName === undefined ? null : matchedName,
    };
  }

  return {
    evaluate: evaluate,
    index: index,
    bottomBarVariants: variantNames,
    hasVariant: function (name) { return variantNames.has(name); },
    instanceOf: function (ref) { return instanceByRef.get(ref) || null; },
  };
}

module.exports = {
  buildRegistrationPolicy: buildRegistrationPolicy,
  buildDslIndex: buildDslIndex,
  ancestorChain: ancestorChain,
};

#!/usr/bin/env node
"use strict";

const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");

const script = path.join(__dirname, "..", "discover-mtslg-page-icon-map.js");
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "mastergo-icon-discovery-"));
const svgFile = path.join(dir, "extractSvg.json");
const mappingFile = path.join(dir, "mapping.json");
const confirmedFile = path.join(dir, "confirmed.json");
const outFile = path.join(dir, "page-icon-map.json");

fs.writeFileSync(svgFile, JSON.stringify({ svgs: [
  { id: "shell/top", name: "顶部状态栏", svg: "<svg><path d=\"M0,0 L1,1\"/></svg>" },
  { id: "page/known", name: "向上", svg: "<svg><path d=\"M1,1 L2,2\"/></svg>" }
] }), "utf8");
fs.writeFileSync(mappingFile, JSON.stringify({ sourceNodes: [
  { ref: "shell/top/path", type: "PATH", name: "路径", svgName: "顶部状态栏" },
  { ref: "page/known/path", type: "PATH", name: "多边形", svgName: "向上" }
] }), "utf8");
fs.writeFileSync(confirmedFile, JSON.stringify({ icons: [
  { sourceId: "page/known", name: "UpGeometry", comment: "向上", sourceRef: "page/known/path" }
] }), "utf8");

const result = spawnSync(process.execPath, [script, "--svg", svgFile, "--mapping", mappingFile, "--confirmed", confirmedFile, "--out", outFile], { encoding: "utf8" });
assert.strictEqual(result.status, 0, result.stderr);
const output = JSON.parse(fs.readFileSync(outFile, "utf8"));
assert.deepStrictEqual(output.icons, JSON.parse(fs.readFileSync(confirmedFile, "utf8")).icons);
assert.strictEqual(output.candidates.length, 2);
const shell = output.candidates.find((candidate) => candidate.sourceId === "shell/top");
assert.ok(shell);
assert.strictEqual(shell.status, "unmapped");
assert.strictEqual(shell.reason, "missing-page-resource-name");
assert.strictEqual(shell.sourceRef, "shell/top/path");
assert.ok(!Object.prototype.hasOwnProperty.call(shell, "sectionIndex"));
assert.ok(!Object.prototype.hasOwnProperty.call(shell, "name"));
const known = output.candidates.find((candidate) => candidate.sourceId === "page/known");
assert.strictEqual(known.status, "confirmed");

// ---- 树判据回归：图标组 id 不是其子 PATH id 的字符串前缀时（部分设计稿里同一实例内的
//      节点 id 只共享外层实例前缀），候选仍必须归属到该图标组条目。
//      旧口径（纯 id 前缀）下这条候选会被误报成 no-exact-extractSvgEntry。----
const treeSvgFile = path.join(dir, "extractSvg.tree.json");
const treeMappingFile = path.join(dir, "mapping.tree.json");
const treeOutFile = path.join(dir, "page-icon-map.tree.json");
fs.writeFileSync(treeSvgFile, JSON.stringify({ svgs: [
  { id: "tree/root/icon-group", name: "图标组", svg: "<svg><path d=\"M0,0 L1,1\"/></svg>" }
] }), "utf8");
fs.writeFileSync(treeMappingFile, JSON.stringify({ sourceNodes: [
  { ref: "tree/root", type: "INSTANCE", name: "按钮", parentRef: null },
  { ref: "tree/root/icon-group", type: "GROUP", name: "图标组", parentRef: "tree/root" },
  // PATH 的父节点是图标组（树包含成立），但 id 不是「图标组 id + /」开头（id 前缀不成立）
  { ref: "tree/root/1066:329573", type: "PATH", name: "路径 203", svgName: "向上", parentRef: "tree/root/icon-group" }
] }), "utf8");
const treeResult = spawnSync(process.execPath,
  [script, "--svg", treeSvgFile, "--mapping", treeMappingFile, "--out", treeOutFile],
  { encoding: "utf8" });
assert.strictEqual(treeResult.status, 0, treeResult.stderr);
const treeOutput = JSON.parse(fs.readFileSync(treeOutFile, "utf8"));
assert.strictEqual(treeOutput.candidates.length, 1);
const treeCandidate = treeOutput.candidates[0];
assert.strictEqual(treeCandidate.sourceId, "tree/root/icon-group",
  "id 前缀断裂时，必须按 DSL 树归属匹配到图标组条目");
assert.strictEqual(treeCandidate.reason, "missing-page-resource-name",
  "命中条目但未起名 → missing-page-resource-name（而不是 no-exact-extractSvgEntry）");

// ---- 台账提示（ledgerFields）回归：ref 全部来自机器读取，人只填 name/comment。
//      覆盖 ① 有 extractSvg 条目 + 祖先组带 flipV → 需烘焙；② 无 extractSvg 条目 → fromDsl。
//      ③ 未传 --dsl 时 bakeAncestorTransform 为 null（无法判断，不猜）。----
const hintSvgFile = path.join(dir, "extractSvg.hint.json");
const hintMappingFile = path.join(dir, "mapping.hint.json");
const hintDslFile = path.join(dir, "dsl.hint.json");
const hintOutFile = path.join(dir, "page-icon-map.hint.json");
const hintOutNoDsl = path.join(dir, "page-icon-map.hint-no-dsl.json");
const upGroup = "page/root/btn-up/icon-group";
const upPath = upGroup + "/path";
const downGroup = "page/root/btn-down/icon-group";
const downPath = downGroup + "/path";
fs.writeFileSync(hintSvgFile, JSON.stringify({ svgs: [
  { id: upGroup, name: "组 1521", svg: "<svg><path d=\"M0,0 L1,1\"/></svg>" }
] }), "utf8");
fs.writeFileSync(hintDslFile, JSON.stringify({ dsl: { nodes: [
  { id: "page/root", type: "INSTANCE", name: "页", children: [
    { id: "page/root/btn-up", type: "INSTANCE", name: "向上", children: [
      { id: upGroup, type: "GROUP", name: "组 1521", layoutStyle: { width: 26, height: 28, flipV: true }, children: [
        { id: upPath, type: "PATH", name: "联集 255", layoutStyle: { width: 26, height: 28 } }
      ] }
    ] },
    { id: "page/root/btn-down", type: "INSTANCE", name: "向下", children: [
      { id: downGroup, type: "GROUP", name: "组 1526", layoutStyle: { width: 100, height: 60 }, children: [
        // 顶层 rotate 不算数：生成器只读 layoutStyle（口径必须一致）
        { id: downPath, type: "PATH", name: "路径 119", rotate: 90, layoutStyle: { width: 35, height: 26 } }
      ] }
    ] }
  ] }
] } }), "utf8");
const hintSourceNodes = [
  { ref: "page/root", type: "INSTANCE", name: "页", parentRef: null },
  { ref: "page/root/btn-up", type: "INSTANCE", name: "向上", parentRef: "page/root" },
  { ref: upGroup, type: "GROUP", name: "组 1521", parentRef: "page/root/btn-up" },
  { ref: upPath, type: "PATH", name: "联集 255", svgName: "组 1521", parentRef: upGroup, width: 26, height: 28 },
  { ref: "page/root/btn-down", type: "INSTANCE", name: "向下", parentRef: "page/root" },
  { ref: downGroup, type: "GROUP", name: "组 1526", parentRef: "page/root/btn-down" },
  { ref: downPath, type: "PATH", name: "路径 119", svgName: "组 1526", parentRef: downGroup, width: 35, height: 26 }
];
fs.writeFileSync(hintMappingFile, JSON.stringify({
  sourceNodes: hintSourceNodes,
  nodes: [
    { sourceRef: "page/root/btn-up", controlType: "IconButton", sourceText: "向上", attrs: {} },
    { sourceRef: "page/root/btn-down", controlType: "IconButton", sourceText: "向下", attrs: {} }
  ]
}), "utf8");

const hintResult = spawnSync(process.execPath,
  [script, "--svg", hintSvgFile, "--mapping", hintMappingFile, "--dsl", hintDslFile, "--out", hintOutFile],
  { encoding: "utf8" });
assert.strictEqual(hintResult.status, 0, hintResult.stderr);
const hintOutput = JSON.parse(fs.readFileSync(hintOutFile, "utf8"));
assert.strictEqual(hintOutput.candidates.length, 2);
const upCandidate = hintOutput.candidates.find((candidate) => candidate.sourceRef === upPath);
assert.strictEqual(upCandidate.sourceId, upGroup, "有 extractSvg 条目时 sourceId 取条目 id");
assert.strictEqual(upCandidate.ownerRef, "page/root/btn-up", "ownerRef 必须是沿真实父子链找到的最近映射控件");
assert.strictEqual(upCandidate.ownerText, "向上");
assert.strictEqual(upCandidate.ownerControlType, "IconButton");
assert.strictEqual(upCandidate.parentRef, upGroup);
assert.strictEqual(upCandidate.parentType, "GROUP");
assert.strictEqual(upCandidate.siblingPathCount, 1);
assert.deepStrictEqual(upCandidate.ledgerFields, {
  sourceId: upGroup,
  sourceRef: upPath,
  ledgerSourceRef: upPath,       // 单路径图标 → 台账就登记该 PATH
  fromDsl: false,
  bakeAncestorTransform: true,   // 祖先组 flipV=true
  iconSize: { width: 26, height: 28 }
});
const downCandidate = hintOutput.candidates.find((candidate) => candidate.sourceRef === downPath);
assert.strictEqual(downCandidate.sourceId, null, "无 extractSvg 条目时 sourceId 为 null");
assert.strictEqual(downCandidate.ledgerFields.fromDsl, true, "无条目 → fromDsl:true（生成器从 DSL 合成）");
assert.strictEqual(downCandidate.ledgerFields.bakeAncestorTransform, false,
  "顶层 rotate 不算数（生成器只读 layoutStyle）→ 不需要烘焙");
assert.deepStrictEqual(downCandidate.ledgerFields.iconSize, { width: 35, height: 26 });
assert.strictEqual(downCandidate.reason, "no-exact-extractSvg-entry");

const hintNoDslResult = spawnSync(process.execPath,
  [script, "--svg", hintSvgFile, "--mapping", hintMappingFile, "--out", hintOutNoDsl],
  { encoding: "utf8" });
assert.strictEqual(hintNoDslResult.status, 0, hintNoDslResult.stderr);
const hintNoDsl = JSON.parse(fs.readFileSync(hintOutNoDsl, "utf8"));
for (const candidate of hintNoDsl.candidates) {
  assert.strictEqual(candidate.ledgerFields.bakeAncestorTransform, null,
    "未传 --dsl 时无法判断祖先朝向 → null（不猜测）");
}

// ---- 多路径图标 + 朝向出现在「所属控件之上」：台账必须登记父层，且烘焙判据一路走到根
//      （与 gen-mtslg-page-icons.js 的 ancestorOrientationMatrix / synthesizeFromDsl 同口径）。----
const multiDslFile = path.join(dir, "dsl.multi.json");
const multiMappingFile = path.join(dir, "mapping.multi.json");
const multiOutFile = path.join(dir, "page-icon-map.multi.json");
const multiGroup = "page/root/wrap/btn-x/icon-group";
const multiPathA = multiGroup + "/path-a";
const multiPathB = multiGroup + "/path-b";
fs.writeFileSync(multiDslFile, JSON.stringify({ dsl: { nodes: [
  { id: "page/root", type: "INSTANCE", name: "页", children: [
    // 朝向在所属控件「之上」：生成器会一路烘焙到根，所以提示也必须是 true
    { id: "page/root/wrap", type: "GROUP", name: "外层容器", layoutStyle: { width: 200, height: 200, rotate: 90 }, children: [
      { id: "page/root/wrap/btn-x", type: "INSTANCE", name: "双侧箭头按钮", children: [
        { id: multiGroup, type: "GROUP", name: "图标组", layoutStyle: { width: 40, height: 24 }, children: [
          { id: multiPathA, type: "PATH", name: "路径 A", layoutStyle: { width: 16, height: 24 } },
          { id: multiPathB, type: "PATH", name: "路径 B", layoutStyle: { width: 16, height: 24 } }
        ] }
      ] }
    ] }
  ] }
] } }), "utf8");
fs.writeFileSync(multiMappingFile, JSON.stringify({
  sourceNodes: [
    { ref: "page/root", type: "INSTANCE", name: "页", parentRef: null },
    { ref: "page/root/wrap", type: "GROUP", name: "外层容器", parentRef: "page/root" },
    { ref: "page/root/wrap/btn-x", type: "INSTANCE", name: "双侧箭头按钮", parentRef: "page/root/wrap" },
    { ref: multiGroup, type: "GROUP", name: "图标组", parentRef: "page/root/wrap/btn-x", width: 40, height: 24 },
    { ref: multiPathA, type: "PATH", name: "路径 A", svgName: "图标组", parentRef: multiGroup, width: 16, height: 24 },
    { ref: multiPathB, type: "PATH", name: "路径 B", svgName: "图标组", parentRef: multiGroup, width: 16, height: 24 }
  ],
  nodes: [{ sourceRef: "page/root/wrap/btn-x", controlType: "IconButton", sourceText: "双侧箭头", attrs: {} }]
}), "utf8");
const multiResult = spawnSync(process.execPath,
  [script, "--svg", hintSvgFile, "--mapping", multiMappingFile, "--dsl", multiDslFile, "--out", multiOutFile],
  { encoding: "utf8" });
assert.strictEqual(multiResult.status, 0, multiResult.stderr);
const multiOutput = JSON.parse(fs.readFileSync(multiOutFile, "utf8"));
assert.strictEqual(multiOutput.candidates.length, 2);
for (const candidate of multiOutput.candidates) {
  assert.strictEqual(candidate.siblingPathCount, 2);
  assert.strictEqual(candidate.ledgerFields.ledgerSourceRef, multiGroup,
    "多路径图标 → 台账必须登记父层（组），否则合成几何会丢子路径");
  assert.strictEqual(candidate.ledgerFields.sourceRef, candidate.sourceRef,
    "sourceRef 仍是图形 PATH 的事实值");
  assert.strictEqual(candidate.ledgerFields.bakeAncestorTransform, true,
    "朝向在所属控件之上时也要报 true（一路烘焙到根，与生成器同口径）");
  assert.deepStrictEqual(candidate.ledgerFields.iconSize, { width: 40, height: 24 },
    "iconSize 取台账登记节点（父层）的 bbox");
  assert.strictEqual(candidate.ownerRef, "page/root/wrap/btn-x");
  assert.strictEqual(candidate.ownerText, "双侧箭头");
}

console.log("PASS page icon discovery regression test");

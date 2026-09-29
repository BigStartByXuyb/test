#!/usr/bin/env node
"use strict";

// 映射变更工具（scripts/tools/mapping-change.js）的纯函数回归。
// 工具动的是真文件，所以这里只喂字符串：落点判定、名字匹配口径、清单拆分、数词同步、
// 族分派、variants 块定位，一律不碰 references/ 与 .claude-plugin/。
// 存在的理由：落点判错会直接改错文档，而门禁查不出「改错了一节」——变体名只要还在总数行里
// 逐字出现就算过，所以工具自己的判定必须有独立用例钉住。

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");
const { loadTemplateMap } = require(path.join(__dirname, "..", "lib", "load-template-map.js"));

const TOOL = path.join(__dirname, "..", "tools", "mapping-change.js");
const SKILL_ROOT = path.join(__dirname, "..", "..");
const SHARED_MAP = path.join(SKILL_ROOT, "references", "component-types.json");
const ROUTE_MAP = path.join(SKILL_ROOT, "references", "adapters", "mtslg-iocontrol", "mtslg-iocontrol-map.json");
const LAYOUT_DOC = path.join(SKILL_ROOT, "references", "adapters", "mtslg-iocontrol", "feishu-layout-mapping.md");

const tool = require(TOOL);
const merged = loadTemplateMap(ROUTE_MAP);
const sharedLines = fs.readFileSync(SHARED_MAP, "utf8").split(/\r?\n/);
const layoutLines = fs.readFileSync(LAYOUT_DOC, "utf8").split(/\r?\n/);

// fail() 走 process.exit(2)，停止路径只能在子进程里断言。
function runInChild(callSource) {
  const script = "const t=require(" + JSON.stringify(TOOL) + ");" + callSource + ";";
  const result = spawnSync(process.execPath, ["-e", script], { encoding: "utf8" });
  return { status: result.status, stderr: String(result.stderr || "") };
}

// ---------- parseArgs：文档里写的选项名（带连字符）必须真的落到读它的那个键上 ----------
// 这条是补一个真出过的事故：--dry-run 只设了 dry-run 键，代码读 dryRun，于是「加开关没生效」。
assert.deepStrictEqual(tool.parseArgs(["add-variant", "--family", "componentTemplates", "--dry-run"]), {
  _: ["add-variant"],
  family: "componentTemplates",
  dryRun: true
});
assert.deepStrictEqual(tool.parseArgs(["add-variant", "--allow-residual-mentions", "--name", "x"]), {
  _: ["add-variant"],
  allowResidualMentions: true,
  name: "x"
});
assert.deepStrictEqual(tool.parseArgs(["add-variant", "--value", "a=1", "--value", "b=2"]), {
  _: ["add-variant"],
  value: ["a=1", "b=2"]
});
assert.deepStrictEqual(tool.parseArgs(["remove-variant", "--name", "x"]), { _: ["remove-variant"], name: "x" });

// ---------- headingValues：取值只从标题里取 ----------
assert.deepStrictEqual(tool.headingValues("### 固定模板：属性 1=轴操作"), ["轴操作"]);
assert.deepStrictEqual(tool.headingValues("### 固定模板：组件集=输入框，变体=整数"), ["输入框", "整数"]);
assert.deepStrictEqual(tool.headingValues("### 待确认变体：组件集=输入框，变体=密码输入框"), ["输入框", "密码输入框"]);
assert.deepStrictEqual(tool.headingValues("  ### 固定模板：属性 1=轴操作  "), ["轴操作"], "标题两侧空白忽略");
assert.deepStrictEqual(tool.headingValues("### 固定模板："), [], "只有前缀没有取值是空数组，不是 null");
assert.strictEqual(tool.headingValues("#### 固定模板：属性 1=轴操作"), null, "只认三级标题");
assert.strictEqual(tool.headingValues("正文里写 ### 固定模板：属性 1=轴操作"), null, "标题必须整行开头");
assert.strictEqual(tool.headingValues("### 变体：首页-长方形"), null, "bottomBar 的 ### 变体：不是取值标题");
// 并列取值按 、，,/ 切开：一段一个值，是否「只讲一个变体」由调用方判。
assert.deepStrictEqual(tool.headingValues("### 固定模板：组件集=集成图像 / 晶圆图"), ["集成图像", "晶圆图"]);
assert.deepStrictEqual(
  tool.headingValues("### 固定模板：属性 1=选择框-40/选择框-36/选择框-32/选择框-28"),
  ["选择框-40", "选择框-36", "选择框-32", "选择框-28"]
);

// ---------- resolveComponentAnchor：整段/整格恰好等于名字，不做子串匹配 ----------
const probe = [
  "## 固定模板",
  "",
  "### 固定模板：组件集=扫描",
  "MasterGo 变体：样例-大、样例-小。二者代码映射固定为 `IntNumberBox`。",
  "",
  "### 固定模板：组件集=集成图像-XIS 模式",
  "",
  "| start | RightButtonStyle | start |"
];
assert.deepStrictEqual(tool.resolveComponentAnchor(probe, "扫描"), [{ kind: "heading", index: 2 }]);
assert.deepStrictEqual(tool.resolveComponentAnchor(probe, "样例-小"), [{ kind: "list", index: 3 }]);
assert.deepStrictEqual(tool.resolveComponentAnchor(probe, "start"), [{ kind: "table", index: 7 }]);
assert.deepStrictEqual(tool.resolveComponentAnchor(probe, "集成图像"), [], "取值是集成图像-XIS 模式时不该匹配集成图像");
assert.deepStrictEqual(tool.resolveComponentAnchor(probe, "集成图像-XIS 模式"), [{ kind: "heading", index: 5 }]);
assert.deepStrictEqual(tool.resolveComponentAnchor(probe, "文档里没有"), []);
const dup = ["| start | A |", "### 固定模板：组件集=start"];
assert.deepStrictEqual(tool.resolveComponentAnchor(dup, "start"), [
  { kind: "table", index: 0 },
  { kind: "heading", index: 1 }
]);

// ---------- 清单行与比较行 ----------
assert.deepStrictEqual(
  tool.splitVariantListLine("MasterGo 变体：A、B、C。四者代码映射固定为 `X`。"),
  ["A", "B", "C"]
);
// fixture 用编造的名字：真变体名只许有一处真值源（映射表），枚举串会被 variant-mention-coverage 拦。
assert.deepStrictEqual(tool.splitVariantListLine("MasterGo 变体：样例-甲、样例-乙。"), ["样例-甲", "样例-乙"]);
assert.deepStrictEqual(tool.splitVariantListLine("MasterGo 变体：A，B C"), ["A", "B C"], "无句号时整行就是名字体");
assert.deepStrictEqual(tool.splitVariantListLine("MasterGo 变体：。"), [], "名字体为空就是空清单");
assert.strictEqual(tool.splitVariantListLine("变体：A、B。"), null, "前缀必须逐字是 MasterGo 变体：");
const parts = tool.variantListParts("MasterGo 变体：A、B。三者代码映射固定为 `X`。");
assert.deepStrictEqual([parts.head, parts.names, parts.tail], ["MasterGo 变体：", ["A", "B"], "。三者代码映射固定为 `X`。"]);
assert.strictEqual(parts.head + parts.names.join("、") + parts.tail, "MasterGo 变体：A、B。三者代码映射固定为 `X`。", "三段拼回必须逐字等于原文");

assert.strictEqual(tool.tableFirstCell("| start | RightButtonStyle | start |"), "start");
assert.strictEqual(tool.tableFirstCell("  |  | A |  "), null, "首格为空不是落点");
assert.strictEqual(tool.tableFirstCell("| --- | --- |"), null, "分隔行不是落点");
assert.strictEqual(tool.tableFirstCell("正文 | start |"), null, "必须是表格行");
assert.strictEqual(tool.tableFirstCell("| |"), null, "空单元格不是落点");

// ---------- 小节范围 ----------
const secLines = ["# 一级", "正文", "### 标题", "正文二", "", "## 下一个", "x"];
assert.deepStrictEqual(tool.componentSection(secLines, 2), { start: 2, end: 4 });
assert.deepStrictEqual(tool.componentSection(secLines, 0), { start: 0, end: 2 });
assert.strictEqual(tool.blockEnd(["a: {", "  x", "}"], 0, ""), 2);
assert.strictEqual(tool.blockEnd(["a: {", "  x"], 0, ""), -1, "没有同缩进的收尾行返回 -1");

// ---------- syncSectionNumeral：本节「N者」跟着变体数一起动 ----------
const numeralLines = [
  "### 固定模板：组件集=输入框",
  "MasterGo 变体：样例-大、样例-小。二者代码映射固定为 `IntNumberBox`。"
];
assert.strictEqual(tool.syncSectionNumeral(numeralLines, 0, 2, 1), true);
assert.ok(numeralLines[1].includes("三者"), "加一个变体后「二者」要变成「三者」");
assert.strictEqual(tool.syncSectionNumeral(numeralLines, 0, 2, -1), true);
assert.ok(numeralLines[1].includes("二者"), "减一个变体后要退回「二者」");
assert.strictEqual(tool.syncSectionNumeral(["### 标题", "正文没有数词"], 0, 2, 1), false, "没有数词就跳过");

const twoNumerals = runInChild("t.syncSectionNumeral(" + JSON.stringify(["二者。", "三者。"]) + ",0,2,1)");
assert.strictEqual(twoNumerals.status, 2, "一节里两处数词必须停下，不猜改哪一处");
assert.ok(twoNumerals.stderr.includes("✗"), "停下时打印 ✗ 前缀");
const overflow = runInChild("t.syncSectionNumeral(" + JSON.stringify(["十者。"]) + ",0,1,1)");
assert.strictEqual(overflow.status, 2, "超出中文数词（一～十）必须停下");
const underflow = runInChild("t.syncSectionNumeral(" + JSON.stringify(["一者。"]) + ",0,1,-1)");
assert.strictEqual(underflow.status, 2, "数词减到 0 必须停下");

// ---------- 族分派 ----------
const families = tool.componentFamilyKeys(merged);
assert.deepStrictEqual(families, [
  "componentTemplates",
  "rightSidebarTemplates",
  "rightSidebarComponentTemplates",
  "inputTemplates",
  "selectBoxTemplates",
  "selectionTemplates",
  "infoGroupTemplates",
  "cameraTemplates",
  "mainMenuTemplates",
  "tableTemplates"
]);
assert.ok(!families.includes("_meta"), "私有键不是族");
assert.ok(!families.includes("layoutRules"), "layoutRules 不是组件库族（bottomBar 单独一种形态）");
assert.deepStrictEqual(tool.availableFamilies(merged), ["layoutRules.bottomBar"].concat(families));
assert.ok(tool.familyVariants(merged, "layoutRules.bottomBar"), "bottomBar 要有 variants");
assert.strictEqual(Object.keys(tool.familyVariants(merged, "layoutRules.bottomBar")).length, 17);
assert.strictEqual(tool.familyVariants(merged, "componentTemplates").扫描.controlType, "IconButton");
assert.strictEqual(tool.familyVariants(merged, "没有这个族"), null);
assert.strictEqual(tool.shapeOf("layoutRules.bottomBar"), "bottomBar");
assert.strictEqual(tool.shapeOf("componentTemplates"), "component");
assert.ok(tool.docFileOf("bottomBar").endsWith("feishu-layout-mapping.md"));
assert.ok(tool.docFileOf("component").endsWith("feishu-component-library-mapping.md"));

// ---------- variants 块必须定位到「自己族」那一段 ----------
// 这条专治从 familyKey 往下找第一个 "variants" 的写法：那样会顺着读进下一个族的块。
function directEntryCount(lines, block) {
  const entryRe = new RegExp("^" + block.indent + "  \"");
  let count = 0;
  for (let index = block.start + 1; index < block.end; index += 1) {
    if (entryRe.test(lines[index])) count += 1;
  }
  return count;
}
for (const key of tool.availableFamilies(merged)) {
  const block = tool.variantsBlockFor(sharedLines, key);
  assert.ok(block.start > 0 && block.end > block.start, key + " 的 variants 块要定位得到");
  assert.strictEqual(
    directEntryCount(sharedLines, block),
    Object.keys(tool.familyVariants(merged, key)).length,
    key + " 的 variants 块内直接条目数要与合并结果一致（说明没串到别的族）"
  );
}

// ---------- bottomBar 人读文档的小节范围 ----------
const doc = { lines: layoutLines };
const range = tool.sectionRange(doc, "首页-长方形");
assert.ok(range, "feishu-layout-mapping.md 里要有「首页-长方形」小节");
assert.strictEqual(layoutLines[range.start].trim(), "### 变体：首页-长方形");
assert.ok(range.end <= layoutLines.length, "小节范围不能越界");
assert.ok(!/^#{1,3} /.test(layoutLines[range.end] || ""), "小节范围不能吞掉下一个标题");
assert.strictEqual(tool.sectionRange(doc, "文档里没有的变体"), null);

console.log("mapping-change.test.js：全部断言通过");

#!/usr/bin/env node
"use strict";

// 族 ↔ 生成器分支的交叉门禁。
//
// 背景：映射表是机器真值源，`gen-mtslg-mapping-from-dsl.js` 按 `match.family` 分派发射结构。
// 只有映射表长出新族、生成器没有对应分支时**不会有任何报错**——命中实例会静默落进末尾的
// 兜底按钮组路径，产出一个结构错的页面（不是失败，是"看起来成功"）。所以两件事必须对上：
//   1) 映射表里"带 variants 的模板族"集合 == 生成器登记的 SUPPORTED_TEMPLATE_FAMILIES（双向）；
//   2) 登记表里除兜底族（componentTemplates）外，每个族在生成器源码里真有对应的发射分支。
// 生成器是 CLI 线性脚本（顶层即入口），require 它会立刻因缺 --dsl 抛错，所以这里按**源码解析**
// 读取那张登记表——登记表的写法是稳定的字面量数组，解析契约就是它本身（见生成器里的注释）。

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const { loadTemplateMap } = require(path.join(__dirname, "..", "lib", "load-template-map.js"));

const SCRIPTS = path.join(__dirname, "..");
const GENERATOR = path.join(SCRIPTS, "adapters", "mtslg-iocontrol", "gen-mtslg-mapping-from-dsl.js");
const MAP = path.join(SCRIPTS, "..", "references", "adapters", "mtslg-iocontrol", "mtslg-iocontrol-map.json");
// 兜底族：没有显式 `match.family ===` 分支，走生成器末尾的按钮组路径。
const FALLBACK_FAMILY = "componentTemplates";

const generatorSource = fs.readFileSync(GENERATOR, "utf8");
const templateMap = loadTemplateMap(MAP);

// 1) 读登记表（生成器里的 `const SUPPORTED_TEMPLATE_FAMILIES = [ ... ];`）。
const declared = generatorSource.match(/const SUPPORTED_TEMPLATE_FAMILIES = \[([\s\S]*?)\];/);
assert.ok(declared, "生成器必须声明 SUPPORTED_TEMPLATE_FAMILIES（模板族 ↔ 发射分支的登记表）");
const supported = [...declared[1].matchAll(/"([^"]+)"/g)].map((match) => match[1]);
assert.strictEqual(new Set(supported).size, supported.length,
  "SUPPORTED_TEMPLATE_FAMILIES 不得有重复项: " + JSON.stringify(supported));
assert.ok(supported.includes(FALLBACK_FAMILY),
  "登记表必须包含兜底族 " + FALLBACK_FAMILY + "（它同样是一个受支持的族）");

// 2) 映射表侧：带 variants 的模板族。
const mapped = Object.entries(templateMap)
  .filter(([family, spec]) => family.endsWith("Templates") && !family.startsWith("_") &&
    spec && typeof spec === "object" && spec.variants && typeof spec.variants === "object" &&
    Object.keys(spec.variants).length > 0)
  .map(([family]) => family);

const missingInGenerator = mapped.filter((family) => !supported.includes(family));
const missingInMap = supported.filter((family) => !mapped.includes(family));
assert.deepStrictEqual(missingInGenerator, [],
  "映射表登记了这些族，但生成器的 SUPPORTED_TEMPLATE_FAMILIES 没登记（新增族要同时写发射分支并登记）: " +
  JSON.stringify(missingInGenerator));
assert.deepStrictEqual(missingInMap, [],
  "生成器登记了这些族，但映射表里没有（族被删除/改名后登记表没同步）: " + JSON.stringify(missingInMap));

// 3) 登记 ≠ 实现：除兜底族外，每个族都要在源码里有真实的发射分支条件。
//    只登记不写分支时，命中实例会静默落进兜底路径，这条断言就是防这个。
for (const family of supported) {
  if (family === FALLBACK_FAMILY) continue;
  assert.ok(generatorSource.includes(`match.family === "${family}"`),
    "登记了族 " + family + "，但生成器源码里找不到它的发射分支（`match.family === \"" + family + "\"`）——" +
    "只登记不写分支会让实例静默走兜底按钮组路径");
}

console.log("PASS 模板族 ↔ 生成器分支门禁（映射表 " + mapped.length + " 族 ↔ 登记表 " + supported.length +
  " 族，双向相等且分支齐备）");

#!/usr/bin/env node
"use strict";

// list-lang-sources 回归：它必须在「写译文」这一步就把「派生不出语义键、必须补术语表」的文案报出来。
// 背景：单字符之类的文案（X / Y / Z）本身派生不出合格标识符，会落成临时键；
// 而临时键要到第 11 步门禁才失败——执行者此时已经写完译文，只能整段返工。
// 本用例钉住「提前报」这件事，并确认判定口径与真实生成器同源（换术语表就不报了）。

const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");

const cli = path.join(__dirname, "..", "list-lang-sources.mjs");
const root = fs.mkdtempSync(path.join(os.tmpdir(), "mtslg-lang-sources-"));

const mappingFile = path.join(root, "Demo.mapping.json");
fs.writeFileSync(mappingFile, JSON.stringify({
  nodes: [
    { ref: "1:1", sourceRef: "1:1", valueSource: "dsl.text", sourceText: "X", controlType: "TextBlock" },
    { ref: "2:2", sourceRef: "2:2", valueSource: "dsl.text", sourceText: "镜头倍率", controlType: "TextBlock" }
  ],
  textAudit: []
}, null, 2), "utf8");

const translationsFile = path.join(root, "Demo.lang-translations.json");
fs.writeFileSync(translationsFile, JSON.stringify({ "镜头倍率": "Lens Magnification", "X": "X" }, null, 2), "utf8");

const glossaryFile = path.join(root, "Demo.lang-glossary.json");
fs.writeFileSync(glossaryFile, JSON.stringify({ "X": "XAxis" }, null, 2), "utf8");

const run = (extra) => spawnSync(process.execPath,
  [cli, mappingFile, "--page-name", "Demo", "--translations", translationsFile].concat(extra || []),
  { encoding: "utf8" });

// 1) 有译文、没有术语表：单字符 X 必须落进「必须补术语表」组（并给出它会落成的临时键）
let result = run([]);
assert.strictEqual(result.status, 0, result.stderr);
const groups = (text) => ({
  glossary: text.slice(text.indexOf("必须补术语表条目"), text.indexOf("还缺译文")),
  translation: text.slice(text.indexOf("还缺译文"))
});
let g = groups(result.stdout);
assert.match(g.glossary, /"X"/, "单字符 X 必须被列出：它与英文译文一致且长度为 1，派生不出语义键");
assert.match(g.glossary, /DemoText01/, "必须给出它会落成的临时键，便于对照第 11 步的报错");
assert.doesNotMatch(g.glossary, /"镜头倍率"/, "有合格英文译文的文案不该被误报");
assert.match(g.translation, /（无）/);

// 2) 给了术语表：同一份数据不再报——证明判定口径与真实生成器同源，不是另一套规则
result = run(["--glossary", glossaryFile]);
assert.strictEqual(result.status, 0, result.stderr);
assert.match(groups(result.stdout).glossary, /（无）/, "补上术语表后「必须补术语表」组必须为空");

// 3) 还没写译文时也要能分清两类：X 派生不出的原因是"单字符形态"、与有没有译文无关，
//    必须在第一次调用就落进「必须补术语表」；中文文案只是缺译文，落「还没有译文」组。
//    这正是执行者最容易漏掉的那次返工：他写译文时还没跑过第 11 步。
result = spawnSync(process.execPath, [cli, mappingFile, "--page-name", "Demo"], { encoding: "utf8" });
assert.strictEqual(result.status, 0, result.stderr);
g = groups(result.stdout);
assert.match(g.glossary, /"X"/, "单字符形态与有没有译文无关，必须提示补术语表");
assert.doesNotMatch(g.glossary, /"镜头倍率"/, "缺译文的中文文案不能混进术语表组");
assert.match(g.translation, /"镜头倍率"/, "没有译文的中文文案应落进「还没有译文」组");

console.log("list-lang-sources: all cases passed");

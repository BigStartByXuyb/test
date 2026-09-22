#!/usr/bin/env node
"use strict";

// 一键流水线契约文档的防漂移回归：
// 步骤契约（输入 / 产物 / 失败 / 怎么修）的唯一真值源是 run-all.ps1 的 `$Steps`（`-List -Format json` 暴露），
// 文档 pipeline-contract.md 由 gen-pipeline-contract.mjs 生成。这里重新生成并比对，手改文档（或改了脚本忘记重新生成）
// 都会失败——避免回到"SKILL.md 与参考文档各写一份流水线说明、改一处漏一处"的老问题。

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");
const { loadPipelineSteps } = require(path.join(__dirname, "..", "lib", "pipeline-steps.js"));

const SCRIPTS = path.join(__dirname, "..");
const SKILL = path.join(SCRIPTS, "..");
const GENERATOR = path.join(SCRIPTS, "gen-pipeline-contract.mjs");
const CONTRACT_DOC = path.join(SKILL, "references", "adapters", "mtslg-iocontrol", "pipeline-contract.md");
const RUN_ALL = path.join(SCRIPTS, "run-all.ps1");

const runAllSource = fs.readFileSync(RUN_ALL, "utf8");
const contractDoc = fs.readFileSync(CONTRACT_DOC, "utf8");

// 1) 脚本侧：12 步、契约字段齐备、没有空字段。
// 读取只有一份实现（lib/pipeline-steps.js）：走 run-all.ps1 -OutFile 的文件通道（UTF-8），
// 契约字段齐备/非空数组由它 fail-closed 保证，这里只断言**契约本身**（步数、名字、顺序、Id 连续）。
const steps = loadPipelineSteps(RUN_ALL);
assert.strictEqual(steps.length, 12, "一键流水线必须是 12 步");
const expectedNames = ["fetch", "capture", "svg", "visibility", "mapping", "discover",
  "ledger", "layout", "inputs", "bundle", "gates", "verify"];
assert.deepStrictEqual(steps.map((step) => step.Name), expectedNames, "步骤名与顺序必须稳定（断点续跑按名字定位）");
steps.forEach((step, index) => {
  assert.strictEqual(step.Id, index + 1, `步骤 ${step.Name} 的 Id 必须连续`);
  assert.ok(step.Title && String(step.Title).trim(), `步骤 ${step.Name} 必须提供 Title`);
  assert.ok(runAllSource.includes(`Name = '${step.Name}'`), `run-all.ps1 里必须能查到步骤 ${step.Name}`);
});

// 2) 文档侧：生成的文档与脚本一致（--check 重新生成比对）。
execFileSync(process.execPath, [GENERATOR, "--check"], { encoding: "utf8", stdio: "pipe" });

// 3) 文档必须覆盖每一步的四个字段标题，且不夹带手写步骤表。
for (const step of steps) {
  assert.ok(contractDoc.includes(`### ${step.Id}. \`${step.Name}\``),
    `契约文档必须为第 ${step.Id} 步生成小节: ${step.Name}`);
}
for (const label of ["**输入**", "**产物**", "**失败语义**", "**怎么修**"]) {
  assert.ok(contractDoc.includes(label), "契约文档必须写明字段 " + label);
}
assert.ok(contractDoc.includes("真值源是脚本"),
  "契约文档必须写明真值源是 run-all.ps1，而不是文档本身");
assert.ok(contractDoc.includes("一条命令跑完全部 12 步"),
  "契约文档必须写明一条命令跑完全部 12 步（12 个阶段用于定位失败与续跑，不是逐步手工调用）");
// 示例命令与「同名目标默认停止」的替换口径必须一致：主示例不带 -Overwrite。
assert.ok(contractDoc.includes("首次生成：不加 -Overwrite"),
  "契约文档的主示例必须标明「首次生成不加 -Overwrite」");
assert.ok(contractDoc.includes("仅用户明确要求替换时"),
  "契约文档必须把 -Overwrite 单列为「仅用户明确要求替换时」");
// 第 1 步失败语义必须覆盖本次新增的两类真实失败：多页登记表未命中、MCP 业务错误码。
assert.ok(contractDoc.includes("没用 -Target/-LayerId 命中本次页面"),
  "第 1 步失败语义必须写明多页登记表未命中本次页面");
assert.ok(contractDoc.includes("MCP 返回业务错误码"),
  "第 1 步失败语义必须写明 MCP 业务错误码");
assert.ok(contractDoc.includes("-Target <Target> -Progress <步骤名>"),
  "续跑示例必须带目标信息（与 SKILL.md 同一口径）");
assert.ok(contractDoc.includes("只给 `-Progress` 时脚本取不到本次页面的来源"),
  "契约文档必须写明只给 -Progress 会取不到来源");

// 4) 编码回归：把控制台输出编码设成 GBK(936) 之后再跑 --check，必须仍然 PASS。
//    背景：契约原先是 `pwsh -List -Format json` 写 stdout 再由 Node 读——经过 GBK 控制台编码后，
//    中文全变成替换字符 U+FFFD，而 `JSON.parse` **不会失败**，坏掉的是内容（本机必现，实测
//    `Title` 会变成 `ȡ�� getDsl…`）。现在契约走 run-all.ps1 -OutFile 的文件通道（UTF-8），
//    与控制台代码页无关；这条用例把它钉住，防止有人把读取改回 stdout。
const gbkCheck = execFileSync("pwsh", ["-NoProfile", "-Command",
  "[Console]::OutputEncoding = [Text.Encoding]::GetEncoding(936); & '" + process.execPath + "' '" + GENERATOR + "' --check"],
  { encoding: "utf8", stdio: "pipe" });
assert.ok(gbkCheck.includes("PASS"), "GBK(936) 控制台编码下 --check 仍必须 PASS: " + gbkCheck);

console.log("PASS 一键流水线契约（run-all.ps1 $Steps ↔ pipeline-contract.md）一致性回归测试");

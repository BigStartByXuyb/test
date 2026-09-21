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

const SCRIPTS = path.join(__dirname, "..");
const SKILL = path.join(SCRIPTS, "..");
const GENERATOR = path.join(SCRIPTS, "gen-pipeline-contract.mjs");
const CONTRACT_DOC = path.join(SKILL, "references", "adapters", "mtslg-iocontrol", "pipeline-contract.md");
const RUN_ALL = path.join(SCRIPTS, "run-all.ps1");

const runAllSource = fs.readFileSync(RUN_ALL, "utf8");
const contractDoc = fs.readFileSync(CONTRACT_DOC, "utf8");

// 1) 脚本侧：12 步、契约字段齐备、没有空字段。
const steps = JSON.parse(execFileSync("pwsh", ["-NoProfile", "-File", RUN_ALL, "-List", "-Format", "json"], {
  encoding: "utf8",
  maxBuffer: 8 * 1024 * 1024,
}));
assert.strictEqual(steps.length, 12, "一键流水线必须是 12 步");
const expectedNames = ["fetch", "capture", "svg", "visibility", "mapping", "discover",
  "ledger", "layout", "inputs", "bundle", "gates", "verify"];
assert.deepStrictEqual(steps.map((step) => step.Name), expectedNames, "步骤名与顺序必须稳定（断点续跑按名字定位）");
steps.forEach((step, index) => {
  assert.strictEqual(step.Id, index + 1, `步骤 ${step.Name} 的 Id 必须连续`);
  for (const field of ["Title", "Inputs", "Outputs", "Failures", "Recovery"]) {
    assert.ok(step[field], `步骤 ${step.Name} 必须提供 ${field}`);
  }
  for (const field of ["Inputs", "Outputs", "Failures", "Recovery"]) {
    assert.ok(Array.isArray(step[field]) && step[field].length > 0 && step[field].every((item) => String(item).trim()),
      `步骤 ${step.Name} 的 ${field} 必须是非空字符串数组`);
  }
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

console.log("PASS 一键流水线契约（run-all.ps1 $Steps ↔ pipeline-contract.md）一致性回归测试");

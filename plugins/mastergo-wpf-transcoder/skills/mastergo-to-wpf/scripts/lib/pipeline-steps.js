#!/usr/bin/env node
"use strict";

// 步骤契约（run-all.ps1 的 `$Steps`）的**唯一读取实现**：CJS 消费者直接 require，
// ESM 消费者用 createRequire（与 check-coords.mjs 同一模式）。禁止再各抄一份。
//
// 为什么必须走文件而不是 stdout：`pwsh -List -Format json` 的输出要经过控制台代码页。
// 本机控制台是 GBK，`ConvertTo-Json` 写出的中文会被替换成 U+FFFD —— `JSON.parse` 照样成功，
// 坏掉的是内容本身（步骤标题、失败语义全变成问号），而且这台机器上必现。所以真值传递改走
// `-OutFile`（PS7 下 `Set-Content -Encoding UTF8` 无 BOM），本模块负责生成临时文件、调用、读回。
//
// 失败口径：拿到文件之前/之后的任何异常都直接抛错 —— 文件不存在、含替换字符 U+FFFD、
// 不是合法 JSON、步骤数组为空、契约字段缺失或为空数组，一律 fail-closed。
// 宁可在这里停住，也不让"读坏了的内容"继续去渲染契约文档（那会把编码事故变成文档事故）。

const fs = require("fs");
const os = require("os");
const path = require("path");
const { execFileSync } = require("child_process");

// 步骤对象的契约字段：7 个都要在，其中 4 个必须是非空字符串数组。
const CONTRACT_FIELDS = ["Id", "Name", "Title", "Inputs", "Outputs", "Failures", "Recovery"];
const LIST_FIELDS = ["Inputs", "Outputs", "Failures", "Recovery"];

function loadPipelineSteps(runAllPath) {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "run-all-steps-"));
  const tmpFile = path.join(tmpDir, "steps.json");
  try {
    execFileSync(
      "pwsh",
      ["-NoProfile", "-File", runAllPath, "-List", "-Format", "json", "-OutFile", tmpFile],
      { encoding: "utf8", stdio: "pipe", maxBuffer: 8 * 1024 * 1024 }
    );
    if (!fs.existsSync(tmpFile)) {
      throw new Error("run-all.ps1 -List -Format json -OutFile 没有产出步骤契约文件: " + tmpFile);
    }
    const raw = fs.readFileSync(tmpFile, "utf8").replace(/^\uFEFF/, "");
    if (raw.includes("\uFFFD")) {
      throw new Error("步骤契约出现替换字符 U+FFFD（编码损坏，说明没有走 -OutFile 文件通道）");
    }
    let steps;
    try {
      steps = JSON.parse(raw);
    }
    catch (error) {
      throw new Error("步骤契约不是合法 JSON: " + error.message);
    }
    if (!Array.isArray(steps) || steps.length === 0) {
      throw new Error("run-all.ps1 -List -Format json 没有返回步骤数组");
    }
    for (const step of steps) {
      for (const field of CONTRACT_FIELDS) {
        if (step[field] === undefined || step[field] === null) {
          throw new Error(`步骤 ${step.Name || step.Id} 缺少契约字段 ${field}`);
        }
      }
      for (const field of LIST_FIELDS) {
        if (!Array.isArray(step[field]) || step[field].length === 0) {
          throw new Error(`步骤 ${step.Name} 的 ${field} 必须是非空数组`);
        }
      }
    }
    return steps;
  }
  finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

module.exports = { loadPipelineSteps };

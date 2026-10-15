#!/usr/bin/env node
"use strict";

// 作业A 门禁 R7 的槽位豁免回归。
//
// 背景：映射表在值槽位登记 langRefPolicy=none 的节点（当前只有选择框的 Value，如设计稿里的 "Auto"）
// 运行时由数据决定、不参与多语言 —— Bundle 侧把它记进 valueLangExempt，SKILL.md 也把它写成"全量产键"
// 的唯一例外。A 门禁的 R7 曾经不认这条登记，于是同一页在 A 路线恒失败（2026-09-29 在 SSD 隐切项目复现）。
//
// 本文件锁三件事：
//   1) langRefPolicy=none 的节点没有 LangName 也不报 R7；
//   2) 同样有设计文本、但没有该登记的节点仍然报 R7（fail-closed 不许被这次放宽带松）；
//   3) 已挂 LangName 的节点不报 R7。

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");
const { tmpDir } = require(path.join(__dirname, "helpers", "tmp-dir.js"));

const SCRIPT_DIR = path.join(__dirname, "..");
const CHECK = path.join(SCRIPT_DIR, "adapters", "mw-wpf", "check-wpf-layout.js");
const MAP = path.join(SCRIPT_DIR, "..", "references", "adapters", "mw-wpf", "mw-wpf-map.json");

const tmp = tmpDir("wpf-lang-exempt-");
let seq = 0;

function writeJson(name, value) {
  const file = path.join(tmp, (++seq) + "-" + name);
  fs.writeFileSync(file, JSON.stringify(value, null, 2), "utf8");
  return file;
}

// 一个最小的发射区：一行一列，一个格子。门禁的 R8 要求行列来源是设计稿。
const LAYOUT = {
  pageTarget: "ProbePage",
  design: { width: 200, height: 40 },
  regions: [
    {
      id: "work-area",
      role: "work-area",
      emit: true,
      rows: [{ size: "Pixel", value: 40, source: "design" }],
      columns: [{ size: "Pixel", value: 200, source: "design" }],
      grid: {
        rows: [{ size: "Pixel", value: 40, source: "design" }],
        columns: [{ size: "Pixel", value: 200, source: "design" }],
        cells: [{ ref: "1:1", row: 0, column: 0, rowSpan: 1, columnSpan: 1, controlType: "ComboBox" }]
      }
    }
  ],
  pending: [],
  constraintExempt: []
};

function runGate(node) {
  const layoutPath = writeJson("layout.json", LAYOUT);
  const typesPath = writeJson("types.json", { nodes: [node] });
  const reportPath = path.join(tmp, "report-" + (++seq) + ".json");
  const result = spawnSync(
    process.execPath,
    [CHECK, "--layout", layoutPath, "--types", typesPath, "--map", MAP, "--json", reportPath],
    { encoding: "utf8" }
  );
  assert.strictEqual(result.status === null, false, "门禁进程没有正常结束");
  return { status: result.status, report: JSON.parse(fs.readFileSync(reportPath, "utf8")) };
}

// ① 值槽位豁免：有设计文本、没有 LangName，但登记了 langRefPolicy=none —— 不报 R7。
{
  const outcome = runGate({
    ref: "1:1",
    sourceRef: "1:1",
    sourceText: "Auto",
    valueSource: "dsl.text",
    controlType: "ComboBox",
    attrs: { Value: "Auto" },
    langRefPolicy: "none"
  });
  assert.strictEqual(outcome.report.counts.R7, undefined,
    "值槽位登记 langRefPolicy=none 的节点不得被 R7 判成缺语言键：" + JSON.stringify(outcome.report.findings));
  assert.strictEqual(outcome.status, 0, "豁免节点应放行（exit 0），实际 exit=" + outcome.status);
}

// ② 没有该登记的同类文本仍然失败：豁免只认 langRefPolicy，不认"文本像英文/像数值"。
{
  const outcome = runGate({
    ref: "1:1",
    sourceRef: "1:1",
    sourceText: "Auto",
    valueSource: "dsl.text",
    controlType: "ComboBox",
    attrs: { Value: "Auto" }
  });
  assert.strictEqual(outcome.report.counts.R7, 1, "没有 langRefPolicy 的文本必须照旧报 R7");
  assert.strictEqual(outcome.status, 2, "R7 是失败条目（exit 2），实际 exit=" + outcome.status);
}

// ③ 已挂语言键的节点不报。
{
  const outcome = runGate({
    ref: "1:1",
    sourceRef: "1:1",
    sourceText: "自动",
    valueSource: "dsl.text",
    controlType: "ComboBox",
    attrs: { LangName: "ProbePageAuto" }
  });
  assert.strictEqual(outcome.report.counts.R7, undefined, "挂了 LangName 的节点不得报 R7");
}

// ④ 容器内层 Grid 同样要查：R7 不递归的话，"分组框套控件"的文本会整层漏过。
{
  const nested = JSON.parse(JSON.stringify(LAYOUT));
  nested.regions[0].grid.cells = [
    {
      ref: "1:2",
      row: 0,
      column: 0,
      rowSpan: 1,
      columnSpan: 1,
      controlType: "GroupBox",
      container: true,
      children: {
        rows: [{ size: "Pixel", value: 40, source: "design" }],
        columns: [{ size: "Pixel", value: 200, source: "design" }],
        cells: [{ ref: "1:2/9:1", row: 0, column: 0, rowSpan: 1, columnSpan: 1, controlType: "ComboBox" }]
      }
    }
  ];
  const layoutPath = writeJson("layout-nested.json", nested);
  const typesPath = writeJson("types-nested.json", {
    nodes: [
      { ref: "1:2", sourceRef: "1:2", controlType: "GroupBox", container: true, attrs: {} },
      { ref: "1:2/9:1", sourceRef: "1:2/9:1", sourceText: "Auto", valueSource: "dsl.text", controlType: "ComboBox", attrs: { Value: "Auto" } }
    ]
  });
  const reportPath = path.join(tmp, "nested-report.json");
  const result = spawnSync(
    process.execPath,
    [CHECK, "--layout", layoutPath, "--types", typesPath, "--map", MAP, "--json", reportPath],
    { encoding: "utf8" }
  );
  const report = JSON.parse(fs.readFileSync(reportPath, "utf8"));
  assert.strictEqual(report.counts.R7, 1, "容器内层没有语言键的文本必须被 R7 拦下");
  assert.strictEqual(result.status, 2, "内层缺键同样失败（exit 2）");
}

console.log("wpf-lang-exempt 全部通过");

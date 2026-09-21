#!/usr/bin/env node
"use strict";

// 图标坐标扫描器回归：必须真的扫到现行产物形态（<Geometry o:Freeze="True" x:Key="…">…</Geometry>）。
// 背景：旧实现匹配的是 <Viewbox x:Key="…"><Canvas …>…，对现行 Geometry 产物完全匹配不到，
// 于是无论图标坐标是否归一化都打印"全部正常"——这是假通过，比不扫更危险。

const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");

const script = path.join(__dirname, "..", "scan-icon-coords.js");
const root = fs.mkdtempSync(path.join(os.tmpdir(), "mastergo-icon-coords-"));

// 1) 现行形态 + 一个未归一化的图标（最小坐标 -40）
const xaml = [
  '<ResourceDictionary xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation">',
  '  <Geometry o:Freeze="True" x:Key="LoadGeometry">',
  '    M 0 0 L 16 0 L 16 16 L 0 16 Z',
  '  </Geometry>',
  '  <Geometry o:Freeze="True" x:Key="ShiftedGeometry">',
  '    M -40 -30 L -20 -30 L -20 -10 Z',
  '  </Geometry>',
  '</ResourceDictionary>',
  '',
].join("\n");
const xamlPath = path.join(root, "DemoIcons.xaml");
fs.writeFileSync(xamlPath, xaml, "utf8");

const run = spawnSync(process.execPath, [script, xamlPath], { encoding: "utf8" });
assert.strictEqual(run.status, 0, "扫描器正常结束: " + run.stderr);
assert.match(run.stdout, /LoadGeometry/, "必须真的扫到现行 Geometry 键");
assert.match(run.stdout, /ShiftedGeometry/, "必须扫到第二个 Geometry 键");
assert.match(run.stdout, /ShiftedGeometry\s+范围 -40\.0/,
  "必须报告被平移过的图标范围（否则等于空转）");
assert.match(run.stdout, /1 个图标坐标需要修复/, "必须数出未归一化的图标");
assert.doesNotMatch(run.stdout, /全部正常/, "不得再出现'全部正常'这种扫描不到也报通过的说法");

// 2) 空字典（全部图标由运行时提供）是合法产物：明确报告跳过，不伪装成通过
const emptyPath = path.join(root, "EmptyIcons.xaml");
fs.writeFileSync(emptyPath,
  '<ResourceDictionary xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"></ResourceDictionary>\n', "utf8");
const emptyRun = spawnSync(process.execPath, [script, emptyPath], { encoding: "utf8" });
assert.strictEqual(emptyRun.status, 0, "空字典必须正常结束: " + emptyRun.stderr);
assert.match(emptyRun.stdout, /没有页面级 Geometry/, "空字典必须明确报告跳过坐标扫描");
assert.doesNotMatch(emptyRun.stdout, /全部正常/, "空字典不得报告'正常'");

console.log("PASS 图标坐标扫描（现行 Geometry 产物形态 + 空字典跳过）回归测试");

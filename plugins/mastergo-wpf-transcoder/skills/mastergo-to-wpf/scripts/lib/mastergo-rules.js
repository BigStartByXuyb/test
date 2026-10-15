#!/usr/bin/env node
"use strict";

// MasterGo DSL 层面的共用判定规则：唯一实现，禁止各脚本再抄一份。
// scripts/tests/script-duplication.test.js 守护「同一个功能不许再复制一份」。

// 宿主壳（顶部栏 / 底部栏 / 常驻信息）判定：按祖先节点名里的标记词。
// 规则来源见 references/adapters/mtslg-iocontrol/mtslg-mode.md 的宿主壳边界一节。
const HOST_SHELL_NAME_MARKERS = ["顶部栏", "底部", "常驻信息"];

function isHostShellName(name) {
  const text = String(name === undefined || name === null ? "" : name);
  return HOST_SHELL_NAME_MARKERS.some(function (marker) { return text.includes(marker); });
}

module.exports = { HOST_SHELL_NAME_MARKERS: HOST_SHELL_NAME_MARKERS, isHostShellName: isHostShellName };

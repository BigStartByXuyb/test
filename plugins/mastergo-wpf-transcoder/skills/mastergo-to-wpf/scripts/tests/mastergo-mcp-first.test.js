#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");

const skillPath = path.join(__dirname, "..", "..", "SKILL.md");
const skill = fs.readFileSync(skillPath, "utf8");

function assert(condition, message) {
  if (!condition) throw new Error("断言失败: " + message);
}

// 断言的是当前契约本身（MCP 一次性读取、只落盘、不读图、不可用时停止），不是历史措辞：
// SKILL.md 只保留模型必须执行的判断，细节在 call-mastergo-mcp.js 与 pipeline-contract.md。
assert(skill.includes("getDsl"), "Skill 必须强制使用一次性 getDsl");
assert(skill.includes("完整 DSL"), "Skill 必须明确一次性读取当前图层的完整 DSL");
assert(skill.includes("call-mastergo-mcp.js"), "Skill 必须点名只落盘的 MCP 调用脚本");
assert(skill.includes("响应只落盘"), "Skill 必须要求 MCP 响应只落盘、不进上下文");
assert(skill.includes("extractSvg"), "Skill 必须列出 MasterGo SVG 步骤");
assert(skill.includes("停止本次转换并报告原因"), "MCP 不可用时必须停止并报告，不得换数据来源");
assert(skill.includes("不得用浏览器"), "浏览器/截图不得替代 MasterGo MCP");
assert(skill.includes("不读图"), "Skill 必须声明转换链路不读图");
assert(!skill.includes("getDesignSections"), "Skill 不得保留分段总览接口");
assert(!skill.includes("sectionIndex"), "Skill 不得保留 sectionIndex 采集语义");

console.log("PASS MasterGo MCP-first workflow contract test");

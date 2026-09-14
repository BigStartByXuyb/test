#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");

const skillPath = path.join(__dirname, "..", "..", "SKILL.md");
const skill = fs.readFileSync(skillPath, "utf8");

function assert(condition, message) {
  if (!condition) throw new Error("断言失败: " + message);
}

assert(skill.includes("MasterGo MCP 一次性读取门禁"), "Skill 必须声明 MasterGo MCP 一次性读取门禁");
assert(skill.includes("getDsl"), "Skill 必须强制使用一次性 getDsl");
assert(skill.includes("完整页面"), "Skill 必须明确一次性读取完整页面");
assert(skill.includes("extractSvg"), "Skill 必须列出 MasterGo SVG MCP");
assert(skill.includes("不得先用浏览器页面"), "浏览器不得优先于 MasterGo MCP");
assert(skill.includes("@mastergo/magic-mcp"), "Skill 必须检查官方 MasterGo MCP 服务");
assert(!skill.includes("getDesignSections"), "Skill 不得保留分段总览接口");
assert(!skill.includes("sectionIndex"), "Skill 不得保留 sectionIndex 采集语义");

console.log("PASS MasterGo MCP-first workflow contract test");

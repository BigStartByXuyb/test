#!/usr/bin/env node
"use strict";

// 契约测试：MasterGo MCP 调用必须"只落盘"，响应内容不得出现在 stdout/stderr。
const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");

const script = path.join(__dirname, "..", "call-mastergo-mcp.js");
const root = fs.mkdtempSync(path.join(os.tmpdir(), "mastergo-mcp-call-"));

const PAYLOAD_MARKER = "PAYLOAD_MARKER_SHOULD_NOT_APPEAR_IN_CONTEXT";
const payload = JSON.stringify({
  dsl: { styles: {}, nodes: [{ id: "3:1", name: "page", marker: PAYLOAD_MARKER, children: [] }] },
  componentDocumentLinks: [],
  rules: [],
});
const payloadPath = path.join(root, "payload.json");
fs.writeFileSync(payloadPath, payload, "utf8");

// 桩：实现最小 MCP stdio 协议，返回一段"像整页 DSL"的大 JSON
const stubPath = path.join(root, "stub-mcp.js");
const stubLines = [
  "const fs = require('fs');",
  "const payload = fs.readFileSync(" + JSON.stringify(payloadPath) + ", 'utf8');",
  "let buffer = '';",
  "function reply(id, result) { process.stdout.write(JSON.stringify({ jsonrpc: '2.0', id: id, result: result }) + '\\n'); }",
  "process.stdin.on('data', (chunk) => {",
  "  buffer += chunk.toString('utf8');",
  "  let index = buffer.indexOf('\\n');",
  "  while (index >= 0) {",
  "    const line = buffer.slice(0, index).trim();",
  "    buffer = buffer.slice(index + 1);",
  "    index = buffer.indexOf('\\n');",
  "    if (!line) continue;",
  "    const message = JSON.parse(line);",
  "    if (message.id === undefined) continue;",
  "    if (message.method === 'initialize') { reply(message.id, { protocolVersion: '2024-11-05', capabilities: {} }); continue; }",
  "    if (message.method === 'tools/list') { reply(message.id, { tools: [{ name: 'mcp__getDsl' }, { name: 'mcp__extractSvg' }] }); continue; }",
  "    if (message.method === 'tools/call') {",
  "      if (message.params && message.params.name !== 'mcp__getDsl') {",
  "        reply(message.id, { isError: true, content: [{ type: 'text', text: String(JSON.stringify({ error: 'unknown tool' })) }] });",
  "        continue;",
  "      }",
  "      reply(message.id, { content: [{ type: 'text', text: payload }] });",
  "      continue;",
  "    }",
  "    reply(message.id, {});",
  "  }",
  "});",
  ""
];
fs.writeFileSync(stubPath, stubLines.join("\n"), "utf8");

const outPath = path.join(root, "run", "getDsl.json");
const run = spawnSync(process.execPath, [script,
  "--tool", "getDsl",
  "--fileId", "181586559903927",
  "--layerId", "1508:271307",
  "--format", "json",
  "--out", outPath,
  "--token", "fake-token",
  "--mcp", process.execPath,
  "--mcp-arg", stubPath,
], { encoding: "utf8" });

assert.strictEqual(run.status, 0, "调用器必须成功：" + run.stderr);
assert.strictEqual(fs.readFileSync(outPath, "utf8"), payload, "响应必须原样写入 --out 文件");

const summaryLines = run.stdout.trim().split("\n").filter(Boolean);
assert.strictEqual(summaryLines.length, 1, "stdout 只允许一行摘要 JSON");
const summary = JSON.parse(summaryLines[0]);
assert.strictEqual(summary.tool, "getDsl");
assert.strictEqual(summary.serverTool, "mcp__getDsl", "必须按服务端暴露的工具名调用");
assert.ok(summary.bytes > 0 && summary.isError === false);
assert.ok(run.stdout.indexOf(PAYLOAD_MARKER) < 0, "响应内容不得出现在 stdout（否则会进入模型上下文）");
assert.ok(run.stderr.indexOf(PAYLOAD_MARKER) < 0, "响应内容不得出现在 stderr");
assert.ok(JSON.stringify(summary).indexOf(PAYLOAD_MARKER) < 0, "摘要里不得夹带响应内容");

// 缺 --out / 缺 token 必须拒绝
const noOut = spawnSync(process.execPath, [script, "--tool", "getDsl", "--fileId", "f", "--layerId", "l", "--token", "t"], { encoding: "utf8" });
assert.notStrictEqual(noOut.status, 0, "缺少 --out 必须失败");
assert.match(noOut.stderr, /--out/);

const noToken = spawnSync(process.execPath, [script, "--tool", "getDsl", "--out", path.join(root, "x.json"), "--mcp", process.execPath, "--mcp-arg", stubPath], {
  encoding: "utf8",
  env: Object.assign({}, process.env, { MASTERGO_MCP_TOKEN: "" }),
});
assert.notStrictEqual(noToken.status, 0, "缺少 token 必须失败");
assert.match(noToken.stderr, /token/i);

// --list-tools 只列工具名，不落盘
const listed = spawnSync(process.execPath, [script, "--list-tools", "--token", "t", "--mcp", process.execPath, "--mcp-arg", stubPath], { encoding: "utf8" });
assert.strictEqual(listed.status, 0, listed.stderr);
assert.deepStrictEqual(JSON.parse(listed.stdout.trim()).tools, ["mcp__getDsl", "mcp__extractSvg"]);

// Skill 必须要求走这个脚本，且响应只落盘
const skill = fs.readFileSync(path.join(__dirname, "..", "..", "SKILL.md"), "utf8");
assert.ok(skill.includes("call-mastergo-mcp.js"), "Skill 必须指定通过 call-mastergo-mcp.js 调用 MCP");
assert.ok(skill.includes("只落盘"), "Skill 必须声明响应只落盘、不进上下文");

console.log("PASS MasterGo MCP call-and-persist contract test");

#!/usr/bin/env node
"use strict";

// Real subprocess/stdio tests: no MasterGo credentials, network, or PowerShell.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const { test } = require("node:test");
const cli = path.join(__dirname, "..", "call-mastergo-mcp.js");
const marker = "PRIVATE_DESIGN_PAYLOAD_MUST_NOT_ENTER_CONTEXT";

function captureWithStub(t, config) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "mastergo-stream-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const stubPath = path.join(root, "stub.cjs");
  const tool = config.tool || "getDsl";
  const out = path.join(root, tool + ".json");
  const previous = "existing capture must survive an unsupported response";
  fs.writeFileSync(out, previous);
  fs.writeFileSync(stubPath, `
const readline = require("node:readline");
const config = ${JSON.stringify(config)};
const input = readline.createInterface({ input: process.stdin });
input.on("close", () => process.exit(0));
input.on("line", (line) => {
  const message = JSON.parse(line);
  if (message.id === undefined) return;
  let result = {};
  if (message.method === "initialize") {
    result = { protocolVersion: "2024-11-05", capabilities: {} };
  } else if (message.method === "tools/list") {
    result = { tools: [{ name: "mcp__getDsl" }, { name: "mcp__extractSvg" }] };
  } else if (message.method === "tools/call") {
    if (config.pages) {
      const page = Number((message.params && message.params.arguments && message.params.arguments.page) || 0);
      const payload = config.pages[page];
      if (payload === undefined) throw new Error("unexpected page: " + page);
      result = { content: [{ type: "text", text: JSON.stringify(payload) }] };
    } else {
      result = { content: config.content };
    }
  }
  const bytes = Buffer.from(JSON.stringify({ jsonrpc: "2.0", id: message.id, result }) + "\\n");
  const page = Number((message.params && message.params.arguments && message.params.arguments.page) || 0);
  const delay = message.method === "tools/call" && config.delayPages ? (config.delayPages[page] || 0) : 0;
  if (delay) {
    setTimeout(() => process.stdout.write(bytes), delay);
  } else if (message.method === "tools/call" && config.splitCharacter) {
    const cut = bytes.indexOf(Buffer.from(config.splitCharacter)) + 1;
    if (cut < 1) throw new Error("test character not found");
    process.stdout.write(bytes.subarray(0, cut));
    setTimeout(() => process.stdout.write(bytes.subarray(cut)), 75);
  } else {
    process.stdout.write(bytes);
  }
});
`);
  const args = [
    cli, "--tool", tool, "--out", out, "--token", "fake-token",
    "--mcp", process.execPath, "--mcp-arg", stubPath,
    "--timeoutMs", String(config.timeoutMs === undefined ? 5000 : config.timeoutMs)
  ];
  if (config.pageSize !== undefined) args.push("--pageSize", String(config.pageSize));
  const result = spawnSync(process.execPath, args, { encoding: "utf8", timeout: 10000 });
  assert.ifError(result.error);
  assert.equal(result.signal, null);
  return { ...result, captured: fs.readFileSync(out, "utf8"), previous };
}

for (const splitCharacter of ["汉", "🙂", "é"]) {
  test("MCP preserves UTF-8 when a pipe chunk splits " + splitCharacter, (t) => {
    const payload = JSON.stringify({ text: "汉字🙂é", marker });
    const result = captureWithStub(t, {
      content: [{ type: "text", text: payload }], splitCharacter
    });
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.captured, payload);
    const summary = JSON.parse(result.stdout.trim());
    assert.equal(summary.bytes, Buffer.byteLength(payload));
    assert.equal((result.stdout + result.stderr).includes(marker), false);
  });
}

for (const content of [
  [{ type: "text", text: marker }, { type: "text", text: "second block" }],
  [{ type: "image", mimeType: "image/png", data: marker }],
  [{ type: "text", text: { marker } }]
]) {
  test("unsupported MCP content cannot truncate, overwrite, or leak a capture: " + content[0].type + "/" + content.length, (t) => {
    const result = captureWithStub(t, { content });
    assert.equal(result.status, 4, result.stderr);
    assert.equal(result.captured, result.previous);
    assert.equal((result.stdout + result.stderr).includes(marker), false);
    assert.match(result.stderr, /text content/);
  });
}

// extractSvg 是分页接口（pageSize 上限 100）。只取第一页会让 >100 个图标的页面静默漏条目，
// 因此聚合必须是"拉全 + 合并 + 与 totalCount 对齐"，且不完整时**不写输出文件**。
test("extractSvg aggregation fetches every page and merges them into one capture", (t) => {
  const page0 = { totalCount: 3, count: 2, page: 0, pageSize: 2, hasMore: true, svgs: [{ id: "a" }, { id: "b" }] };
  const page1 = { totalCount: 3, count: 1, page: 1, pageSize: 2, hasMore: false, svgs: [{ id: "c" }] };
  const result = captureWithStub(t, { tool: "extractSvg", pageSize: 2, pages: { 0: page0, 1: page1 } });

  assert.equal(result.status, 0, result.stderr);
  const merged = JSON.parse(result.captured);
  assert.deepEqual(merged.svgs.map((item) => item.id), ["a", "b", "c"]);
  assert.equal(merged.count, 3);
  assert.equal(merged.totalCount, 3);
  assert.equal(merged.hasMore, false);
  assert.equal(merged.pagesFetched, 2);
  const summary = JSON.parse(result.stdout.trim());
  assert.deepEqual(summary.svgPaging, { pages: 2, entries: 3, totalCount: 3 });
});

test("extractSvg aggregation refuses a truncated page set instead of writing it", (t) => {
  // 服务端声称有 3 条却只给 1 条且 hasMore=false：聚合结果与 totalCount 不符 → 失败且保留旧文件。
  const page0 = { totalCount: 3, count: 1, page: 0, pageSize: 2, hasMore: false, svgs: [{ id: "a" }] };
  const result = captureWithStub(t, { tool: "extractSvg", pageSize: 2, pages: { 0: page0 } });

  assert.equal(result.status, 4, result.stderr);
  assert.equal(result.captured, result.previous);
  assert.match(result.stderr, /分页聚合不完整/);
});

test("extractSvg aggregation stops at the page cap when hasMore never clears", (t) => {
  const pages = {};
  for (let index = 0; index < 200; index += 1) {
    pages[index] = { totalCount: 999, count: 1, page: index, pageSize: 1, hasMore: true, svgs: [{ id: "x" + index }] };
  }
  const result = captureWithStub(t, { tool: "extractSvg", pageSize: 1, pages });

  assert.equal(result.status, 4, result.stderr);
  assert.equal(result.captured, result.previous);
  assert.match(result.stderr, /超过上限/);
});

// 回归（v1.0.246 语义审计 REVIEW-002）：分页聚合会发多次 tools/call，超时窗口必须**按请求重新武装**。
// 改造前定时器在首个响应后就被清掉，第 2 页及以后卡住会让脚本永久挂起（而不是按契约以非零码退出）。
test("extractSvg pagination keeps each page request under the timeout window", (t) => {
  const page0 = { totalCount: 2, count: 1, page: 0, pageSize: 1, hasMore: true, svgs: [{ id: "a" }] };
  const page1 = { totalCount: 2, count: 1, page: 1, pageSize: 1, hasMore: false, svgs: [{ id: "b" }] };
  const result = captureWithStub(t, {
    tool: "extractSvg", pageSize: 1, timeoutMs: 400,
    pages: { 0: page0, 1: page1 }, delayPages: { 1: 2000 }
  });

  assert.equal(result.status, 3, "第 2 页超时必须按超时失败码退出，而不是无限挂起");
  assert.match(result.stderr, /超时/);
  assert.equal(result.captured, result.previous);
});

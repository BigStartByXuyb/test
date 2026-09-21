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
  const out = path.join(root, "getDsl.json");
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
    result = { tools: [{ name: "mcp__getDsl" }] };
  } else if (message.method === "tools/call") {
    result = { content: config.content };
  }
  const bytes = Buffer.from(JSON.stringify({ jsonrpc: "2.0", id: message.id, result }) + "\\n");
  if (message.method === "tools/call" && config.splitCharacter) {
    const cut = bytes.indexOf(Buffer.from(config.splitCharacter)) + 1;
    if (cut < 1) throw new Error("test character not found");
    process.stdout.write(bytes.subarray(0, cut));
    setTimeout(() => process.stdout.write(bytes.subarray(cut)), 75);
  } else {
    process.stdout.write(bytes);
  }
});
`);
  const result = spawnSync(process.execPath, [
    cli, "--tool", "getDsl", "--out", out, "--token", "fake-token",
    "--mcp", process.execPath, "--mcp-arg", stubPath, "--timeoutMs", "5000"
  ], { encoding: "utf8", timeout: 10000 });
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
